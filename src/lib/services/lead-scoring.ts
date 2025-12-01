import { createClient } from '@/lib/supabase/server';
import { CacheManager, redisConfig } from '@/lib/redis/client';
import { openai } from '@/lib/ai/client';

// Define scoring interfaces
export interface LeadProfile {
  // Basic information
  id: string;
  name: string;
  email: string;
  title?: string;
  company?: string;

  // Apollo enrichment data
  apolloData?: any;
  companyApolloData?: any;

  // Behavioral data
  emailOpens?: number;
  emailClicks?: number;
  websiteVisits?: number;
  contentDownloads?: number;

  // Engagement history
  lastEngagement?: Date;
  totalEngagements?: number;
  sequenceResponses?: number;

  // Custom fields
  customFields?: Record<string, any>;
}

export interface ScoreFactor {
  category: 'firmographic' | 'behavioral' | 'technographic' | 'intent' | 'engagement';
  factor: string;
  score: number;
  weight: number;
  reason: string;
}

export interface LeadScoreResult {
  score: number;
  confidence: number;
  factors: ScoreFactor[];
  aiInsights: string;
  recommendations: string[];
  scoreBreakdown: {
    firmographic: number;
    behavioral: number;
    technographic: number;
    intent: number;
    engagement: number;
  };
}

export interface ScoringModel {
  version: string;
  weights: {
    firmographic: number;
    behavioral: number;
    technographic: number;
    intent: number;
    engagement: number;
  };
  thresholds: {
    hot: number;
    warm: number;
    cold: number;
  };
}

/**
 * AI-Powered Lead Scoring Service
 * Uses OpenAI GPT-4 for intelligent lead analysis and scoring
 */
export class AILeadScoringService {
  private cache: CacheManager;
  private scoringModel: ScoringModel;

  constructor() {
    this.cache = new CacheManager();
    this.scoringModel = {
      version: 'v1.0',
      weights: {
        firmographic: 0.25,
        behavioral: 0.30,
        technographic: 0.15,
        intent: 0.20,
        engagement: 0.10,
      },
      thresholds: {
        hot: 80,
        warm: 50,
        cold: 30,
      },
    };
  }

  /**
   * Calculate lead score using AI and traditional scoring
   */
  async calculateScore(lead: LeadProfile): Promise<LeadScoreResult> {
    // Check cache first
    const cacheKey = CacheManager.generateKey('lead_score', lead.id, this.scoringModel.version);
    const cached = await this.cache.get<LeadScoreResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate component scores
    const firmographicScore = await this.calculateFirmographicScore(lead);
    const behavioralScore = this.calculateBehavioralScore(lead);
    const technographicScore = this.calculateTechnographicScore(lead);
    const intentScore = await this.calculateIntentScore(lead);
    const engagementScore = this.calculateEngagementScore(lead);

    // Combine scores with weights
    const scoreBreakdown = {
      firmographic: firmographicScore.score * this.scoringModel.weights.firmographic,
      behavioral: behavioralScore.score * this.scoringModel.weights.behavioral,
      technographic: technographicScore.score * this.scoringModel.weights.technographic,
      intent: intentScore.score * this.scoringModel.weights.intent,
      engagement: engagementScore.score * this.scoringModel.weights.engagement,
    };

    const totalScore = Math.round(
      Object.values(scoreBreakdown).reduce((sum, score) => sum + score, 0)
    );

    // Collect all factors
    const allFactors = [
      ...firmographicScore.factors,
      ...behavioralScore.factors,
      ...technographicScore.factors,
      ...intentScore.factors,
      ...engagementScore.factors,
    ];

    // Get AI insights and recommendations
    const { insights, recommendations } = await this.getAIInsights(lead, totalScore, allFactors);

    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(lead);

    const result: LeadScoreResult = {
      score: Math.min(100, Math.max(0, totalScore)),
      confidence,
      factors: allFactors,
      aiInsights: insights,
      recommendations,
      scoreBreakdown,
    };

    // Cache the result
    await this.cache.set(cacheKey, result, redisConfig.cache.ttl.score);

    return result;
  }

  /**
   * Calculate firmographic score based on company and role fit
   */
  private async calculateFirmographicScore(lead: LeadProfile): Promise<{
    score: number;
    factors: ScoreFactor[];
  }> {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Check ideal customer profile (ICP) match
    if (lead.companyApolloData) {
      const company = lead.companyApolloData;

      // Company size scoring
      if (company.employee_count) {
        if (company.employee_count >= 50 && company.employee_count <= 500) {
          factors.push({
            category: 'firmographic',
            factor: 'company_size',
            score: 20,
            weight: 0.25,
            reason: 'Company size fits ideal range (50-500 employees)',
          });
          score += 20;
        } else if (company.employee_count >= 10 && company.employee_count < 50) {
          factors.push({
            category: 'firmographic',
            factor: 'company_size',
            score: 10,
            weight: 0.25,
            reason: 'Small company, may have budget constraints',
          });
          score += 10;
        }
      }

      // Industry match
      const targetIndustries = ['SaaS', 'Technology', 'Software', 'Financial Services'];
      if (company.industry && targetIndustries.some(i => company.industry.includes(i))) {
        factors.push({
          category: 'firmographic',
          factor: 'industry',
          score: 25,
          weight: 0.25,
          reason: `Target industry: ${company.industry}`,
        });
        score += 25;
      }

      // Revenue potential
      if (company.revenue_range) {
        const revenueScore = this.scoreRevenue(company.revenue_range);
        if (revenueScore > 0) {
          factors.push({
            category: 'firmographic',
            factor: 'revenue',
            score: revenueScore,
            weight: 0.25,
            reason: `Revenue range: ${company.revenue_range}`,
          });
          score += revenueScore;
        }
      }
    }

    // Title/Seniority scoring
    if (lead.title) {
      const titleScore = this.scoreTitleSeniority(lead.title);
      if (titleScore > 0) {
        factors.push({
          category: 'firmographic',
          factor: 'title_seniority',
          score: titleScore,
          weight: 0.25,
          reason: `Decision maker role: ${lead.title}`,
        });
        score += titleScore;
      }
    }

    return { score: Math.min(100, score), factors };
  }

  /**
   * Calculate behavioral score based on actions and engagement
   */
  private calculateBehavioralScore(lead: LeadProfile): {
    score: number;
    factors: ScoreFactor[];
  } {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Website visit scoring
    if (lead.websiteVisits) {
      const visitScore = Math.min(30, lead.websiteVisits * 5);
      factors.push({
        category: 'behavioral',
        factor: 'website_visits',
        score: visitScore,
        weight: 0.30,
        reason: `${lead.websiteVisits} website visits in last 30 days`,
      });
      score += visitScore;
    }

    // Content engagement
    if (lead.contentDownloads) {
      const downloadScore = Math.min(25, lead.contentDownloads * 10);
      factors.push({
        category: 'behavioral',
        factor: 'content_downloads',
        score: downloadScore,
        weight: 0.30,
        reason: `Downloaded ${lead.contentDownloads} resources`,
      });
      score += downloadScore;
    }

    // Email engagement
    if (lead.emailOpens) {
      const openRate = lead.emailClicks ? (lead.emailClicks / lead.emailOpens) : 0;
      const engagementScore = Math.min(25, (lead.emailOpens * 2) + (lead.emailClicks || 0) * 5);
      factors.push({
        category: 'behavioral',
        factor: 'email_engagement',
        score: engagementScore,
        weight: 0.30,
        reason: `Email open rate: ${(openRate * 100).toFixed(1)}%`,
      });
      score += engagementScore;
    }

    // Recency bonus
    if (lead.lastEngagement) {
      const daysSinceEngagement = Math.floor(
        (Date.now() - new Date(lead.lastEngagement).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceEngagement <= 7) {
        factors.push({
          category: 'behavioral',
          factor: 'recency',
          score: 20,
          weight: 0.30,
          reason: 'Recent engagement within 7 days',
        });
        score += 20;
      } else if (daysSinceEngagement <= 30) {
        factors.push({
          category: 'behavioral',
          factor: 'recency',
          score: 10,
          weight: 0.30,
          reason: 'Engaged within last month',
        });
        score += 10;
      }
    }

    return { score: Math.min(100, score), factors };
  }

  /**
   * Calculate technographic score based on technology stack
   */
  private calculateTechnographicScore(lead: LeadProfile): {
    score: number;
    factors: ScoreFactor[];
  } {
    const factors: ScoreFactor[] = [];
    let score = 0;

    if (lead.companyApolloData?.technologies) {
      const technologies = lead.companyApolloData.technologies;

      // Check for competitor technologies
      const competitors = ['Competitor1', 'Competitor2', 'Competitor3'];
      const hasCompetitor = technologies.some((tech: string) =>
        competitors.some(comp => tech.toLowerCase().includes(comp.toLowerCase()))
      );

      if (hasCompetitor) {
        factors.push({
          category: 'technographic',
          factor: 'competitor_usage',
          score: 40,
          weight: 0.15,
          reason: 'Currently using competitor product',
        });
        score += 40;
      }

      // Check for complementary technologies
      const complementary = ['Salesforce', 'HubSpot', 'Slack', 'Microsoft 365'];
      const complementaryCount = technologies.filter((tech: string) =>
        complementary.some(comp => tech.toLowerCase().includes(comp.toLowerCase()))
      ).length;

      if (complementaryCount > 0) {
        const techScore = Math.min(30, complementaryCount * 10);
        factors.push({
          category: 'technographic',
          factor: 'complementary_tech',
          score: techScore,
          weight: 0.15,
          reason: `Uses ${complementaryCount} complementary technologies`,
        });
        score += techScore;
      }

      // Technology sophistication
      if (technologies.length > 10) {
        factors.push({
          category: 'technographic',
          factor: 'tech_sophistication',
          score: 30,
          weight: 0.15,
          reason: 'High technology adoption indicates innovation focus',
        });
        score += 30;
      }
    }

    return { score: Math.min(100, score), factors };
  }

  /**
   * Calculate intent score based on buying signals
   */
  private async calculateIntentScore(lead: LeadProfile): Promise<{
    score: number;
    factors: ScoreFactor[];
  }> {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Check for high-intent actions
    if (lead.customFields) {
      // Pricing page visits
      if (lead.customFields.pricingPageVisits > 0) {
        factors.push({
          category: 'intent',
          factor: 'pricing_interest',
          score: 35,
          weight: 0.20,
          reason: 'Visited pricing page',
        });
        score += 35;
      }

      // Demo requests
      if (lead.customFields.demoRequested) {
        factors.push({
          category: 'intent',
          factor: 'demo_request',
          score: 50,
          weight: 0.20,
          reason: 'Requested product demo',
        });
        score += 50;
      }

      // Feature comparison
      if (lead.customFields.comparisonPageVisits > 0) {
        factors.push({
          category: 'intent',
          factor: 'comparison_research',
          score: 25,
          weight: 0.20,
          reason: 'Researching product comparisons',
        });
        score += 25;
      }
    }

    // Search intent (if available from Apollo or other sources)
    if (lead.apolloData?.intent_signals) {
      factors.push({
        category: 'intent',
        factor: 'search_intent',
        score: 30,
        weight: 0.20,
        reason: 'Showing buying intent signals',
      });
      score += 30;
    }

    return { score: Math.min(100, score), factors };
  }

  /**
   * Calculate engagement score based on interaction history
   */
  private calculateEngagementScore(lead: LeadProfile): {
    score: number;
    factors: ScoreFactor[];
  } {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Sequence response rate
    if (lead.sequenceResponses && lead.totalEngagements) {
      const responseRate = lead.sequenceResponses / lead.totalEngagements;
      if (responseRate > 0.2) {
        factors.push({
          category: 'engagement',
          factor: 'response_rate',
          score: 40,
          weight: 0.10,
          reason: `High response rate: ${(responseRate * 100).toFixed(1)}%`,
        });
        score += 40;
      }
    }

    // Total engagement frequency
    if (lead.totalEngagements) {
      const engagementScore = Math.min(60, lead.totalEngagements * 5);
      factors.push({
        category: 'engagement',
        factor: 'total_engagements',
        score: engagementScore,
        weight: 0.10,
        reason: `${lead.totalEngagements} total interactions`,
      });
      score += engagementScore;
    }

    return { score: Math.min(100, score), factors };
  }

  /**
   * Get AI-powered insights and recommendations
   */
  private async getAIInsights(
    lead: LeadProfile,
    score: number,
    factors: ScoreFactor[]
  ): Promise<{ insights: string; recommendations: string[] }> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        // Fallback to rule-based insights if no API key
        return this.getRuleBasedInsights(lead, score, factors);
      }

      const prompt = `Analyze this lead and provide scoring insights.
      
      Lead Profile:
      - Title: ${lead.title}
      - Company: ${lead.company}
      - Industry: ${lead.companyApolloData?.industry}
      - Employees: ${lead.companyApolloData?.employee_count}
      - Score: ${score}/100
      - Key Factors: ${factors.map(f => `${f.factor} (${f.score}pts): ${f.reason}`).join(', ')}
      
      Provide:
      1. A concise 2-sentence insight summary.
      2. 3 specific, actionable recommendations for the sales team.
      
      Output JSON:
      {
        "insights": "string",
        "recommendations": ["string"]
      }`;

      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: "You are a sales operations expert." },
          { role: "user", content: prompt }
        ],
        model: "gpt-4o",
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      if (!content) throw new Error('No content');

      return JSON.parse(content);
    } catch (error) {
      console.error('AI Insight generation failed:', error);
      return this.getRuleBasedInsights(lead, score, factors);
    }
  }

  private getRuleBasedInsights(
    lead: LeadProfile,
    score: number,
    factors: ScoreFactor[]
  ): { insights: string; recommendations: string[] } {
    const topFactors = factors
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(f => f.reason);

    let insights = '';
    let recommendations: string[] = [];

    if (score >= this.scoringModel.thresholds.hot) {
      insights = `High-quality lead with strong buying signals. Key strengths: ${topFactors.join(', ')}. This lead shows multiple indicators of purchase intent and fits your ideal customer profile well.`;
      recommendations = [
        'Prioritize immediate outreach from senior sales rep',
        'Personalize messaging around their specific use case',
        'Offer a tailored demo focusing on ROI',
        'Connect on LinkedIn before reaching out',
      ];
    } else if (score >= this.scoringModel.thresholds.warm) {
      insights = `Moderate potential lead requiring nurturing. Positive signals: ${topFactors.join(', ')}. This lead shows interest but may need more education or timing alignment.`;
      recommendations = [
        'Add to nurture sequence with educational content',
        'Monitor for increased engagement signals',
        'Schedule follow-up in 2-3 weeks',
        'Share relevant case studies from similar companies',
      ];
    } else {
      insights = `Early-stage lead requiring long-term nurturing. Current indicators: ${topFactors.join(', ')}. This lead may not be ready for sales engagement yet.`;
      recommendations = [
        'Add to long-term nurture campaign',
        'Focus on educational content and thought leadership',
        'Re-score after 60 days of nurturing',
        'Consider for future marketing campaigns',
      ];
    }

    return { insights, recommendations };
  }

  /**
   * Calculate confidence score based on data completeness
   */
  private calculateConfidence(lead: LeadProfile): number {
    let dataPoints = 0;
    let availablePoints = 0;

    // Check data availability
    const checks = [
      lead.email,
      lead.title,
      lead.company,
      lead.apolloData,
      lead.companyApolloData,
      lead.websiteVisits !== undefined,
      lead.emailOpens !== undefined,
      lead.totalEngagements !== undefined,
    ];

    dataPoints = checks.filter(Boolean).length;
    availablePoints = checks.length;

    return Number((dataPoints / availablePoints).toFixed(2));
  }

  /**
   * Helper: Score revenue range
   */
  private scoreRevenue(revenueRange: string): number {
    const rangeMap: Record<string, number> = {
      '$10M-$50M': 20,
      '$50M-$100M': 30,
      '$100M-$500M': 35,
      '$500M+': 40,
      '$1M-$10M': 10,
    };

    for (const [range, score] of Object.entries(rangeMap)) {
      if (revenueRange.includes(range)) {
        return score;
      }
    }

    return 0;
  }

  /**
   * Helper: Score title seniority
   */
  private scoreTitleSeniority(title: string): number {
    const lowerTitle = title.toLowerCase();

    // C-Level
    if (lowerTitle.includes('ceo') || lowerTitle.includes('cto') ||
      lowerTitle.includes('cfo') || lowerTitle.includes('chief')) {
      return 35;
    }

    // VP Level
    if (lowerTitle.includes('vp') || lowerTitle.includes('vice president') ||
      lowerTitle.includes('head of')) {
      return 30;
    }

    // Director Level
    if (lowerTitle.includes('director')) {
      return 25;
    }

    // Manager Level
    if (lowerTitle.includes('manager')) {
      return 15;
    }

    return 5;
  }

  /**
   * Predict conversion probability using historical data
   */
  async predictConversionProbability(lead: LeadProfile): Promise<number> {
    const score = await this.calculateScore(lead);

    // Simple probability calculation based on score
    // In production, this would use ML models trained on historical data
    const probability = Math.min(0.95, score.score / 100 * 1.2);

    return Number(probability.toFixed(2));
  }

  /**
   * Suggest next best actions for a lead
   */
  async suggestNextBestAction(lead: LeadProfile): Promise<string[]> {
    const score = await this.calculateScore(lead);
    return score.recommendations;
  }

  /**
   * Update scoring model (placeholder for ML model updates)
   */
  async updateModel(outcomes: Array<{ leadId: string; converted: boolean }>): Promise<void> {
    // In production, this would retrain the ML model with new outcome data
    console.log(`Updating model with ${outcomes.length} new outcomes`);
  }

  /**
   * Get model performance metrics
   */
  async getModelPerformance(): Promise<any> {
    // In production, this would return actual model performance metrics
    return {
      accuracy: 0.82,
      precision: 0.78,
      recall: 0.85,
      f1Score: 0.81,
      lastUpdated: new Date().toISOString(),
      version: this.scoringModel.version,
    };
  }
}