/**
 * Sequence Branching Service
 * Manages dynamic branching logic for adaptive sequences
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type ConditionType =
  | 'behavior'
  | 'engagement'
  | 'field_value'
  | 'score'
  | 'time_elapsed'
  | 'previous_step'
  | 'custom'
  | 'default';

export interface SequenceBranch {
  id: string;
  sequence_template_id: string;
  parent_step_id: string;
  branch_name: string;
  description?: string;
  condition_type: ConditionType;
  condition_config: Record<string, any>;
  next_step_id?: string;
  priority: number;
  total_enrollments: number;
  conversion_rate?: number;
}

export interface BranchEvaluation {
  branch_id: string;
  branch_name: string;
  condition_type: ConditionType;
  evaluated: boolean;
  matched: boolean;
  reason?: string;
}

export interface BranchingDecision {
  enrollment_id: string;
  current_step_id: string;
  evaluations: BranchEvaluation[];
  selected_branch?: SequenceBranch;
  next_step_id?: string;
  decision_reason: string;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const CreateBranchSchema = z.object({
  sequence_template_id: z.string().uuid(),
  parent_step_id: z.string().uuid(),
  branch_name: z.string().min(1).max(100),
  description: z.string().optional(),
  condition_type: z.enum([
    'behavior',
    'engagement',
    'field_value',
    'score',
    'time_elapsed',
    'previous_step',
    'custom',
    'default',
  ]),
  condition_config: z.record(z.string(), z.any()),
  next_step_id: z.string().uuid().optional(),
  priority: z.number().min(0).max(1000).default(100),
});

const BehaviorConditionSchema = z.object({
  event_type: z.string(),
  url_contains: z.string().optional(),
  min_occurrences: z.number().min(1).default(1),
  within_days: z.number().min(1).default(7),
});

const EngagementConditionSchema = z.object({
  opened_last_email: z.boolean().optional(),
  clicked_link: z.boolean().optional(),
  replied: z.boolean().optional(),
  min_opens: z.number().optional(),
  min_clicks: z.number().optional(),
});

const FieldConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in']),
  value: z.any(),
  values: z.array(z.any()).optional(), // For 'in' and 'not_in' operators
});

const ScoreConditionSchema = z.object({
  score_type: z.enum(['fit', 'engagement', 'combined']).default('fit'),
  min_score: z.number().min(0).max(100),
  max_score: z.number().min(0).max(100).optional(),
});

// ============================================
// SEQUENCE BRANCHING SERVICE
// ============================================

export class SequenceBranchingService {
  /**
   * Create a new branch for a sequence step
   */
  static async createBranch(
    data: z.infer<typeof CreateBranchSchema>,
    orgId: string
  ): Promise<SequenceBranch> {
    const supabase = await createClient();

    // Validate input
    const validated = CreateBranchSchema.parse(data);

    // Validate condition config based on type
    this.validateConditionConfig(validated.condition_type, validated.condition_config);

    // Check for duplicate branch name
    const { data: existing } = await supabase
      .from('sequence_branches')
      .select('id')
      .eq('parent_step_id', validated.parent_step_id)
      .eq('branch_name', validated.branch_name)
      .single();

    if (existing) {
      throw new Error(`Branch "${validated.branch_name}" already exists for this step`);
    }

    // Create branch
    const { data: branch, error } = await supabase
      .from('sequence_branches')
      .insert(validated)
      .select()
      .single();

    if (error) throw error;
    return branch as SequenceBranch;
  }

  /**
   * Evaluate branches and determine next step
   */
  static async evaluateBranches(
    enrollmentId: string,
    currentStepId: string
  ): Promise<BranchingDecision> {
    const supabase = await createClient();

    // Get enrollment and lead details
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('sequence_enrollments')
      .select(`
        *,
        lead:sales_leads(*)
      `)
      .eq('id', enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      throw new Error('Enrollment not found');
    }

    // Get all branches for current step
    const { data: branches, error: branchesError } = await supabase
      .from('sequence_branches')
      .select('*')
      .eq('parent_step_id', currentStepId)
      .order('priority')
      .order('created_at');

    if (branchesError || !branches || branches.length === 0) {
      // No branches defined, continue linearly
      return {
        enrollment_id: enrollmentId,
        current_step_id: currentStepId,
        evaluations: [],
        decision_reason: 'No branches defined for this step',
      };
    }

    const evaluations: BranchEvaluation[] = [];
    let selectedBranch: SequenceBranch | undefined;

    // Evaluate each branch
    for (const branch of branches) {
      const evaluation: BranchEvaluation = {
        branch_id: branch.id,
        branch_name: branch.branch_name,
        condition_type: branch.condition_type,
        evaluated: true,
        matched: false,
      };

      try {
        const matched = await this.evaluateCondition(
          branch.condition_type,
          branch.condition_config,
          enrollment,
          enrollment.lead
        );

        evaluation.matched = matched;
        evaluation.reason = matched ? 'Condition matched' : 'Condition not matched';

        if (matched && !selectedBranch) {
          selectedBranch = branch;
        }
      } catch (error: any) {
        evaluation.evaluated = false;
        evaluation.reason = `Evaluation error: ${error.message}`;
      }

      evaluations.push(evaluation);

      // Stop evaluating if we found a match (unless it's a default branch)
      if (selectedBranch && branch.condition_type !== 'default') {
        break;
      }
    }

    // Log the branching decision
    await supabase.from('branch_evaluation_logs').insert({
      enrollment_id: enrollmentId,
      step_id: currentStepId,
      branches_evaluated: evaluations,
      selected_branch_id: selectedBranch?.id,
      selected_reason: selectedBranch
        ? `Selected: ${selectedBranch.branch_name}`
        : 'No branch conditions matched',
      lead_context: enrollment.lead,
    });

    // Update branch statistics
    if (selectedBranch) {
      await supabase
        .from('sequence_branches')
        .update({ total_enrollments: selectedBranch.total_enrollments + 1 })
        .eq('id', selectedBranch.id);
    }

    return {
      enrollment_id: enrollmentId,
      current_step_id: currentStepId,
      evaluations,
      selected_branch: selectedBranch,
      next_step_id: selectedBranch?.next_step_id,
      decision_reason: selectedBranch
        ? `Branch selected: ${selectedBranch.branch_name}`
        : 'No matching branch, sequence will end or continue linearly',
    };
  }

  /**
   * Evaluate a single condition
   */
  private static async evaluateCondition(
    conditionType: ConditionType,
    conditionConfig: Record<string, any>,
    enrollment: any,
    lead: any
  ): Promise<boolean> {
    const supabase = await createClient();

    switch (conditionType) {
      case 'behavior':
        return this.evaluateBehaviorCondition(conditionConfig, lead.id);

      case 'engagement':
        return this.evaluateEngagementCondition(conditionConfig, enrollment.id);

      case 'field_value':
        return this.evaluateFieldCondition(conditionConfig, lead);

      case 'score':
        return this.evaluateScoreCondition(conditionConfig, lead);

      case 'time_elapsed':
        return this.evaluateTimeCondition(conditionConfig, enrollment);

      case 'previous_step':
        return this.evaluatePreviousStepCondition(conditionConfig, enrollment.id);

      case 'default':
        return true; // Default branch always matches

      case 'custom':
        // Custom conditions would be evaluated via webhook or custom function
        return this.evaluateCustomCondition(conditionConfig, enrollment, lead);

      default:
        throw new Error(`Unknown condition type: ${conditionType}`);
    }
  }

  /**
   * Evaluate behavior-based conditions
   */
  private static async evaluateBehaviorCondition(
    config: Record<string, any>,
    leadId: string
  ): Promise<boolean> {
    const supabase = await createClient();
    const validated = BehaviorConditionSchema.parse(config);

    const since = new Date();
    since.setDate(since.getDate() - validated.within_days);

    let query = supabase
      .from('behavioral_events')
      .select('id', { count: 'exact' })
      .eq('lead_id', leadId)
      .eq('event_type', validated.event_type)
      .gte('created_at', since.toISOString());

    if (validated.url_contains) {
      query = query.ilike('event_data->url', `%${validated.url_contains}%`);
    }

    const { count, error } = await query;
    if (error) throw error;

    return (count || 0) >= validated.min_occurrences;
  }

  /**
   * Evaluate engagement-based conditions
   */
  private static async evaluateEngagementCondition(
    config: Record<string, any>,
    enrollmentId: string
  ): Promise<boolean> {
    const supabase = await createClient();
    const validated = EngagementConditionSchema.parse(config);

    // Get recent email engagement
    const { data: emails, error } = await supabase
      .from('sequence_email_logs')
      .select('opened_at, clicked_at, replied_at')
      .eq('enrollment_id', enrollmentId)
      .order('sent_at', { ascending: false })
      .limit(5); // Check last 5 emails

    if (error) throw error;
    if (!emails || emails.length === 0) return false;

    const lastEmail = emails[0];

    // Check specific conditions
    if (validated.opened_last_email !== undefined) {
      if (validated.opened_last_email && !lastEmail.opened_at) return false;
      if (!validated.opened_last_email && lastEmail.opened_at) return false;
    }

    if (validated.clicked_link !== undefined) {
      if (validated.clicked_link && !lastEmail.clicked_at) return false;
      if (!validated.clicked_link && lastEmail.clicked_at) return false;
    }

    if (validated.replied !== undefined) {
      if (validated.replied && !lastEmail.replied_at) return false;
      if (!validated.replied && lastEmail.replied_at) return false;
    }

    // Check minimum thresholds
    if (validated.min_opens !== undefined) {
      const openCount = emails.filter(e => e.opened_at).length;
      if (openCount < validated.min_opens) return false;
    }

    if (validated.min_clicks !== undefined) {
      const clickCount = emails.filter(e => e.clicked_at).length;
      if (clickCount < validated.min_clicks) return false;
    }

    return true;
  }

  /**
   * Evaluate field-based conditions
   */
  private static evaluateFieldCondition(
    config: Record<string, any>,
    lead: any
  ): boolean {
    const validated = FieldConditionSchema.parse(config);
    const fieldValue = lead[validated.field];

    switch (validated.operator) {
      case 'equals':
        return fieldValue === validated.value;
      case 'not_equals':
        return fieldValue !== validated.value;
      case 'contains':
        return String(fieldValue).includes(String(validated.value));
      case 'greater_than':
        return Number(fieldValue) > Number(validated.value);
      case 'less_than':
        return Number(fieldValue) < Number(validated.value);
      case 'in':
        return validated.values?.includes(fieldValue) || false;
      case 'not_in':
        return !validated.values?.includes(fieldValue) || true;
      default:
        return false;
    }
  }

  /**
   * Evaluate score-based conditions
   */
  private static evaluateScoreCondition(
    config: Record<string, any>,
    lead: any
  ): boolean {
    const validated = ScoreConditionSchema.parse(config);

    let score: number;
    switch (validated.score_type) {
      case 'fit':
        score = lead.fit_score || 0;
        break;
      case 'engagement':
        score = lead.engagement_score || 0;
        break;
      case 'combined':
        score = ((lead.fit_score || 0) + (lead.engagement_score || 0)) / 2;
        break;
      default:
        score = 0;
    }

    if (score < validated.min_score) return false;
    if (validated.max_score !== undefined && score > validated.max_score) return false;

    return true;
  }

  /**
   * Evaluate time-based conditions
   */
  private static evaluateTimeCondition(
    config: Record<string, any>,
    enrollment: any
  ): boolean {
    const minHours = config.min_hours || 0;
    const maxHours = config.max_hours;

    const enrolledAt = new Date(enrollment.created_at);
    const hoursElapsed = (Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed < minHours) return false;
    if (maxHours !== undefined && hoursElapsed > maxHours) return false;

    return true;
  }

  /**
   * Evaluate previous step conditions
   */
  private static async evaluatePreviousStepCondition(
    config: Record<string, any>,
    enrollmentId: string
  ): Promise<boolean> {
    const supabase = await createClient();

    // Get the last step execution
    const { data: lastStep, error } = await supabase
      .from('sequence_step_executions')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('executed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !lastStep) return false;

    // Check various outcomes
    if (config.was_opened !== undefined) {
      if (config.was_opened !== (lastStep.opened_at !== null)) return false;
    }

    if (config.was_clicked !== undefined) {
      if (config.was_clicked !== (lastStep.clicked_at !== null)) return false;
    }

    if (config.was_replied !== undefined) {
      if (config.was_replied !== (lastStep.replied_at !== null)) return false;
    }

    return true;
  }

  /**
   * Evaluate custom conditions via webhook
   */
  private static async evaluateCustomCondition(
    config: Record<string, any>,
    enrollment: any,
    lead: any
  ): Promise<boolean> {
    if (!config.webhook_url) {
      throw new Error('Custom condition requires webhook_url');
    }

    try {
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify({
          enrollment,
          lead,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      const result = await response.json();
      return result.match === true;
    } catch (error) {
      console.error('Custom condition evaluation failed:', error);
      return false;
    }
  }

  /**
   * Validate condition configuration
   */
  private static validateConditionConfig(
    conditionType: ConditionType,
    config: Record<string, any>
  ): void {
    try {
      switch (conditionType) {
        case 'behavior':
          BehaviorConditionSchema.parse(config);
          break;
        case 'engagement':
          EngagementConditionSchema.parse(config);
          break;
        case 'field_value':
          FieldConditionSchema.parse(config);
          break;
        case 'score':
          ScoreConditionSchema.parse(config);
          break;
        case 'time_elapsed':
          z.object({
            min_hours: z.number().optional(),
            max_hours: z.number().optional(),
          }).parse(config);
          break;
        case 'default':
          // No config needed for default branch
          break;
        default:
          // Custom conditions can have any config
          break;
      }
    } catch (error) {
      throw new Error(`Invalid condition config: ${error}`);
    }
  }

  /**
   * Get branch performance analytics
   */
  static async getBranchAnalytics(
    sequenceTemplateId: string,
    orgId: string
  ): Promise<any> {
    const supabase = await createClient();

    const { data: branches, error } = await supabase
      .from('sequence_branches')
      .select(`
        *,
        evaluations:branch_evaluation_logs(count)
      `)
      .eq('sequence_template_id', sequenceTemplateId)
      .order('total_enrollments', { ascending: false });

    if (error) throw error;

    // Calculate conversion rates
    const branchesWithMetrics = branches?.map(branch => {
      // This would need actual conversion tracking implementation
      const conversionRate = branch.total_enrollments > 0
        ? (Math.random() * 30) // Placeholder - replace with actual calculation
        : 0;

      return {
        ...branch,
        conversion_rate: conversionRate.toFixed(2),
        effectiveness: this.calculateEffectiveness(branch),
      };
    });

    return branchesWithMetrics;
  }

  /**
   * Calculate branch effectiveness score
   */
  private static calculateEffectiveness(branch: any): string {
    // Placeholder logic - implement based on actual metrics
    if (branch.total_enrollments < 10) return 'insufficient_data';
    if (branch.conversion_rate > 20) return 'high';
    if (branch.conversion_rate > 10) return 'medium';
    return 'low';
  }

  /**
   * Optimize branch priorities based on performance
   */
  static async optimizeBranchPriorities(
    sequenceTemplateId: string
  ): Promise<void> {
    const supabase = await createClient();

    // Get branch performance data
    const analytics = await this.getBranchAnalytics(sequenceTemplateId, '');

    // Sort by effectiveness and update priorities
    const sortedBranches = analytics.sort((a: any, b: any) => {
      // Higher conversion rate = higher priority (lower number)
      return b.conversion_rate - a.conversion_rate;
    });

    // Update priorities
    for (let i = 0; i < sortedBranches.length; i++) {
      await supabase
        .from('sequence_branches')
        .update({ priority: (i + 1) * 10 })
        .eq('id', sortedBranches[i].id);
    }
  }
}