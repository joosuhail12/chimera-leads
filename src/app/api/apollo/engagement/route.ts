import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

const EVENT_SCORES: Record<string, number> = {
  email_open: 1,
  email_click: 3,
  email_reply: 5,
  meeting_booked: 10,
  call: 7,
  linkedin_profile_view: 2,
  linkedin_connection_accepted: 4,
  document_viewed: 4,
  form_submission: 6,
};

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';
    const startDate = getStartDate(period);

    const supabase = await createClient();

    let eventsQuery = supabase
      .from('behavioral_events')
      .select('id, lead_id, event_type, event_data, created_at, source')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(250);

    if (startDate) {
      eventsQuery = eventsQuery.gte('created_at', startDate.toISOString());
    }

    const { data: eventsData, error } = await eventsQuery;
    if (error) {
      throw error;
    }

    const leadIds = Array.from(
      new Set(eventsData?.map((event) => event.lead_id).filter(Boolean) as string[])
    );

    const leadsById = await fetchLeadsById(leadIds, supabase);

    const events = (eventsData || []).map((event) => {
      const lead = event.lead_id ? leadsById.get(event.lead_id) : null;
      const score = EVENT_SCORES[event.event_type] ?? 1;
      return {
        id: event.id,
        leadId: event.lead_id,
        leadName: lead?.name || 'Unknown lead',
        company: lead?.company || 'Unknown company',
        type: event.event_type,
        details: event.event_data || {},
        timestamp: event.created_at,
        score,
        source: event.source || 'system',
      };
    });

    const metrics = buildMetrics(events);

    return NextResponse.json({
      events,
      metrics,
    });
  } catch (error) {
    console.error('Engagement API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load engagement data' },
      { status: 500 }
    );
  }
}

function getStartDate(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

async function fetchLeadsById(
  leadIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  if (!leadIds.length) {
    return new Map<string, { name: string; company: string }>();
  }

  const { data } = await supabase
    .from('sales_leads')
    .select('id, name, company')
    .in('id', leadIds);

  const map = new Map<string, { name: string; company: string }>();
  (data || []).forEach((lead) => {
    map.set(lead.id, { name: lead.name, company: lead.company });
  });
  return map;
}

function buildMetrics(events: any[]) {
  const totalEngagements = events.length;
  const uniqueLeads = new Set(events.map((event) => event.leadId).filter(Boolean)).size;
  const totalScore = events.reduce((sum, event) => sum + event.score, 0);

  const engagementByType: Record<string, number> = {};
  const leadScores: Record<string, { name: string; company: string; score: number; last: string }> =
    {};
  const dailyTrend: Record<string, { count: number; score: number }> = {};
  const funnelStages: Record<string, number> = {
    contacted: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    meeting: 0,
  };

  events.forEach((event) => {
    engagementByType[event.type] = (engagementByType[event.type] || 0) + 1;

    if (event.leadId) {
      if (!leadScores[event.leadId]) {
        leadScores[event.leadId] = {
          name: event.leadName,
          company: event.company,
          score: 0,
          last: event.timestamp,
        };
      }
      leadScores[event.leadId].score += event.score;
      leadScores[event.leadId].last = event.timestamp;
    }

    const dayKey = new Date(event.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    if (!dailyTrend[dayKey]) {
      dailyTrend[dayKey] = { count: 0, score: 0 };
    }
    dailyTrend[dayKey].count += 1;
    dailyTrend[dayKey].score += event.score;

    switch (event.type) {
      case 'email_open':
        funnelStages.opened += 1;
        break;
      case 'email_click':
        funnelStages.clicked += 1;
        break;
      case 'email_reply':
        funnelStages.replied += 1;
        break;
      case 'meeting_booked':
        funnelStages.meeting += 1;
        break;
      default:
        funnelStages.contacted += 1;
    }
  });

  const topEngagedLeads = Object.entries(leadScores)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 5)
    .map(([id, info]) => ({
      id,
      name: info.name,
      company: info.company,
      score: info.score,
      lastEngagement: info.last,
    }));

  const engagementTrend = Object.entries(dailyTrend).map(([date, value]) => ({
    date,
    count: value.count,
    score: value.score,
  }));

  const conversionFunnel = [
    { stage: 'Contacted', count: funnelStages.contacted, rate: 100 },
    { stage: 'Opened', count: funnelStages.opened, rate: rateOf(funnelStages.opened, funnelStages.contacted) },
    { stage: 'Clicked', count: funnelStages.clicked, rate: rateOf(funnelStages.clicked, funnelStages.opened) },
    { stage: 'Replied', count: funnelStages.replied, rate: rateOf(funnelStages.replied, funnelStages.clicked) },
    { stage: 'Meeting', count: funnelStages.meeting, rate: rateOf(funnelStages.meeting, funnelStages.replied) },
  ];

  return {
    totalEngagements,
    uniqueLeads,
    avgEngagementScore: totalEngagements ? Number((totalScore / totalEngagements).toFixed(2)) : 0,
    topEngagedLeads,
    engagementByType,
    engagementTrend,
    conversionFunnel,
  };
}

function rateOf(current: number, previous: number) {
  if (!previous) return 0;
  return Number(((current / previous) * 100).toFixed(1));
}
