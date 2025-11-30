import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const ExportSchema = z.object({
  format: z.enum(['csv', 'json', 'excel']).default('csv'),
  dataType: z.enum(['leads', 'companies', 'all']).default('leads'),
  dateRange: z.enum(['all', '7d', '30d', '90d', 'custom']).default('30d'),
  customStart: z.string().optional(),
  customEnd: z.string().optional(),
  filters: z
    .object({
      scoreMin: z.number().optional(),
      scoreMax: z.number().optional(),
      status: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      sources: z.array(z.string()).optional(),
    })
    .optional(),
  fields: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = ExportSchema.parse(await request.json());
    const supabase = await createClient();

    const dateFilter = getDateFilter(body.dateRange, body.customStart, body.customEnd);

    let leadsQuery = supabase
      .from('sales_leads')
      .select(
        `
        id,
        created_at,
        name,
        email,
        status,
        priority,
        company,
        company_size,
        industry,
        tags,
        phone,
        utm_source,
        utm_campaign,
        technographics,
        intent_signals,
        company_apollo_data
      `
      )
      .eq('organization_id', orgId);

    if (dateFilter) {
      leadsQuery = leadsQuery.gte('created_at', dateFilter.toISOString());
    }

    if (body.filters?.status?.length) {
      leadsQuery = leadsQuery.in('status', body.filters.status);
    }

    if (body.filters?.tags?.length) {
      leadsQuery = leadsQuery.contains('tags', body.filters.tags);
    }

    if (body.filters?.sources?.length) {
      leadsQuery = leadsQuery.in('utm_source', body.filters.sources);
    }

    const { data: leadsData, error: leadsError } = await leadsQuery;
    if (leadsError) {
      throw leadsError;
    }

    const leads = leadsData || [];
    const companies = buildCompanyDataset(leads);

    let payload: any[] = [];
    switch (body.dataType) {
      case 'leads':
        payload = leads.map(normalizeLeadRow);
        break;
      case 'companies':
        payload = companies;
        break;
      case 'all':
        payload = [
          ...leads.map((lead) => ({ record_type: 'lead', ...normalizeLeadRow(lead) })),
          ...companies.map((company) => ({ record_type: 'company', ...company })),
        ];
        break;
    }

    const fields = body.fields && body.fields.length > 0
      ? body.fields
      : inferFields(payload);

    if (body.format === 'json') {
      return NextResponse.json({ data: payload });
    }

    const csv = convertToCsv(payload, fields);
    const filename = `apollo-${body.dataType}-export-${new Date().toISOString().split('T')[0]}.csv`;
    const headers = new Headers({
      'Content-Type': body.format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new NextResponse(csv, { headers });
  } catch (error) {
    console.error('Export error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export data' },
      { status: 500 }
    );
  }
}

function getDateFilter(range: string, customStart?: string, customEnd?: string): Date | null {
  if (range === 'all') return null;

  const now = new Date();
  switch (range) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'custom':
      if (customStart) {
        return new Date(customStart);
      }
      return null;
    default:
      return null;
  }
}

function normalizeLeadRow(lead: any) {
  return {
    id: lead.id,
    created_at: lead.created_at,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    status: lead.status,
    priority: lead.priority,
    industry: lead.industry,
    company_size: lead.company_size,
    tags: Array.isArray(lead.tags) ? lead.tags.join('; ') : '',
    phone: lead.phone || '',
    utm_source: lead.utm_source || '',
    utm_campaign: lead.utm_campaign || '',
  };
}

function buildCompanyDataset(leads: any[]) {
  const map = new Map<
    string,
    {
      name: string;
      domain?: string | null;
      industry?: string | null;
      employee_count?: number | null;
      revenue_range?: string | null;
      headquarters_location?: string | null;
      technologies: string[];
      contacts_found: number;
      tags: Set<string>;
    }
  >();

  leads.forEach((lead) => {
    const domain =
      lead.company_apollo_data?.domain ||
      lead.company_apollo_data?.primary_domain ||
      null;
    const key = domain || lead.company;

    if (!map.has(key)) {
      map.set(key, {
        name: lead.company,
        domain,
        industry: lead.industry,
        employee_count: lead.company_apollo_data?.employee_count || null,
        revenue_range: lead.company_apollo_data?.revenue_range || null,
        headquarters_location: lead.company_apollo_data?.headquarters_location || null,
        technologies: lead.company_apollo_data?.technologies || [],
        contacts_found: 0,
        tags: new Set<string>(),
      });
    }

    const entry = map.get(key)!;
    entry.contacts_found += 1;
    if (Array.isArray(lead.tags)) {
      lead.tags.forEach((tag: string) => entry.tags.add(tag));
    }
  });

  return Array.from(map.values()).map((entry) => ({
    name: entry.name,
    domain: entry.domain,
    industry: entry.industry,
    employee_count: entry.employee_count,
    revenue_range: entry.revenue_range,
    headquarters_location: entry.headquarters_location,
    technologies: entry.technologies.join(', '),
    contacts_found: entry.contacts_found,
    tags: Array.from(entry.tags).join('; '),
  }));
}

function inferFields(rows: any[]): string[] {
  if (!rows.length) {
    return [];
  }
  const fieldSet = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => fieldSet.add(key));
  });
  return Array.from(fieldSet);
}

function convertToCsv(rows: any[], headers: string[]): string {
  if (!rows.length || !headers.length) {
    return headers.join(',');
  }

  const escape = (value: any) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    const line = headers.map((header) => escape(row[header])).join(',');
    lines.push(line);
  }

  return lines.join('\n');
}
