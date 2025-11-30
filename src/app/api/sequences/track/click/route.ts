/**
 * Email click tracking endpoint
 * Logs the click event and redirects to the actual URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const executionId = searchParams.get('eid');
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }

    // Decode the URL
    const decodedUrl = decodeURIComponent(targetUrl);

    if (executionId) {
      // Log the click event (don't wait for it)
      logClickEvent(executionId, decodedUrl, request);
    }

    // Redirect to the actual URL
    return NextResponse.redirect(decodedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error tracking email click:', error);
    // Redirect to home page as fallback
    return NextResponse.redirect(process.env.NEXT_PUBLIC_APP_URL || '/', {
      status: 302,
    });
  }
}

async function logClickEvent(
  executionId: string,
  url: string,
  request: NextRequest
) {
  const supabase = await createClient();

  try {
    // Get execution details
    const { data: execution } = await supabase
      .from('sequence_step_executions')
      .select('enrollment_id, clicked_at')
      .eq('id', executionId)
      .single();

    if (!execution) return;

    // Update execution with click timestamp (first click only)
    if (!execution.clicked_at) {
      await supabase
        .from('sequence_step_executions')
        .update({
          clicked_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      // Update enrollment metrics
      await supabase.rpc('increment_enrollment_metric', {
        p_enrollment_id: execution.enrollment_id,
        p_metric: 'emails_clicked',
      });
    }

    // Log the event
    const headers = request.headers;
    await supabase.from('sequence_email_events').insert({
      execution_id: executionId,
      enrollment_id: execution.enrollment_id,
      event_type: 'click',
      link_url: url,
      ip_address: headers.get('x-forwarded-for') || headers.get('x-real-ip'),
      user_agent: headers.get('user-agent'),
    });
  } catch (error) {
    console.error('Error logging click event:', error);
  }
}