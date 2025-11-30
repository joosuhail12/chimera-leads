/**
 * Playbook System Type Definitions
 * Defines the structure for automated prospecting workflows
 */

// ============================================
// Core Playbook Types
// ============================================

export interface Playbook {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  type: 'system' | 'custom';
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger: PlaybookTrigger;
  steps: PlaybookStep[];
  visualConfig?: VisualConfig;  // React Flow diagram configuration
  settings: PlaybookSettings;
  metrics?: PlaybookMetrics;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

// ============================================
// Trigger Types
// ============================================

export type PlaybookTrigger =
  | ScheduleTrigger
  | WebhookTrigger
  | EventTrigger
  | ManualTrigger;

export interface ScheduleTrigger {
  type: 'schedule';
  schedule: {
    cron: string;  // Cron expression
    timezone: string;
    active: boolean;
  };
}

export interface WebhookTrigger {
  type: 'webhook';
  webhook: {
    url: string;
    secret?: string;
    events: string[];
  };
}

export interface EventTrigger {
  type: 'event';
  event: {
    source: 'apollo' | 'crm' | 'sequence' | 'form';
    name: string;
    filters?: Record<string, any>;
  };
}

export interface ManualTrigger {
  type: 'manual';
  manual: {
    requiresApproval?: boolean;
    approvers?: string[];
  };
}

// ============================================
// Step Types
// ============================================

export interface PlaybookStep {
  id: string;
  name: string;
  type: StepType;
  config: StepConfig;
  conditions?: StepCondition[];
  errorHandling: ErrorHandling;
  timeout?: number;  // milliseconds
  retries?: number;
  nextSteps?: NextStep[];
}

export type StepType =
  | 'search'       // Apollo search
  | 'enrich'       // Data enrichment
  | 'score'        // Lead scoring
  | 'filter'       // Filter results
  | 'assign'       // Assign to user/team
  | 'sequence'     // Add to email sequence
  | 'wait'         // Delay execution
  | 'webhook'      // Call external API
  | 'condition'    // Branching logic
  | 'loop'         // Iterate over results
  | 'transform'    // Data transformation
  | 'notify';      // Send notification

export type StepConfig =
  | SearchStepConfig
  | EnrichStepConfig
  | ScoreStepConfig
  | FilterStepConfig
  | AssignStepConfig
  | SequenceStepConfig
  | WaitStepConfig
  | WebhookStepConfig
  | ConditionStepConfig
  | LoopStepConfig
  | TransformStepConfig
  | NotifyStepConfig;

export interface SearchStepConfig {
  type: 'search';
  searchType: 'people' | 'companies';
  parameters: {
    keywords?: string;
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
  };
  output: {
    variable: string;  // Variable name to store results
    fields?: string[]; // Fields to extract
  };
}

export interface EnrichStepConfig {
  type: 'enrich';
  enrichType: 'person' | 'company' | 'both';
  source: {
    variable: string;  // Variable containing items to enrich
    field?: string;    // Field to use as identifier
  };
  options: {
    useCache?: boolean;
    priority?: 'high' | 'normal' | 'low';
    updateExisting?: boolean;
  };
  output: {
    variable: string;
  };
}

export interface ScoreStepConfig {
  type: 'score';
  source: {
    variable: string;
  };
  scoringModel?: string;
  output: {
    variable: string;
    includeInsights?: boolean;
  };
}

export interface FilterStepConfig {
  type: 'filter';
  source: {
    variable: string;
  };
  filters: FilterRule[];
  operator: 'AND' | 'OR';
  output: {
    variable: string;
  };
}

export interface AssignStepConfig {
  type: 'assign';
  source: {
    variable: string;
  };
  assignment: {
    type: 'user' | 'team' | 'round-robin' | 'load-balanced';
    target?: string;  // User or team ID
    targets?: string[];  // For round-robin
  };
}

export interface SequenceStepConfig {
  type: 'sequence';
  source: {
    variable: string;
  };
  sequence: {
    id: string;
    variant?: string;  // A/B test variant
  };
  options: {
    skipDuplicates?: boolean;
    sendImmediately?: boolean;
  };
}

export interface WaitStepConfig {
  type: 'wait';
  duration: {
    value: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days';
  };
  skipWeekends?: boolean;
  skipHolidays?: boolean;
}

export interface WebhookStepConfig {
  type: 'webhook';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    credentials: string;
  };
  output?: {
    variable: string;
  };
}

export interface ConditionStepConfig {
  type: 'condition';
  conditions: ConditionRule[];
  operator: 'AND' | 'OR';
  branches: {
    true: string;   // Next step ID if true
    false?: string;  // Next step ID if false
  };
}

export interface LoopStepConfig {
  type: 'loop';
  source: {
    variable: string;
  };
  iterator: {
    variable: string;  // Current item variable name
    index: string;     // Current index variable name
  };
  steps: string[];  // Step IDs to execute in loop
  maxIterations?: number;
}

export interface TransformStepConfig {
  type: 'transform';
  source: {
    variable: string;
  };
  transformations: Transformation[];
  output: {
    variable: string;
  };
}

export interface NotifyStepConfig {
  type: 'notify';
  channels: ('email' | 'slack' | 'webhook')[];
  recipients: string[];
  message: {
    subject?: string;
    body: string;
    data?: Record<string, any>;
  };
}

// ============================================
// Conditions and Rules
// ============================================

export interface StepCondition {
  field: string;
  operator: ComparisonOperator;
  value: any;
}

export interface FilterRule {
  field: string;
  operator: ComparisonOperator;
  value: any;
  type?: 'string' | 'number' | 'boolean' | 'date';
}

export interface ConditionRule {
  left: {
    type: 'variable' | 'constant';
    value: any;
  };
  operator: ComparisonOperator;
  right: {
    type: 'variable' | 'constant';
    value: any;
  };
}

export type ComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

// ============================================
// Transformations
// ============================================

export interface Transformation {
  type: 'map' | 'filter' | 'reduce' | 'sort' | 'limit' | 'extract' | 'merge';
  config: Record<string, any>;
}

// ============================================
// Error Handling
// ============================================

export interface ErrorHandling {
  strategy: 'stop' | 'continue' | 'retry' | 'skip' | 'fallback';
  retryConfig?: {
    maxAttempts: number;
    backoff: 'linear' | 'exponential';
    delayMs: number;
  };
  fallbackStep?: string;
  notification?: {
    enabled: boolean;
    channels: string[];
  };
}

// ============================================
// Next Step Logic
// ============================================

export interface NextStep {
  stepId: string;
  condition?: StepCondition;
  priority?: number;
}

// ============================================
// Settings and Configuration
// ============================================

export interface PlaybookSettings {
  concurrency?: number;
  maxExecutionTime?: number;  // milliseconds
  timezone?: string;
  notifications?: {
    onSuccess?: boolean;
    onFailure?: boolean;
    onCompletion?: boolean;
    recipients?: string[];
  };
  variables?: Record<string, any>;  // Global variables
  tags?: string[];
}

// ============================================
// Visual Configuration (for React Flow)
// ============================================

export interface VisualConfig {
  nodes: VisualNode[];
  edges: VisualEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface VisualNode {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    stepId: string;
    stepType: StepType;
    config?: any;
  };
}

export interface VisualEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'conditional' | 'error';
  label?: string;
  animated?: boolean;
}

// ============================================
// Execution and Metrics
// ============================================

export interface PlaybookExecution {
  id: string;
  playbookId: string;
  organizationId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  context: ExecutionContext;
  steps: StepExecution[];
  metrics: ExecutionMetrics;
  error?: {
    message: string;
    stepId?: string;
    stack?: string;
  };
}

export interface ExecutionContext {
  trigger: {
    type: string;
    data?: any;
  };
  variables: Record<string, any>;
  user?: {
    id: string;
    email: string;
  };
}

export interface StepExecution {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  input?: any;
  output?: any;
  error?: string;
  retries?: number;
}

export interface ExecutionMetrics {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration?: number;  // milliseconds
  itemsProcessed?: number;
  apiCallsMade?: number;
  costEstimate?: number;
}

export interface PlaybookMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  lastRunAt?: Date;
  nextRunAt?: Date;
  totalItemsProcessed: number;
  conversionRate?: number;
  costPerRun?: number;
}

// ============================================
// Templates
// ============================================

export interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  category: 'prospecting' | 'nurturing' | 'enrichment' | 'scoring' | 'custom';
  icon?: string;
  playbook: Partial<Playbook>;
  variables?: TemplateVariable[];
  requirements?: string[];
  estimatedTime?: string;
  difficulty?: 'easy' | 'medium' | 'advanced';
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
  options?: any[];  // For select fields
}