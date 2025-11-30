/**
 * API endpoints for sequence templates
 * Handles CRUD operations for sequence templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SequenceTemplateService } from '@/lib/services/sequences';
import { CreateSequenceTemplateSchema } from '@/lib/types/sequences';
import { z } from 'zod';

/**
 * GET /api/sequences/templates
 * Get all sequence templates for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters = {
      is_active: searchParams.get('is_active') === 'true' ? true :
        searchParams.get('is_active') === 'false' ? false : undefined,
      category: searchParams.get('category') || undefined,
    };

    const templates = await SequenceTemplateService.list(userId, filters);

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Error fetching sequence templates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sequences/templates
 * Create a new sequence template
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = CreateSequenceTemplateSchema.parse(body);

    const template = await SequenceTemplateService.create(validatedData, userId);

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating sequence template:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: (error as any).errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}