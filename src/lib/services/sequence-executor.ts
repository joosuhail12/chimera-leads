/**
 * Sequence Execution Engine
 * Processes scheduled sequence steps and manages execution flow
 */

import { createClient } from '@/lib/supabase/server';
import {
  SequenceEnrollment,
  SequenceStep,
  SequenceStepExecution,
  ExecutionStatus,
} from '@/lib/types/sequences';

export class SequenceExecutor {
  /**
   * Process all due sequence steps
   * This should be called by a cron job or background worker
   */
  static async processScheduledSteps(): Promise<{
    processed: number;
    errors: string[];
  }> {
    const supabase = await createClient();
    const results = {
      processed: 0,
      errors: [] as string[],
    };

    try {
      // Get all active enrollments with steps due for execution
      const { data: dueEnrollments, error } = await supabase
        .from('sequence_enrollments')
        .select(`
          *,
          template:sequence_templates!inner(
            id,
            name,
            settings,
            steps:sequence_steps(*)
          ),
          lead:sales_leads(
            id,
            email,
            first_name,
            last_name,
            company,
            custom_fields
          )
        `)
        .eq('status', 'active')
        .lte('next_step_scheduled_at', new Date().toISOString())
        .order('next_step_scheduled_at', { ascending: true })
        .limit(50); // Process in batches

      if (error) {
        console.error('Error fetching due enrollments:', error);
        results.errors.push(`Failed to fetch enrollments: ${error.message}`);
        return results;
      }

      if (!dueEnrollments || dueEnrollments.length === 0) {
        return results;
      }

      // Process each enrollment
      for (const enrollment of dueEnrollments) {
        try {
          await this.processEnrollmentStep(enrollment);
          results.processed++;
        } catch (error: any) {
          console.error(`Error processing enrollment ${enrollment.id}:`, error);
          results.errors.push(`Enrollment ${enrollment.id}: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.error('Error in sequence executor:', error);
      results.errors.push(`Executor error: ${error.message}`);
    }

    return results;
  }

  /**
   * Process a single enrollment's next step
   */
  private static async processEnrollmentStep(enrollment: any): Promise<void> {
    const supabase = await createClient();

    // Get the next step to execute
    const nextStepNumber = enrollment.current_step + 1;
    const nextStep = enrollment.template?.steps?.find(
      (s: SequenceStep) => s.step_number === nextStepNumber
    );

    if (!nextStep) {
      // No more steps, mark enrollment as completed
      await supabase
        .from('sequence_enrollments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          next_step_scheduled_at: null,
        })
        .eq('id', enrollment.id);
      return;
    }

    // Check for pause conditions
    if (await this.shouldPauseEnrollment(enrollment, nextStep)) {
      return;
    }

    // Execute the step based on type
    let execution: Partial<SequenceStepExecution> = {
      enrollment_id: enrollment.id,
      step_id: nextStep.id,
      status: 'pending' as ExecutionStatus,
    };

    try {
      switch (nextStep.step_type) {
        case 'email':
          execution = await this.executeEmailStep(enrollment, nextStep);
          break;
        case 'task':
          execution = await this.executeTaskStep(enrollment, nextStep);
          break;
        case 'wait':
          execution = await this.executeWaitStep(enrollment, nextStep);
          break;
        case 'conditional':
          execution = await this.executeConditionalStep(enrollment, nextStep);
          break;
        case 'webhook':
          execution = await this.executeWebhookStep(enrollment, nextStep);
          break;
        default:
          throw new Error(`Unknown step type: ${nextStep.step_type}`);
      }

      // Record successful execution
      await supabase
        .from('sequence_step_executions')
        .insert({
          ...execution,
          status: 'success',
        });

      // Update enrollment progress
      await this.updateEnrollmentProgress(enrollment.id, nextStepNumber);

      // Schedule next step
      await this.scheduleNextStep(enrollment.id, nextStepNumber, enrollment.template);

    } catch (error: any) {
      // Record failed execution
      await supabase
        .from('sequence_step_executions')
        .insert({
          ...execution,
          status: 'failed',
          error_message: error.message,
        });

      // Retry logic could be added here
      throw error;
    }
  }

  /**
   * Check if enrollment should be paused
   */
  private static async shouldPauseEnrollment(
    enrollment: any,
    nextStep: SequenceStep
  ): Promise<boolean> {
    const supabase = await createClient();
    const settings = enrollment.template?.settings;

    // Check for replies if pauseOnReply is enabled
    if (settings?.pauseOnReply && enrollment.replies_received > 0) {
      await supabase
        .from('sequence_enrollments')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          paused_reason: 'Lead replied to sequence',
        })
        .eq('id', enrollment.id);
      return true;
    }

    // Check for meetings if pauseOnMeeting is enabled
    if (settings?.pauseOnMeeting && enrollment.meetings_booked > 0) {
      await supabase
        .from('sequence_enrollments')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          paused_reason: 'Meeting booked with lead',
        })
        .eq('id', enrollment.id);
      return true;
    }

    // Check daily limit
    if (settings?.dailyLimit) {
      const { count } = await supabase
        .from('sequence_step_executions')
        .select('*', { count: 'exact', head: true })
        .eq('enrollment_id', enrollment.id)
        .eq('step_id', nextStep.id)
        .gte('executed_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

      if (count && count >= settings.dailyLimit) {
        // Reschedule for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);

        await supabase
          .from('sequence_enrollments')
          .update({
            next_step_scheduled_at: tomorrow.toISOString(),
          })
          .eq('id', enrollment.id);
        return true;
      }
    }

    return false;
  }

  /**
   * Execute an email step
   */
  private static async executeEmailStep(
    enrollment: any,
    step: SequenceStep
  ): Promise<Partial<SequenceStepExecution>> {
    // Import email sender (dynamic import to avoid circular dependencies)
    const { sendSequenceEmail, htmlToText } = await import('@/lib/email/sequence-email-sender');

    // Replace variables in email content
    const personalizedSubject = this.replaceVariables(
      step.email_subject || '',
      enrollment.lead
    );
    const personalizedBodyHtml = this.replaceVariables(
      step.email_body || '',
      enrollment.lead
    );

    // Convert HTML to plain text for multipart email
    const personalizedBodyText = htmlToText(personalizedBodyHtml);

    // Get sender email (from env or organization settings)
    const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@example.com';
    const fromName = step.email_from_name || 'Your Company';

    // Create a new execution record first to get the ID for tracking
    const supabase = await createClient();
    const { data: execution } = await supabase
      .from('sequence_step_executions')
      .insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        status: 'pending',
      })
      .select()
      .single();

    // Send the email
    const result = await sendSequenceEmail({
      to: enrollment.lead.email,
      from: fromEmail,
      fromName: fromName,
      replyTo: step.email_reply_to || undefined,
      subject: personalizedSubject,
      bodyHtml: personalizedBodyHtml,
      bodyText: personalizedBodyText,
      enrollmentId: enrollment.id,
      stepId: step.id,
      executionId: execution?.id,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    // Update enrollment metrics
    await supabase
      .from('sequence_enrollments')
      .update({
        emails_sent: enrollment.emails_sent + 1,
      })
      .eq('id', enrollment.id);

    return {
      enrollment_id: enrollment.id,
      step_id: step.id,
      email_provider: 'ses',
      email_message_id: result.messageId,
    };
  }

  /**
   * Execute a task step
   */
  private static async executeTaskStep(
    enrollment: any,
    step: SequenceStep
  ): Promise<Partial<SequenceStepExecution>> {
    const supabase = await createClient();

    // Create task in CRM
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (step.task_due_days || 1));

    const { data: task, error } = await supabase
      .from('crm_tasks')
      .insert({
        lead_id: enrollment.lead_id,
        title: this.replaceVariables(step.task_title || '', enrollment.lead),
        description: this.replaceVariables(step.task_description || '', enrollment.lead),
        priority: step.task_priority || 'medium',
        status: 'pending',
        due_date: dueDate.toISOString(),
        created_by: 'system', // Could be the enrollment creator
      })
      .select()
      .single();

    if (error) throw error;

    return {
      enrollment_id: enrollment.id,
      step_id: step.id,
      task_id: task.id,
    };
  }

  /**
   * Execute a wait step (basically does nothing except progress)
   */
  private static async executeWaitStep(
    enrollment: any,
    step: SequenceStep
  ): Promise<Partial<SequenceStepExecution>> {
    // Wait steps just mark completion and move to next
    return {
      enrollment_id: enrollment.id,
      step_id: step.id,
    };
  }

  /**
   * Execute a conditional step
   */
  private static async executeConditionalStep(
    enrollment: any,
    step: SequenceStep
  ): Promise<Partial<SequenceStepExecution>> {
    const conditions = step.conditions;

    if (!conditions) {
      return {
        enrollment_id: enrollment.id,
        step_id: step.id,
      };
    }

    // Evaluate condition
    let conditionMet = false;

    switch (conditions.type) {
      case 'email_opened':
        conditionMet = enrollment.emails_opened > 0;
        break;
      case 'email_clicked':
        conditionMet = enrollment.emails_clicked > 0;
        break;
      case 'replied':
        conditionMet = enrollment.replies_received > 0;
        break;
      case 'not_replied':
        conditionMet = enrollment.replies_received === 0;
        break;
    }

    // Handle branching logic
    if (conditionMet && conditions.goto_step) {
      // Jump to specific step
      const supabase = await createClient();
      await supabase
        .from('sequence_enrollments')
        .update({
          current_step: conditions.goto_step - 1, // Will be incremented
        })
        .eq('id', enrollment.id);
    } else if (!conditionMet && conditions.skip_to_end) {
      // End sequence
      const supabase = await createClient();
      await supabase
        .from('sequence_enrollments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id);
    }

    return {
      enrollment_id: enrollment.id,
      step_id: step.id,
      execution_metadata: { condition_met: conditionMet },
    };
  }

  /**
   * Execute a webhook step
   */
  private static async executeWebhookStep(
    enrollment: any,
    step: SequenceStep
  ): Promise<Partial<SequenceStepExecution>> {
    if (!step.webhook_url) {
      throw new Error('Webhook URL is required');
    }

    // Prepare webhook payload
    const payload = {
      enrollment_id: enrollment.id,
      lead: enrollment.lead,
      step_number: step.step_number,
      custom_body: step.webhook_body,
    };

    // Make webhook request
    const response = await fetch(step.webhook_url, {
      method: step.webhook_method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...step.webhook_headers,
      },
      body: JSON.stringify(payload),
    });

    return {
      enrollment_id: enrollment.id,
      step_id: step.id,
      webhook_response_code: response.status,
      webhook_response_body: await response.text(),
    };
  }

  /**
   * Update enrollment progress
   */
  private static async updateEnrollmentProgress(
    enrollmentId: string,
    completedStep: number
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('sequence_enrollments')
      .update({
        current_step: completedStep,
        last_step_executed_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId);
  }

  /**
   * Schedule the next step execution
   */
  private static async scheduleNextStep(
    enrollmentId: string,
    currentStep: number,
    template: any
  ): Promise<void> {
    const supabase = await createClient();

    const nextStepNumber = currentStep + 1;
    const nextStep = template?.steps?.find(
      (s: SequenceStep) => s.step_number === nextStepNumber
    );

    if (!nextStep) {
      // No more steps
      return;
    }

    // Calculate next execution time
    const nextExecutionTime = new Date();

    // Add wait time
    nextExecutionTime.setDate(nextExecutionTime.getDate() + (nextStep.wait_days || 0));
    nextExecutionTime.setHours(nextExecutionTime.getHours() + (nextStep.wait_hours || 0));

    // Apply time window if specified
    if (nextStep.send_time_window) {
      const [startHour, startMinute] = nextStep.send_time_window.start.split(':').map(Number);
      const [endHour] = nextStep.send_time_window.end.split(':').map(Number);

      // If outside window, move to next window
      if (nextExecutionTime.getHours() < startHour ||
        nextExecutionTime.getHours() >= endHour) {
        nextExecutionTime.setHours(startHour, startMinute, 0, 0);
        if (nextExecutionTime < new Date()) {
          nextExecutionTime.setDate(nextExecutionTime.getDate() + 1);
        }
      }
    }

    // Skip weekends if configured
    if (template.settings?.skipWeekends) {
      const dayOfWeek = nextExecutionTime.getDay();
      if (dayOfWeek === 0) { // Sunday
        nextExecutionTime.setDate(nextExecutionTime.getDate() + 1);
      } else if (dayOfWeek === 6) { // Saturday
        nextExecutionTime.setDate(nextExecutionTime.getDate() + 2);
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
   * Replace variables in text with lead data
   */
  private static replaceVariables(text: string, lead: any): string {
    if (!text || !lead) return text;

    let result = text;

    // Replace standard variables
    result = result.replace(/{first_name}/gi, lead.first_name || '');
    result = result.replace(/{last_name}/gi, lead.last_name || '');
    result = result.replace(/{company}/gi, lead.company || '');
    result = result.replace(/{email}/gi, lead.email || '');

    // Replace custom field variables
    if (lead.custom_fields) {
      Object.entries(lead.custom_fields).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'gi');
        result = result.replace(regex, String(value || ''));
      });
    }

    return result;
  }
}