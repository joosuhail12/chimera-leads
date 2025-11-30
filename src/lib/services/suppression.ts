/**
 * Suppression Service
 * Manages email suppressions and unsubscribe preferences for sequence enrollments
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type SuppressionReason =
  | 'unsubscribe'
  | 'bounce'
  | 'complaint'
  | 'competitor'
  | 'customer'
  | 'manual'
  | 'invalid';

export type SuppressionSource =
  | 'manual'
  | 'import'
  | 'auto'
  | 'unsubscribe_link'
  | 'bounce_webhook';

export interface Suppression {
  id: string;
  created_at: string;
  organization_id: string;
  email?: string;
  domain?: string;
  lead_id?: string;
  reason: SuppressionReason;
  source?: SuppressionSource;
  expires_at?: string;
  is_active: boolean;
  added_by?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UnsubscribePreferences {
  id: string;
  organization_id: string;
  lead_id?: string;
  email: string;
  all_sequences: boolean;
  marketing_emails: boolean;
  transactional_emails: boolean;
  max_emails_per_week?: number;
  preferred_send_days?: number[];
  preferred_send_time_start?: string;
  preferred_send_time_end?: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  excluded_sequence_template_ids: string[];
  excluded_sequence_categories: string[];
  unsubscribe_token: string;
  last_updated_at?: string;
  unsubscribe_reason?: string;
  unsubscribe_feedback?: string;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const AddSuppressionSchema = z.object({
  email: z.string().email().optional(),
  domain: z.string().optional(),
  lead_id: z.string().uuid().optional(),
  reason: z.enum(['unsubscribe', 'bounce', 'complaint', 'competitor', 'customer', 'manual', 'invalid']),
  source: z.enum(['manual', 'import', 'auto', 'unsubscribe_link', 'bounce_webhook']).optional(),
  expires_at: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).refine(
  (data) => data.email || data.domain || data.lead_id,
  { message: 'At least one of email, domain, or lead_id must be provided' }
);

const UpdatePreferencesSchema = z.object({
  all_sequences: z.boolean().optional(),
  marketing_emails: z.boolean().optional(),
  transactional_emails: z.boolean().optional(),
  max_emails_per_week: z.number().min(0).max(50).optional(),
  preferred_send_days: z.array(z.number().min(0).max(6)).optional(),
  preferred_send_time_start: z.string().optional(),
  preferred_send_time_end: z.string().optional(),
  email_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  excluded_sequence_template_ids: z.array(z.string().uuid()).optional(),
  excluded_sequence_categories: z.array(z.string()).optional(),
  unsubscribe_reason: z.string().optional(),
  unsubscribe_feedback: z.string().optional(),
});

// ============================================
// SUPPRESSION SERVICE
// ============================================

export class SuppressionService {
  /**
   * Check if a lead can be enrolled in sequences
   */
  static async canEnrollLead(
    leadId: string,
    orgId: string,
    leadEmail?: string
  ): Promise<{ canEnroll: boolean; reason?: string }> {
    const supabase = await createClient();

    try {
      // Use the database function for comprehensive checks
      const { data, error } = await supabase.rpc('can_enroll_lead', {
        p_lead_id: leadId,
        p_lead_email: leadEmail || '',
        p_organization_id: orgId,
      });

      if (error) throw error;

      if (!data) {
        // Get specific reason for suppression
        const reason = await this.getSuppressionReason(leadId, orgId, leadEmail);
        return { canEnroll: false, reason };
      }

      return { canEnroll: true };
    } catch (error) {
      console.error('Error checking enrollment eligibility:', error);
      return { canEnroll: false, reason: 'Error checking suppression status' };
    }
  }

  /**
   * Get the specific reason why a lead is suppressed
   */
  private static async getSuppressionReason(
    leadId: string,
    orgId: string,
    leadEmail?: string
  ): Promise<string> {
    const supabase = await createClient();

    // Check suppressions
    const { data: suppression } = await supabase
      .from('sequence_suppressions')
      .select('reason')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .or(`lead_id.eq.${leadId},email.eq.${leadEmail}`)
      .single();

    if (suppression) {
      return `Lead is suppressed: ${suppression.reason}`;
    }

    // Check unsubscribe preferences
    const { data: preferences } = await supabase
      .from('unsubscribe_preferences')
      .select('all_sequences')
      .eq('organization_id', orgId)
      .or(`lead_id.eq.${leadId},email.eq.${leadEmail}`)
      .single();

    if (preferences?.all_sequences) {
      return 'Lead has unsubscribed from all sequences';
    }

    return 'Lead is suppressed';
  }

  /**
   * Add a suppression entry
   */
  static async addSuppression(
    data: z.infer<typeof AddSuppressionSchema>,
    orgId: string,
    userId: string
  ): Promise<Suppression> {
    const supabase = await createClient();

    // Validate input
    const validated = AddSuppressionSchema.parse(data);

    const { data: suppression, error } = await supabase
      .from('sequence_suppressions')
      .insert({
        ...validated,
        organization_id: orgId,
        added_by: userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return suppression as Suppression;
  }

  /**
   * Bulk import suppressions from CSV/JSON
   */
  static async bulkImport(
    suppressions: Array<{
      email?: string;
      domain?: string;
      reason: SuppressionReason;
      notes?: string;
    }>,
    orgId: string,
    userId: string
  ): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }> {
    const supabase = await createClient();
    const results = {
      imported: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < suppressions.length; i += batchSize) {
      const batch = suppressions.slice(i, i + batchSize);

      const validatedBatch = batch
        .map((item, index) => {
          try {
            const validated = AddSuppressionSchema.parse({
              ...item,
              source: 'import',
            });
            return {
              ...validated,
              organization_id: orgId,
              added_by: userId,
              is_active: true,
            };
          } catch (error) {
            results.failed++;
            results.errors.push(`Row ${i + index + 1}: ${error}`);
            return null;
          }
        })
        .filter(Boolean);

      if (validatedBatch.length > 0) {
        const { error } = await supabase
          .from('sequence_suppressions')
          .upsert(validatedBatch, {
            onConflict: 'organization_id,email',
          });

        if (error) {
          results.failed += validatedBatch.length;
          results.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
        } else {
          results.imported += validatedBatch.length;
        }
      }
    }

    return results;
  }

  /**
   * Remove a suppression
   */
  static async removeSuppression(
    suppressionId: string,
    orgId: string
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('sequence_suppressions')
      .update({ is_active: false })
      .eq('id', suppressionId)
      .eq('organization_id', orgId);

    if (error) throw error;
  }

  /**
   * Get suppression list
   */
  static async listSuppressions(
    orgId: string,
    filters?: {
      reason?: SuppressionReason;
      source?: SuppressionSource;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ suppressions: Suppression[]; total: number }> {
    const supabase = await createClient();

    let query = supabase
      .from('sequence_suppressions')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (filters?.reason) {
      query = query.eq('reason', filters.reason);
    }

    if (filters?.source) {
      query = query.eq('source', filters.source);
    }

    if (filters?.search) {
      query = query.or(`email.ilike.%${filters.search}%,domain.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      suppressions: (data || []) as Suppression[],
      total: count || 0,
    };
  }

  /**
   * Get unsubscribe preferences for a lead
   */
  static async getPreferences(
    leadId: string,
    orgId: string
  ): Promise<UnsubscribePreferences | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('unsubscribe_preferences')
      .select('*')
      .eq('organization_id', orgId)
      .eq('lead_id', leadId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as UnsubscribePreferences | null;
  }

  /**
   * Get preferences by unsubscribe token
   */
  static async getPreferencesByToken(
    token: string
  ): Promise<UnsubscribePreferences | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('unsubscribe_preferences')
      .select('*')
      .eq('unsubscribe_token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as UnsubscribePreferences | null;
  }

  /**
   * Update unsubscribe preferences
   */
  static async updatePreferences(
    leadId: string,
    orgId: string,
    preferences: z.infer<typeof UpdatePreferencesSchema>
  ): Promise<UnsubscribePreferences> {
    const supabase = await createClient();

    // Validate input
    const validated = UpdatePreferencesSchema.parse(preferences);

    // Get lead email
    const { data: lead } = await supabase
      .from('sales_leads')
      .select('email')
      .eq('id', leadId)
      .single();

    if (!lead) throw new Error('Lead not found');

    // Upsert preferences
    const { data, error } = await supabase
      .from('unsubscribe_preferences')
      .upsert({
        lead_id: leadId,
        organization_id: orgId,
        email: lead.email,
        ...validated,
        last_updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,lead_id',
      })
      .select()
      .single();

    if (error) throw error;
    return data as UnsubscribePreferences;
  }

  /**
   * Create or get unsubscribe token for a lead
   */
  static async getOrCreateUnsubscribeToken(
    leadId: string,
    leadEmail: string,
    orgId: string
  ): Promise<string> {
    const supabase = await createClient();

    // Check if preferences exist
    const { data: existing } = await supabase
      .from('unsubscribe_preferences')
      .select('unsubscribe_token')
      .eq('organization_id', orgId)
      .eq('lead_id', leadId)
      .single();

    if (existing?.unsubscribe_token) {
      return existing.unsubscribe_token;
    }

    // Create new preferences with token
    const { data, error } = await supabase
      .from('unsubscribe_preferences')
      .insert({
        lead_id: leadId,
        email: leadEmail,
        organization_id: orgId,
      })
      .select('unsubscribe_token')
      .single();

    if (error) throw error;
    return data.unsubscribe_token;
  }

  /**
   * Check if email/domain is globally suppressed
   */
  static async isGloballySuppressed(
    email: string,
    orgId: string
  ): Promise<boolean> {
    const supabase = await createClient();
    const domain = email.split('@')[1];

    const { data } = await supabase
      .from('sequence_suppressions')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .or(`email.eq.${email},domain.eq.${domain}`)
      .limit(1);

    return (data && data.length > 0) || false;
  }

  /**
   * Handle bounce notification
   */
  static async handleBounce(
    email: string,
    orgId: string,
    bounceType: 'hard' | 'soft',
    metadata?: Record<string, any>
  ): Promise<void> {
    const supabase = await createClient();

    // For hard bounces, add to suppression list
    if (bounceType === 'hard') {
      await supabase
        .from('sequence_suppressions')
        .upsert({
          email,
          organization_id: orgId,
          reason: 'bounce',
          source: 'bounce_webhook',
          is_active: true,
          metadata: {
            bounce_type: bounceType,
            ...metadata,
          },
        }, {
          onConflict: 'organization_id,email',
        });
    }

    // Update lead record
    // Update lead record
    const { data: lead } = await supabase
      .from('sales_leads')
      .select('bounce_count')
      .eq('email', email)
      .eq('organization_id', orgId)
      .single();

    if (lead) {
      await supabase
        .from('sales_leads')
        .update({
          last_bounce_at: new Date().toISOString(),
          bounce_count: (lead.bounce_count || 0) + 1,
          email_valid: bounceType === 'hard' ? false : undefined,
        })
        .eq('email', email)
        .eq('organization_id', orgId);
    }
  }

  /**
   * Handle complaint notification
   */
  static async handleComplaint(
    email: string,
    orgId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const supabase = await createClient();

    // Add to suppression list
    await supabase
      .from('sequence_suppressions')
      .upsert({
        email,
        organization_id: orgId,
        reason: 'complaint',
        source: 'auto',
        is_active: true,
        metadata,
      }, {
        onConflict: 'organization_id,email',
      });
  }
}