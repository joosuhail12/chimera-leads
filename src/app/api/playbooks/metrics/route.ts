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

    const { data: playbooks, error: playbooksError } = await supabase
      .from('prospecting_playbooks')
      .select('id, name, status, run_count, success_count, failure_count, average_run_time')
      .eq('organization_id', orgId);

    if (playbooksError) throw playbooksError;

    const { data: executions, error: executionsError } = await supabase
      .from('playbook_executions')
      .select(
        `
        id,
        playbook_id,
        status,
        started_at,
        completed_at,
        leads_processed,
        leads_enrolled,
        error_message,
        playbook:prospecting_playbooks(name)
      `
      )
      .eq('organization_id', orgId)
      .order('started_at', { ascending: false })
      .limit(15);

    if (executionsError) throw executionsError;

    const active = (playbooks || []).filter((p) => p.status === 'active').length;
    const total = playbooks?.length || 0;
    const totalRuns = (playbooks || []).reduce((sum, pb) => sum + (pb.run_count || 0), 0);
    const totalSuccess = (playbooks || []).reduce((sum, pb) => sum + (pb.success_count || 0), 0);
    const totalFailures = (playbooks || []).reduce((sum, pb) => sum + (pb.failure_count || 0), 0);
    const avgDuration =
      executions && executions.length
        ? Math.round(
            executions.reduce((sum, exec) => {
              if (exec.started_at && exec.completed_at) {
                return (
                  sum +
                  (new Date(exec.completed_at).getTime() -
                    new Date(exec.started_at).getTime())
                );
              }
              return sum;
            }, 0) / executions.length
          )
        : 0;

    const recentExecutions = (executions || []).map((exec) => ({
      id: exec.id,
      name: exec.playbook?.name || 'Playbook run',
      status: exec.status,
      startedAt: exec.started_at,
      duration: exec.started_at && exec.completed_at
        ? new Date(exec.completed_at).getTime() - new Date(exec.started_at).getTime()
        : null,
      itemsProcessed: exec.leads_processed ?? 0,
      leadsEnrolled: exec.leads_enrolled ?? 0,
      error: exec.error_message || null,
    }));

    return NextResponse.json({
      active,
      total,
      recentExecutions,
      successRate: totalRuns ? Number(((totalSuccess / totalRuns) * 100).toFixed(1)) : 0,
      failureRate: totalRuns ? Number(((totalFailures / totalRuns) * 100).toFixed(1)) : 0,
      averageDuration: avgDuration,
    });
  } catch (error) {
    console.error('Playbook metrics error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load playbook metrics' },
      { status: 500 }
    );
  }
}
