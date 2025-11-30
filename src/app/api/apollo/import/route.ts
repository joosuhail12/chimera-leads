import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

const textEncoder = new TextEncoder();

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const mappingRaw = formData.get('mapping');
    const dataType = (formData.get('dataType') as string) || 'leads';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (dataType !== 'leads') {
      return NextResponse.json(
        { error: 'Company imports are not yet supported. Please import leads.' },
        { status: 400 }
      );
    }

    const mapping = mappingRaw ? JSON.parse(mappingRaw as string) : {};
    const content = await file.text();
    const rows = parseFile(content, file.name);

    const normalized = rows.map((row) => normalizeRow(row, mapping));
    const supabase = await createClient();

    const stream = new ReadableStream({
      async start(controller) {
        const totals = {
          total: normalized.length,
          success: 0,
          failed: 0,
          duplicates: 0,
          errors: [] as Array<{ row: number; field: string; message: string }>,
        };

        for (let index = 0; index < normalized.length; index++) {
          const record = normalized[index];
          const progress = Math.round(((index + 1) / normalized.length) * 100);

          const result = await upsertLead(record, supabase, orgId);
          if (result.status === 'success') {
            totals.success++;
          } else if (result.status === 'duplicate') {
            totals.duplicates++;
          } else {
            totals.failed++;
            totals.errors.push({
              row: index + 1,
              field: result.field ?? 'unknown',
              message: result.message ?? 'Unknown error',
            });
          }

          controller.enqueue(
            textEncoder.encode(JSON.stringify({ progress }) + '\n')
          );
        }

        controller.enqueue(textEncoder.encode(JSON.stringify({ result: totals }) + '\n'));
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import data' },
      { status: 500 }
    );
  }
}

function parseFile(content: string, filename: string): Record<string, any>[] {
  if (filename.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  }

  return parseCsv(content);
}

function parseCsv(content: string): Record<string, any>[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    rows.push(row);
  }

  return rows;
}

function normalizeRow(row: Record<string, any>, mapping: Record<string, string>) {
  if (!mapping || Object.keys(mapping).length === 0) {
    return row;
  }

  const normalized: Record<string, any> = {};
  Object.entries(mapping).forEach(([source, target]) => {
    if (!target) return;
    normalized[target] = row[source];
  });

  return normalized;
}

async function upsertLead(
  record: Record<string, any>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<{ status: 'success' | 'duplicate' | 'error'; field?: string; message?: string }> {
  const email = record.email || record.Email;
  const name = record.name || record.Name || record.full_name;
  const company = record.company || record.Company || record.organization;

  if (!email) {
    return { status: 'error', field: 'email', message: 'Email is required' };
  }

  if (!name) {
    return { status: 'error', field: 'name', message: 'Name is required' };
  }

  const { data: existing } = await supabase
    .from('sales_leads')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return { status: 'duplicate' };
  }

  const tags = parseTags(record.tags || record.Tags);

  const { error } = await supabase.from('sales_leads').insert({
    organization_id: organizationId,
    name,
    email,
    company: company || 'Unknown Company',
    phone: record.phone || record.Phone || null,
    status: record.status || 'new',
    priority: record.priority || 'medium',
    tags,
    utm_source: record.utm_source || null,
    utm_campaign: record.utm_campaign || null,
  });

  if (error) {
    return { status: 'error', field: 'supabase', message: error.message };
  }

  return { status: 'success' };
}

function parseTags(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}
