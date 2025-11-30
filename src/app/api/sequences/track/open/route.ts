/**
 * Email open tracking endpoint
 * Returns a 1x1 transparent pixel and logs the open event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const executionId = searchParams.get('eid');

    if (executionId) {
      // Log the open event
      await logOpenEvent(executionId, request);
    }

    // Return the tracking pixel
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error tracking email open:', error);
    // Still return the pixel even if logging fails
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store',
      },
    });
  }
}

async function logOpenEvent(executionId: string, request: NextRequest) {
  const supabase = await createClient();

  try {
    // Get execution details
    const { data: execution } = await supabase
      .from('sequence_step_executions')
      .select('enrollment_id, opened_at')
      .eq('id', executionId)
      .single();

    if (!execution) return;

    // Only log first open
    if (!execution.opened_at) {
      // Update execution with open timestamp
      await supabase
        .from('sequence_step_executions')
        .update({
          opened_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      // Update enrollment metrics
      await supabase.rpc('increment_enrollment_metric', {
        p_enrollment_id: execution.enrollment_id,
        p_metric: 'emails_opened',
      });
    }

    // Log the event
    const headers = request.headers;
    await supabase.from('sequence_email_events').insert({
      execution_id: executionId,
      enrollment_id: execution.enrollment_id,
      event_type: 'open',
      ip_address: headers.get('x-forwarded-for') || headers.get('x-real-ip'),
      user_agent: headers.get('user-agent'),
    });
  } catch (error) {
    console.error('Error logging open event:', error);
  }
}