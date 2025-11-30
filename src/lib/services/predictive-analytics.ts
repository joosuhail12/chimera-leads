/**
 * Predictive Analytics Engine
 * ML-powered scoring, predictions, and insights for sequences
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PredictionModel {
  id: string;
  name: string;
  type: 'engagement' | 'conversion' | 'churn' | 'timing' | 'channel';
  version: string;
  accuracy: number;
  features: string[];
  weights?: Record<string, number>;
  last_trained: Date;
}

export interface LeadScore {
  lead_id: string;
  fit_score: number;          // 0-100: How well lead matches ICP
  engagement_score: number;    // 0-100: Level of engagement
  intent_score: number;        // 0-100: Buying intent signals
  velocity_score: number;      // 0-100: Speed of progression
  composite_score: number;     // 0-100: Overall score
  scores_by_model: Record<string, number>;
  confidence: number;
  factors: ScoreFactor[];
  updated_at: Date;
}

export interface ScoreFactor {
  name: string;
  value: any;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  contribution: number; // How much this factor contributed to score
}

export interface EngagementPrediction {
  lead_id: string;
  sequence_id: string;
  predicted_open_rate: number;
  predicted_click_rate: number;
  predicted_reply_rate: number;
  best_channel: 'email' | 'linkedin' | 'sms' | 'call';
  best_time: string;
  best_day: number;
  message_fatigue_risk: number; // 0-1: Risk of over-messaging
  confidence: number;
}

export interface ConversionPrediction {
  lead_id: string;
  probability: number;         // 0-1: Likelihood to convert
  expected_days: number;        // Days to conversion
  expected_value: number;       // Predicted deal size
  key_factors: string[];        // Most important factors
  recommended_actions: string[];
  confidence: number;
}

// ============================================
// FEATURE EXTRACTORS
// ============================================

class FeatureExtractor {
  /**
   * Extract features from lead data for ML models
   */
  static async extractLeadFeatures(leadId: string): Promise<Record<string, any>> {
    const supabase = await createClient();

    // Get lead data
    const { data: lead } = await supabase
      .from('sales_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (!lead) throw new Error('Lead not found');

    // Get engagement history
    const { data: engagements } = await supabase
      .from('sequence_email_logs')
      .select('opened_at, clicked_at, replied_at')
      .eq('lead_id', leadId)
      .order('sent_at', { ascending: false })
      .limit(10);

    // Get behavioral events
    const { data: events } = await supabase
      .from('behavioral_events')
      .select('event_type, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Extract features
    const features: Record<string, any> = {
      // Lead attributes
      has_title: !!lead.title,
      has_company: !!lead.company,
      has_phone: !!lead.phone,
      has_linkedin: !!lead.linkedin_url,
      days_since_created: this.daysSince(lead.created_at),

      // Company attributes
      company_size: this.encodeCompanySize(lead.company_size),
      industry_encoded: this.encodeIndustry(lead.industry),

      // Engagement metrics
      total_emails_sent: engagements?.length || 0,
      total_opens: engagements?.filter(e => e.opened_at).length || 0,
      total_clicks: engagements?.filter(e => e.clicked_at).length || 0,
      total_replies: engagements?.filter(e => e.replied_at).length || 0,
      open_rate: this.calculateRate(engagements, 'opened_at'),
      click_rate: this.calculateRate(engagements, 'clicked_at'),
      reply_rate: this.calculateRate(engagements, 'replied_at'),

      // Behavioral signals
      page_visits: events?.filter(e => e.event_type === 'page_visit').length || 0,
      form_submissions: events?.filter(e => e.event_type === 'form_submission').length || 0,
      content_downloads: events?.filter(e => e.event_type === 'document_viewed').length || 0,
      linkedin_engagement: events?.filter(e => e.event_type.startsWith('linkedin_')).length || 0,

      // Recency features
      days_since_last_open: this.daysSinceLastEngagement(engagements, 'opened_at'),
      days_since_last_click: this.daysSinceLastEngagement(engagements, 'clicked_at'),
      days_since_last_event: (events && events.length > 0) ? this.daysSince(events[0].created_at) : 999,

      // Velocity features
      engagement_velocity: this.calculateVelocity(engagements),
      event_velocity: this.calculateEventVelocity(events),
    };

    return features;
  }

  private static daysSince(date: string): number {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  }

  private static encodeCompanySize(size?: string): number {
    const sizeMap: Record<string, number> = {
      '1-10': 1,
      '11-50': 2,
      '51-200': 3,
      '201-500': 4,
      '501-1000': 5,
      '1000+': 6,
    };
    return sizeMap[size || ''] || 0;
  }

  private static encodeIndustry(industry?: string): number {
    // Simple hash encoding for industry
    if (!industry) return 0;
    return industry.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100;
  }

  private static calculateRate(engagements: any[] | null, field: string): number {
    if (!engagements || engagements.length === 0) return 0;
    return engagements.filter(e => e[field]).length / engagements.length;
  }

  private static daysSinceLastEngagement(engagements: any[] | null, field: string): number {
    if (!engagements) return 999;

    const engaged = engagements.find(e => e[field]);
    if (!engaged) return 999;

    return this.daysSince(engaged[field]);
  }

  private static calculateVelocity(engagements: any[] | null): number {
    if (!engagements || engagements.length < 2) return 0;

    // Calculate average time between engagements
    const openTimes = engagements
      .filter(e => e.opened_at)
      .map(e => new Date(e.opened_at).getTime())
      .sort();

    if (openTimes.length < 2) return 0;

    const gaps = [];
    for (let i = 1; i < openTimes.length; i++) {
      gaps.push(openTimes[i] - openTimes[i - 1]);
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return 1 / (avgGap / (1000 * 60 * 60 * 24) + 1); // Inverse of days
  }

  private static calculateEventVelocity(events: any[] | null): number {
    if (!events || events.length < 2) return 0;

    const recentEvents = events.slice(0, 5);
    const oldestEvent = new Date(recentEvents[recentEvents.length - 1].created_at);
    const newestEvent = new Date(recentEvents[0].created_at);
    const timeSpan = newestEvent.getTime() - oldestEvent.getTime();

    if (timeSpan === 0) return 0;

    return recentEvents.length / (timeSpan / (1000 * 60 * 60 * 24) + 1);
  }
}

// ============================================
// SCORING MODELS
// ============================================

class ScoringModels {
  /**
   * Fit Score Model - How well lead matches ICP
   */
  static calculateFitScore(features: Record<string, any>): { score: number; factors: ScoreFactor[] } {
    const factors: ScoreFactor[] = [];
    let score = 50; // Base score

    // Title match
    if (features.has_title) {
      score += 10;
      factors.push({
        name: 'Has job title',
        value: true,
        weight: 10,
        impact: 'positive',
        contribution: 10,
      });
    }

    // Company size
    if (features.company_size >= 3 && features.company_size <= 5) {
      score += 15;
      factors.push({
        name: 'Ideal company size',
        value: features.company_size,
        weight: 15,
        impact: 'positive',
        contribution: 15,
      });
    }

    // Has LinkedIn
    if (features.has_linkedin) {
      score += 5;
      factors.push({
        name: 'LinkedIn profile',
        value: true,
        weight: 5,
        impact: 'positive',
        contribution: 5,
      });
    }

    // Complete profile
    if (features.has_title && features.has_company && features.has_phone) {
      score += 10;
      factors.push({
        name: 'Complete profile',
        value: true,
        weight: 10,
        impact: 'positive',
        contribution: 10,
      });
    }

    // Industry match (simplified)
    if (features.industry_encoded > 50) {
      score += 10;
      factors.push({
        name: 'Target industry',
        value: true,
        weight: 10,
        impact: 'positive',
        contribution: 10,
      });
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      factors,
    };
  }

  /**
   * Engagement Score Model - Level of interaction
   */
  static calculateEngagementScore(features: Record<string, any>): { score: number; factors: ScoreFactor[] } {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Email engagement
    const emailScore = (features.open_rate * 30) + (features.click_rate * 40) + (features.reply_rate * 30);
    score += emailScore;

    if (emailScore > 0) {
      factors.push({
        name: 'Email engagement',
        value: `${Math.round(features.open_rate * 100)}% open rate`,
        weight: emailScore,
        impact: emailScore > 20 ? 'positive' : 'neutral',
        contribution: emailScore,
      });
    }

    // Behavioral engagement
    const behaviorScore = Math.min(30,
      (features.page_visits * 5) +
      (features.form_submissions * 10) +
      (features.content_downloads * 8) +
      (features.linkedin_engagement * 3)
    );

    if (behaviorScore > 0) {
      score += behaviorScore;
      factors.push({
        name: 'Behavioral signals',
        value: `${features.page_visits + features.form_submissions + features.content_downloads} actions`,
        weight: behaviorScore,
        impact: 'positive',
        contribution: behaviorScore,
      });
    }

    // Recency bonus
    if (features.days_since_last_open < 7) {
      score += 10;
      factors.push({
        name: 'Recent engagement',
        value: `${features.days_since_last_open} days ago`,
        weight: 10,
        impact: 'positive',
        contribution: 10,
      });
    }

    // Velocity bonus
    if (features.engagement_velocity > 0.2) {
      score += 10;
      factors.push({
        name: 'High velocity',
        value: features.engagement_velocity,
        weight: 10,
        impact: 'positive',
        contribution: 10,
      });
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      factors,
    };
  }

  /**
   * Intent Score Model - Buying signals
   */
  static calculateIntentScore(features: Record<string, any>): { score: number; factors: ScoreFactor[] } {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // High-intent actions
    if (features.form_submissions > 0) {
      score += 30;
      factors.push({
        name: 'Form submission',
        value: features.form_submissions,
        weight: 30,
        impact: 'positive',
        contribution: 30,
      });
    }

    // Pricing page visits (would need specific event tracking)
    if (features.page_visits > 3) {
      score += 20;
      factors.push({
        name: 'Multiple page visits',
        value: features.page_visits,
        weight: 20,
        impact: 'positive',
        contribution: 20,
      });
    }

    // Content engagement
    if (features.content_downloads > 0) {
      score += 15;
      factors.push({
        name: 'Content downloads',
        value: features.content_downloads,
        weight: 15,
        impact: 'positive',
        contribution: 15,
      });
    }

    // Email replies
    if (features.total_replies > 0) {
      score += 25;
      factors.push({
        name: 'Email replies',
        value: features.total_replies,
        weight: 25,
        impact: 'positive',
        contribution: 25,
      });
    }

    // Recent surge in activity
    if (features.event_velocity > 0.5) {
      score += 10;
      factors.push({
        name: 'Activity surge',
        value: 'High recent activity',
        weight: 10,
        impact: 'positive',
        contribution: 10,
      });
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      factors,
    };
  }
}

// ============================================
// PREDICTIVE ANALYTICS SERVICE
// ============================================

export class PredictiveAnalyticsService {
  /**
   * Calculate comprehensive lead score
   */
  static async scoreLeads(leadIds: string[]): Promise<LeadScore[]> {
    const scores: LeadScore[] = [];

    for (const leadId of leadIds) {
      try {
        // Extract features
        const features = await FeatureExtractor.extractLeadFeatures(leadId);

        // Calculate individual scores
        const fitResult = ScoringModels.calculateFitScore(features);
        const engagementResult = ScoringModels.calculateEngagementScore(features);
        const intentResult = ScoringModels.calculateIntentScore(features);

        // Calculate velocity score (simplified)
        const velocityScore = Math.min(100,
          (features.engagement_velocity * 100) +
          (features.event_velocity * 50)
        );

        // Calculate composite score (weighted average)
        const composite = (
          fitResult.score * 0.25 +
          engagementResult.score * 0.35 +
          intentResult.score * 0.30 +
          velocityScore * 0.10
        );

        // Combine all factors
        const allFactors = [
          ...fitResult.factors,
          ...engagementResult.factors,
          ...intentResult.factors,
        ];

        // Calculate confidence based on data availability
        const dataPoints = Object.values(features).filter(v => v !== null && v !== 0).length;
        const confidence = Math.min(0.95, dataPoints / 20);

        scores.push({
          lead_id: leadId,
          fit_score: fitResult.score,
          engagement_score: engagementResult.score,
          intent_score: intentResult.score,
          velocity_score: velocityScore,
          composite_score: Math.round(composite),
          scores_by_model: {
            fit: fitResult.score,
            engagement: engagementResult.score,
            intent: intentResult.score,
            velocity: velocityScore,
          },
          confidence,
          factors: allFactors,
          updated_at: new Date(),
        });

        // Store score in database
        await this.storeLeadScore(scores[scores.length - 1]);

      } catch (error) {
        console.error(`Failed to score lead ${leadId}:`, error);
      }
    }

    return scores;
  }

  /**
   * Predict engagement for a sequence
   */
  static async predictEngagement(
    leadId: string,
    sequenceId: string
  ): Promise<EngagementPrediction> {
    const features = await FeatureExtractor.extractLeadFeatures(leadId);

    // Simple prediction model (in production, use trained ML model)
    const baseOpenRate = 0.2;
    const baseClickRate = 0.05;
    const baseReplyRate = 0.02;

    // Adjust based on features
    let openRateMultiplier = 1.0;
    let clickRateMultiplier = 1.0;
    let replyRateMultiplier = 1.0;

    if (features.open_rate > 0.3) openRateMultiplier += 0.5;
    if (features.engagement_velocity > 0.2) openRateMultiplier += 0.3;
    if (features.days_since_last_open < 7) openRateMultiplier += 0.2;

    if (features.click_rate > 0.1) clickRateMultiplier += 0.5;
    if (features.page_visits > 3) clickRateMultiplier += 0.3;

    if (features.total_replies > 0) replyRateMultiplier += 1.0;
    if (features.form_submissions > 0) replyRateMultiplier += 0.5;

    // Calculate predictions
    const predictedOpenRate = Math.min(0.8, baseOpenRate * openRateMultiplier);
    const predictedClickRate = Math.min(0.3, baseClickRate * clickRateMultiplier);
    const predictedReplyRate = Math.min(0.15, baseReplyRate * replyRateMultiplier);

    // Predict best channel
    let bestChannel: 'email' | 'linkedin' | 'sms' | 'call' = 'email';
    if (features.linkedin_engagement > features.total_opens) {
      bestChannel = 'linkedin';
    }

    // Predict best time (simplified)
    const bestHour = features.open_rate > 0.3 ? 10 : 14; // 10am or 2pm
    const bestDay = 2; // Tuesday

    // Calculate message fatigue
    const messageFatigue = Math.min(1.0,
      (features.total_emails_sent / 10) *
      (1 - features.open_rate)
    );

    const prediction: EngagementPrediction = {
      lead_id: leadId,
      sequence_id: sequenceId,
      predicted_open_rate: predictedOpenRate,
      predicted_click_rate: predictedClickRate,
      predicted_reply_rate: predictedReplyRate,
      best_channel: bestChannel,
      best_time: `${bestHour}:00`,
      best_day: bestDay,
      message_fatigue_risk: messageFatigue,
      confidence: 0.7,
    };

    return prediction;
  }

  /**
   * Predict conversion probability
   */
  static async predictConversion(leadId: string): Promise<ConversionPrediction> {
    const features = await FeatureExtractor.extractLeadFeatures(leadId);
    const leadScore = (await this.scoreLeads([leadId]))[0];

    // Simple logistic regression model (in production, use trained model)
    const weights = {
      fit_score: 0.002,
      engagement_score: 0.003,
      intent_score: 0.004,
      velocity_score: 0.001,
      total_replies: 0.05,
      form_submissions: 0.1,
      page_visits: 0.01,
    };

    // Calculate probability
    let logit = -3.0; // Intercept
    logit += leadScore.fit_score * weights.fit_score;
    logit += leadScore.engagement_score * weights.engagement_score;
    logit += leadScore.intent_score * weights.intent_score;
    logit += leadScore.velocity_score * weights.velocity_score;
    logit += features.total_replies * weights.total_replies;
    logit += features.form_submissions * weights.form_submissions;
    logit += features.page_visits * weights.page_visits;

    const probability = 1 / (1 + Math.exp(-logit));

    // Predict time to conversion
    const expectedDays = probability > 0.5
      ? Math.round(10 / probability)
      : Math.round(30 + (1 - probability) * 60);

    // Estimate deal value (simplified)
    const companySize = features.company_size || 2;
    const expectedValue = companySize * 10000 * probability;

    // Identify key factors
    const keyFactors = leadScore.factors
      .filter(f => f.impact === 'positive')
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map(f => f.name);

    // Generate recommendations
    const recommendations = this.generateRecommendations(leadScore, features);

    return {
      lead_id: leadId,
      probability,
      expected_days: expectedDays,
      expected_value: Math.round(expectedValue),
      key_factors: keyFactors,
      recommended_actions: recommendations,
      confidence: leadScore.confidence,
    };
  }

  /**
   * Predict churn risk
   */
  static async predictChurn(leadId: string): Promise<{ risk: number; reasons: string[] }> {
    const features = await FeatureExtractor.extractLeadFeatures(leadId);

    let churnRisk = 0;
    const reasons: string[] = [];

    // No recent engagement
    if (features.days_since_last_open > 14) {
      churnRisk += 0.3;
      reasons.push('No email opens in 14+ days');
    }

    // Declining engagement
    if (features.open_rate < 0.1 && features.total_emails_sent > 5) {
      churnRisk += 0.2;
      reasons.push('Very low open rate');
    }

    // No behavioral events
    if (features.days_since_last_event > 30) {
      churnRisk += 0.2;
      reasons.push('No recent website activity');
    }

    // Low velocity
    if (features.engagement_velocity < 0.05) {
      churnRisk += 0.15;
      reasons.push('Engagement slowing down');
    }

    // Never clicked or replied
    if (features.total_clicks === 0 && features.total_replies === 0 && features.total_emails_sent > 3) {
      churnRisk += 0.15;
      reasons.push('No meaningful engagement');
    }

    return {
      risk: Math.min(1.0, churnRisk),
      reasons,
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static async storeLeadScore(score: LeadScore): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('lead_scores')
      .upsert({
        lead_id: score.lead_id,
        fit_score: score.fit_score,
        engagement_score: score.engagement_score,
        intent_score: score.intent_score,
        velocity_score: score.velocity_score,
        composite_score: score.composite_score,
        scores_by_model: score.scores_by_model,
        confidence: score.confidence,
        factors: score.factors,
        updated_at: score.updated_at,
      });
  }

  private static generateRecommendations(
    score: LeadScore,
    features: Record<string, any>
  ): string[] {
    const recommendations: string[] = [];

    // High intent but low engagement
    if (score.intent_score > 70 && score.engagement_score < 30) {
      recommendations.push('Try different messaging - high intent but low engagement');
    }

    // High engagement but low intent
    if (score.engagement_score > 70 && score.intent_score < 30) {
      recommendations.push('Focus on value proposition - engaged but not showing buying signals');
    }

    // Message fatigue risk
    if (features.total_emails_sent > 7 && features.open_rate < 0.15) {
      recommendations.push('Reduce email frequency - showing fatigue signs');
    }

    // LinkedIn opportunity
    if (features.has_linkedin && features.linkedin_engagement === 0) {
      recommendations.push('Try LinkedIn outreach - email engagement is low');
    }

    // Fast mover
    if (score.velocity_score > 80) {
      recommendations.push('Prioritize immediately - high velocity indicates hot lead');
    }

    // Needs nurturing
    if (score.composite_score < 40) {
      recommendations.push('Move to nurture campaign - not ready for sales');
    }

    return recommendations;
  }
}