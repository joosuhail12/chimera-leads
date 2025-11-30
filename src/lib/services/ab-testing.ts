/**
 * A/B Testing Framework for Sequences
 * Manages split testing, variant assignment, and performance tracking
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type TestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';
export type VariantType = 'control' | 'variant_a' | 'variant_b' | 'variant_c';

export interface ABTest {
  id: string;
  created_at: string;
  organization_id: string;
  template_id: string;
  name: string;
  description?: string;
  hypothesis?: string;
  status: TestStatus;
  start_date?: string;
  end_date?: string;
  traffic_percentage: number; // % of new enrollments to include in test
  winning_variant?: VariantType;
  winning_confidence?: number;
  created_by: string;
  settings: {
    minimum_sample_size?: number;
    confidence_level?: number; // e.g., 95 for 95% confidence
    test_duration_days?: number;
    auto_conclude?: boolean;
    primary_metric?: 'reply_rate' | 'open_rate' | 'click_rate' | 'meeting_rate';
  };
}

export interface ABTestVariant {
  id: string;
  test_id: string;
  variant_type: VariantType;
  name: string;
  description?: string;
  weight: number; // Distribution weight (e.g., 50 for 50%)
  changes: {
    subject_lines?: Record<number, string>; // step_number -> subject
    email_content?: Record<number, string>; // step_number -> content
    send_times?: Record<number, string>; // step_number -> time
    wait_periods?: Record<number, { days: number; hours: number }>;
    from_names?: Record<number, string>;
  };
  is_control: boolean;
}

export interface VariantMetrics {
  variant_id: string;
  variant_type: VariantType;
  enrollments: number;
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  replies_received: number;
  meetings_booked: number;
  unsubscribes: number;

  // Calculated rates
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  meeting_rate: number;
  unsubscribe_rate: number;

  // Statistical measures
  conversion_rate: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  is_significant: boolean;
  p_value?: number;
}

export interface TestResults {
  test_id: string;
  variants: VariantMetrics[];
  winner?: {
    variant_type: VariantType;
    improvement_percentage: number;
    confidence_level: number;
  };
  statistical_significance: boolean;
  sample_size_reached: boolean;
  test_duration_days: number;
  recommendations: string[];
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const CreateABTestSchema = z.object({
  template_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  traffic_percentage: z.number().min(1).max(100).default(100),
  settings: z.object({
    confidence_level: z.number().min(0.8).max(0.99).default(0.95),
    auto_conclude: z.boolean().default(true),
    primary_metric: z.enum(['open_rate', 'click_rate', 'reply_rate', 'meeting_rate']).default('reply_rate'),
    minimum_sample_size: z.number().min(100).optional(),
    test_duration_days: z.number().min(1).optional(),
  }).default({
    confidence_level: 0.95,
    auto_conclude: true,
    primary_metric: 'reply_rate',
  }),
});

const CreateVariantSchema = z.object({
  test_id: z.string().uuid(),
  variant_type: z.enum(['control', 'variant_a', 'variant_b', 'variant_c']),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  weight: z.number().min(0).max(100),
  changes: z.object({
    subject_lines: z.record(z.string(), z.string()).optional(),
    email_content: z.record(z.string(), z.string()).optional(),
    send_times: z.record(z.string(), z.string()).optional(),
    wait_periods: z.record(z.string(), z.object({
      days: z.number(),
      hours: z.number(),
    })).optional(),
    from_names: z.record(z.string(), z.string()).optional(),
  }).default({}),
  is_control: z.boolean().default(false),
});

// ============================================
// A/B TESTING SERVICE
// ============================================

export class ABTestingService {
  /**
   * Create a new A/B test
   */
  static async createTest(
    data: z.infer<typeof CreateABTestSchema>,
    userId: string,
    orgId: string
  ): Promise<ABTest> {
    const supabase = await createClient();

    // Validate input
    const validated = CreateABTestSchema.parse(data);

    // Check template exists
    const { data: template } = await supabase
      .from('sequence_templates')
      .select('id')
      .eq('id', validated.template_id)
      .eq('organization_id', orgId)
      .single();

    if (!template) {
      throw new Error('Sequence template not found');
    }

    // Create test
    const { data: test, error } = await supabase
      .from('sequence_ab_tests')
      .insert({
        ...validated,
        organization_id: orgId,
        created_by: userId,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    // Create default control variant
    await this.createVariant({
      test_id: test.id,
      variant_type: 'control',
      name: 'Control (Original)',
      weight: 50,
      changes: {},
      is_control: true,
    });

    return test as ABTest;
  }

  /**
   * Create a test variant
   */
  static async createVariant(
    data: z.infer<typeof CreateVariantSchema>
  ): Promise<ABTestVariant> {
    const supabase = await createClient();

    // Validate input
    const validated = CreateVariantSchema.parse(data);

    // Ensure weights don't exceed 100%
    const { data: existingVariants } = await supabase
      .from('sequence_ab_test_variants')
      .select('weight')
      .eq('test_id', validated.test_id);

    const totalWeight = (existingVariants || []).reduce(
      (sum, v) => sum + v.weight,
      validated.weight
    );

    if (totalWeight > 100) {
      throw new Error(`Total variant weights cannot exceed 100% (current: ${totalWeight}%)`);
    }

    // Create variant
    const { data: variant, error } = await supabase
      .from('sequence_ab_test_variants')
      .insert(validated)
      .select()
      .single();

    if (error) throw error;
    return variant as ABTestVariant;
  }

  /**
   * Start an A/B test
   */
  static async startTest(testId: string, orgId: string): Promise<ABTest> {
    const supabase = await createClient();

    // Verify test has at least 2 variants
    const { data: variants } = await supabase
      .from('sequence_ab_test_variants')
      .select('id')
      .eq('test_id', testId);

    if (!variants || variants.length < 2) {
      throw new Error('Test must have at least 2 variants');
    }

    // Update test status
    const { data: test, error } = await supabase
      .from('sequence_ab_tests')
      .update({
        status: 'running',
        start_date: new Date().toISOString(),
      })
      .eq('id', testId)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) throw error;
    return test as ABTest;
  }

  /**
   * Pause an A/B test
   */
  static async pauseTest(testId: string, orgId: string): Promise<ABTest> {
    const supabase = await createClient();

    const { data: test, error } = await supabase
      .from('sequence_ab_tests')
      .update({ status: 'paused' })
      .eq('id', testId)
      .eq('organization_id', orgId)
      .eq('status', 'running')
      .select()
      .single();

    if (error) throw error;
    return test as ABTest;
  }

  /**
   * Conclude an A/B test and declare winner
   */
  static async concludeTest(
    testId: string,
    orgId: string,
    winningVariant?: VariantType
  ): Promise<TestResults> {
    const supabase = await createClient();

    // Get test results
    const results = await this.getTestResults(testId, orgId);

    // Determine winner if not specified
    let winner = winningVariant;
    if (!winner && results.winner) {
      winner = results.winner.variant_type;
    }

    // Update test
    await supabase
      .from('sequence_ab_tests')
      .update({
        status: 'completed',
        end_date: new Date().toISOString(),
        winning_variant: winner,
        winning_confidence: results.winner?.confidence_level,
      })
      .eq('id', testId)
      .eq('organization_id', orgId);

    // If winner declared, apply changes to template
    if (winner && winner !== 'control') {
      await this.applyWinningVariant(testId, winner, orgId);
    }

    return results;
  }

  /**
   * Get test results with statistical analysis
   */
  static async getTestResults(testId: string, orgId: string): Promise<TestResults> {
    const supabase = await createClient();

    // Get test details
    const { data: test } = await supabase
      .from('sequence_ab_tests')
      .select('*')
      .eq('id', testId)
      .eq('organization_id', orgId)
      .single();

    if (!test) throw new Error('Test not found');

    // Get variants
    const { data: variants } = await supabase
      .from('sequence_ab_test_variants')
      .select('*')
      .eq('test_id', testId);

    if (!variants) throw new Error('No variants found');

    // Get metrics for each variant
    const variantMetrics: VariantMetrics[] = [];

    for (const variant of variants) {
      const { data: enrollments } = await supabase
        .from('sequence_enrollments')
        .select('*')
        .eq('ab_test_id', testId)
        .eq('ab_test_variant', variant.variant_type);

      const metrics = this.calculateVariantMetrics(
        variant,
        enrollments || [],
        test.settings?.primary_metric || 'reply_rate'
      );

      variantMetrics.push(metrics);
    }

    // Perform statistical analysis
    const analysis = this.performStatisticalAnalysis(
      variantMetrics,
      test.settings?.confidence_level || 95
    );

    // Check if sample size reached
    const sampleSizeReached = variantMetrics.every(
      v => v.enrollments >= (test.settings?.minimum_sample_size || 100)
    );

    // Calculate test duration
    const testDuration = test.start_date
      ? Math.floor((Date.now() - new Date(test.start_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      variantMetrics,
      analysis,
      sampleSizeReached,
      testDuration,
      test.settings?.test_duration_days
    );

    return {
      test_id: testId,
      variants: variantMetrics,
      winner: analysis.winner,
      statistical_significance: analysis.isSignificant,
      sample_size_reached: sampleSizeReached,
      test_duration_days: testDuration,
      recommendations,
    };
  }

  /**
   * Calculate metrics for a variant
   */
  private static calculateVariantMetrics(
    variant: ABTestVariant,
    enrollments: any[],
    primaryMetric: string
  ): VariantMetrics {
    const total = enrollments.length;
    const emailsSent = enrollments.reduce((sum, e) => sum + (e.emails_sent || 0), 0);
    const emailsOpened = enrollments.reduce((sum, e) => sum + (e.emails_opened || 0), 0);
    const emailsClicked = enrollments.reduce((sum, e) => sum + (e.emails_clicked || 0), 0);
    const repliesReceived = enrollments.reduce((sum, e) => sum + (e.replies_received || 0), 0);
    const meetingsBooked = enrollments.reduce((sum, e) => sum + (e.meetings_booked || 0), 0);
    const unsubscribes = enrollments.filter(e => e.status === 'unsubscribed').length;

    // Calculate rates
    const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0;
    const clickRate = emailsSent > 0 ? (emailsClicked / emailsSent) * 100 : 0;
    const replyRate = emailsSent > 0 ? (repliesReceived / emailsSent) * 100 : 0;
    const meetingRate = total > 0 ? (meetingsBooked / total) * 100 : 0;
    const unsubscribeRate = total > 0 ? (unsubscribes / total) * 100 : 0;

    // Primary conversion rate based on selected metric
    const conversionRate = {
      reply_rate: replyRate,
      open_rate: openRate,
      click_rate: clickRate,
      meeting_rate: meetingRate,
    }[primaryMetric] || replyRate;

    // Calculate confidence intervals (simplified Wilson score interval)
    const { lower, upper } = this.calculateConfidenceInterval(
      conversionRate / 100,
      total,
      95
    );

    return {
      variant_id: variant.id,
      variant_type: variant.variant_type,
      enrollments: total,
      emails_sent: emailsSent,
      emails_opened: emailsOpened,
      emails_clicked: emailsClicked,
      replies_received: repliesReceived,
      meetings_booked: meetingsBooked,
      unsubscribes,
      open_rate: openRate,
      click_rate: clickRate,
      reply_rate: replyRate,
      meeting_rate: meetingRate,
      unsubscribe_rate: unsubscribeRate,
      conversion_rate: conversionRate,
      confidence_interval_lower: lower * 100,
      confidence_interval_upper: upper * 100,
      is_significant: false, // Set by statistical analysis
    };
  }

  /**
   * Calculate confidence interval using Wilson score
   */
  private static calculateConfidenceInterval(
    p: number,
    n: number,
    confidence: number
  ): { lower: number; upper: number } {
    if (n === 0) return { lower: 0, upper: 0 };

    // Z-score for confidence level
    const zScores: Record<number, number> = {
      80: 1.28,
      85: 1.44,
      90: 1.645,
      95: 1.96,
      99: 2.576,
    };
    const z = zScores[confidence] || 1.96;

    // Wilson score interval
    const denominator = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / denominator;
    const margin = (z * Math.sqrt((p * (1 - p) / n) + (z * z) / (4 * n * n))) / denominator;

    return {
      lower: Math.max(0, centre - margin),
      upper: Math.min(1, centre + margin),
    };
  }

  /**
   * Perform statistical analysis on variants
   */
  private static performStatisticalAnalysis(
    variants: VariantMetrics[],
    confidenceLevel: number
  ): {
    winner?: {
      variant_type: VariantType;
      improvement_percentage: number;
      confidence_level: number;
    };
    isSignificant: boolean;
  } {
    // Find control variant
    const control = variants.find(v => v.variant_type === 'control');
    if (!control) return { isSignificant: false };

    let bestVariant: VariantMetrics | null = null;
    let bestImprovement = 0;
    let isSignificant = false;

    // Compare each variant to control
    for (const variant of variants) {
      if (variant.variant_type === 'control') continue;

      // Check if confidence intervals don't overlap (simplified significance test)
      const noOverlap =
        variant.confidence_interval_lower > control.confidence_interval_upper ||
        variant.confidence_interval_upper < control.confidence_interval_lower;

      if (noOverlap && variant.conversion_rate > control.conversion_rate) {
        const improvement = ((variant.conversion_rate - control.conversion_rate) / control.conversion_rate) * 100;

        if (improvement > bestImprovement) {
          bestVariant = variant;
          bestImprovement = improvement;
          isSignificant = true;
        }
      }

      variant.is_significant = noOverlap;
    }

    if (bestVariant && isSignificant) {
      return {
        winner: {
          variant_type: bestVariant.variant_type,
          improvement_percentage: bestImprovement,
          confidence_level: confidenceLevel,
        },
        isSignificant: true,
      };
    }

    return { isSignificant: false };
  }

  /**
   * Generate test recommendations
   */
  private static generateRecommendations(
    variants: VariantMetrics[],
    analysis: any,
    sampleSizeReached: boolean,
    testDuration: number,
    targetDuration?: number
  ): string[] {
    const recommendations: string[] = [];

    // Sample size recommendation
    if (!sampleSizeReached) {
      const minEnrollments = Math.min(...variants.map(v => v.enrollments));
      recommendations.push(
        `Continue test to reach minimum sample size. Current: ${minEnrollments}, Recommended: 100+`
      );
    }

    // Duration recommendation
    if (targetDuration && testDuration < targetDuration) {
      recommendations.push(
        `Continue test for ${targetDuration - testDuration} more days to reach target duration`
      );
    }

    // Statistical significance
    if (analysis.isSignificant && analysis.winner) {
      recommendations.push(
        `${analysis.winner.variant_type} shows ${analysis.winner.improvement_percentage.toFixed(1)}% improvement. Consider concluding test.`
      );
    } else if (sampleSizeReached && testDuration >= 14) {
      recommendations.push(
        'No significant difference detected. Consider testing more dramatic variations.'
      );
    }

    // Unsubscribe rate warning
    const highUnsubscribeVariant = variants.find(v => v.unsubscribe_rate > 5);
    if (highUnsubscribeVariant) {
      recommendations.push(
        `Warning: ${highUnsubscribeVariant.variant_type} has high unsubscribe rate (${highUnsubscribeVariant.unsubscribe_rate.toFixed(1)}%)`
      );
    }

    return recommendations;
  }

  /**
   * Apply winning variant changes to template
   */
  private static async applyWinningVariant(
    testId: string,
    winningVariant: VariantType,
    orgId: string
  ): Promise<void> {
    const supabase = await createClient();

    // Get winning variant details
    const { data: variant } = await supabase
      .from('sequence_ab_test_variants')
      .select('*')
      .eq('test_id', testId)
      .eq('variant_type', winningVariant)
      .single();

    if (!variant || !variant.changes) return;

    // Get test details
    const { data: test } = await supabase
      .from('sequence_ab_tests')
      .select('template_id')
      .eq('id', testId)
      .single();

    if (!test) return;

    // Apply subject line changes
    if (variant.changes.subject_lines) {
      for (const [stepNumber, subject] of Object.entries(variant.changes.subject_lines)) {
        await supabase
          .from('sequence_steps')
          .update({ email_subject: subject })
          .eq('template_id', test.template_id)
          .eq('step_number', parseInt(stepNumber));
      }
    }

    // Apply content changes
    if (variant.changes.email_content) {
      for (const [stepNumber, content] of Object.entries(variant.changes.email_content)) {
        await supabase
          .from('sequence_steps')
          .update({ email_body: content })
          .eq('template_id', test.template_id)
          .eq('step_number', parseInt(stepNumber));
      }
    }

    // Log the application
    await supabase
      .from('sequence_ab_test_applications')
      .insert({
        test_id: testId,
        template_id: test.template_id,
        variant_type: winningVariant,
        applied_at: new Date().toISOString(),
        changes_applied: variant.changes,
      });
  }

  /**
   * Get active test for a template
   */
  static async getActiveTest(
    templateId: string,
    orgId: string
  ): Promise<ABTest | null> {
    const supabase = await createClient();

    const { data } = await supabase
      .from('sequence_ab_tests')
      .select('*')
      .eq('template_id', templateId)
      .eq('organization_id', orgId)
      .eq('status', 'running')
      .single();

    return data as ABTest | null;
  }

  /**
   * Get all tests for organization
   */
  static async listTests(
    orgId: string,
    filters?: {
      status?: TestStatus;
      template_id?: string;
    }
  ): Promise<ABTest[]> {
    const supabase = await createClient();

    let query = supabase
      .from('sequence_ab_tests')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.template_id) {
      query = query.eq('template_id', filters.template_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as ABTest[];
  }
}