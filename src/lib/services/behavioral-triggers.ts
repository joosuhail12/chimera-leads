/**
 * Behavioral Triggers Service
 * Processes prospect behavior events and triggers sequence actions in real-time
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type TriggerType =
  | 'page_visit'
  | 'email_open'
  | 'email_click'
  | 'email_reply'
  | 'form_submission'
  | 'linkedin_profile_view'
  | 'linkedin_connection_accepted'
  | 'meeting_booked'
  | 'document_viewed'
  | 'video_watched'
  | 'chat_interaction'
  | 'score_threshold'
  | 'custom_event';

export type ActionType =
  | 'enroll_in_sequence'
  | 'advance_to_step'
  | 'switch_branch'
  | 'pause_sequence'
  | 'resume_sequence'
  | 'add_tag'
  | 'update_field'
  | 'create_task'
  | 'send_notification'
  | 'webhook';

export interface BehavioralTrigger {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_conditions: Record<string, any>;
  action_type: ActionType;
  action_config: Record<string, any>;
  delay_minutes: number;
  cooldown_hours: number;
  max_triggers_per_lead?: number;
  max_triggers_total?: number;
  lead_filters?: Record<string, any>;
  priority: number;
  total_triggers: number;
  last_triggered_at?: string;
}

export interface BehavioralEvent {
  id?: string;
  organization_id: string;
  lead_id?: string;
  contact_email?: string;
  session_id?: string;
  event_type: string;
  event_data: Record<string, any>;
  source?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface TriggerExecutionResult {
  trigger_id: string;
  trigger_name: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  result_data?: Record<string, any>;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const CreateTriggerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  trigger_type: z.enum([
    'page_visit',
    'email_open',
    'email_click',
    'email_reply',
    'form_submission',
    'linkedin_profile_view',
    'linkedin_connection_accepted',
    'meeting_booked',
    'document_viewed',
    'video_watched',
    'chat_interaction',
    'score_threshold',
    'custom_event',
  ]),
  trigger_conditions: z.record(z.string(), z.any()),
  action_type: z.enum([
    'enroll_in_sequence',
    'advance_to_step',
    'switch_branch',
    'pause_sequence',
    'resume_sequence',
    'add_tag',
    'update_field',
    'create_task',
    'send_notification',
    'webhook',
  ]),
  action_config: z.record(z.string(), z.any()),
  delay_minutes: z.number().min(0).default(0),
  cooldown_hours: z.number().min(0).default(24),
  max_triggers_per_lead: z.number().min(1).optional(),
  max_triggers_total: z.number().min(1).optional(),
  lead_filters: z.record(z.string(), z.any()).optional(),
  priority: z.number().min(0).max(1000).default(100),
  is_active: z.boolean().default(true),
});

const TrackEventSchema = z.object({
  lead_id: z.string().uuid().optional(),
  contact_email: z.string().email().optional(),
  session_id: z.string().optional(),
  event_type: z.string(),
  event_data: z.record(z.string(), z.any()),
  source: z.string().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
});

// ============================================
// BEHAVIORAL TRIGGERS SERVICE
// ============================================

export class BehavioralTriggersService {
  /**
   * Create a new behavioral trigger
   */
  static async createTrigger(
    data: z.infer<typeof CreateTriggerSchema>,
    orgId: string,
    userId: string
  ): Promise<BehavioralTrigger> {
    const supabase = await createClient();

    // Validate input
    const validated = CreateTriggerSchema.parse(data);

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('sequence_behavioral_triggers')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', validated.name)
      .single();

    if (existing) {
      throw new Error(`Trigger with name "${validated.name}" already exists`);
    }

    // Create trigger
    const { data: trigger, error } = await supabase
      .from('sequence_behavioral_triggers')
      .insert({
        ...validated,
        organization_id: orgId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return trigger as BehavioralTrigger;
  }

  /**
   * Update a behavioral trigger
   */
  static async updateTrigger(
    triggerId: string,
    updates: Partial<z.infer<typeof CreateTriggerSchema>>,
    orgId: string
  ): Promise<BehavioralTrigger> {
    const supabase = await createClient();

    const { data: trigger, error } = await supabase
      .from('sequence_behavioral_triggers')
      .update(updates)
      .eq('id', triggerId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return trigger as BehavioralTrigger;
  }

  /**
   * Track a behavioral event
   */
  static async trackEvent(
    data: z.infer<typeof TrackEventSchema>,
    orgId: string
  ): Promise<string> {
    const supabase = await createClient();

    // Validate input
    const validated = TrackEventSchema.parse(data);

    // If email provided but no lead_id, try to find the lead
    let leadId = validated.lead_id;
    if (!leadId && validated.contact_email) {
      const { data: lead } = await supabase
        .from('sales_leads')
        .select('id')
        .eq('organization_id', orgId)
        .eq('email', validated.contact_email)
        .single();

      if (lead) {
        leadId = lead.id;
      }
    }

    // Store the event
    const { data: event, error } = await supabase
      .from('behavioral_events')
      .insert({
        ...validated,
        lead_id: leadId,
        organization_id: orgId,
        processed: false,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Process the event asynchronously
    this.processEvent(event.id, orgId).catch(console.error);

    return event.id;
  }

  /**
   * Process a behavioral event against all triggers
   */
  static async processEvent(
    eventId: string,
    orgId: string
  ): Promise<TriggerExecutionResult[]> {
    const supabase = await createClient();
    const results: TriggerExecutionResult[] = [];

    try {
      // Get the event
      const { data: event, error: eventError } = await supabase
        .from('behavioral_events')
        .select('*')
        .eq('id', eventId)
        .eq('organization_id', orgId)
        .single();

      if (eventError || !event) {
        throw new Error('Event not found');
      }

      // Get active triggers for this event type
      const { data: triggers } = await supabase
        .from('sequence_behavioral_triggers')
        .select('*')
        .eq('organization_id', orgId)
        .eq('trigger_type', event.event_type)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (!triggers || triggers.length === 0) {
        // Mark event as processed
        await supabase
          .from('behavioral_events')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('id', eventId);
        return results;
      }

      const matchedTriggerIds: string[] = [];

      // Evaluate each trigger
      for (const trigger of triggers) {
        try {
          // Check if conditions match
          const conditionsMatch = await this.evaluateConditions(
            trigger.trigger_conditions,
            event.event_data
          );

          if (!conditionsMatch) {
            continue;
          }

          // Check lead filters if applicable
          if (trigger.lead_filters && event.lead_id) {
            const leadMatches = await this.evaluateLeadFilters(
              event.lead_id,
              trigger.lead_filters,
              orgId
            );

            if (!leadMatches) {
              continue;
            }
          }

          // Check cooldown
          if (event.lead_id) {
            const cooldownPassed = await this.checkCooldown(
              trigger.id,
              event.lead_id
            );

            if (!cooldownPassed) {
              results.push({
                trigger_id: trigger.id,
                trigger_name: trigger.name,
                status: 'skipped',
                message: 'Cooldown period not met',
              });
              continue;
            }
          }

          // Check max triggers
          if (trigger.max_triggers_total && trigger.total_triggers >= trigger.max_triggers_total) {
            results.push({
              trigger_id: trigger.id,
              trigger_name: trigger.name,
              status: 'skipped',
              message: 'Max total triggers reached',
            });
            continue;
          }

          // Execute the action
          const actionResult = await this.executeAction(
            trigger,
            event,
            trigger.delay_minutes
          );

          results.push({
            trigger_id: trigger.id,
            trigger_name: trigger.name,
            ...actionResult,
          });

          matchedTriggerIds.push(trigger.id);

          // Update trigger stats
          await supabase
            .from('sequence_behavioral_triggers')
            .update({
              total_triggers: trigger.total_triggers + 1,
              last_triggered_at: new Date().toISOString(),
            })
            .eq('id', trigger.id);

        } catch (error: any) {
          results.push({
            trigger_id: trigger.id,
            trigger_name: trigger.name,
            status: 'failed',
            message: error.message,
          });
        }
      }

      // Mark event as processed
      await supabase
        .from('behavioral_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          matched_triggers: matchedTriggerIds,
        })
        .eq('id', eventId);

    } catch (error) {
      console.error('Error processing event:', error);
      throw error;
    }

    return results;
  }

  /**
   * Evaluate trigger conditions against event data
   */
  private static async evaluateConditions(
    conditions: Record<string, any>,
    eventData: Record<string, any>
  ): Promise<boolean> {
    for (const [key, condition] of Object.entries(conditions)) {
      const eventValue = eventData[key];

      // Handle different condition types
      if (typeof condition === 'object' && condition !== null) {
        // Complex conditions
        if ('equals' in condition && eventValue !== condition.equals) {
          return false;
        }
        if ('contains' in condition && !String(eventValue).includes(condition.contains)) {
          return false;
        }
        if ('gt' in condition && Number(eventValue) <= Number(condition.gt)) {
          return false;
        }
        if ('lt' in condition && Number(eventValue) >= Number(condition.lt)) {
          return false;
        }
        if ('gte' in condition && Number(eventValue) < Number(condition.gte)) {
          return false;
        }
        if ('lte' in condition && Number(eventValue) > Number(condition.lte)) {
          return false;
        }
        if ('in' in condition && !condition.in.includes(eventValue)) {
          return false;
        }
        if ('not_in' in condition && condition.not_in.includes(eventValue)) {
          return false;
        }
      } else {
        // Simple equality
        if (eventValue !== condition) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate lead filters
   */
  private static async evaluateLeadFilters(
    leadId: string,
    filters: Record<string, any>,
    orgId: string
  ): Promise<boolean> {
    const supabase = await createClient();

    const { data: lead } = await supabase
      .from('sales_leads')
      .select('*')
      .eq('id', leadId)
      .eq('organization_id', orgId)
      .single();

    if (!lead) return false;

    // Check each filter
    for (const [field, value] of Object.entries(filters)) {
      const leadValue = lead[field];

      if (Array.isArray(value)) {
        if (!value.includes(leadValue)) return false;
      } else if (typeof value === 'object' && value !== null) {
        // Complex conditions (same as event conditions)
        if ('gt' in value && Number(leadValue) <= Number(value.gt)) return false;
        if ('lt' in value && Number(leadValue) >= Number(value.lt)) return false;
        // ... other conditions
      } else {
        if (leadValue !== value) return false;
      }
    }

    return true;
  }

  /**
   * Check if cooldown period has passed
   */
  private static async checkCooldown(
    triggerId: string,
    leadId: string
  ): Promise<boolean> {
    const supabase = await createClient();

    const { data: canTrigger } = await supabase.rpc('check_trigger_cooldown', {
      p_trigger_id: triggerId,
      p_lead_id: leadId,
    });

    return canTrigger || false;
  }

  /**
   * Execute trigger action
   */
  private static async executeAction(
    trigger: BehavioralTrigger,
    event: BehavioralEvent,
    delayMinutes: number
  ): Promise<Omit<TriggerExecutionResult, 'trigger_id' | 'trigger_name'>> {
    const supabase = await createClient();

    // If delay is set, schedule for later
    if (delayMinutes > 0) {
      // In production, this would use a job queue
      // For now, we'll mark it as scheduled
      await supabase
        .from('trigger_execution_log')
        .insert({
          trigger_id: trigger.id,
          event_id: event.id,
          lead_id: event.lead_id,
          action_type: trigger.action_type,
          action_config: trigger.action_config,
          status: 'scheduled',
          result_data: { scheduled_for: new Date(Date.now() + delayMinutes * 60000).toISOString() },
        });

      return {
        status: 'success',
        message: `Action scheduled for ${delayMinutes} minutes`,
      };
    }

    // Execute action based on type
    try {
      let result: any;

      switch (trigger.action_type) {
        case 'enroll_in_sequence':
          result = await this.enrollInSequence(event.lead_id!, trigger.action_config);
          break;

        case 'advance_to_step':
          result = await this.advanceSequenceStep(event.lead_id!, trigger.action_config);
          break;

        case 'switch_branch':
          result = await this.switchBranch(event.lead_id!, trigger.action_config);
          break;

        case 'pause_sequence':
          result = await this.pauseSequence(event.lead_id!, trigger.action_config);
          break;

        case 'add_tag':
          result = await this.addTag(event.lead_id!, trigger.action_config);
          break;

        case 'update_field':
          result = await this.updateField(event.lead_id!, trigger.action_config);
          break;

        case 'create_task':
          result = await this.createTask(event.lead_id!, trigger.action_config);
          break;

        case 'webhook':
          result = await this.callWebhook(trigger.action_config, event);
          break;

        default:
          throw new Error(`Unsupported action type: ${trigger.action_type}`);
      }

      // Log successful execution
      await supabase
        .from('trigger_execution_log')
        .insert({
          trigger_id: trigger.id,
          event_id: event.id,
          lead_id: event.lead_id,
          action_type: trigger.action_type,
          action_config: trigger.action_config,
          status: 'success',
          result_data: result,
        });

      return {
        status: 'success',
        result_data: result,
      };

    } catch (error: any) {
      // Log failed execution
      await supabase
        .from('trigger_execution_log')
        .insert({
          trigger_id: trigger.id,
          event_id: event.id,
          lead_id: event.lead_id,
          action_type: trigger.action_type,
          action_config: trigger.action_config,
          status: 'failed',
          error_message: error.message,
        });

      return {
        status: 'failed',
        message: error.message,
      };
    }
  }

  // ============================================
  // ACTION HANDLERS
  // ============================================

  private static async enrollInSequence(leadId: string, config: any) {
    const { SequenceEnrollmentService } = await import('./sequences');

    return SequenceEnrollmentService.enroll(
      {
        lead_id: leadId,
        template_id: config.sequence_id || config.template_id,
      },
      'behavioral_trigger'
    );
  }

  private static async advanceSequenceStep(leadId: string, config: any) {
    const supabase = await createClient();

    const { data: enrollment } = await supabase
      .from('sequence_enrollments')
      .select('id, current_step')
      .eq('lead_id', leadId)
      .eq('status', 'active')
      .single();

    if (!enrollment) {
      throw new Error('No active enrollment found');
    }

    const newStep = enrollment.current_step + (config.steps_to_advance || 1);

    return supabase
      .from('sequence_enrollments')
      .update({ current_step: newStep })
      .eq('id', enrollment.id);
  }

  private static async switchBranch(leadId: string, config: any) {
    // This will be implemented with the branching engine
    return { branch_switched: true, branch_name: config.branch_name };
  }

  private static async pauseSequence(leadId: string, config: any) {
    const supabase = await createClient();

    return supabase
      .from('sequence_enrollments')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        paused_reason: config.reason || 'Behavioral trigger',
      })
      .eq('lead_id', leadId)
      .eq('status', 'active');
  }

  private static async addTag(leadId: string, config: any) {
    const supabase = await createClient();

    const { data: lead } = await supabase
      .from('sales_leads')
      .select('tags')
      .eq('id', leadId)
      .single();

    const currentTags = lead?.tags || [];
    const newTags = Array.isArray(config.tags) ? config.tags : [config.tag];
    const updatedTags = [...new Set([...currentTags, ...newTags])];

    return supabase
      .from('sales_leads')
      .update({ tags: updatedTags })
      .eq('id', leadId);
  }

  private static async updateField(leadId: string, config: any) {
    const supabase = await createClient();

    const updates: any = {};

    if (config.field && config.value !== undefined) {
      updates[config.field] = config.value;
    } else if (config.fields) {
      Object.assign(updates, config.fields);
    }

    return supabase
      .from('sales_leads')
      .update(updates)
      .eq('id', leadId);
  }

  private static async createTask(leadId: string, config: any) {
    const supabase = await createClient();

    return supabase
      .from('crm_activities')
      .insert({
        lead_id: leadId,
        activity_type: 'task',
        title: config.title || 'Follow up on behavioral trigger',
        description: config.description,
        due_date: config.due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: config.priority || 'medium',
        assigned_to: config.assigned_to,
      });
  }

  private static async callWebhook(config: any, event: BehavioralEvent) {
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify({
        trigger: config,
        event: event,
      }),
    });

    return {
      status: response.status,
      statusText: response.statusText,
    };
  }

  // ============================================
  // QUERY METHODS
  // ============================================

  /**
   * List all triggers for an organization
   */
  static async listTriggers(
    orgId: string,
    filters?: {
      is_active?: boolean;
      trigger_type?: TriggerType;
      action_type?: ActionType;
    }
  ): Promise<BehavioralTrigger[]> {
    const supabase = await createClient();

    let query = supabase
      .from('sequence_behavioral_triggers')
      .select('*')
      .eq('organization_id', orgId)
      .order('priority', { ascending: false });

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters?.trigger_type) {
      query = query.eq('trigger_type', filters.trigger_type);
    }

    if (filters?.action_type) {
      query = query.eq('action_type', filters.action_type);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as BehavioralTrigger[];
  }

  /**
   * Get trigger execution history
   */
  static async getTriggerHistory(
    triggerId: string,
    limit = 100
  ): Promise<any[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('trigger_execution_log')
      .select(`
        *,
        event:behavioral_events(event_type, event_data),
        lead:sales_leads(first_name, last_name, email)
      `)
      .eq('trigger_id', triggerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get lead's behavioral events
   */
  static async getLeadEvents(
    leadId: string,
    limit = 50
  ): Promise<BehavioralEvent[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('behavioral_events')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as BehavioralEvent[];
  }
}