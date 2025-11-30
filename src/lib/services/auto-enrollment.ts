/**
 * Auto-Enrollment Engine
 * Handles automated sequence enrollment based on triggers and rules
 */

import { createClient } from '@/lib/supabase/server';
import { SequenceEnrollmentService } from './sequences';
import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type TriggerType =
  | 'lead_created'
  | 'lead_status_change'
  | 'lead_score_threshold'
  | 'form_submission'
  | 'tag_added'
  | 'field_updated'
  | 'webhook'
  | 'scheduled';

export interface AutoEnrollmentRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  template_id: string;
  is_active: boolean;
  priority: number;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  lead_filters?: Record<string, any>;
  delay_minutes: number;
  max_enrollments_per_day?: number;
  max_total_enrollments?: number;
  execute_between_start?: string;
  execute_between_end?: string;
  execute_on_days?: number[];
  last_triggered_at?: string;
  total_enrollments: number;
  created_by: string;
}

export interface AutoEnrollmentLog {
  id: string;
  created_at: string;
  rule_id: string;
  lead_id?: string;
  status: 'enrolled' | 'skipped' | 'failed';
  skip_reason?: string;
  error_message?: string;
  trigger_data?: Record<string, any>;
  filters_evaluated?: Record<string, any>;
}

export interface ProcessResult {
  processed: number;
  enrolled: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const CreateRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  template_id: z.string().uuid(),
  is_active: z.boolean().default(true),
  priority: z.number().int().min(0).default(100),
  trigger_type: z.enum([
    'lead_created',
    'lead_status_change',
    'lead_score_threshold',
    'form_submission',
    'tag_added',
    'field_updated',
    'webhook',
    'scheduled'
  ]),
  trigger_config: z.record(z.string(), z.any()).default({}),
  lead_filters: z.record(z.string(), z.any()).optional(),
  delay_minutes: z.number().int().min(0).default(0),
  max_enrollments_per_day: z.number().int().min(1).optional(),
  max_total_enrollments: z.number().int().min(1).optional(),
  execute_between_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  execute_between_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  execute_on_days: z.array(z.number().int().min(0).max(6)).optional(),
});

// ============================================
// AUTO-ENROLLMENT ENGINE
// ============================================

export class AutoEnrollmentEngine {
  /**
   * Create a new auto-enrollment rule
   */
  static async createRule(
    data: z.infer<typeof CreateRuleSchema>,
    orgId: string,
    userId: string
  ): Promise<AutoEnrollmentRule> {
    const supabase = await createClient();

    // Validate input
    const validated = CreateRuleSchema.parse(data);

    // Check template exists and belongs to org
    const { data: template } = await supabase
      .from('sequence_templates')
      .select('id')
      .eq('id', validated.template_id)
      .eq('organization_id', orgId)
      .single();

    if (!template) {
      throw new Error('Sequence template not found');
    }

    // Create rule
    const { data: rule, error } = await supabase
      .from('sequence_auto_enrollment_rules')
      .insert({
        ...validated,
        organization_id: orgId,
        created_by: userId,
        last_modified_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return rule as AutoEnrollmentRule;
  }

  /**
   * Update an auto-enrollment rule
   */
  static async updateRule(
    ruleId: string,
    updates: Partial<z.infer<typeof CreateRuleSchema>>,
    orgId: string,
    userId: string
  ): Promise<AutoEnrollmentRule> {
    const supabase = await createClient();

    const { data: rule, error } = await supabase
      .from('sequence_auto_enrollment_rules')
      .update({
        ...updates,
        last_modified_by: userId,
      })
      .eq('id', ruleId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return rule as AutoEnrollmentRule;
  }

  /**
   * Process a trigger event
   */
  static async processTrigger(
    triggerType: TriggerType,
    triggerData: Record<string, any>,
    orgId: string
  ): Promise<ProcessResult> {
    const supabase = await createClient();
    const result: ProcessResult = {
      processed: 0,
      enrolled: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get active rules for this trigger type
      const { data: rules } = await supabase
        .from('sequence_auto_enrollment_rules')
        .select('*')
        .eq('organization_id', orgId)
        .eq('trigger_type', triggerType)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (!rules || rules.length === 0) {
        return result;
      }

      // Process each rule
      for (const rule of rules) {
        try {
          const ruleResult = await this.processRule(rule, triggerData);
          result.processed++;

          if (ruleResult.enrolled) {
            result.enrolled += ruleResult.enrolled;
          }
          if (ruleResult.skipped) {
            result.skipped += ruleResult.skipped;
          }
          if (ruleResult.errors.length > 0) {
            result.failed++;
            result.errors.push(...ruleResult.errors);
          }
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Rule ${rule.name}: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Failed to process trigger: ${error.message}`);
    }

    return result;
  }

  /**
   * Process a single rule
   */
  private static async processRule(
    rule: AutoEnrollmentRule,
    triggerData: Record<string, any>
  ): Promise<{ enrolled: number; skipped: number; errors: string[] }> {
    const supabase = await createClient();
    const result = { enrolled: 0, skipped: 0, errors: [] as string[] };

    // Check if rule matches trigger conditions
    if (!this.matchesTriggerConditions(rule, triggerData)) {
      result.skipped++;
      await this.logEnrollment(rule.id, triggerData.lead_id, 'skipped', 'trigger_conditions_not_met', triggerData);
      return result;
    }

    // Check execution window
    if (!this.isInExecutionWindow(rule)) {
      result.skipped++;
      await this.logEnrollment(rule.id, triggerData.lead_id, 'skipped', 'outside_execution_window', triggerData);
      return result;
    }

    // Check daily limit
    if (rule.max_enrollments_per_day) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('sequence_auto_enrollment_logs')
        .select('*', { count: 'exact', head: true })
        .eq('rule_id', rule.id)
        .eq('status', 'enrolled')
        .gte('created_at', today.toISOString());

      if (count && count >= rule.max_enrollments_per_day) {
        result.skipped++;
        await this.logEnrollment(rule.id, triggerData.lead_id, 'skipped', 'daily_limit_reached', triggerData);
        return result;
      }
    }

    // Check total limit
    if (rule.max_total_enrollments && rule.total_enrollments >= rule.max_total_enrollments) {
      result.skipped++;
      await this.logEnrollment(rule.id, triggerData.lead_id, 'skipped', 'total_limit_reached', triggerData);
      return result;
    }

    // Get leads to enroll based on trigger type
    const leads = await this.getLeadsToEnroll(rule, triggerData);

    // Process each lead
    for (const lead of leads) {
      try {
        // Check lead filters
        if (!this.matchesLeadFilters(lead, rule.lead_filters)) {
          result.skipped++;
          await this.logEnrollment(rule.id, lead.id, 'skipped', 'filters_not_matched', triggerData, rule.lead_filters);
          continue;
        }

        // Schedule enrollment with delay
        if (rule.delay_minutes > 0) {
          await this.scheduleDelayedEnrollment(lead.id, rule, triggerData);
        } else {
          // Enroll immediately
          await SequenceEnrollmentService.enroll({
            lead_id: lead.id,
            template_id: rule.template_id,
          }, 'auto_enrollment');

          result.enrolled++;
          await this.logEnrollment(rule.id, lead.id, 'enrolled', undefined, triggerData);

          // Update rule enrollment count
          await supabase
            .from('sequence_auto_enrollment_rules')
            .update({
              total_enrollments: rule.total_enrollments + 1,
              last_triggered_at: new Date().toISOString(),
            })
            .eq('id', rule.id);
        }
      } catch (error: any) {
        result.errors.push(`Lead ${lead.id}: ${error.message}`);
        await this.logEnrollment(rule.id, lead.id, 'failed', undefined, triggerData, undefined, error.message);
      }
    }

    return result;
  }

  /**
   * Check if trigger conditions are met
   */
  private static matchesTriggerConditions(
    rule: AutoEnrollmentRule,
    triggerData: Record<string, any>
  ): boolean {
    const config = rule.trigger_config;

    switch (rule.trigger_type) {
      case 'lead_status_change':
        return (
          config.from_status === triggerData.old_status &&
          config.to_status === triggerData.new_status
        );

      case 'lead_score_threshold':
        return (
          triggerData.score >= config.min_score &&
          (!config.max_score || triggerData.score <= config.max_score)
        );

      case 'tag_added':
        return config.tags?.includes(triggerData.tag);

      case 'field_updated':
        return (
          config.field_name === triggerData.field_name &&
          (!config.field_value || config.field_value === triggerData.new_value)
        );

      case 'form_submission':
        return config.form_id === triggerData.form_id;

      case 'lead_created':
      case 'scheduled':
      case 'webhook':
        return true;

      default:
        return false;
    }
  }

  /**
   * Check if current time is within execution window
   */
  private static isInExecutionWindow(rule: AutoEnrollmentRule): boolean {
    const now = new Date();

    // Check day of week
    if (rule.execute_on_days && rule.execute_on_days.length > 0) {
      if (!rule.execute_on_days.includes(now.getDay())) {
        return false;
      }
    }

    // Check time window
    if (rule.execute_between_start && rule.execute_between_end) {
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      return currentTime >= rule.execute_between_start && currentTime <= rule.execute_between_end;
    }

    return true;
  }

  /**
   * Get leads to enroll based on trigger
   */
  private static async getLeadsToEnroll(
    rule: AutoEnrollmentRule,
    triggerData: Record<string, any>
  ): Promise<any[]> {
    const supabase = await createClient();

    // For single lead triggers
    if (triggerData.lead_id) {
      const { data: lead } = await supabase
        .from('sales_leads')
        .select('*')
        .eq('id', triggerData.lead_id)
        .eq('organization_id', rule.organization_id)
        .single();

      return lead ? [lead] : [];
    }

    // For batch triggers (scheduled, webhook)
    if (rule.trigger_type === 'scheduled' || rule.trigger_type === 'webhook') {
      let query = supabase
        .from('sales_leads')
        .select('*')
        .eq('organization_id', rule.organization_id);

      // Apply basic filters from trigger config
      if (rule.trigger_config.lead_status) {
        query = query.eq('status', rule.trigger_config.lead_status);
      }

      if (rule.trigger_config.limit) {
        query = query.limit(rule.trigger_config.limit);
      }

      const { data: leads } = await query;
      return leads || [];
    }

    return [];
  }

  /**
   * Check if lead matches filter criteria
   */
  private static matchesLeadFilters(
    lead: any,
    filters?: Record<string, any>
  ): boolean {
    if (!filters) return true;

    // Status filter
    if (filters.status && !filters.status.includes(lead.status)) {
      return false;
    }

    // Tags filter
    if (filters.tags) {
      const leadTags = lead.tags || [];

      if (filters.tags.includes && !filters.tags.includes.some((tag: string) => leadTags.includes(tag))) {
        return false;
      }

      if (filters.tags.excludes && filters.tags.excludes.some((tag: string) => leadTags.includes(tag))) {
        return false;
      }
    }

    // Score filter
    if (filters.score) {
      const score = lead.lead_score || 0;

      if (filters.score.min !== undefined && score < filters.score.min) {
        return false;
      }

      if (filters.score.max !== undefined && score > filters.score.max) {
        return false;
      }
    }

    // Custom fields filter
    if (filters.custom_fields) {
      const customFields = lead.custom_fields || {};

      for (const [field, value] of Object.entries(filters.custom_fields)) {
        if (customFields[field] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Schedule delayed enrollment
   */
  private static async scheduleDelayedEnrollment(
    leadId: string,
    rule: AutoEnrollmentRule,
    triggerData: Record<string, any>
  ): Promise<void> {
    // In production, this would integrate with a job queue (Bull, BullMQ, etc.)
    // For now, we'll log it for manual processing
    await this.logEnrollment(
      rule.id,
      leadId,
      'skipped',
      'scheduled_for_later',
      triggerData
    );
  }

  /**
   * Log enrollment attempt
   */
  private static async logEnrollment(
    ruleId: string,
    leadId: string | undefined,
    status: 'enrolled' | 'skipped' | 'failed',
    skipReason?: string,
    triggerData?: Record<string, any>,
    filtersEvaluated?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('sequence_auto_enrollment_logs')
      .insert({
        rule_id: ruleId,
        lead_id: leadId,
        status,
        skip_reason: skipReason,
        error_message: errorMessage,
        trigger_data: triggerData,
        filters_evaluated: filtersEvaluated,
      });
  }

  /**
   * Get rules for organization
   */
  static async listRules(
    orgId: string,
    filters?: {
      is_active?: boolean;
      trigger_type?: TriggerType;
      template_id?: string;
    }
  ): Promise<AutoEnrollmentRule[]> {
    const supabase = await createClient();

    let query = supabase
      .from('sequence_auto_enrollment_rules')
      .select('*')
      .eq('organization_id', orgId)
      .order('priority', { ascending: true });

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters?.trigger_type) {
      query = query.eq('trigger_type', filters.trigger_type);
    }

    if (filters?.template_id) {
      query = query.eq('template_id', filters.template_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as AutoEnrollmentRule[];
  }

  /**
   * Process scheduled rules (called by cron job)
   */
  static async processScheduledRules(orgId: string): Promise<ProcessResult> {
    return this.processTrigger('scheduled', {}, orgId);
  }
}