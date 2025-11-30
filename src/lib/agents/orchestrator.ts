/**
 * Agent Orchestrator
 * Coordinates multiple AI agents and manages their collaboration
 */

import { BaseAgent, AgentTask, AgentResult, AgentContext, AgentFactory } from './base-agent';
import { ResearchAgent } from './research-agent';
import { PersonalizationAgent } from './personalization-agent';
import { TimingAgent } from './timing-agent';
import { z } from 'zod';

// ============================================
// AI MODEL PROVIDERS
// ============================================

interface AIProvider {
  name: string;
  generateCompletion(prompt: string, options?: any): Promise<string>;
  generateEmbedding(text: string): Promise<number[]>;
}

class AzureOpenAIProvider implements AIProvider {
  name = 'azure-openai';
  private apiKey: string;
  private endpoint: string;
  private deploymentName: string;

  constructor(config: {
    apiKey: string;
    endpoint: string;
    deploymentName: string;
  }) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.deploymentName = config.deploymentName;
  }

  async generateCompletion(prompt: string, options?: any): Promise<string> {
    const response = await fetch(
      `${this.endpoint}/openai/deployments/${this.deploymentName}/chat/completions?api-version=2024-02-15-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant helping with sales and marketing automation.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: options?.temperature || 0.7,
          max_tokens: options?.max_tokens || 500,
          top_p: options?.top_p || 0.9,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Azure OpenAI error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(
      `${this.endpoint}/openai/deployments/text-embedding-ada-002/embeddings?api-version=2024-02-15-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          input: text,
        }),
      }
    );

    const data = await response.json();
    return data.data[0].embedding;
  }
}

class AWSBedrockProvider implements AIProvider {
  name = 'aws-bedrock';
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private modelId: string;

  constructor(config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    modelId?: string;
  }) {
    this.region = config.region;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.modelId = config.modelId || 'anthropic.claude-v2';
  }

  async generateCompletion(prompt: string, options?: any): Promise<string> {
    // AWS Bedrock API implementation
    const endpoint = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${this.modelId}/invoke`;

    // Prepare request based on model
    let requestBody: any;
    if (this.modelId.includes('anthropic')) {
      requestBody = {
        prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
        max_tokens_to_sample: options?.max_tokens || 500,
        temperature: options?.temperature || 0.7,
      };
    } else if (this.modelId.includes('meta')) {
      // Llama 2 format
      requestBody = {
        prompt,
        max_gen_len: options?.max_tokens || 500,
        temperature: options?.temperature || 0.7,
      };
    }

    // Note: In production, use AWS SDK v3 for proper signature
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // AWS signature headers would be added here
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (this.modelId.includes('anthropic')) {
      return data.completion;
    } else if (this.modelId.includes('meta')) {
      return data.generation;
    }

    return data.response || '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Use Amazon Titan Embeddings model
    const endpoint = `https://bedrock-runtime.${this.region}.amazonaws.com/model/amazon.titan-embed-text-v1/invoke`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // AWS signature headers
      },
      body: JSON.stringify({
        inputText: text,
      }),
    });

    const data = await response.json();
    return data.embedding;
  }
}

// ============================================
// ORCHESTRATOR CONFIGURATION
// ============================================

export interface OrchestratorConfig {
  provider?: 'azure-openai' | 'aws-bedrock';
  azureConfig?: {
    apiKey: string;
    endpoint: string;
    deploymentName: string;
  };
  awsConfig?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    modelId?: string;
  };
  maxConcurrentAgents?: number;
  defaultTimeout?: number;
}

// ============================================
// SEQUENCE AGENT ORCHESTRATOR
// ============================================

export class SequenceAgentOrchestrator {
  private agents: Map<string, BaseAgent>;
  private aiProvider: AIProvider | null;
  private taskQueue: AgentTask[];
  private activeExecutions: Map<string, Promise<AgentResult>>;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = config;
    this.agents = new Map();
    this.taskQueue = [];
    this.activeExecutions = new Map();

    // Initialize AI provider
    if (config.provider === 'azure-openai' && config.azureConfig) {
      this.aiProvider = new AzureOpenAIProvider(config.azureConfig);
    } else if (config.provider === 'aws-bedrock' && config.awsConfig) {
      this.aiProvider = new AWSBedrockProvider(config.awsConfig);
    } else {
      this.aiProvider = null;
    }

    // Initialize agents
    this.initializeAgents();
  }

  private initializeAgents(): void {
    // Create agent instances
    const researchAgent = new ResearchAgent();
    const personalizationAgent = new PersonalizationAgent();
    const timingAgent = new TimingAgent();

    // Register agents
    this.registerAgent(researchAgent);
    this.registerAgent(personalizationAgent);
    this.registerAgent(timingAgent);

    // Set up collaborations
    personalizationAgent.registerCollaborator(researchAgent);
    timingAgent.registerCollaborator(researchAgent);

    // Register in factory
    AgentFactory.register(researchAgent);
    AgentFactory.register(personalizationAgent);
    AgentFactory.register(timingAgent);
  }

  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  // ============================================
  // ORCHESTRATION METHODS
  // ============================================

  async processSequenceStep(
    step: any,
    lead: any,
    enrollment?: any
  ): Promise<{
    content: string;
    subject?: string;
    sendTime: string;
    metadata: any;
  }> {
    const context: AgentContext = {
      lead,
      enrollment,
      sequence: step.sequence,
      company: lead.company_data,
    };

    // Phase 1: Research
    const researchResult = await this.executeTask({
      id: crypto.randomUUID(),
      type: 'gather_lead_context',
      description: 'Research lead and company',
      parameters: {},
      context,
    }, 'ResearchAgent');

    // Store research in shared memory
    this.updateSharedContext(context, researchResult.data);

    // Phase 2: Generate content
    const contentResult = await this.executeTask({
      id: crypto.randomUUID(),
      type: 'generate_email',
      description: 'Generate personalized email',
      parameters: {
        template_type: step.template_type || 'cold_outreach',
        tone: step.tone || 'friendly',
        value_proposition: step.value_proposition,
      },
      context,
    }, 'PersonalizationAgent');

    // Phase 3: Optimize timing
    const timingResult = await this.executeTask({
      id: crypto.randomUUID(),
      type: 'predict_send_time',
      description: 'Calculate optimal send time',
      parameters: {
        sequence_step: step.step_number || 1,
      },
      context,
    }, 'TimingAgent');

    return {
      content: contentResult.data?.email_content || '',
      subject: contentResult.data?.subject_line || '',
      sendTime: timingResult.data?.optimal_send_time || new Date().toISOString(),
      metadata: {
        research: researchResult.data,
        personalization_score: contentResult.data?.personalization_score || 0,
        timing_confidence: timingResult.confidence || 0,
        ai_generated: true,
        provider: this.aiProvider?.name || 'mock',
      },
    };
  }

  async executeTask(task: AgentTask, agentName: string): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    // Check if task is already being executed
    if (this.activeExecutions.has(task.id)) {
      return this.activeExecutions.get(task.id)!;
    }

    // Execute task with timeout
    const execution = this.executeWithTimeout(
      agent.execute(task),
      this.config.defaultTimeout || 30000
    );

    this.activeExecutions.set(task.id, execution);

    try {
      const result = await execution;
      this.activeExecutions.delete(task.id);
      return result;
    } catch (error) {
      this.activeExecutions.delete(task.id);
      throw error;
    }
  }

  async executeParallel(tasks: AgentTask[]): Promise<AgentResult[]> {
    const maxConcurrent = this.config.maxConcurrentAgents || 3;
    const results: AgentResult[] = [];

    // Process in batches
    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(task => {
          const agentName = this.selectAgentForTask(task);
          return this.executeTask(task, agentName);
        })
      );
      results.push(...batchResults);
    }

    return results;
  }

  // ============================================
  // AI-POWERED METHODS
  // ============================================

  async generateWithAI(
    prompt: string,
    context?: any,
    options?: any
  ): Promise<string> {
    if (!this.aiProvider) {
      throw new Error('No AI provider configured');
    }

    // Enhance prompt with context
    const enhancedPrompt = this.buildEnhancedPrompt(prompt, context);

    // Generate completion
    return this.aiProvider.generateCompletion(enhancedPrompt, options);
  }

  async analyzeWithAI(
    text: string,
    analysisType: 'sentiment' | 'intent' | 'topics' | 'summary'
  ): Promise<any> {
    if (!this.aiProvider) {
      throw new Error('No AI provider configured');
    }

    const prompts = {
      sentiment: `Analyze the sentiment of this text. Return JSON with score (-1 to 1) and label (positive/neutral/negative):\n\n${text}`,
      intent: `Identify the intent of this message. Return JSON with primary_intent and confidence:\n\n${text}`,
      topics: `Extract key topics from this text. Return JSON array of topics:\n\n${text}`,
      summary: `Summarize this text in 2-3 sentences:\n\n${text}`,
    };

    const result = await this.aiProvider.generateCompletion(prompts[analysisType]);

    try {
      return JSON.parse(result);
    } catch {
      return result; // Return as string if not JSON
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.aiProvider) {
      throw new Error('No AI provider configured');
    }

    return this.aiProvider.generateEmbedding(text);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private selectAgentForTask(task: AgentTask): string {
    // Select best agent based on task type
    const taskTypeToAgent: Record<string, string> = {
      'gather_lead_context': 'ResearchAgent',
      'research_company': 'ResearchAgent',
      'generate_email': 'PersonalizationAgent',
      'generate_linkedin_message': 'PersonalizationAgent',
      'predict_send_time': 'TimingAgent',
      'analyze_engagement': 'TimingAgent',
    };

    return taskTypeToAgent[task.type] || 'ResearchAgent';
  }

  private updateSharedContext(context: AgentContext, data: any): void {
    // Update context with new data
    Object.assign(context, { shared_data: data });

    // Update all agents' memory
    this.agents.forEach(agent => {
      agent.remember('shared_context', context, false);
    });
  }

  private buildEnhancedPrompt(prompt: string, context?: any): string {
    let enhanced = prompt;

    if (context) {
      enhanced = `Context:\n`;

      if (context.lead) {
        enhanced += `Lead: ${context.lead.first_name} ${context.lead.last_name}, ${context.lead.title} at ${context.lead.company}\n`;
      }

      if (context.company) {
        enhanced += `Company: ${context.company.name}, ${context.company.industry}, ${context.company.size} employees\n`;
      }

      if (context.triggers) {
        enhanced += `Recent triggers: ${context.triggers.map((t: any) => t.message).join(', ')}\n`;
      }

      enhanced += `\nTask: ${prompt}`;
    }

    return enhanced;
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Task execution timeout')), timeoutMs);
    });

    return Promise.race([promise, timeout]);
  }

  // ============================================
  // MONITORING & ANALYTICS
  // ============================================

  getAgentMetrics(): any {
    const metrics: any = {
      agents: {},
      total_tasks: this.taskQueue.length,
      active_executions: this.activeExecutions.size,
    };

    this.agents.forEach((agent, name) => {
      metrics.agents[name] = {
        capabilities: agent.getCapabilities(),
        memory_size: agent.getMemoryContext().length,
      };
    });

    return metrics;
  }

  clearMemory(): void {
    this.agents.forEach(agent => {
      agent.clearMemory();
    });
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createOrchestrator(config?: Partial<OrchestratorConfig>): SequenceAgentOrchestrator {
  // Load config from environment if not provided
  const finalConfig: OrchestratorConfig = {
    provider: config?.provider || (process.env.AI_PROVIDER as any) || 'azure-openai',
    ...config,
  };

  // Set Azure config from env if not provided
  if (finalConfig.provider === 'azure-openai' && !finalConfig.azureConfig) {
    finalConfig.azureConfig = {
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
    };
  }

  // Set AWS config from env if not provided
  if (finalConfig.provider === 'aws-bedrock' && !finalConfig.awsConfig) {
    finalConfig.awsConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-v2',
    };
  }

  return new SequenceAgentOrchestrator(finalConfig);
}