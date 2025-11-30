/**
 * API endpoints for individual sequence step operations
 * Handles PATCH and DELETE for specific steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SequenceStepService } from '@/lib/services/sequences';
import { UpdateSequenceStepSchema } from '@/lib/types/sequences';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PATCH /api/sequences/steps/[id]
 * Update a sequence step
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = UpdateSequenceStepSchema.parse(body);

    const step = await SequenceStepService.update(id, validatedData);

    return NextResponse.json({ step });
  } catch (error: any) {
    console.error('Error updating sequence step:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: (error as any).errors },
        { status: 400 }
      );
    }

    if (error.message.includes('require')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update step' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sequences/steps/[id]
 * Delete a sequence step and reorder remaining steps
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await SequenceStepService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting sequence step:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete step' },
      { status: 500 }
    );
  }
}