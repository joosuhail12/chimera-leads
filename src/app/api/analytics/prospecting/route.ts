import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const EventSchema = z.object({
  event: z.string().min(1),
  payload: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bodyText = await request.text();
    const data = bodyText ? JSON.parse(bodyText) : {};
    const { event, payload } = EventSchema.parse(data);

    const supabase = await createClient();
    await supabase.from('admin_activity_logs').insert({
      actor_clerk_id: userId,
      action: event,
      details: {
        ...(payload || {}),
        organization_id: orgId,
      },
      resource_type: 'prospecting',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics logging error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to log analytics event' },
      { status: 500 }
    );
  }
}
