/**
 * API endpoints for sequence steps
 * Handles creating and listing steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SequenceStepService } from '@/lib/services/sequences';
import { CreateSequenceStepSchema } from '@/lib/types/sequences';
import { z } from 'zod';

/**
 * POST /api/sequences/steps
 * Create a new sequence step
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = CreateSequenceStepSchema.parse(body);

    const step = await SequenceStepService.create(validatedData);

    return NextResponse.json({ step }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating sequence step:', error);

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
      { error: error.message || 'Failed to create step' },
      { status: 500 }
    );
  }
}