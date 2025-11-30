/**
 * Personalization Agent
 * Generates hyper-personalized content based on lead context and research
 */

import { BaseAgent, AgentTask, AgentResult, AgentContext, AgentTool } from './base-agent';
import { z } from 'zod';

// ============================================
// PERSONALIZATION TOOLS
// ============================================

const ToneAnalyzerTool: AgentTool = {
  name: 'tone_analyzer',
  description: 'Analyze and match communication tone',
  parameters: z.object({
    sample_text: z.string(),
    target_tone: z.enum(['formal', 'casual', 'friendly', 'direct', 'enthusiastic']).optional(),
  }),
  execute: async (params) => {
    // Analyze the tone of sample text
    const tones = {
      formal: 0,
      casual: 0,
      friendly: 0,
      direct: 0,
      enthusiastic: 0,
    };

    // Simple heuristic analysis (in production, use NLP)
    const text = params.sample_text.toLowerCase();

    if (text.includes('dear') || text.includes('sincerely')) tones.formal += 0.3;
    if (text.includes('hey') || text.includes('thanks')) tones.casual += 0.3;
    if (text.includes('!') || text.includes('excited')) tones.enthusiastic += 0.3;
    if (text.length < 100) tones.direct += 0.2;
    if (text.includes('hope') || text.includes('great')) tones.friendly += 0.3;

    // Find dominant tone
    const dominantTone = Object.entries(tones).reduce((a, b) =>
      tones[a[0] as keyof typeof tones] > tones[b[0] as keyof typeof tones] ? a : b
    )[0];

    return {
      dominant_tone: dominantTone,
      tone_scores: tones,
      recommended_style: params.target_tone || dominantTone,
    };
  },
};

const ContentGeneratorTool: AgentTool = {
  name: 'content_generator',
  description: 'Generate personalized content using AI',
  parameters: z.object({
    template: z.string(),
    variables: z.record(z.string(), z.any()),
    tone: z.string().optional(),
    max_length: z.number().optional(),
  }),
  execute: async (params) => {
    // In production, integrate with OpenAI/Anthropic API
    let content = params.template;

    // Replace variables
    Object.entries(params.variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, String(value));
    });

    // Apply tone adjustments
    if (params.tone === 'casual') {
      content = content.replace(/Dear /g, 'Hi ')
        .replace(/Sincerely,/g, 'Best,');
    } else if (params.tone === 'enthusiastic') {
      content = content.replace(/\./g, '!');
    }

    // Trim to max length if specified
    if (params.max_length && content.length > params.max_length) {
      content = content.substring(0, params.max_length - 3) + '...';
    }

    return {
      generated_content: content,
      word_count: content.split(' ').length,
      personalization_score: 0.85,
    };
  },
};

const SubjectLineTool: AgentTool = {
  name: 'subject_line_generator',
  description: 'Generate compelling subject lines',
  parameters: z.object({
    context: z.object({
      lead_name: z.string(),
      company: z.string().optional(),
      trigger: z.string().optional(),
      value_prop: z.string(),
    }),
    style: z.enum(['question', 'benefit', 'curiosity', 'personal', 'urgent']).default('benefit'),
  }),
  execute: async (params) => {
    const templates = {
      question: [
        `${params.context.lead_name}, quick question about ${params.context.company}`,
        `Is ${params.context.company} struggling with ${params.context.value_prop}?`,
        `${params.context.lead_name}, how do you handle ${params.context.value_prop}?`,
      ],
      benefit: [
        `${params.context.value_prop} for ${params.context.company}`,
        `Help ${params.context.company} ${params.context.value_prop}`,
        `${params.context.lead_name}: ${params.context.value_prop} in 10 minutes`,
      ],
      curiosity: [
        `${params.context.company}'s biggest opportunity`,
        `Noticed something about ${params.context.company}`,
        `${params.context.lead_name}, saw your ${params.context.trigger}`,
      ],
      personal: [
        `${params.context.lead_name}, loved your post about ${params.context.trigger}`,
        `Congrats on ${params.context.trigger}, ${params.context.lead_name}!`,
        `${params.context.lead_name} - fellow ${params.context.trigger} enthusiast`,
      ],
      urgent: [
        `Time-sensitive for ${params.context.company}`,
        `${params.context.lead_name}, expires Friday`,
        `Last chance: ${params.context.value_prop}`,
      ],
    };

    const selectedTemplates = (templates as any)[params.style];
    const variations = selectedTemplates.map((template: string) => {
      let line = template;
      // Further personalization based on context
      if (!params.context.trigger) {
        line = line.replace(/your \${params.context.trigger}/g, 'your recent update');
      }
      return line;
    });

    return {
      subject_lines: variations,
      recommended: variations[0],
      style: params.style,
      open_rate_prediction: Math.random() * 0.3 + 0.15, // 15-45% predicted open rate
    };
  },
};

// ============================================
// PERSONALIZATION AGENT IMPLEMENTATION
// ============================================

export class PersonalizationAgent extends BaseAgent {
  private personalizationTemplates: Map<string, string>;

  constructor() {
    super({
      name: 'PersonalizationAgent',
      role: 'Content Personalizer',
      description: 'Creates hyper-personalized messages based on lead context and behavior',
      capabilities: [
        'content_generation',
        'tone_matching',
        'subject_line_optimization',
        'dynamic_personalization',
        'a_b_testing',
        'multilingual_support',
      ],
      model: 'gpt-4',
      temperature: 0.7,
      tools: [
        ToneAnalyzerTool,
        ContentGeneratorTool,
        SubjectLineTool,
      ],
    });

    this.personalizationTemplates = new Map();
    this.loadTemplates();
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    try {
      if (!this.validateTask(task)) {
        return {
          success: false,
          error: 'Invalid task',
        };
      }

      this.log(`Executing personalization task: ${task.type}`);

      switch (task.type) {
        case 'generate_email':
          return await this.generateEmail(task);

        case 'generate_linkedin_message':
          return await this.generateLinkedInMessage(task);

        case 'generate_subject_line':
          return await this.generateSubjectLine(task);

        case 'personalize_template':
          return await this.personalizeTemplate(task);

        case 'optimize_content':
          return await this.optimizeContent(task);

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
    const result = await this.generateEmail({
      id: crypto.randomUUID(),
      type: 'generate_email',
      description: prompt,
      parameters: {},
      context,
    });

    return result.data?.email_content || 'Failed to generate content';
  }

  // ============================================
  // CONTENT GENERATION METHODS
  // ============================================

  private async generateEmail(task: AgentTask): Promise<AgentResult> {
    const context = task.context;
    const params = task.parameters;

    // Get research from ResearchAgent if available
    const research = this.recall(`lead_research_${context.lead?.id}`) || {};

    // Analyze tone preference
    const toneAnalysis = await this.useTool('tone_analyzer', {
      sample_text: params.sample_text || '',
      target_tone: params.tone || 'friendly',
    });

    // Generate subject line
    const subjectLineResult = await this.useTool('subject_line_generator', {
      context: {
        lead_name: context.lead?.first_name || 'there',
        company: context.lead?.company || research.company?.name || '',
        trigger: research.triggers?.[0]?.message || '',
        value_prop: params.value_proposition || 'save time and increase revenue',
      },
      style: params.subject_style || 'benefit',
    });

    // Build personalization variables
    const personalizations = this.buildPersonalizations(context, research);

    // Select appropriate template
    const template = this.selectTemplate(params.template_type || 'cold_outreach');

    // Generate content
    const contentResult = await this.useTool('content_generator', {
      template,
      variables: personalizations,
      tone: toneAnalysis.recommended_style,
      max_length: params.max_length || 150,
    });

    // Add dynamic elements
    const enrichedContent = this.addDynamicElements(
      contentResult.generated_content,
      context,
      research
    );

    // Calculate personalization score
    const personalizationScore = this.calculatePersonalizationScore(
      enrichedContent,
      personalizations
    );

    return {
      success: true,
      data: {
        subject_line: subjectLineResult.recommended,
        email_content: enrichedContent,
        personalization_score: personalizationScore,
        tone: toneAnalysis.recommended_style,
        variables_used: Object.keys(personalizations),
        alternative_subjects: subjectLineResult.subject_lines,
      },
      confidence: personalizationScore,
      metadata: {
        word_count: contentResult.word_count,
        predicted_open_rate: subjectLineResult.open_rate_prediction,
        research_available: !!research.company,
      },
    };
  }

  private async generateLinkedInMessage(task: AgentTask): Promise<AgentResult> {
    const context = task.context;
    const params = task.parameters;

    // LinkedIn messages are shorter and more casual
    const template = params.is_connection_request
      ? this.getConnectionRequestTemplate()
      : this.getLinkedInMessageTemplate();

    const research = this.recall(`lead_research_${context.lead?.id}`) || {};
    const personalizations = this.buildPersonalizations(context, research);

    // Add LinkedIn-specific personalizations
    if (research.linkedin) {
      personalizations.mutual_connections = research.linkedin.mutual_connections || 'several';
      personalizations.recent_post = research.linkedin.recent_posts?.[0]?.content || '';
      personalizations.headline = research.linkedin.headline || '';
    }

    const contentResult = await this.useTool('content_generator', {
      template,
      variables: personalizations,
      tone: 'casual', // LinkedIn is generally more casual
      max_length: params.is_connection_request ? 300 : 500,
    });

    return {
      success: true,
      data: {
        message: contentResult.generated_content,
        is_connection_request: params.is_connection_request || false,
        personalization_score: 0.9,
      },
      confidence: 0.9,
    };
  }

  private async generateSubjectLine(task: AgentTask): Promise<AgentResult> {
    const context = task.context;
    const params = task.parameters;

    const result = await this.useTool('subject_line_generator', {
      context: {
        lead_name: context.lead?.first_name || '',
        company: context.lead?.company || '',
        trigger: params.trigger || '',
        value_prop: params.value_proposition || '',
      },
      style: params.style || 'benefit',
    });

    // A/B test variations
    const variations = result.subject_lines.map((line: string, index: number) => ({
      variant: String.fromCharCode(65 + index), // A, B, C...
      subject_line: line,
      predicted_open_rate: result.open_rate_prediction + (Math.random() * 0.1 - 0.05),
    }));

    return {
      success: true,
      data: {
        primary: result.recommended,
        variations,
        style: result.style,
      },
      confidence: 0.85,
    };
  }

  private async personalizeTemplate(task: AgentTask): Promise<AgentResult> {
    const template = task.parameters.template;
    const variables = task.parameters.variables || {};

    const result = await this.useTool('content_generator', {
      template,
      variables,
      tone: task.parameters.tone,
    });

    return {
      success: true,
      data: {
        personalized_content: result.generated_content,
        variables_replaced: Object.keys(variables),
      },
      confidence: 0.95,
    };
  }

  private async optimizeContent(task: AgentTask): Promise<AgentResult> {
    const content = task.parameters.content;

    // Analyze current content
    const analysis = {
      length: content.length,
      word_count: content.split(' ').length,
      personalization_tokens: (content.match(/{{[^}]+}}/g) || []).length,
      questions: (content.match(/\?/g) || []).length,
      cta_count: (content.match(/\b(click|download|schedule|book|try|start)\b/gi) || []).length,
    };

    // Generate recommendations
    const recommendations = [];

    if (analysis.word_count > 150) {
      recommendations.push('Consider shortening the message for better engagement');
    }

    if (analysis.personalization_tokens < 2) {
      recommendations.push('Add more personalization tokens for higher relevance');
    }

    if (analysis.questions === 0) {
      recommendations.push('Include a question to encourage response');
    }

    if (analysis.cta_count === 0) {
      recommendations.push('Add a clear call-to-action');
    } else if (analysis.cta_count > 2) {
      recommendations.push('Reduce CTAs to avoid overwhelming the reader');
    }

    // Generate optimized version
    let optimizedContent = content;

    // Add question if missing
    if (analysis.questions === 0) {
      optimizedContent += '\n\nWould you be open to a brief conversation about this?';
    }

    return {
      success: true,
      data: {
        original: content,
        optimized: optimizedContent,
        analysis,
        recommendations,
        improvement_score: recommendations.length === 0 ? 1.0 : 0.7,
      },
      confidence: 0.8,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private loadTemplates(): void {
    // Load email templates
    this.personalizationTemplates.set('cold_outreach', `
Hi {{first_name}},

I noticed {{trigger_event}} at {{company}}. {{personalized_observation}}

Many companies in {{industry}} struggle with {{pain_point}}. We've helped similar companies {{value_proposition}}.

{{social_proof}}

Would you be open to a brief conversation about how {{company}} could {{benefit}}?

Best,
{{sender_name}}
    `.trim());

    this.personalizationTemplates.set('follow_up', `
Hi {{first_name}},

Following up on my previous message about {{topic}}.

{{new_information}}

I understand you're busy, so I'll keep this brief. {{value_reminder}}

{{soft_cta}}

Best,
{{sender_name}}
    `.trim());

    this.personalizationTemplates.set('linkedin_connection', `
Hi {{first_name}},

{{connection_reason}} I'm particularly impressed by {{specific_achievement}}.

{{common_ground}}

Would love to connect and {{mutual_benefit}}.

Best,
{{sender_name}}
    `.trim());
  }

  private selectTemplate(type: string): string {
    return this.personalizationTemplates.get(type) ||
      this.personalizationTemplates.get('cold_outreach')!;
  }

  private buildPersonalizations(context: AgentContext, research: any): Record<string, any> {
    return {
      first_name: context.lead?.first_name || 'there',
      last_name: context.lead?.last_name || '',
      company: context.lead?.company || research.company?.name || 'your company',
      industry: research.company?.industry || 'your industry',
      trigger_event: research.triggers?.[0]?.message || 'your recent update',
      personalized_observation: this.generateObservation(research),
      pain_point: this.identifyPainPoint(context, research),
      value_proposition: 'increase efficiency by 40%',
      social_proof: this.generateSocialProof(context),
      benefit: this.generateBenefit(context, research),
      sender_name: context.sequence?.sender_name || 'The Chimera Team',
      // Additional personalizations
      role: context.lead?.title || 'your role',
      location: context.lead?.location || '',
      recent_news: research.company?.recent_news?.[0] || '',
    };
  }

  private generateObservation(research: any): string {
    if (research.triggers?.length > 0) {
      return `Congratulations on ${research.triggers[0].message}!`;
    }
    if (research.company?.funding) {
      return `Impressive ${research.company.funding.last_round} round!`;
    }
    return "Your team has been doing great work";
  }

  private identifyPainPoint(context: AgentContext, research: any): string {
    // Industry-specific pain points
    const painPoints: Record<string, string> = {
      'SaaS': 'scaling customer acquisition efficiently',
      'E-commerce': 'cart abandonment and conversion',
      'Healthcare': 'patient engagement and compliance',
      'Finance': 'regulatory compliance and efficiency',
      'default': 'scaling operations efficiently',
    };

    const industry = research.company?.industry || 'default';
    return painPoints[industry] || painPoints.default;
  }

  private generateSocialProof(context: AgentContext): string {
    const examples = [
      'Companies like Acme Corp and TechCo saw 3x improvement',
      'We recently helped a similar company achieve 50% cost reduction',
      'Over 100 companies in your space trust us',
    ];
    return examples[Math.floor(Math.random() * examples.length)];
  }

  private generateBenefit(context: AgentContext, research: any): string {
    if (research.company?.size && parseInt(research.company.size) > 100) {
      return 'streamline operations at scale';
    }
    if (research.triggers?.some((t: any) => t.type === 'funding')) {
      return 'scale efficiently with your new resources';
    }
    return 'achieve your growth targets faster';
  }

  private addDynamicElements(content: string, context: AgentContext, research: any): string {
    // Add PS line with recent trigger
    if (research.triggers?.length > 0) {
      content += `\n\nP.S. ${research.triggers[0].message} - exciting times ahead!`;
    }

    // Add signature with calendar link
    if (context.sequence?.calendar_link) {
      content = content.replace(
        '{{soft_cta}}',
        `Here's my calendar if you'd like to chat: ${context.sequence.calendar_link}`
      );
    }

    return content;
  }

  private calculatePersonalizationScore(content: string, variables: Record<string, any>): number {
    let score = 0.5; // Base score

    // Check how many variables were actually used
    const usedVariables = Object.keys(variables).filter(key =>
      content.includes(variables[key])
    );

    score += usedVariables.length * 0.05; // 5% per variable

    // Check for specific high-value personalizations
    if (content.includes('trigger_event')) score += 0.1;
    if (content.includes('recent_')) score += 0.1;
    if (content.includes('mutual')) score += 0.05;

    // Check content quality
    if (content.length > 50 && content.length < 200) score += 0.05;
    if (content.includes('?')) score += 0.05; // Has a question

    return Math.min(score, 1.0);
  }

  private getConnectionRequestTemplate(): string {
    return `Hi {{first_name}}, {{connection_reason}} Would love to connect! - {{sender_name}}`;
  }

  private getLinkedInMessageTemplate(): string {
    return `Hi {{first_name}},

{{opener}}

{{value_prop}}

{{soft_cta}}

Best,
{{sender_name}}`;
  }
}