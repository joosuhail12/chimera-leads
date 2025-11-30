/**
 * Type definitions for Prospecting Sequences
 * These types match the database schema defined in migration 0016_add_sequence_tables.sql
 */

import { z } from 'zod';

// Enums matching database constraints
export const SequenceCategory = z.enum(['cold_outreach', 'nurture', 'follow_up', 'win_back', 'custom']);
export type SequenceCategory = z.infer<typeof SequenceCategory>;

export const SequenceStepType = z.enum([
  'email',
  'manual_email',
  'task',
  'call',
  'linkedin_connection',
  'linkedin_message',
  'linkedin_profile_view',
  'linkedin_engagement',
  'wait',
  'conditional',
  'webhook'
]);
export type SequenceStepType = z.infer<typeof SequenceStepType>;

export const TaskPriority = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const EnrollmentStatus = z.enum(['active', 'paused', 'completed', 'stopped', 'failed']);
export type EnrollmentStatus = z.infer<typeof EnrollmentStatus>;

export const ExecutionStatus = z.enum(['success', 'failed', 'skipped', 'pending']);
export type ExecutionStatus = z.infer<typeof ExecutionStatus>;

export const EmailEventType = z.enum(['open', 'click', 'reply', 'bounce', 'unsubscribe', 'spam']);
export type EmailEventType = z.infer<typeof EmailEventType>;

// Sequence Template Settings
export const SequenceSettingsSchema = z.object({
  pauseOnReply: z.boolean().default(true),
  pauseOnMeeting: z.boolean().default(true),
  skipWeekends: z.boolean().default(true),
  dailyLimit: z.number().min(1).max(500).default(50),
  timezone: z.string().default('America/New_York'),
});
export type SequenceSettings = z.infer<typeof SequenceSettingsSchema>;

// Time Window for sending emails
export const TimeWindowSchema = z.object({
  start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
  end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: z.string().optional(),
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

// Conditional Step Configuration
export const ConditionSchema = z.object({
  type: z.enum(['email_opened', 'email_clicked', 'replied', 'not_replied', 'custom']),
  value: z.any(),
  goto_step: z.number().optional(),
  skip_to_end: z.boolean().optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

// Webhook Configuration
export const WebhookConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.any().optional(),
});
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

// LinkedIn Configuration
export const LinkedInStepConfigSchema = z.object({
  action_type: z.enum(['connect', 'message', 'view_profile', 'like_post', 'comment', 'follow', 'unfollow', 'extract_profile']),
  connection_note_template: z.string().optional(),
  skip_if_connected: z.boolean().default(true),
  message_template: z.string().optional(),
  require_connection: z.boolean().default(true),
  view_duration_seconds: z.number().default(5),
  scroll_profile: z.boolean().default(true),
  like_recent_posts: z.number().optional(),
  comment_templates: z.array(z.string()).optional(),
  automation_mode: z.enum(['full_auto', 'semi_auto', 'assisted', 'manual']).default('semi_auto'),
});
export type LinkedInStepConfig = z.infer<typeof LinkedInStepConfigSchema>;

// Call Configuration
export const CallStepConfigSchema = z.object({
  script_template: z.string().optional(),
  outcome_options: z.array(z.string()).optional(),
  log_duration: z.boolean().default(true),
});
export type CallStepConfig = z.infer<typeof CallStepConfigSchema>;

// Main Entity Types
export interface SequenceTemplate {
  id: string;
  created_at: string;
  updated_at: string;
  organization_id: string;

  // Basic info
  name: string;
  description?: string | null;
  category?: SequenceCategory | null;

  // Settings
  settings: SequenceSettings;

  // Metadata
  is_active: boolean;
  created_by?: string | null;
  last_modified_by?: string | null;

  // Performance metrics
  total_enrolled: number;
  total_completed: number;
  avg_reply_rate: number;
  avg_open_rate: number;

  // Relations (when joined)
  steps?: SequenceStep[];
  enrollments?: SequenceEnrollment[];
}

export interface SequenceStep {
  id: string;
  template_id: string;

  step_number: number;
  step_type: SequenceStepType;

  // Timing
  wait_days: number;
  wait_hours: number;
  send_time_window?: TimeWindow | null;

  // Email content
  email_subject?: string | null;
  email_body?: string | null;
  email_from_name?: string | null;
  email_reply_to?: string | null;

  // Task configuration
  task_title?: string | null;
  task_description?: string | null;
  task_priority?: TaskPriority;
  task_due_days?: number;

  // Conditional logic
  conditions?: Condition | null;

  // Webhook configuration
  webhook_url?: string | null;
  webhook_method?: string | null;
  webhook_headers?: Record<string, string> | null;
  webhook_body?: any | null;

  // LinkedIn configuration
  linkedin_config?: LinkedInStepConfig | null;

  // Call configuration
  call_config?: CallStepConfig | null;

  // Metadata
  created_at: string;
  updated_at: string;

  // Relations
  template?: SequenceTemplate;
  variants?: SequenceStepVariant[];
}

export interface SequenceStepVariant {
  id: string;
  step_id: string;
  variant_type: string; // 'control', 'variant_a', 'variant_b', etc.
  email_subject?: string | null;
  email_body?: string | null;
  traffic_percentage: number;
  is_active: boolean;
}

export interface SequenceEnrollment {
  id: string;
  enrolled_at: string;
  organization_id: string;

  // Relationships
  lead_id: string;
  template_id: string;

  // Status
  status: EnrollmentStatus;
  current_step: number;

  // Pause/stop tracking
  paused_at?: string | null;
  paused_reason?: string | null;
  resumed_at?: string | null;
  stopped_at?: string | null;
  stopped_reason?: string | null;

  // Scheduling
  last_step_executed_at?: string | null;
  next_step_scheduled_at?: string | null;
  completed_at?: string | null;

  // Performance metrics
  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  emails_bounced: number;
  replies_received: number;
  meetings_booked: number;

  // User tracking
  enrolled_by?: string | null;
  stopped_by?: string | null;

  // Relations
  template?: SequenceTemplate;
  lead?: any; // Import Lead type when available
  executions?: SequenceStepExecution[];
}

export interface SequenceStepExecution {
  id: string;
  executed_at: string;

  // Relationships
  enrollment_id: string;
  step_id: string;

  // Execution details
  status: ExecutionStatus;
  error_message?: string | null;
  retry_count: number;

  // Email tracking
  email_provider?: string | null;
  email_message_id?: string | null;
  email_thread_id?: string | null;

  // Tracking timestamps
  opened_at?: string | null;
  clicked_at?: string | null;
  replied_at?: string | null;
  bounced_at?: string | null;

  // Task reference
  task_id?: string | null;

  // Webhook response
  webhook_response_code?: number | null;
  webhook_response_body?: any | null;

  // Metadata
  execution_metadata?: any | null;

  // Relations
  enrollment?: SequenceEnrollment;
  step?: SequenceStep;
  events?: SequenceEmailEvent[];
}

export interface SequenceEmailEvent {
  id: string;
  occurred_at: string;

  // Relationships
  execution_id: string;
  enrollment_id: string;

  // Event details
  event_type: EmailEventType;

  // Tracking details
  ip_address?: string | null;
  user_agent?: string | null;
  location_country?: string | null;
  location_city?: string | null;

  // Click event details
  link_url?: string | null;
  link_position?: number | null;

  // Bounce event details
  bounce_type?: string | null;
  bounce_reason?: string | null;

  // Relations
  execution?: SequenceStepExecution;
  enrollment?: SequenceEnrollment;
}

// API Request/Response Types
export const CreateSequenceTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: SequenceCategory.optional(),
  settings: SequenceSettingsSchema.optional(),
  is_active: z.boolean().default(true),
});
export type CreateSequenceTemplateRequest = z.infer<typeof CreateSequenceTemplateSchema>;

export const UpdateSequenceTemplateSchema = CreateSequenceTemplateSchema.partial();
export type UpdateSequenceTemplateRequest = z.infer<typeof UpdateSequenceTemplateSchema>;

export const CreateSequenceStepSchema = z.object({
  template_id: z.string().uuid(),
  step_number: z.number().min(1),
  step_type: SequenceStepType,

  // Timing
  wait_days: z.number().min(0).default(0),
  wait_hours: z.number().min(0).max(23).default(0),
  send_time_window: TimeWindowSchema.optional(),

  // Email content
  email_subject: z.string().optional(),
  email_body: z.string().optional(),
  email_from_name: z.string().optional(),
  email_reply_to: z.string().email().optional(),

  // Task configuration
  task_title: z.string().optional(),
  task_description: z.string().optional(),
  task_priority: TaskPriority.optional(),
  task_due_days: z.number().min(0).optional(),

  // Conditional logic
  conditions: ConditionSchema.optional(),

  // Webhook configuration
  webhook_url: z.string().url().optional(),
  webhook_method: z.string().optional(),
  webhook_headers: z.record(z.string(), z.string()).optional(),
  webhook_body: z.any().optional(),

  // LinkedIn configuration
  linkedin_config: LinkedInStepConfigSchema.optional(),

  // Call configuration
  call_config: CallStepConfigSchema.optional(),
});
export type CreateSequenceStepRequest = z.infer<typeof CreateSequenceStepSchema>;

export const UpdateSequenceStepSchema = CreateSequenceStepSchema.omit({ template_id: true }).partial();
export type UpdateSequenceStepRequest = z.infer<typeof UpdateSequenceStepSchema>;

export const EnrollLeadSchema = z.object({
  lead_id: z.string().uuid(),
  template_id: z.string().uuid(),
});
export type EnrollLeadRequest = z.infer<typeof EnrollLeadSchema>;

export const BulkEnrollLeadsSchema = z.object({
  lead_ids: z.array(z.string().uuid()).min(1).max(100),
  template_id: z.string().uuid(),
});
export type BulkEnrollLeadsRequest = z.infer<typeof BulkEnrollLeadsSchema>;

export const UpdateEnrollmentStatusSchema = z.object({
  status: EnrollmentStatus,
  reason: z.string().optional(),
});
export type UpdateEnrollmentStatusRequest = z.infer<typeof UpdateEnrollmentStatusSchema>;

// Utility Types
export interface SequenceMetrics {
  total_sequences: number;
  active_enrollments: number;
  completed_enrollments: number;
  average_reply_rate: number;
  average_open_rate: number;
  average_click_rate: number;
  total_replies: number;
  total_meetings_booked: number;
}

export interface SequencePerformance {
  sequence_id: string;
  sequence_name: string;
  enrollments: number;
  active: number;
  completed: number;
  reply_rate: number;
  open_rate: number;
  click_rate: number;
  meeting_rate: number;
}

// Variable types for email personalization
export interface SequenceVariable {
  key: string;
  label: string;
  value?: string;
  fallback?: string;
  category: 'lead' | 'company' | 'sender' | 'custom';
}

// Email preview types
export interface EmailPreview {
  subject: string;
  body_html: string;
  body_text: string;
  from_name: string;
  from_email: string;
  reply_to?: string;
  variables_used: SequenceVariable[];
}