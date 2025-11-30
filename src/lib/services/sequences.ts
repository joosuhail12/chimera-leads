/**
 * Service layer for managing prospecting sequences
 * Handles CRUD operations, enrollments, and execution logic
 */

import { createClient } from '@/lib/supabase/server';
import { SuppressionService } from '@/lib/services/suppression';
import { EmailValidator } from '@/lib/email/validator';
import { TimezoneService } from '@/lib/services/timezone';
import {
  SequenceTemplate,
  SequenceStep,
  SequenceEnrollment,
  SequenceStepExecution,
  CreateSequenceTemplateRequest,
  UpdateSequenceTemplateRequest,
  CreateSequenceStepRequest,
  UpdateSequenceStepRequest,
  EnrollLeadRequest,
  BulkEnrollLeadsRequest,
  UpdateEnrollmentStatusRequest,
  EnrollmentStatus,
  ExecutionStatus,
  SequenceMetrics,
  SequencePerformance,
  SequenceVariable,
  EmailPreview
} from '@/lib/types/sequences';

/**
 * Sequence Template Operations
 */
export class SequenceTemplateService {
  /**
   * Create a new sequence template
   */
  static async create(data: CreateSequenceTemplateRequest, userId: string): Promise<SequenceTemplate> {
    const supabase = await createClient();

    // Get user's organization
    const { data: adminUser, error: userError } = await supabase
      .from('admin_users')
      .select('organization_id')
      .eq('clerk_user_id', userId)
      .single();

    if (userError || !adminUser) {
      throw new Error('User not found or not authorized');
    }

    const { data: template, error } = await supabase
      .from('sequence_templates')
      .insert({
        ...data,
        organization_id: adminUser.organization_id,
        created_by: userId,
        last_modified_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return template as SequenceTemplate;
  }

  /**
   * Get all sequence templates for an organization
   */
  static async list(userId: string, filters?: {
    is_active?: boolean;
    category?: string;
  }): Promise<SequenceTemplate[]> {
    const supabase = await createClient();

    // Get user's organization
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('organization_id')
      .eq('clerk_user_id', userId)
      .single();

    if (!adminUser) return [];

    let query = supabase
      .from('sequence_templates')
      .select('*')
      .eq('organization_id', adminUser.organization_id)
      .order('created_at', { ascending: false });

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as SequenceTemplate[];
  }

  /**
   * Get a single sequence template with its steps
   */
  static async getById(id: string, userId: string): Promise<SequenceTemplate | null> {
    const supabase = await createClient();

    // Get user's organization
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('organization_id')
      .eq('clerk_user_id', userId)
      .single();

    if (!adminUser) return null;

    const { data, error } = await supabase
      .from('sequence_templates')
      .select(`
        *,
        steps:sequence_steps(*)
      `)
      .eq('id', id)
      .eq('organization_id', adminUser.organization_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    // Sort steps by step_number
    if (data?.steps) {
      data.steps.sort((a: SequenceStep, b: SequenceStep) => a.step_number - b.step_number);
    }

    return data as SequenceTemplate;
  }

  /**
   * Update a sequence template
   */
  static async update(
    id: string,
    data: UpdateSequenceTemplateRequest,
    userId: string
  ): Promise<SequenceTemplate> {
    const supabase = await createClient();

    // Get user's organization
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('organization_id')
      .eq('clerk_user_id', userId)
      .single();

    if (!adminUser) throw new Error('User not found or not authorized');

    const { data: template, error } = await supabase
      .from('sequence_templates')
      .update({
        ...data,
        last_modified_by: userId,
      })
      .eq('id', id)
      .eq('organization_id', adminUser.organization_id)
      .select()
      .single();

    if (error) throw error;
    return template as SequenceTemplate;
  }

  /**
   * Delete a sequence template (soft delete by deactivating)
   */
  static async delete(id: string, userId: string): Promise<void> {
    const supabase = await createClient();

    // Get user's organization
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('organization_id')
      .eq('clerk_user_id', userId)
      .single();

    if (!adminUser) throw new Error('User not found or not authorized');

    // Check for active enrollments
    const { data: activeEnrollments } = await supabase
      .from('sequence_enrollments')
      .select('id')
      .eq('template_id', id)
      .eq('status', 'active')
      .limit(1);

    if (activeEnrollments && activeEnrollments.length > 0) {
      throw new Error('Cannot delete template with active enrollments');
    }

    const { error } = await supabase
      .from('sequence_templates')
      .update({
        is_active: false,
        last_modified_by: userId
      })
      .eq('id', id)
      .eq('organization_id', adminUser.organization_id);

    if (error) throw error;
  }

  /**
   * Clone a sequence template
   */
  static async clone(id: string, newName: string, userId: string): Promise<SequenceTemplate> {
    const supabase = await createClient();

    // Get original template with steps
    const original = await this.getById(id, userId);
    if (!original) throw new Error('Template not found');

    // Create new template
    const newTemplate = await this.create({
      name: newName,
      description: original.description || undefined,
      category: original.category as any,
      settings: original.settings,
      is_active: true,
    }, userId);

    // Clone steps if any
    if (original.steps && original.steps.length > 0) {
      const stepsToCreate = original.steps.map(step => ({
        template_id: newTemplate.id,
        step_number: step.step_number,
        step_type: step.step_type,
        wait_days: step.wait_days,
        wait_hours: step.wait_hours,
        send_time_window: step.send_time_window,
        email_subject: step.email_subject,
        email_body: step.email_body,
        email_from_name: step.email_from_name,
        email_reply_to: step.email_reply_to,
        task_title: step.task_title,
        task_description: step.task_description,
        task_priority: step.task_priority,
        task_due_days: step.task_due_days,
        conditions: step.conditions,
        webhook_url: step.webhook_url,
        webhook_method: step.webhook_method,
        webhook_headers: step.webhook_headers,
        webhook_body: step.webhook_body,
      }));

      const { error } = await supabase
        .from('sequence_steps')
        .insert(stepsToCreate);

      if (error) throw error;
    }

    return newTemplate;
  }
}

/**
 * Sequence Step Operations
 */
export class SequenceStepService {
  /**
   * Create a new sequence step
   */
  static async create(data: CreateSequenceStepRequest): Promise<SequenceStep> {
    const supabase = await createClient();

    // Validate step based on type
    this.validateStep(data);

    // Extract LinkedIn config
    const { linkedin_config, ...stepData } = data;

    const { data: step, error } = await supabase
      .from('sequence_steps')
      .insert(stepData)
      .select()
      .single();

    if (error) throw error;

    // Handle LinkedIn config
    if (linkedin_config && step) {
      const { error: liError } = await supabase
        .from('sequence_linkedin_steps')
        .insert({
          sequence_step_id: step.id,
          ...linkedin_config,
        });

      if (liError) {
        // Cleanup step if LinkedIn config fails
        await supabase.from('sequence_steps').delete().eq('id', step.id);
        throw liError;
      }

      (step as any).linkedin_config = linkedin_config;
    }

    return step as SequenceStep;
  }

  /**
   * Update a sequence step
   */
  static async update(id: string, data: UpdateSequenceStepRequest): Promise<SequenceStep> {
    const supabase = await createClient();

    // Validate step if type-specific fields are being updated
    if (data.step_type || data.email_subject || data.task_title) {
      const { data: existingStep } = await supabase
        .from('sequence_steps')
        .select('*')
        .eq('id', id)
        .single();

      if (existingStep) {
        this.validateStep({ ...existingStep, ...data } as CreateSequenceStepRequest);
      }
    }

    // Extract LinkedIn config
    const { linkedin_config, ...stepData } = data;

    const { data: step, error } = await supabase
      .from('sequence_steps')
      .update(stepData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Handle LinkedIn config update
    if (linkedin_config) {
      const { error: liError } = await supabase
        .from('sequence_linkedin_steps')
        .upsert({
          sequence_step_id: id,
          ...linkedin_config,
        }, { onConflict: 'sequence_step_id' });

      if (liError) throw liError;

      (step as any).linkedin_config = linkedin_config;
    }

    return step as SequenceStep;
  }

  /**
   * Delete a sequence step and reorder remaining steps
   */
  static async delete(id: string): Promise<void> {
    const supabase = await createClient();

    // Get the step to be deleted
    const { data: stepToDelete, error: fetchError } = await supabase
      .from('sequence_steps')
      .select('template_id, step_number')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete the step
    const { error: deleteError } = await supabase
      .from('sequence_steps')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Reorder remaining steps
    const { error: reorderError } = await supabase.rpc('reorder_sequence_steps', {
      p_template_id: stepToDelete.template_id,
      p_deleted_step_number: stepToDelete.step_number,
    });

    if (reorderError) {
      // If the RPC doesn't exist, do it manually
      const { data: remainingSteps } = await supabase
        .from('sequence_steps')
        .select('id, step_number')
        .eq('template_id', stepToDelete.template_id)
        .gt('step_number', stepToDelete.step_number)
        .order('step_number');

      if (remainingSteps) {
        for (const step of remainingSteps) {
          await supabase
            .from('sequence_steps')
            .update({ step_number: step.step_number - 1 })
            .eq('id', step.id);
        }
      }
    }
  }

  /**
   * Reorder steps within a sequence
   */
  static async reorder(templateId: string, stepOrder: string[]): Promise<void> {
    const supabase = await createClient();

    // Update each step with its new position
    for (let i = 0; i < stepOrder.length; i++) {
      await supabase
        .from('sequence_steps')
        .update({ step_number: i + 1 })
        .eq('id', stepOrder[i])
        .eq('template_id', templateId);
    }
  }

  /**
   * Validate step data based on type
   */
  private static validateStep(data: CreateSequenceStepRequest): void {
    switch (data.step_type) {
      case 'email':
        if (!data.email_subject || !data.email_body) {
          throw new Error('Email steps require subject and body');
        }
        break;
      case 'task':
      case 'call':
        if (!data.task_title) {
          throw new Error('Task/Call steps require a title');
        }
        break;
      case 'linkedin_connection':
      case 'linkedin_message':
      case 'linkedin_profile_view':
      case 'linkedin_engagement':
        if (!data.linkedin_config) {
          throw new Error('LinkedIn steps require configuration');
        }
        break;
        break;
      case 'webhook':
        if (!data.webhook_url) {
          throw new Error('Webhook steps require a URL');
        }
        break;
    }
  }
}

/**
 * Sequence Enrollment Operations
 */
export class SequenceEnrollmentService {
  private static readonly SYSTEM_ACTORS = new Set(['behavioral_trigger', 'playbook_executor']);

  /**
   * Enroll a single lead in a sequence
   */
  static async enroll(data: EnrollLeadRequest, userId: string): Promise<SequenceEnrollment> {
    const supabase = await createClient();
    const organizationId = await this.resolveOrganizationId(userId, data.lead_id);

    if (!organizationId) {
      throw new Error('User not found or not authorized');
    }

    const actorUserId = await this.resolveActorUserId(userId, organizationId, supabase);

    // Get lead details for validation
    const { data: lead } = await supabase
      .from('sales_leads')
      .select('id, email, organization_id')
      .eq('id', data.lead_id)
      .eq('organization_id', organizationId)
      .single();

    if (!lead) throw new Error('Lead not found');

    // Check suppression status
    const { canEnroll, reason } = await SuppressionService.canEnrollLead(
      lead.id,
      organizationId,
      lead.email
    );

    if (!canEnroll) {
      throw new Error(`Cannot enroll lead: ${reason}`);
    }

    // Validate email if not already validated
    if (lead.email) {
      const validation = await EmailValidator.verifyDeliverability(
        lead.email,
        organizationId,
        {
          checkMX: false, // Skip MX check for speed
          checkSuppression: false, // Already checked above
          leadId: lead.id
        }
      );

      if (!validation.is_valid) {
        throw new Error(`Invalid email address: ${validation.validation_errors.join(', ')}`);
      }

      // Update lead with validation results
      if (!validation.is_deliverable) {
        await supabase
          .from('sales_leads')
          .update({
            email_valid: false,
            email_validated_at: new Date().toISOString(),
            email_validation_error: validation.validation_errors.join('; ')
          })
          .eq('id', lead.id);

        throw new Error(`Email not deliverable: ${validation.validation_errors.join(', ')}`);
      }
    }

    // Check if already enrolled
    const { data: existing } = await supabase
      .from('sequence_enrollments')
      .select('id, status')
      .eq('lead_id', data.lead_id)
      .eq('template_id', data.template_id)
      .eq('organization_id', organizationId)
      .single();

    if (existing) {
      if (existing.status === 'active') {
        throw new Error('Lead is already actively enrolled in this sequence');
      }
      // Re-activate if previously stopped/completed
      const { data: enrollment, error } = await supabase
        .from('sequence_enrollments')
        .update({
          status: 'active',
          current_step: 0,
          resumed_at: new Date().toISOString(),
          enrolled_by: actorUserId,
        })
        .eq('id', existing.id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      return enrollment as SequenceEnrollment;
    }

    // Check for A/B test and assign variant
    let abTestId = null;
    let abTestVariant = null;

    const { data: activeTest } = await supabase
      .from('sequence_ab_tests')
      .select('id')
      .eq('template_id', data.template_id)
      .eq('status', 'running')
      .single();

    if (activeTest) {
      // Assign variant using database function
      const { data: variant } = await supabase.rpc('assign_ab_test_variant', {
        p_test_id: activeTest.id
      });

      if (variant) {
        abTestId = activeTest.id;
        abTestVariant = variant;
      }
    }

    // Generate unsubscribe token for the lead
    const unsubscribeToken = await SuppressionService.getOrCreateUnsubscribeToken(
      data.lead_id,
      lead.email,
      organizationId
    );

    // Create new enrollment
    const { data: enrollment, error } = await supabase
      .from('sequence_enrollments')
      .insert({
        ...data,
        organization_id: organizationId,
        enrolled_by: actorUserId,
        status: 'active',
        current_step: 0,
        ab_test_id: abTestId,
        ab_test_variant: abTestVariant,
      })
      .select()
      .single();

    if (error) throw error;

    // Schedule first step
    await this.scheduleNextStep(enrollment.id);

    // Log enrollment as CRM activity
    await this.logEnrollmentActivity(enrollment.id, data.lead_id, 'enrolled', actorUserId);

    return enrollment as SequenceEnrollment;
  }

  /**
   * Bulk enroll leads in a sequence
   */
  static async bulkEnroll(data: BulkEnrollLeadsRequest, userId: string): Promise<{
    enrolled: number;
    skipped: number;
    errors: string[];
  }> {
    const results = {
      enrolled: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const leadId of data.lead_ids) {
      try {
        await this.enroll({
          lead_id: leadId,
          template_id: data.template_id,
        }, userId);
        results.enrolled++;
      } catch (error: any) {
        if (error.message.includes('already actively enrolled')) {
          results.skipped++;
        } else {
          results.errors.push(`Lead ${leadId}: ${error.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Update enrollment status (pause, resume, stop)
   */
  static async updateStatus(
    enrollmentId: string,
    data: UpdateEnrollmentStatusRequest,
    userId: string
  ): Promise<SequenceEnrollment> {
    const supabase = await createClient();

    const updateData: any = {
      status: data.status,
    };

    switch (data.status) {
      case 'paused':
        updateData.paused_at = new Date().toISOString();
        updateData.paused_reason = data.reason;
        break;
      case 'active':
        updateData.resumed_at = new Date().toISOString();
        updateData.paused_at = null;
        updateData.paused_reason = null;
        break;
      case 'stopped':
        updateData.stopped_at = new Date().toISOString();
        updateData.stopped_reason = data.reason;
        updateData.stopped_by = userId;
        break;
    }

    const { data: enrollmentRecord } = await supabase
      .from('sequence_enrollments')
      .select('organization_id, lead_id')
      .eq('id', enrollmentId)
      .single();

    const actorUserId = enrollmentRecord
      ? await this.resolveActorUserId(userId, enrollmentRecord.organization_id, supabase)
      : userId;

    if (data.status === 'stopped') {
      updateData.stopped_by = actorUserId;
    }

    const { data: enrollment, error } = await supabase
      .from('sequence_enrollments')
      .update(updateData)
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) throw error;

    // If resuming, schedule next step
    if (data.status === 'active') {
      await this.scheduleNextStep(enrollmentId);
    }

    return enrollment as SequenceEnrollment;
  }

  /**
   * Get enrollments for a lead
   */
  static async getByLead(leadId: string): Promise<SequenceEnrollment[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('sequence_enrollments')
      .select(`
        *,
        template:sequence_templates(name, category)
      `)
      .eq('lead_id', leadId)
      .order('enrolled_at', { ascending: false });

    if (error) throw error;
    return (data || []) as SequenceEnrollment[];
  }

  /**
   * Get enrollment details with execution history
   */
  static async getDetails(enrollmentId: string): Promise<SequenceEnrollment | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('sequence_enrollments')
      .select(`
        *,
        template:sequence_templates(*),
        executions:sequence_step_executions(
          *,
          step:sequence_steps(*)
        )
      `)
      .eq('id', enrollmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as SequenceEnrollment;
  }

  /**
   * Log enrollment activity
   */
  private static async logEnrollmentActivity(
    enrollmentId: string,
    leadId: string,
    activityType: string,
    userId: string
  ): Promise<void> {
    const supabase = await createClient();
    // Implementation to log activity to CRM or audit log
    // For now, we'll just log to console or a placeholder table if exists
    console.log(`Enrollment activity: ${activityType} for ${enrollmentId} by ${userId}`);
  }

  /**
   * Schedule the next step for an enrollment
   */
  private static async scheduleNextStep(enrollmentId: string): Promise<void> {
    const supabase = await createClient();

    // Get enrollment details
    const { data: enrollment } = await supabase
      .from('sequence_enrollments')
      .select(`
        *,
        template:sequence_templates(
          settings,
          steps:sequence_steps(*)
        )
      `)
      .eq('id', enrollmentId)
      .single();

    if (!enrollment || !enrollment.template?.steps) return;

    const nextStepNumber = enrollment.current_step + 1;
    const nextStep = enrollment.template.steps.find(
      (s: SequenceStep) => s.step_number === nextStepNumber
    );

    if (!nextStep) {
      // No more steps, mark as completed
      await supabase
        .from('sequence_enrollments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);
      return;
    }

    // Get optimal send window for recipient's timezone
    const optimalWindow = await TimezoneService.getOptimalSendWindow(
      enrollment.lead_id,
      enrollment.organization_id,
      nextStep.send_time_window
    );

    // Calculate base execution time
    const now = new Date();
    let nextExecutionTime = new Date(now);

    // Add wait time
    nextExecutionTime.setDate(nextExecutionTime.getDate() + nextStep.wait_days);
    nextExecutionTime.setHours(nextExecutionTime.getHours() + nextStep.wait_hours);

    // If we have timezone-aware scheduling enabled
    if (enrollment.template.settings?.useTimezoneScheduling) {
      // Use the optimal window for recipient's timezone
      if (nextExecutionTime < optimalWindow.nextWindowUTC) {
        nextExecutionTime = optimalWindow.nextWindowUTC;
      } else {
        // Apply recipient's time window to the calculated time
        const recipientTime = TimezoneService.convertToTimezone(
          nextExecutionTime,
          optimalWindow.timezone
        );

        const [startHour, startMinute] = optimalWindow.start.split(':').map(Number);
        const [endHour] = optimalWindow.end.split(':').map(Number);

        // Check if we're outside the window
        const hour = recipientTime.getHours();
        if (hour < startHour || hour >= endHour) {
          // Move to next available window
          recipientTime.setHours(startHour, startMinute, 0, 0);
          if (hour >= endHour) {
            // Move to next day if past window
            recipientTime.setDate(recipientTime.getDate() + 1);
          }

          // Skip weekends in recipient's timezone
          if (enrollment.template.settings?.skipWeekends) {
            const dayOfWeek = recipientTime.getDay();
            if (dayOfWeek === 0) { // Sunday
              recipientTime.setDate(recipientTime.getDate() + 1);
            } else if (dayOfWeek === 6) { // Saturday
              recipientTime.setDate(recipientTime.getDate() + 2);
            }
          }

          // Convert back to UTC (simplified - in production use proper library)
          nextExecutionTime = recipientTime;
        }
      }
    } else {
      // Original logic for non-timezone-aware scheduling
      if (nextStep.send_time_window) {
        const [startHour, startMinute] = nextStep.send_time_window.start.split(':').map(Number);
        const [endHour] = nextStep.send_time_window.end.split(':').map(Number);

        // If outside window, move to next window
        if (nextExecutionTime.getHours() < startHour ||
          nextExecutionTime.getHours() >= endHour) {
          nextExecutionTime.setHours(startHour, startMinute, 0, 0);
          if (nextExecutionTime < now) {
            nextExecutionTime.setDate(nextExecutionTime.getDate() + 1);
          }
        }
      }

      // Skip weekends if configured
      if (enrollment.template.settings?.skipWeekends) {
        const dayOfWeek = nextExecutionTime.getDay();
        if (dayOfWeek === 0) { // Sunday
          nextExecutionTime.setDate(nextExecutionTime.getDate() + 1);
        } else if (dayOfWeek === 6) { // Saturday
          nextExecutionTime.setDate(nextExecutionTime.getDate() + 2);
        }
      }
    }

    // Update enrollment with next scheduled time
    await supabase
      .from('sequence_enrollments')
      .update({
        next_step_scheduled_at: nextExecutionTime.toISOString(),
      })
      .eq('id', enrollmentId);
  }

  /**
   * Resolve the organization context for the current actor.
   * Allows system actors (e.g., behavioral triggers, playbooks) to operate by deriving
   * the organization from the target lead when no admin user is present.
   */
  private static async resolveOrganizationId(userId: string, leadId?: string): Promise<string | null> {
    const supabase = await createClient();

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('organization_id')
      .eq('clerk_user_id', userId)
      .single();

    if (adminUser?.organization_id) {
      return adminUser.organization_id;
    }

    if (!leadId) {
      return null;
    }

    const { data: lead } = await supabase
      .from('sales_leads')
      .select('organization_id')
      .eq('id', leadId)
      .single();

    return lead?.organization_id ?? null;
  }

  /**
   * Ensures we have a valid admin user id to attribute automated actions
   */
  private static async resolveActorUserId(
    userId: string,
    organizationId: string,
    supabaseClient?: Awaited<ReturnType<typeof createClient>>
  ): Promise<string> {
    const supabase = supabaseClient ?? (await createClient());

    const { data: existing } = await supabase
      .from('admin_users')
      .select('clerk_user_id')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (existing) {
      return userId;
    }

    if (!this.SYSTEM_ACTORS.has(userId)) {
      throw new Error('User not found or not authorized');
    }

    const automationUserId = `automation:${organizationId}`;

    await supabase
      .from('admin_users')
      .upsert(
        {
          clerk_user_id: automationUserId,
          email: `${organizationId}@automation.local`,
          display_name: 'System Automation',
          role: 'system',
          organization_id: organizationId,
          is_active: true,
        },
        { onConflict: 'clerk_user_id' }
      );

    return automationUserId;
  }
}

/**
 * Get sequence metrics for dashboard
 */
export async function getSequenceMetrics(userId: string): Promise<SequenceMetrics> {
  const supabase = await createClient();

  // Get user's organization
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('organization_id')
    .eq('clerk_user_id', userId)
    .single();

  if (!adminUser) {
    return {
      total_sequences: 0,
      active_enrollments: 0,
      completed_enrollments: 0,
      average_reply_rate: 0,
      average_open_rate: 0,
      average_click_rate: 0,
      total_replies: 0,
      total_meetings_booked: 0,
    };
  }

  // Get metrics using aggregation
  const { data: metrics } = await supabase
    .from('sequence_enrollments')
    .select('*')
    .eq('organization_id', adminUser.organization_id);

  const enrollments = metrics || [];

  const activeEnrollments = enrollments.filter((e: any) => e.status === 'active').length;
  const completedEnrollments = enrollments.filter((e: any) => e.status === 'completed').length;

  let totalReplies = 0;
  let totalMeetings = 0;
  let totalEmailsSent = 0;
  let totalEmailsOpened = 0;
  let totalEmailsClicked = 0;

  enrollments.forEach((e: any) => {
    totalReplies += e.replies_received || 0;
    totalMeetings += e.meetings_booked || 0;
    totalEmailsSent += e.emails_sent || 0;
    totalEmailsOpened += e.emails_opened || 0;
    totalEmailsClicked += e.emails_clicked || 0;
  });

  const { count: totalSequences } = await supabase
    .from('sequence_templates')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', adminUser.organization_id)
    .eq('is_active', true);

  return {
    total_sequences: totalSequences || 0,
    active_enrollments: activeEnrollments,
    completed_enrollments: completedEnrollments,
    average_reply_rate: totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0,
    average_open_rate: totalEmailsSent > 0 ? (totalEmailsOpened / totalEmailsSent) * 100 : 0,
    average_click_rate: totalEmailsSent > 0 ? (totalEmailsClicked / totalEmailsSent) * 100 : 0,
    total_replies: totalReplies,
    total_meetings_booked: totalMeetings,
  };
}

/**
 * Get performance metrics for all sequences
 */
export async function getSequencePerformance(userId: string): Promise<SequencePerformance[]> {
  const supabase = await createClient();

  const templates = await SequenceTemplateService.list(userId, { is_active: true });
  const performance: SequencePerformance[] = [];

  for (const template of templates) {
    const { data: enrollments } = await supabase
      .from('sequence_enrollments')
      .select('*')
      .eq('template_id', template.id);

    const enrollmentData = enrollments || [];
    const active = enrollmentData.filter((e: any) => e.status === 'active').length;
    const completed = enrollmentData.filter((e: any) => e.status === 'completed').length;

    let totalEmailsSent = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalReplies = 0;
    let totalMeetings = 0;

    enrollmentData.forEach((e: any) => {
      totalEmailsSent += e.emails_sent || 0;
      totalOpened += e.emails_opened || 0;
      totalClicked += e.emails_clicked || 0;
      totalReplies += e.replies_received || 0;
      totalMeetings += e.meetings_booked || 0;
    });

    performance.push({
      sequence_id: template.id,
      sequence_name: template.name,
      enrollments: enrollmentData.length,
      active,
      completed,
      reply_rate: totalEmailsSent > 0 ? (totalReplies / totalEmailsSent) * 100 : 0,
      open_rate: totalEmailsSent > 0 ? (totalOpened / totalEmailsSent) * 100 : 0,
      click_rate: totalEmailsSent > 0 ? (totalClicked / totalEmailsSent) * 100 : 0,
      meeting_rate: enrollmentData.length > 0 ? (totalMeetings / enrollmentData.length) * 100 : 0,
    });
  }

  return performance;
}
