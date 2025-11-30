/**
 * API endpoint for reordering sequence steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SequenceStepService } from '@/lib/services/sequences';
import { z } from 'zod';

const ReorderStepsSchema = z.object({
  template_id: z.string().uuid(),
  step_order: z.array(z.string().uuid()).min(1),
});

/**
 * POST /api/sequences/steps/reorder
 * Reorder steps within a sequence template
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const { template_id, step_order } = ReorderStepsSchema.parse(body);

    await SequenceStepService.reorder(template_id, step_order);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error reordering sequence steps:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: (error as any).errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to reorder steps' },
      { status: 500 }
    );
  }
}