/**
 * Research Agent
 * Gathers context and information about leads, companies, and industries
 */

import { BaseAgent, AgentTask, AgentResult, AgentContext, AgentTool } from './base-agent';
import { z } from 'zod';

// ============================================
// RESEARCH TOOLS
// ============================================

const WebSearchTool: AgentTool = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string(),
    num_results: z.number().min(1).max(10).default(5),
  }),
  execute: async (params) => {
    // In production, integrate with search API (Serper, Bing, etc.)
    console.log('Searching web for:', params.query);

    // Simulated results
    return {
      results: [
        {
          title: 'Company News',
          snippet: 'Recent funding announcement...',
          url: 'https://example.com/news',
        },
      ],
    };
  },
};

const LinkedInScrapeTool: AgentTool = {
  name: 'linkedin_scrape',
  description: 'Extract information from LinkedIn profiles',
  parameters: z.object({
    profile_url: z.string().url(),
    extract_fields: z.array(z.string()).optional(),
  }),
  execute: async (params) => {
    // In production, use the Chrome extension or scraping service
    console.log('Scraping LinkedIn profile:', params.profile_url);

    // Check if we have cached data
    const supabase = (await import('@/lib/supabase/server')).createClient;
    const client = await supabase();

    const { data: cached } = await client
      .from('linkedin_profiles')
      .select('*')
      .eq('profile_url', params.profile_url)
      .single();

    if (cached && cached.last_scraped_at) {
      const hoursSinceUpdate =
        (Date.now() - new Date(cached.last_scraped_at).getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate < 24) {
        return cached;
      }
    }

    // Return mock data for now
    return {
      full_name: 'John Doe',
      headline: 'CEO at Example Corp',
      location: 'San Francisco, CA',
      current_company: 'Example Corp',
      current_title: 'Chief Executive Officer',
      about: 'Passionate about innovation...',
      experience: [
        {
          title: 'CEO',
          company: 'Example Corp',
          duration: '2020 - Present',
        },
      ],
    };
  },
};

const CompanyDataTool: AgentTool = {
  name: 'company_data',
  description: 'Get company information and insights',
  parameters: z.object({
    company_name: z.string(),
    data_points: z.array(z.enum([
      'overview',
      'size',
      'industry',
      'funding',
      'news',
      'technologies',
      'competitors',
    ])).optional(),
  }),
  execute: async (params) => {
    // In production, integrate with Clearbit, Crunchbase, etc.
    console.log('Fetching company data for:', params.company_name);

    return {
      name: params.company_name,
      industry: 'Technology',
      size: '100-500',
      founded: 2015,
      funding: {
        total: '$50M',
        last_round: 'Series B',
        last_round_date: '2023-06',
      },
      technologies: ['React', 'Node.js', 'AWS'],
      recent_news: [
        'Announced new product launch',
        'Expanded to European market',
      ],
    };
  },
};

const SocialMediaTool: AgentTool = {
  name: 'social_media',
  description: 'Analyze social media presence and activity',
  parameters: z.object({
    handle: z.string(),
    platform: z.enum(['twitter', 'linkedin', 'facebook']),
    analysis_type: z.enum(['recent_posts', 'engagement', 'topics']).default('recent_posts'),
  }),
  execute: async (params) => {
    console.log('Analyzing social media:', params.handle, params.platform);

    return {
      recent_posts: [
        {
          content: 'Excited about our new product launch!',
          date: '2024-01-15',
          engagement: { likes: 45, comments: 12 },
        },
      ],
      topics: ['AI', 'SaaS', 'Product Development'],
      engagement_rate: 0.035,
    };
  },
};

// ============================================
// RESEARCH AGENT IMPLEMENTATION
// ============================================

export class ResearchAgent extends BaseAgent {
  constructor() {
    super({
      name: 'ResearchAgent',
      role: 'Information Gatherer',
      description: 'Researches and gathers context about leads, companies, and industries',
      capabilities: [
        'web_search',
        'linkedin_profile_analysis',
        'company_research',
        'industry_insights',
        'social_media_analysis',
        'news_monitoring',
        'competitive_intelligence',
      ],
      tools: [
        WebSearchTool,
        LinkedInScrapeTool,
        CompanyDataTool,
        SocialMediaTool,
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

      this.log(`Executing research task: ${task.type}`);

      switch (task.type) {
        case 'gather_lead_context':
          return await this.gatherLeadContext(task.context);

        case 'research_company':
          return await this.researchCompany(task.context);

        case 'find_triggers':
          return await this.findTriggers(task.context);

        case 'competitive_analysis':
          return await this.analyzeCompetition(task.context);

        case 'industry_insights':
          return await this.getIndustryInsights(task.context);

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
    // Process natural language research requests
    const researchTask: AgentTask = {
      id: crypto.randomUUID(),
      type: 'gather_lead_context',
      description: prompt,
      parameters: {},
      context,
    };

    const result = await this.execute(researchTask);
    return JSON.stringify(result.data, null, 2);
  }

  // ============================================
  // RESEARCH METHODS
  // ============================================

  private async gatherLeadContext(context: AgentContext): Promise<AgentResult> {
    const research: any = {
      lead: context.lead,
      linkedin: null,
      company: null,
      recent_activity: null,
      triggers: [],
      insights: [],
    };

    // Research LinkedIn profile
    if (context.lead?.linkedin_url) {
      try {
        const linkedinData = await this.useTool('linkedin_scrape', {
          profile_url: context.lead.linkedin_url,
        });
        research.linkedin = linkedinData;

        // Extract insights
        if (linkedinData.recent_posts) {
          research.insights.push({
            type: 'activity',
            message: 'Recently active on LinkedIn',
            data: linkedinData.recent_posts[0],
          });
        }
      } catch (error) {
        this.log('LinkedIn scrape failed', 'warn');
      }
    }

    // Research company
    if (context.lead?.company || research.linkedin?.current_company) {
      const companyName = context.lead?.company || research.linkedin.current_company;

      try {
        const companyData = await this.useTool('company_data', {
          company_name: companyName,
          data_points: ['overview', 'funding', 'news', 'technologies'],
        });
        research.company = companyData;

        // Find triggers in company data
        if (companyData.funding?.last_round_date) {
          const monthsSinceFunding = this.monthsSince(companyData.funding.last_round_date);
          if (monthsSinceFunding < 6) {
            research.triggers.push({
              type: 'funding',
              priority: 'high',
              message: `Recent ${companyData.funding.last_round} funding (${monthsSinceFunding} months ago)`,
              data: companyData.funding,
            });
          }
        }

        if (companyData.recent_news?.length > 0) {
          research.triggers.push({
            type: 'news',
            priority: 'medium',
            message: companyData.recent_news[0],
          });
        }
      } catch (error) {
        this.log('Company research failed', 'warn');
      }
    }

    // Web search for additional context
    const searchQuery = `"${context.lead?.first_name} ${context.lead?.last_name}" ${research.company?.name || ''}`;

    try {
      const webResults = await this.useTool('web_search', {
        query: searchQuery,
        num_results: 3,
      });

      if (webResults.results?.length > 0) {
        research.recent_activity = webResults.results;
      }
    } catch (error) {
      this.log('Web search failed', 'warn');
    }

    // Analyze and score the research
    const relevanceScore = this.calculateRelevanceScore(research);

    // Store in memory for future use
    this.remember(`lead_research_${context.lead?.id}`, research, true);

    return {
      success: true,
      data: research,
      confidence: relevanceScore,
      metadata: {
        sources_checked: ['linkedin', 'company_data', 'web_search'],
        triggers_found: research.triggers.length,
        insights_generated: research.insights.length,
      },
    };
  }

  private async researchCompany(context: AgentContext): Promise<AgentResult> {
    const companyName = context.company?.name || context.lead?.company;

    if (!companyName) {
      return {
        success: false,
        error: 'No company name provided',
      };
    }

    const companyData = await this.useTool('company_data', {
      company_name: companyName,
      data_points: ['overview', 'size', 'industry', 'funding', 'news', 'technologies', 'competitors'],
    });

    // Enrich with web search
    const newsResults = await this.useTool('web_search', {
      query: `"${companyName}" news announcement`,
      num_results: 5,
    });

    const insights = this.generateCompanyInsights(companyData, newsResults);

    return {
      success: true,
      data: {
        company: companyData,
        recent_news: newsResults.results,
        insights,
      },
      confidence: 0.85,
    };
  }

  private async findTriggers(context: AgentContext): Promise<AgentResult> {
    const triggers: any[] = [];

    // Job change trigger
    if (context.lead?.job_changed_recently) {
      triggers.push({
        type: 'job_change',
        priority: 'high',
        message: 'Recently changed jobs',
        recommended_action: 'Send congratulations and introduction',
      });
    }

    // Funding trigger
    const companyResearch = await this.researchCompany(context);
    if (companyResearch.data?.company?.funding) {
      const funding = companyResearch.data.company.funding;
      if (this.monthsSince(funding.last_round_date) < 6) {
        triggers.push({
          type: 'funding',
          priority: 'high',
          message: `Company raised ${funding.last_round}`,
          recommended_action: 'Reference funding in outreach',
        });
      }
    }

    // Social media activity
    if (context.lead?.linkedin_url) {
      // Check for recent posts or activity
      triggers.push({
        type: 'social_activity',
        priority: 'medium',
        message: 'Active on LinkedIn',
        recommended_action: 'Engage with recent posts before outreach',
      });
    }

    return {
      success: true,
      data: {
        triggers,
        total_triggers: triggers.length,
        high_priority: triggers.filter(t => t.priority === 'high').length,
      },
      confidence: 0.9,
    };
  }

  private async analyzeCompetition(context: AgentContext): Promise<AgentResult> {
    // Competitive intelligence gathering
    const competitors = context.company?.competitors || [];
    const analysis: any = {
      competitors: [],
      market_position: null,
      differentiators: [],
    };

    for (const competitor of competitors) {
      const compData = await this.useTool('company_data', {
        company_name: competitor,
        data_points: ['overview', 'size', 'funding'],
      });

      analysis.competitors.push({
        name: competitor,
        data: compData,
      });
    }

    return {
      success: true,
      data: analysis,
      confidence: 0.75,
    };
  }

  private async getIndustryInsights(context: AgentContext): Promise<AgentResult> {
    const industry = context.company?.industry || context.lead?.industry;

    if (!industry) {
      return {
        success: false,
        error: 'No industry specified',
      };
    }

    // Search for industry trends
    const trendResults = await this.useTool('web_search', {
      query: `${industry} trends 2024 challenges opportunities`,
      num_results: 5,
    });

    // Analyze and extract insights
    const insights = {
      industry,
      trends: this.extractTrends(trendResults),
      challenges: this.extractChallenges(trendResults),
      opportunities: this.extractOpportunities(trendResults),
    };

    return {
      success: true,
      data: insights,
      confidence: 0.8,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private monthsSince(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    const months = (now.getFullYear() - date.getFullYear()) * 12 +
                  now.getMonth() - date.getMonth();
    return months;
  }

  private calculateRelevanceScore(research: any): number {
    let score = 0.5; // Base score

    if (research.linkedin) score += 0.15;
    if (research.company) score += 0.15;
    if (research.triggers.length > 0) score += 0.1;
    if (research.recent_activity) score += 0.05;
    if (research.insights.length > 0) score += 0.05;

    return Math.min(score, 1.0);
  }

  private generateCompanyInsights(companyData: any, newsResults: any): any[] {
    const insights = [];

    // Growth insight
    if (companyData.size && companyData.founded) {
      const age = new Date().getFullYear() - companyData.founded;
      insights.push({
        type: 'growth',
        message: `${age} year old company with ${companyData.size} employees`,
      });
    }

    // Technology stack insight
    if (companyData.technologies?.length > 0) {
      insights.push({
        type: 'tech_stack',
        message: `Uses ${companyData.technologies.join(', ')}`,
      });
    }

    // News insights
    if (newsResults.results?.length > 0) {
      insights.push({
        type: 'recent_news',
        message: newsResults.results[0].title,
      });
    }

    return insights;
  }

  private extractTrends(searchResults: any): string[] {
    // Simple extraction - in production, use NLP
    return ['Digital transformation', 'AI adoption', 'Remote work'];
  }

  private extractChallenges(searchResults: any): string[] {
    return ['Talent acquisition', 'Market competition', 'Technology costs'];
  }

  private extractOpportunities(searchResults: any): string[] {
    return ['Market expansion', 'New product lines', 'Partnership potential'];
  }
}