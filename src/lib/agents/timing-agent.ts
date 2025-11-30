/**
 * Timing Agent
 * Optimizes send times and scheduling based on engagement patterns
 */

import { BaseAgent, AgentTask, AgentResult, AgentContext, AgentTool } from './base-agent';
import { z } from 'zod';

// ============================================
// TIMING ANALYSIS TOOLS
// ============================================

const EngagementAnalyzerTool: AgentTool = {
  name: 'engagement_analyzer',
  description: 'Analyze historical engagement patterns',
  parameters: z.object({
    lead_id: z.string().uuid(),
    days_back: z.number().default(30),
  }),
  execute: async (params) => {
    const supabase = (await import('@/lib/supabase/server')).createClient;
    const client = await supabase();

    // Get historical email engagement
    const { data: engagements } = await client
      .from('sequence_email_logs')
      .select('sent_at, opened_at, clicked_at, replied_at')
      .eq('lead_id', params.lead_id)
      .gte('sent_at', new Date(Date.now() - params.days_back * 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false });

    if (!engagements || engagements.length === 0) {
      return { pattern: 'no_data', best_times: [] };
    }

    // Analyze open times
    const openTimes = engagements
      .filter(e => e.opened_at)
      .map(e => {
        const opened = new Date(e.opened_at!);
        return {
          hour: opened.getHours(),
          day: opened.getDay(),
          response_time: (opened.getTime() - new Date(e.sent_at).getTime()) / (1000 * 60), // minutes
        };
      });

    // Find best hours
    const hourCounts: Record<number, number> = {};
    openTimes.forEach(t => {
      hourCounts[t.hour] = (hourCounts[t.hour] || 0) + 1;
    });

    const bestHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    // Find best days
    const dayCounts: Record<number, number> = {};
    openTimes.forEach(t => {
      dayCounts[t.day] = (dayCounts[t.day] || 0) + 1;
    });

    const bestDays = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => parseInt(day));

    // Calculate average response time
    const avgResponseTime = openTimes.length > 0
      ? openTimes.reduce((sum, t) => sum + t.response_time, 0) / openTimes.length
      : 0;

    return {
      pattern: 'analyzed',
      best_hours: bestHours,
      best_days: bestDays,
      avg_response_time_minutes: avgResponseTime,
      engagement_count: openTimes.length,
      total_sent: engagements.length,
      open_rate: openTimes.length / engagements.length,
    };
  },
};

const TimezonePredictorTool: AgentTool = {
  name: 'timezone_predictor',
  description: 'Predict timezone based on location and activity',
  parameters: z.object({
    location: z.string().optional(),
    phone: z.string().optional(),
    email_domain: z.string().optional(),
    linkedin_activity: z.array(z.object({
      timestamp: z.string(),
      type: z.string(),
    })).optional(),
  }),
  execute: async (params) => {
    let timezone = 'America/New_York'; // Default
    let confidence = 0.3;

    // Check location
    if (params.location) {
      const locationTimezones: Record<string, string> = {
        'san francisco': 'America/Los_Angeles',
        'los angeles': 'America/Los_Angeles',
        'seattle': 'America/Los_Angeles',
        'new york': 'America/New_York',
        'boston': 'America/New_York',
        'chicago': 'America/Chicago',
        'dallas': 'America/Chicago',
        'denver': 'America/Denver',
        'london': 'Europe/London',
        'paris': 'Europe/Paris',
        'berlin': 'Europe/Berlin',
        'singapore': 'Asia/Singapore',
        'tokyo': 'Asia/Tokyo',
        'sydney': 'Australia/Sydney',
      };

      const locationLower = params.location.toLowerCase();
      for (const [city, tz] of Object.entries(locationTimezones)) {
        if (locationLower.includes(city)) {
          timezone = tz;
          confidence = 0.8;
          break;
        }
      }
    }

    // Check phone area code
    if (params.phone && confidence < 0.8) {
      const areaCode = params.phone.match(/^\+?1?(\d{3})/)?.[1];
      if (areaCode) {
        const areaCodeTimezones: Record<string, string> = {
          '415': 'America/Los_Angeles',
          '650': 'America/Los_Angeles',
          '310': 'America/Los_Angeles',
          '206': 'America/Los_Angeles',
          '212': 'America/New_York',
          '646': 'America/New_York',
          '617': 'America/New_York',
          '312': 'America/Chicago',
          '303': 'America/Denver',
        };

        if (areaCodeTimezones[areaCode]) {
          timezone = areaCodeTimezones[areaCode];
          confidence = 0.7;
        }
      }
    }

    // Analyze LinkedIn activity patterns
    if (params.linkedin_activity && params.linkedin_activity.length > 5) {
      const activityHours = params.linkedin_activity.map((a: { timestamp: string; type: string }) => {
        const date = new Date(a.timestamp);
        return date.getUTCHours();
      });

      // Find most common activity hours (in UTC)
      const hourCounts: Record<number, number> = {};
      activityHours.forEach((h: number) => {
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });

      const peakHour = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0][0];

      // Infer timezone from peak activity hour
      // Assuming peak activity is around 10am-2pm local time
      const utcOffset = 12 - parseInt(peakHour);

      if (utcOffset >= -5 && utcOffset <= -8) {
        timezone = 'America/Los_Angeles';
        confidence = 0.6;
      } else if (utcOffset >= -4 && utcOffset <= -5) {
        timezone = 'America/New_York';
        confidence = 0.6;
      }
    }

    return {
      predicted_timezone: timezone,
      confidence,
      utc_offset: getUTCOffset(timezone),
    };
  },
};

const OptimalTimeTool: AgentTool = {
  name: 'optimal_time_calculator',
  description: 'Calculate optimal send time',
  parameters: z.object({
    timezone: z.string(),
    best_hours: z.array(z.number()).optional(),
    best_days: z.array(z.number()).optional(),
    industry: z.string().optional(),
    role: z.string().optional(),
    sequence_step: z.number().optional(),
  }),
  execute: async (params) => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: params.timezone,
      hour: 'numeric',
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    // Get the day of week in the target timezone by creating a date string and parsing it
    const tzDateStr = now.toLocaleString('en-US', { timeZone: params.timezone, weekday: 'short' });
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const currentDay = dayMap[tzDateStr.split(',')[0]] ?? now.getDay();

    // Default best times if not provided
    const bestHours = params.best_hours?.length ? params.best_hours : [10, 14, 9]; // 10am, 2pm, 9am
    const bestDays = params.best_days?.length ? params.best_days : [2, 3, 4]; // Tue, Wed, Thu

    // Industry-specific adjustments
    const industryAdjustments: Record<string, number[]> = {
      'tech': [9, 10, 14],
      'finance': [8, 9, 16],
      'healthcare': [7, 11, 15],
      'retail': [11, 14, 19],
      'education': [10, 15, 16],
    };

    const adjustedHours = industryAdjustments[params.industry?.toLowerCase() || ''] || bestHours;

    // Find next optimal time
    let targetHour = adjustedHours[0];
    let daysToAdd = 0;

    // Check if we can send today
    if (currentHour < adjustedHours[adjustedHours.length - 1]) {
      // Find next available hour today
      targetHour = adjustedHours.find(h => h > currentHour) || adjustedHours[0];
      if (targetHour <= currentHour) {
        daysToAdd = 1;
      }
    } else {
      // Send tomorrow
      daysToAdd = 1;
    }

    // Skip weekends if needed
    const targetDay = (currentDay + daysToAdd) % 7;
    if (targetDay === 0) daysToAdd += 1; // Skip Sunday
    if (targetDay === 6) daysToAdd += 2; // Skip Saturday

    // Calculate optimal send time
    const optimalTime = new Date(now);
    optimalTime.setDate(optimalTime.getDate() + daysToAdd);
    optimalTime.setHours(targetHour, Math.floor(Math.random() * 30), 0, 0); // Add random minutes

    // Sequence step timing adjustments
    if (params.sequence_step) {
      // Add delays based on step number
      const stepDelay = params.sequence_step <= 3 ? 0 : 1; // Extra day after 3rd email
      optimalTime.setDate(optimalTime.getDate() + stepDelay);
    }

    return {
      optimal_time: optimalTime.toISOString(),
      local_time: optimalTime.toLocaleString('en-US', { timeZone: params.timezone }),
      confidence: 0.75,
      reasoning: `Best time for ${params.industry || 'general'} industry, step ${params.sequence_step || 1}`,
    };
  },
};

// ============================================
// TIMING AGENT IMPLEMENTATION
// ============================================

export class TimingAgent extends BaseAgent {
  constructor() {
    super({
      name: 'TimingAgent',
      role: 'Send Time Optimizer',
      description: 'Predicts and optimizes the best times to send messages',
      capabilities: [
        'engagement_pattern_analysis',
        'timezone_detection',
        'optimal_time_prediction',
        'industry_timing_patterns',
        'cadence_optimization',
        'response_time_prediction',
      ],
      tools: [
        EngagementAnalyzerTool,
        TimezonePredictorTool,
        OptimalTimeTool,
      ],
    });
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    try {
      if (!this.validateTask(task)) {
        return {
          success: false,
          error: 'Invalid task',
        };
      }

      this.log(`Executing timing task: ${task.type}`);

      switch (task.type) {
        case 'predict_send_time':
          return await this.predictSendTime(task);

        case 'analyze_engagement':
          return await this.analyzeEngagement(task);

        case 'optimize_cadence':
          return await this.optimizeCadence(task);

        case 'predict_response_time':
          return await this.predictResponseTime(task);

        default:
          return {
            success: false,
            error: `Unknown task type: ${task.type}`,
          };
      }
    } catch (error) {
      return this.handleError(error, task);
    }
  }

  async processPrompt(prompt: string, context: AgentContext): Promise<string> {
    const result = await this.predictSendTime({
      id: crypto.randomUUID(),
      type: 'predict_send_time',
      description: prompt,
      parameters: {},
      context,
    });

    return JSON.stringify(result.data, null, 2);
  }

  // ============================================
  // TIMING METHODS
  // ============================================

  private async predictSendTime(task: AgentTask): Promise<AgentResult> {
    const context = task.context;
    const params = task.parameters;

    // Analyze historical engagement if available
    let engagementData: any = { pattern: 'no_data' };
    if (context.lead?.id) {
      engagementData = await this.useTool('engagement_analyzer', {
        lead_id: context.lead.id,
        days_back: 30,
      });
    }

    // Predict timezone
    const timezoneData = await this.useTool('timezone_predictor', {
      location: context.lead?.location,
      phone: context.lead?.phone,
      email_domain: context.lead?.email?.split('@')[1],
    });

    // Calculate optimal send time
    const optimalTimeData = await this.useTool('optimal_time_calculator', {
      timezone: timezoneData.predicted_timezone,
      best_hours: engagementData.best_hours,
      best_days: engagementData.best_days,
      industry: context.company?.industry || context.lead?.industry,
      role: context.lead?.title,
      sequence_step: params.sequence_step || 1,
    });

    // Store in memory for future use
    this.remember(`lead_timing_${context.lead?.id}`, {
      timezone: timezoneData.predicted_timezone,
      best_hours: engagementData.best_hours || [10, 14, 9],
      engagement_pattern: engagementData.pattern,
    }, true);

    return {
      success: true,
      data: {
        optimal_send_time: optimalTimeData.optimal_time,
        local_time: optimalTimeData.local_time,
        timezone: timezoneData.predicted_timezone,
        timezone_confidence: timezoneData.confidence,
        engagement_analysis: {
          pattern: engagementData.pattern,
          open_rate: engagementData.open_rate || 0,
          best_hours: engagementData.best_hours || [],
          best_days: engagementData.best_days || [],
        },
        reasoning: optimalTimeData.reasoning,
      },
      confidence: (timezoneData.confidence + optimalTimeData.confidence) / 2,
      metadata: {
        has_historical_data: engagementData.pattern !== 'no_data',
        emails_analyzed: engagementData.total_sent || 0,
      },
    };
  }

  private async analyzeEngagement(task: AgentTask): Promise<AgentResult> {
    const context = task.context;

    if (!context.lead?.id) {
      return {
        success: false,
        error: 'Lead ID required for engagement analysis',
      };
    }

    const engagementData = await this.useTool('engagement_analyzer', {
      lead_id: context.lead.id,
      days_back: task.parameters.days_back || 30,
    });

    // Identify patterns
    const patterns = this.identifyPatterns(engagementData);

    // Generate recommendations
    const recommendations = this.generateTimingRecommendations(engagementData, patterns);

    return {
      success: true,
      data: {
        engagement_summary: engagementData,
        patterns,
        recommendations,
      },
      confidence: engagementData.engagement_count > 5 ? 0.85 : 0.5,
    };
  }

  private async optimizeCadence(task: AgentTask): Promise<AgentResult> {
    const params = task.parameters;
    const currentCadence = params.current_cadence || [1, 2, 3, 5, 7]; // Days between emails

    // Analyze performance at each step
    const stepPerformance = params.step_performance || [];

    // Calculate optimal cadence
    const optimizedCadence = this.calculateOptimalCadence(
      currentCadence,
      stepPerformance,
      params.target_metric || 'engagement'
    );

    return {
      success: true,
      data: {
        current_cadence: currentCadence,
        optimized_cadence: optimizedCadence,
        expected_improvement: '15-25%',
        reasoning: 'Based on engagement decay patterns and industry benchmarks',
      },
      confidence: 0.7,
    };
  }

  private async predictResponseTime(task: AgentTask): Promise<AgentResult> {
    const context = task.context;

    // Factors affecting response time
    const factors = {
      day_of_week: new Date().getDay(),
      hour_of_day: new Date().getHours(),
      industry: context.company?.industry,
      role_seniority: this.estimateSeniority(context.lead?.title),
      email_number: task.parameters.sequence_step || 1,
    };

    // Predict response time
    const prediction = this.calculateResponseTimePrediction(factors);

    return {
      success: true,
      data: {
        predicted_response_time_hours: prediction.hours,
        confidence: prediction.confidence,
        factors_considered: factors,
        recommendation: prediction.hours < 24
          ? 'Expect quick response - prepare follow-up'
          : 'Longer response expected - schedule reminder',
      },
      confidence: prediction.confidence,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private identifyPatterns(engagementData: any): any {
    const patterns: any = {
      engagement_trend: 'stable',
      best_time_consistency: false,
      day_preference: null,
    };

    if (engagementData.best_hours?.length > 0) {
      // Check if best hours are consistent (within 2-hour window)
      const hourRange = Math.max(...engagementData.best_hours) - Math.min(...engagementData.best_hours);
      patterns.best_time_consistency = hourRange <= 2;
    }

    if (engagementData.best_days?.length > 0) {
      // Identify day preference
      const weekdays = engagementData.best_days.filter((d: number) => d >= 1 && d <= 5);
      if (weekdays.length > engagementData.best_days.length * 0.8) {
        patterns.day_preference = 'weekdays';
      }
    }

    return patterns;
  }

  private generateTimingRecommendations(engagementData: any, patterns: any): string[] {
    const recommendations = [];

    if (engagementData.open_rate < 0.2) {
      recommendations.push('Consider testing different send times - current open rate is below average');
    }

    if (patterns.best_time_consistency) {
      recommendations.push(`Consistently send between ${Math.min(...engagementData.best_hours)}-${Math.max(...engagementData.best_hours)}:00 for best engagement`);
    }

    if (patterns.day_preference === 'weekdays') {
      recommendations.push('Avoid sending on weekends - engagement is significantly lower');
    }

    if (engagementData.avg_response_time_minutes < 60) {
      recommendations.push('Lead responds quickly - consider shorter sequence cadence');
    }

    return recommendations;
  }

  private calculateOptimalCadence(
    currentCadence: number[],
    stepPerformance: any[],
    targetMetric: string
  ): number[] {
    // Simple optimization - adjust based on performance
    const optimized = [...currentCadence];

    // If early emails perform well, accelerate
    if (stepPerformance[0]?.open_rate > 0.3) {
      optimized[1] = Math.max(1, optimized[1] - 1);
    }

    // If engagement drops off, extend gaps
    if (stepPerformance[2]?.open_rate < 0.1) {
      optimized[3] = optimized[3] + 2;
      optimized[4] = optimized[4] + 3;
    }

    return optimized;
  }

  private estimateSeniority(title?: string): string {
    if (!title) return 'unknown';

    const seniorKeywords = ['chief', 'president', 'vp', 'vice president', 'head', 'director'];
    const titleLower = title.toLowerCase();

    for (const keyword of seniorKeywords) {
      if (titleLower.includes(keyword)) {
        return 'senior';
      }
    }

    if (titleLower.includes('manager')) return 'mid';
    return 'junior';
  }

  private calculateResponseTimePrediction(factors: any): { hours: number; confidence: number } {
    let baseHours = 24;
    let confidence = 0.6;

    // Seniority affects response time
    if (factors.role_seniority === 'senior') {
      baseHours *= 2; // Executives take longer
    } else if (factors.role_seniority === 'junior') {
      baseHours *= 0.7; // Junior folks respond faster
    }

    // Day of week
    if (factors.day_of_week === 1) { // Monday
      baseHours *= 1.3; // Busy day
    } else if (factors.day_of_week === 5) { // Friday
      baseHours *= 1.5; // May not respond until Monday
    }

    // Email number in sequence
    if (factors.email_number > 3) {
      baseHours *= 0.8; // Later emails get faster responses (if any)
      confidence -= 0.1;
    }

    return {
      hours: Math.round(baseHours),
      confidence: Math.max(0.3, confidence),
    };
  }
}

// Utility function
function getUTCOffset(timezone: string): number {
  const now = new Date();
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
}