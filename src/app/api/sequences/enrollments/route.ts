/**
 * API endpoints for sequence enrollments
 * Handles enrolling leads in sequences
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SequenceEnrollmentService } from '@/lib/services/sequences';
import { EnrollLeadSchema, BulkEnrollLeadsSchema } from '@/lib/types/sequences';
import { z } from 'zod';

/**
 * GET /api/sequences/enrollments
 * Get enrollments for a specific lead
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
      return NextResponse.json(
        { error: 'lead_id parameter is required' },
        { status: 400 }
      );
    }

    const enrollments = await SequenceEnrollmentService.getByLead(leadId);

    return NextResponse.json({ enrollments });
  } catch (error: any) {
    console.error('Error fetching enrollments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch enrollments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sequences/enrollments
 * Enroll a lead in a sequence
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check if bulk enrollment
    if (body.lead_ids && Array.isArray(body.lead_ids)) {
      // Bulk enrollment
      const validatedData = BulkEnrollLeadsSchema.parse(body);
      const results = await SequenceEnrollmentService.bulkEnroll(validatedData, userId);

      return NextResponse.json({ results }, { status: 201 });
    } else {
      // Single enrollment
      const validatedData = EnrollLeadSchema.parse(body);
      const enrollment = await SequenceEnrollmentService.enroll(validatedData, userId);

      return NextResponse.json({ enrollment }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error creating enrollment:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: (error as any).errors },
        { status: 400 }
      );
    }

    if (error.message.includes('already actively enrolled')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create enrollment' },
      { status: 500 }
    );
  }
}