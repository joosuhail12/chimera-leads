import { createClient } from '@/lib/supabase/server';
import { ApolloService } from './apollo';
import { AILeadScoringService } from './lead-scoring';
import { SequenceEnrollmentService } from '@/lib/services/sequences';
import { queueManager } from '@/lib/queue/apollo-queue';
import {
  Playbook,
  PlaybookStep,
  PlaybookExecution,
  StepExecution,
  ExecutionContext,
  ExecutionMetrics,
  StepConfig,
  SearchStepConfig,
  EnrichStepConfig,
  ScoreStepConfig,
  FilterStepConfig,
  SequenceStepConfig,
  WaitStepConfig,
  ConditionStepConfig,
  ComparisonOperator,
} from '@/lib/types/playbook';

/**
 * Playbook Executor Service
 * Executes automated prospecting workflows step by step
 */
export class PlaybookExecutor {
  private apolloService: ApolloService;
  private scoringService: AILeadScoringService;
  private execution: PlaybookExecution | null = null;
  private context: ExecutionContext;
  private abortController: AbortController;
  private organizationId: string;

  constructor(organizationId: string, userId?: string) {
    this.organizationId = organizationId;
    this.apolloService = new ApolloService(undefined, organizationId);
    this.scoringService = new AILeadScoringService();
    this.abortController = new AbortController();
    this.context = {
      trigger: { type: 'manual' },
      variables: {},
      user: userId ? { id: userId, email: '' } : undefined,
    };
  }

  /**
   * Execute a playbook
   */
  async execute(
    playbook: Playbook,
    context?: Partial<ExecutionContext>
  ): Promise<PlaybookExecution> {
    // Initialize execution
    this.execution = await this.initializeExecution(playbook, context);
    this.context = { ...this.context, ...context };

    try {
      // Execute steps sequentially
      for (const step of playbook.steps) {
        if (this.abortController.signal.aborted) {
          throw new Error('Execution cancelled');
        }

        await this.executeStep(step);
      }

      // Mark execution as completed
      await this.completeExecution('completed');
    } catch (error) {
      // Mark execution as failed
      await this.completeExecution('failed', error as Error);
      throw error;
    }

    return this.execution;
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: PlaybookStep): Promise<void> {
    if (!this.execution) throw new Error('No execution context');

    const stepExecution: StepExecution = {
      stepId: step.id,
      stepName: step.name,
      status: 'running',
      startedAt: new Date(),
    };

    // Add to execution steps
    this.execution.steps.push(stepExecution);

    try {
      // Check conditions
      if (step.conditions && !this.evaluateConditions(step.conditions)) {
        stepExecution.status = 'skipped';
        stepExecution.completedAt = new Date();
        return;
      }

      // Execute based on step type
      const output = await this.executeStepByType(step);

      // Store output in context
      if (output !== undefined) {
        const outputVar = this.getOutputVariable(step.config);
        if (outputVar) {
          this.context.variables[outputVar] = output;
        }
      }

      stepExecution.output = output;
      stepExecution.status = 'completed';
      stepExecution.completedAt = new Date();

      // Update metrics
      this.updateMetrics(stepExecution);
    } catch (error) {
      stepExecution.status = 'failed';
      stepExecution.error = error instanceof Error ? error.message : 'Unknown error';
      stepExecution.completedAt = new Date();

      // Handle error based on strategy
      await this.handleStepError(step, error as Error);
    }
  }

  /**
   * Execute step based on its type
   */
  private async executeStepByType(step: PlaybookStep): Promise<any> {
    switch (step.type) {
      case 'search':
        return this.executeSearchStep(step.config as SearchStepConfig);
      case 'enrich':
        return this.executeEnrichStep(step.config as EnrichStepConfig);
      case 'score':
        return this.executeScoreStep(step.config as ScoreStepConfig);
      case 'filter':
        return this.executeFilterStep(step.config as FilterStepConfig);
      case 'sequence':
        return this.executeSequenceStep(step.config as SequenceStepConfig);
      case 'wait':
        return this.executeWaitStep(step.config as WaitStepConfig);
      case 'condition':
        return this.executeConditionStep(step.config as ConditionStepConfig);
      default:
        throw new Error(`Unsupported step type: ${step.type}`);
    }
  }

  /**
   * Execute search step
   */
  private async executeSearchStep(config: SearchStepConfig): Promise<any> {
    const { searchType, parameters } = config;

    if (searchType === 'people') {
      const results = await this.apolloService.searchPeople({
        q_keywords: parameters.keywords,
        ...parameters.filters,
        page: 1,
        per_page: parameters.limit || 25,
      });
      return results.people;
    } else {
      const results = await this.apolloService.searchCompanies({
        q_keywords: parameters.keywords,
        ...parameters.filters,
        page: 1,
        per_page: parameters.limit || 25,
      });
      return results.organizations;
    }
  }

  /**
   * Execute enrichment step
   */
  private async executeEnrichStep(config: EnrichStepConfig): Promise<any> {
    const source = this.getVariable(config.source.variable);
    if (!Array.isArray(source)) {
      throw new Error('Enrich step requires array input');
    }

    const enriched = [];
    for (const item of source) {
      const identifier = config.source.field ? item[config.source.field] : item;

      if (config.enrichType === 'person') {
        const result = await this.apolloService.enrichPerson(
          identifier,
          config.options?.useCache ?? true
        );
        if (result) enriched.push(result);
      } else if (config.enrichType === 'company') {
        const result = await this.apolloService.enrichCompany(
          identifier,
          config.options?.useCache ?? true
        );
        if (result) enriched.push(result);
      }

      // Add small delay to avoid rate limiting
      await this.sleep(100);
    }

    return enriched;
  }

  /**
   * Execute scoring step
   */
  private async executeScoreStep(config: ScoreStepConfig): Promise<any> {
    const source = this.getVariable(config.source.variable);
    if (!Array.isArray(source)) {
      throw new Error('Score step requires array input');
    }

    const scored = [];
    for (const lead of source) {
      const score = await this.scoringService.calculateScore(lead);
      scored.push({
        ...lead,
        score: score.score,
        scoreCategory: this.getScoreCategory(score.score),
        scoreConfidence: score.confidence,
        ...(config.output.includeInsights && {
          insights: score.aiInsights,
          recommendations: score.recommendations,
        }),
      });
    }

    return scored;
  }

  /**
   * Execute filter step
   */
  private async executeFilterStep(config: FilterStepConfig): Promise<any> {
    const source = this.getVariable(config.source.variable);
    if (!Array.isArray(source)) {
      throw new Error('Filter step requires array input');
    }

    return source.filter(item => {
      const results = config.filters.map(filter =>
        this.evaluateFilter(item, filter)
      );

      return config.operator === 'AND'
        ? results.every(r => r)
        : results.some(r => r);
    });
  }

  /**
   * Execute sequence step
   */
  private async executeSequenceStep(config: SequenceStepConfig): Promise<any> {
    const source = this.getVariable(config.source.variable);
    if (!Array.isArray(source)) {
      throw new Error('Sequence step requires array input');
    }

    const supabase = await createClient();
    const enrolled = [];
    const actingUserId = this.context.user?.id ?? 'playbook_executor';

    for (const lead of source) {
      if (config.options?.skipDuplicates) {
        const { data: existing } = await supabase
          .from('sequence_enrollments')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('template_id', config.sequence.id)
          .eq('organization_id', this.organizationId)
          .maybeSingle();

        if (existing) {
          continue;
        }
      }

      try {
        const enrollment = await SequenceEnrollmentService.enroll(
          {
            lead_id: lead.id,
            template_id: config.sequence.id,
          },
          actingUserId
        );

        enrolled.push(enrollment);
      } catch (error: any) {
        const message = error?.message || '';
        if (config.options?.skipDuplicates && message.includes('already actively enrolled')) {
          continue;
        }
        throw error;
      }
    }

    return enrolled;
  }

  /**
   * Execute wait step
   */
  private async executeWaitStep(config: WaitStepConfig): Promise<void> {
    const milliseconds = this.convertToMilliseconds(
      config.duration.value,
      config.duration.unit
    );

    await this.sleep(milliseconds);
  }

  /**
   * Execute condition step
   */
  private async executeConditionStep(config: ConditionStepConfig): Promise<boolean> {
    const results = config.conditions.map(condition =>
      this.evaluateCondition(condition)
    );

    const result = config.operator === 'AND'
      ? results.every(r => r)
      : results.some(r => r);

    // Update next step based on condition result
    if (this.execution) {
      // This would need to modify the execution flow
      // Implementation depends on your execution model
    }

    return result;
  }

  /**
   * Helper: Evaluate conditions
   */
  private evaluateConditions(conditions: any[]): boolean {
    // Implement condition evaluation logic
    return true;
  }

  /**
   * Helper: Evaluate a single filter
   */
  private evaluateFilter(item: any, filter: any): boolean {
    const value = this.getNestedValue(item, filter.field);
    return this.compareValues(value, filter.operator, filter.value);
  }

  /**
   * Helper: Evaluate a condition
   */
  private evaluateCondition(condition: any): boolean {
    const leftValue = condition.left.type === 'variable'
      ? this.getVariable(condition.left.value)
      : condition.left.value;

    const rightValue = condition.right.type === 'variable'
      ? this.getVariable(condition.right.value)
      : condition.right.value;

    return this.compareValues(leftValue, condition.operator, rightValue);
  }

  /**
   * Helper: Compare values based on operator
   */
  private compareValues(left: any, operator: ComparisonOperator, right: any): boolean {
    switch (operator) {
      case 'equals':
        return left === right;
      case 'not_equals':
        return left !== right;
      case 'contains':
        return String(left).includes(String(right));
      case 'not_contains':
        return !String(left).includes(String(right));
      case 'starts_with':
        return String(left).startsWith(String(right));
      case 'ends_with':
        return String(left).endsWith(String(right));
      case 'greater_than':
        return Number(left) > Number(right);
      case 'greater_than_or_equal':
        return Number(left) >= Number(right);
      case 'less_than':
        return Number(left) < Number(right);
      case 'less_than_or_equal':
        return Number(left) <= Number(right);
      case 'in':
        return Array.isArray(right) && right.includes(left);
      case 'not_in':
        return Array.isArray(right) && !right.includes(left);
      case 'is_null':
        return left === null || left === undefined;
      case 'is_not_null':
        return left !== null && left !== undefined;
      default:
        return false;
    }
  }

  /**
   * Helper: Get variable from context
   */
  private getVariable(name: string): any {
    return this.context.variables[name];
  }

  /**
   * Helper: Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  /**
   * Helper: Get output variable name from config
   */
  private getOutputVariable(config: StepConfig): string | undefined {
    if ('output' in config && config.output && 'variable' in config.output) {
      return config.output.variable;
    }
    return undefined;
  }

  /**
   * Helper: Get score category
   */
  private getScoreCategory(score: number): 'hot' | 'warm' | 'cold' {
    if (score >= 80) return 'hot';
    if (score >= 50) return 'warm';
    return 'cold';
  }

  /**
   * Helper: Convert time to milliseconds
   */
  private convertToMilliseconds(value: number, unit: string): number {
    const multipliers: Record<string, number> = {
      seconds: 1000,
      minutes: 60000,
      hours: 3600000,
      days: 86400000,
    };
    return value * (multipliers[unit] || 1000);
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize execution record
   */
  private async initializeExecution(
    playbook: Playbook,
    context?: Partial<ExecutionContext>
  ): Promise<PlaybookExecution> {
    const supabase = await createClient();

    const execution: PlaybookExecution = {
      id: crypto.randomUUID(),
      playbookId: playbook.id,
      organizationId: playbook.organizationId,
      status: 'running',
      startedAt: new Date(),
      context: {
        ...this.context,
        ...context,
      },
      steps: [],
      metrics: {
        totalSteps: playbook.steps.length,
        completedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
      },
    };

    // Save to database
    await supabase.from('playbook_executions').insert({
      id: execution.id,
      playbook_id: execution.playbookId,
      organization_id: execution.organizationId,
      status: execution.status,
      started_at: execution.startedAt,
      execution_context: execution.context,
      execution_log: [],
    });

    return execution;
  }

  /**
   * Complete execution
   */
  private async completeExecution(
    status: 'completed' | 'failed' | 'cancelled',
    error?: Error
  ): Promise<void> {
    if (!this.execution) return;

    const supabase = await createClient();

    this.execution.status = status;
    this.execution.completedAt = new Date();

    if (error) {
      this.execution.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    // Calculate final metrics
    this.execution.metrics.duration =
      this.execution.completedAt.getTime() - this.execution.startedAt.getTime();

    // Update in database
    await supabase
      .from('playbook_executions')
      .update({
        status: this.execution.status,
        completed_at: this.execution.completedAt,
        execution_log: this.execution.steps,
        error_message: this.execution.error?.message,
      })
      .eq('id', this.execution.id);

    // Update playbook metrics
    await this.updatePlaybookMetrics(this.execution.playbookId, status);
  }

  /**
   * Update execution metrics
   */
  private updateMetrics(stepExecution: StepExecution): void {
    if (!this.execution) return;

    switch (stepExecution.status) {
      case 'completed':
        this.execution.metrics.completedSteps++;
        break;
      case 'failed':
        this.execution.metrics.failedSteps++;
        break;
      case 'skipped':
        this.execution.metrics.skippedSteps++;
        break;
    }
  }

  /**
   * Update playbook metrics
   */
  private async updatePlaybookMetrics(
    playbookId: string,
    status: string
  ): Promise<void> {
    const supabase = await createClient();

    if (status === 'completed') {
      await supabase.rpc('increment_playbook_success', { playbook_id: playbookId });
    } else if (status === 'failed') {
      await supabase.rpc('increment_playbook_failure', { playbook_id: playbookId });
    }
  }

  /**
   * Handle step error based on error handling strategy
   */
  private async handleStepError(step: PlaybookStep, error: Error): Promise<void> {
    const strategy = step.errorHandling.strategy;

    switch (strategy) {
      case 'stop':
        throw error;
      case 'continue':
        console.error(`Step ${step.name} failed, continuing:`, error);
        break;
      case 'retry':
        if (step.retries && step.retries > 0) {
          await this.sleep(
            step.errorHandling.retryConfig?.delayMs || 1000
          );
          step.retries--;
          await this.executeStep(step);
        } else {
          throw error;
        }
        break;
      case 'skip':
        console.log(`Step ${step.name} failed, skipping`);
        break;
      case 'fallback':
        if (step.errorHandling.fallbackStep) {
          // Execute fallback step
          // Implementation needed
        }
        break;
    }

    // Send notification if configured
    if (step.errorHandling.notification?.enabled) {
      await this.sendErrorNotification(step, error);
    }
  }

  /**
   * Send error notification
   */
  private async sendErrorNotification(
    step: PlaybookStep,
    error: Error
  ): Promise<void> {
    // Implementation for sending notifications
    console.error(`Notification: Step ${step.name} failed:`, error);
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    this.abortController.abort();
    if (this.execution) {
      this.completeExecution('cancelled');
    }
  }
}
