/**
 * API endpoint for cloning sequence templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { SequenceTemplateService } from '@/lib/services/sequences';
import { z } from 'zod';

const CloneTemplateSchema = z.object({
  name: z.string().min(1).max(100),
});

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/sequences/templates/[id]/clone
 * Clone a sequence template with all its steps
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const { name } = CloneTemplateSchema.parse(body);

    const template = await SequenceTemplateService.clone(id, name, userId);

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error('Error cloning sequence template:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: (error as any).errors },
        { status: 400 }
      );
    }

    if (error.message === 'Template not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to clone template' },
      { status: 500 }
    );
  }
}