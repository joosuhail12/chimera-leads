import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('apollo_api_usage')
      .select('endpoint, method, status_code, credits_used, cached, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', startOfMonth.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const usage = data || [];
    const today = aggregateUsage(usage.filter((row) => isSameDay(row.created_at, new Date())));
    const thisWeek = aggregateUsage(
      usage.filter((row) => isSameWeek(row.created_at, new Date()))
    );
    const thisMonth = aggregateUsage(usage);

    const byEndpoint: Record<string, number> = {};
    usage.forEach((row) => {
      const key = `${row.method} ${row.endpoint}`;
      byEndpoint[key] = (byEndpoint[key] || 0) + 1;
    });

    const byHour: Record<string, number> = {};
    usage
      .filter((row) => isSameDay(row.created_at, new Date()))
      .forEach((row) => {
        const hour = new Date(row.created_at).getHours().toString().padStart(2, '0');
        byHour[hour] = (byHour[hour] || 0) + 1;
      });

    return NextResponse.json({
      today,
      thisWeek,
      thisMonth,
      byEndpoint,
      byHour,
    });
  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load usage stats' },
      { status: 500 }
    );
  }
}

function aggregateUsage(rows: any[]) {
  const summary = {
    requests: rows.length,
    cached: rows.filter((row) => row.cached).length,
    failed: rows.filter((row) => (row.status_code || 0) >= 400).length,
    cost: rows.reduce((sum, row) => sum + (row.credits_used || 0), 0),
  };
  return summary;
}

function isSameDay(date: string, compare: Date) {
  const d = new Date(date);
  return (
    d.getFullYear() === compare.getFullYear() &&
    d.getMonth() === compare.getMonth() &&
    d.getDate() === compare.getDate()
  );
}

function isSameWeek(date: string, compare: Date) {
  const d = new Date(date);
  const startOfWeek = new Date(compare);
  startOfWeek.setDate(compare.getDate() - compare.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return d >= startOfWeek && d < endOfWeek;
}
