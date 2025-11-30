/**
 * LinkedIn Integration API
 * Handles communication with the Chrome extension for LinkedIn automation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const LinkedInTaskSchema = z.object({
  action: z.enum(['connect', 'message', 'view_profile', 'like_post', 'extract_profile']),
  profile_url: z.string().url().optional(),
  post_url: z.string().url().optional(),
  message: z.string().optional(),
  lead_id: z.string().uuid(),
  enrollment_id: z.string().uuid().optional(),
  sequence_step_id: z.string().uuid().optional(),
  mode: z.enum(['full_auto', 'semi_auto', 'assisted', 'manual']).default('semi_auto'),
});

const TaskResultSchema = z.object({
  task_id: z.string().uuid(),
  success: z.boolean(),
  error: z.string().optional(),
  data: z.any().optional(),
  executed_at: z.string().datetime(),
});

// ============================================
// GET - Fetch pending LinkedIn tasks
// ============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get organization ID from headers
    const orgId = request.headers.get('x-organization-id');
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 401 }
      );
    }

    // Fetch pending LinkedIn tasks
    const { data: tasks, error } = await supabase
      .from('linkedin_tasks')
      .select(`
        *,
        lead:sales_leads(
          id,
          first_name,
          last_name,
          email,
          linkedin_url
        ),
        enrollment:sequence_enrollments(
          id,
          sequence_template_id,
          current_step
        )
      `)
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at')
      .limit(10);

    if (error) throw error;

    // Transform tasks for extension
    const extensionTasks = tasks?.map(task => ({
      id: task.id,
      action: task.action_type,
      profileUrl: task.profile_url || task.lead?.linkedin_url,
      message: task.message_content,
      leadId: task.lead_id,
      leadName: `${task.lead?.first_name} ${task.lead?.last_name}`,
      enrollmentId: task.enrollment_id,
      mode: task.automation_mode || 'semi_auto',
      priority: task.priority,
    }));

    return NextResponse.json(extensionTasks || []);

  } catch (error) {
    console.error('Error fetching LinkedIn tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create new LinkedIn task
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Get organization ID
    const orgId = request.headers.get('x-organization-id');
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 401 }
      );
    }

    // Validate input
    const validated = LinkedInTaskSchema.parse(body);

    // Create task
    const { data: task, error } = await supabase
      .from('linkedin_tasks')
      .insert({
        organization_id: orgId,
        lead_id: validated.lead_id,
        enrollment_id: validated.enrollment_id,
        sequence_step_id: validated.sequence_step_id,
        action_type: validated.action,
        profile_url: validated.profile_url,
        post_url: validated.post_url,
        message_content: validated.message,
        automation_mode: validated.mode,
        status: 'pending',
        priority: 100,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      task_id: task.id,
    });

  } catch (error) {
    console.error('Error creating LinkedIn task:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid task data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Update task status
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Update task
    const { data: task, error } = await supabase
      .from('linkedin_tasks')
      .update({
        status: body.status,
        result_data: body.result,
        error_message: body.error,
        executed_at: body.executed_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    // If task completed successfully, update sequence step execution
    if (body.status === 'completed' && task.sequence_step_id) {
      await supabase
        .from('sequence_step_executions')
        .update({
          linkedin_action_completed: true,
          linkedin_result: body.result,
        })
        .eq('id', task.sequence_step_id);
    }

    // Track behavioral event
    if (body.status === 'completed') {
      await supabase.from('behavioral_events').insert({
        organization_id: task.organization_id,
        lead_id: task.lead_id,
        event_type: `linkedin_${task.action_type}`,
        event_data: {
          task_id: task.id,
          profile_url: task.profile_url,
          result: body.result,
        },
        source: 'linkedin',
        processed: false,
      });
    }

    return NextResponse.json({
      success: true,
      task,
    });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}