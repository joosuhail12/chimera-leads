/**
 * Base Agent Class
 * Foundation for all AI agents in the system
 */

import { z } from 'zod';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AgentMemory {
  short_term: Map<string, any>;
  long_term: Map<string, any>;
  context_window: any[];

  store(key: string, value: any, persistent?: boolean): void;
  retrieve(key: string): any;
  forget(key: string): void;
  clear(): void;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodSchema<any>;
  execute: (params: any) => Promise<any>;
}

export interface AgentContext {
  lead: any;
  enrollment?: any;
  sequence?: any;
  company?: any;
  previous_interactions?: any[];
  custom_data?: Record<string, any>;
}

export interface AgentTask {
  id: string;
  type: string;
  description: string;
  parameters: Record<string, any>;
  context: AgentContext;
  priority?: number;
  deadline?: Date;
}

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  confidence?: number;
  reasoning?: string;
  metadata?: Record<string, any>;
}

export interface AgentConfig {
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: AgentTool[];
}

// ============================================
// MEMORY IMPLEMENTATION
// ============================================

export class SimpleAgentMemory implements AgentMemory {
  short_term: Map<string, any>;
  long_term: Map<string, any>;
  context_window: any[];
  private max_context_size: number;

  constructor(maxContextSize = 10) {
    this.short_term = new Map();
    this.long_term = new Map();
    this.context_window = [];
    this.max_context_size = maxContextSize;
  }

  store(key: string, value: any, persistent = false): void {
    if (persistent) {
      this.long_term.set(key, value);
    } else {
      this.short_term.set(key, value);
    }

    // Add to context window
    this.context_window.push({ key, value, timestamp: new Date() });

    // Trim context window if too large
    if (this.context_window.length > this.max_context_size) {
      this.context_window.shift();
    }
  }

  retrieve(key: string): any {
    return this.short_term.get(key) || this.long_term.get(key);
  }

  forget(key: string): void {
    this.short_term.delete(key);
    this.long_term.delete(key);
  }

  clear(): void {
    this.short_term.clear();
    // Keep long-term memory
    this.context_window = [];
  }

  getContext(): any[] {
    return this.context_window;
  }

  serialize(): string {
    return JSON.stringify({
      short_term: Array.from(this.short_term.entries()),
      long_term: Array.from(this.long_term.entries()),
      context_window: this.context_window,
    });
  }

  deserialize(data: string): void {
    const parsed = JSON.parse(data);
    this.short_term = new Map(parsed.short_term);
    this.long_term = new Map(parsed.long_term);
    this.context_window = parsed.context_window;
  }
}

// ============================================
// BASE AGENT CLASS
// ============================================

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected memory: AgentMemory;
  protected tools: Map<string, AgentTool>;
  protected collaborators: Map<string, BaseAgent>;

  constructor(config: AgentConfig) {
    this.config = config;
    this.memory = new SimpleAgentMemory();
    this.tools = new Map();
    this.collaborators = new Map();

    // Register tools
    if (config.tools) {
      config.tools.forEach(tool => {
        this.registerTool(tool);
      });
    }
  }

  // ============================================
  // ABSTRACT METHODS (must be implemented)
  // ============================================

  abstract execute(task: AgentTask): Promise<AgentResult>;
  abstract processPrompt(prompt: string, context: AgentContext): Promise<string>;

  // ============================================
  // TOOL MANAGEMENT
  // ============================================

  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  async useTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    try {
      // Validate parameters
      const validated = tool.parameters.parse(params);

      // Execute tool
      const result = await tool.execute(validated);

      // Store in memory
      this.memory.store(`tool_result_${toolName}`, result);

      return result;
    } catch (error) {
      console.error(`Tool ${toolName} execution failed:`, error);
      throw error;
    }
  }

  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // ============================================
  // COLLABORATION
  // ============================================

  registerCollaborator(agent: BaseAgent): void {
    this.collaborators.set(agent.getName(), agent);
  }

  async collaborate(
    agentName: string,
    task: AgentTask
  ): Promise<AgentResult> {
    const collaborator = this.collaborators.get(agentName);
    if (!collaborator) {
      throw new Error(`Collaborator ${agentName} not found`);
    }

    // Share context
    const sharedContext = {
      ...task.context,
      requesting_agent: this.getName(),
      shared_memory: this.getMemoryContext(),
    };

    const collaborationTask = {
      ...task,
      context: sharedContext,
    };

    return collaborator.execute(collaborationTask);
  }

  // ============================================
  // MEMORY MANAGEMENT
  // ============================================

  remember(key: string, value: any, persistent = false): void {
    this.memory.store(key, value, persistent);
  }

  recall(key: string): any {
    return this.memory.retrieve(key);
  }

  forget(key: string): void {
    this.memory.forget(key);
  }

  clearMemory(): void {
    this.memory.clear();
  }

  getMemoryContext(): any[] {
    return this.memory.context_window;
  }

  // ============================================
  // REASONING & DECISION MAKING
  // ============================================

  protected async reason(
    question: string,
    facts: string[]
  ): Promise<{
    conclusion: string;
    confidence: number;
    reasoning_steps: string[];
  }> {
    // Basic reasoning framework
    const reasoning_steps: string[] = [];

    // Analyze facts
    reasoning_steps.push('Analyzing provided facts...');
    const relevant_facts = facts.filter(fact =>
      this.isRelevant(fact, question)
    );

    // Draw conclusions
    reasoning_steps.push('Drawing conclusions from relevant facts...');
    const conclusion = await this.drawConclusion(
      question,
      relevant_facts
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(
      relevant_facts.length,
      facts.length
    );

    return {
      conclusion,
      confidence,
      reasoning_steps,
    };
  }

  protected isRelevant(fact: string, question: string): boolean {
    // Simple keyword matching - override for sophisticated logic
    const keywords = question.toLowerCase().split(' ');
    const factLower = fact.toLowerCase();

    return keywords.some(keyword =>
      keyword.length > 3 && factLower.includes(keyword)
    );
  }

  protected async drawConclusion(
    question: string,
    facts: string[]
  ): Promise<string> {
    // Override in subclasses for specific reasoning
    if (facts.length === 0) {
      return 'Insufficient information to draw conclusion';
    }

    return `Based on ${facts.length} relevant facts: ${facts[0]}...`;
  }

  protected calculateConfidence(
    relevantFacts: number,
    totalFacts: number
  ): number {
    if (totalFacts === 0) return 0;

    const ratio = relevantFacts / totalFacts;
    const base_confidence = ratio * 0.7; // 70% weight on relevance
    const quantity_bonus = Math.min(relevantFacts * 0.05, 0.3); // 30% on quantity

    return Math.min(base_confidence + quantity_bonus, 1.0);
  }

  // ============================================
  // UTILITIES
  // ============================================

  getName(): string {
    return this.config.name;
  }

  getRole(): string {
    return this.config.role;
  }

  getDescription(): string {
    return this.config.description;
  }

  getCapabilities(): string[] {
    return this.config.capabilities;
  }

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${this.getName()}] ${timestamp}`;

    switch (level) {
      case 'error':
        console.error(`${prefix} ERROR: ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} WARN: ${message}`);
        break;
      default:
        console.log(`${prefix} INFO: ${message}`);
    }
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  protected handleError(error: any, task: AgentTask): AgentResult {
    this.log(`Task ${task.id} failed: ${error.message}`, 'error');

    return {
      success: false,
      error: error.message,
      metadata: {
        task_id: task.id,
        task_type: task.type,
        error_stack: error.stack,
      },
    };
  }

  // ============================================
  // VALIDATION
  // ============================================

  protected validateTask(task: AgentTask): boolean {
    if (!task.id || !task.type) {
      this.log('Invalid task: missing id or type', 'error');
      return false;
    }

    if (!task.context) {
      this.log('Invalid task: missing context', 'error');
      return false;
    }

    return true;
  }
}

// ============================================
// AGENT FACTORY
// ============================================

export class AgentFactory {
  private static agents: Map<string, BaseAgent> = new Map();

  static register(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  static get(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  static getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  static clear(): void {
    this.agents.clear();
  }
}