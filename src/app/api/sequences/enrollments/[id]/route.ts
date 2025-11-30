/**
 * API endpoints for individual enrollment operations
 * Handles GET, PATCH for specific enrollments
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SequenceEnrollmentService } from '@/lib/services/sequences';
import { UpdateEnrollmentStatusSchema } from '@/lib/types/sequences';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/sequences/enrollments/[id]
 * Get enrollment details with execution history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const enrollment = await SequenceEnrollmentService.getDetails(id);

    if (!enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    return NextResponse.json({ enrollment });
  } catch (error: any) {
    console.error('Error fetching enrollment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch enrollment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sequences/enrollments/[id]
 * Update enrollment status (pause, resume, stop)
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
    const validatedData = UpdateEnrollmentStatusSchema.parse(body);

    const enrollment = await SequenceEnrollmentService.updateStatus(
      id,
      validatedData,
      userId
    );

    return NextResponse.json({ enrollment });
  } catch (error: any) {
    console.error('Error updating enrollment:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: (error as any).errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update enrollment' },
      { status: 500 }
    );
  }
}