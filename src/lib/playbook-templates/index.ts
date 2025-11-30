import { PlaybookTemplate } from '@/lib/types/playbook';

/**
 * Playbook Templates Library
 * Pre-built workflows for common prospecting scenarios
 */

export const playbookTemplates: PlaybookTemplate[] = [
  {
    id: 'icp-hunter',
    name: 'ICP Hunter',
    description: 'Find and qualify ideal customer profile matches, enrich data, and add to nurture sequences',
    category: 'prospecting',
    icon: '🎯',
    difficulty: 'easy',
    estimatedTime: '5-10 minutes',
    requirements: [
      'Apollo API key configured',
      'At least one active email sequence',
      'Lead scoring enabled',
    ],
    variables: [
      {
        name: 'industries',
        type: 'array',
        required: true,
        description: 'Target industries (e.g., SaaS, FinTech)',
        default: ['Software', 'Technology'],
      },
      {
        name: 'companySize',
        type: 'object',
        required: true,
        description: 'Company size range',
        default: { min: 50, max: 500 },
      },
      {
        name: 'titles',
        type: 'array',
        required: true,
        description: 'Target job titles',
        default: ['VP Sales', 'Head of Sales', 'Director of Sales'],
      },
      {
        name: 'minScore',
        type: 'number',
        required: false,
        description: 'Minimum lead score to qualify',
        default: 70,
      },
    ],
    playbook: {
      name: 'ICP Hunter',
      description: 'Automated ideal customer prospecting',
      type: 'custom',
      status: 'draft',
      trigger: {
        type: 'schedule',
        schedule: {
          cron: '0 9 * * 1', // Every Monday at 9 AM
          timezone: 'America/New_York',
          active: true,
        },
      },
      steps: [
        {
          id: 'search-companies',
          name: 'Find ICP Companies',
          type: 'search',
          config: {
            type: 'search',
            searchType: 'companies',
            parameters: {
              filters: {
                industries: '{{industries}}',
                employee_count_min: '{{companySize.min}}',
                employee_count_max: '{{companySize.max}}',
              },
              limit: 25,
            },
            output: {
              variable: 'icpCompanies',
            },
          },
          errorHandling: {
            strategy: 'retry',
            retryConfig: {
              maxAttempts: 3,
              backoff: 'exponential',
              delayMs: 1000,
            },
          },
        },
        {
          id: 'search-contacts',
          name: 'Find Decision Makers',
          type: 'search',
          config: {
            type: 'search',
            searchType: 'people',
            parameters: {
              filters: {
                organization_domains: '{{icpCompanies.map(c => c.domain)}}',
                titles: '{{titles}}',
              },
              limit: 50,
            },
            output: {
              variable: 'contacts',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'enrich-contacts',
          name: 'Enrich Contact Data',
          type: 'enrich',
          config: {
            type: 'enrich',
            enrichType: 'person',
            source: {
              variable: 'contacts',
              field: 'email',
            },
            options: {
              useCache: true,
              priority: 'normal',
              updateExisting: true,
            },
            output: {
              variable: 'enrichedContacts',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'score-leads',
          name: 'Score Leads',
          type: 'score',
          config: {
            type: 'score',
            source: {
              variable: 'enrichedContacts',
            },
            output: {
              variable: 'scoredLeads',
              includeInsights: true,
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'filter-qualified',
          name: 'Filter Qualified Leads',
          type: 'filter',
          config: {
            type: 'filter',
            source: {
              variable: 'scoredLeads',
            },
            filters: [
              {
                field: 'score',
                operator: 'greater_than_or_equal',
                value: '{{minScore}}',
              },
            ],
            operator: 'AND',
            output: {
              variable: 'qualifiedLeads',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'add-to-sequence',
          name: 'Add to Nurture Sequence',
          type: 'sequence',
          config: {
            type: 'sequence',
            source: {
              variable: 'qualifiedLeads',
            },
            sequence: {
              id: '{{sequenceId}}',
            },
            options: {
              skipDuplicates: true,
              sendImmediately: false,
            },
          },
          errorHandling: {
            strategy: 'retry',
            retryConfig: {
              maxAttempts: 2,
              backoff: 'linear',
              delayMs: 2000,
            },
          },
        },
        {
          id: 'notify-team',
          name: 'Notify Sales Team',
          type: 'notify',
          config: {
            type: 'notify',
            channels: ['email', 'slack'],
            recipients: ['{{teamEmail}}'],
            message: {
              subject: 'New ICP Leads Found',
              body: 'Found {{qualifiedLeads.length}} qualified leads matching ICP criteria. Average score: {{qualifiedLeads.avg(score)}}',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
      ],
      settings: {
        concurrency: 3,
        maxExecutionTime: 600000, // 10 minutes
        notifications: {
          onSuccess: true,
          onFailure: true,
        },
      },
    },
  },

  {
    id: 'competitor-displacement',
    name: 'Competitor Displacement',
    description: 'Find companies using competitor products and engage with switching campaigns',
    category: 'prospecting',
    icon: '⚔️',
    difficulty: 'medium',
    estimatedTime: '10-15 minutes',
    requirements: [
      'Apollo API key configured',
      'Competitor technologies identified',
      'Displacement sequence created',
    ],
    variables: [
      {
        name: 'competitorTech',
        type: 'array',
        required: true,
        description: 'Competitor technology names',
        default: ['Salesforce', 'HubSpot'],
      },
      {
        name: 'targetSize',
        type: 'object',
        required: true,
        description: 'Target company size',
        default: { min: 100, max: 1000 },
      },
      {
        name: 'switchingSignals',
        type: 'array',
        required: false,
        description: 'Keywords indicating switching intent',
        default: ['looking for alternative', 'evaluating options', 'considering switch'],
      },
    ],
    playbook: {
      name: 'Competitor Displacement',
      description: 'Target companies using competitor products',
      type: 'custom',
      status: 'draft',
      trigger: {
        type: 'schedule',
        schedule: {
          cron: '0 10 * * 2,4', // Tuesday and Thursday at 10 AM
          timezone: 'America/New_York',
          active: true,
        },
      },
      steps: [
        {
          id: 'find-competitor-users',
          name: 'Find Competitor Users',
          type: 'search',
          config: {
            type: 'search',
            searchType: 'companies',
            parameters: {
              filters: {
                technologies: '{{competitorTech}}',
                employee_count_min: '{{targetSize.min}}',
                employee_count_max: '{{targetSize.max}}',
              },
              limit: 30,
            },
            output: {
              variable: 'competitorUsers',
            },
          },
          errorHandling: {
            strategy: 'retry',
            retryConfig: {
              maxAttempts: 3,
              backoff: 'exponential',
              delayMs: 1000,
            },
          },
        },
        {
          id: 'enrich-companies',
          name: 'Enrich Company Data',
          type: 'enrich',
          config: {
            type: 'enrich',
            enrichType: 'company',
            source: {
              variable: 'competitorUsers',
              field: 'domain',
            },
            options: {
              useCache: true,
              priority: 'high',
            },
            output: {
              variable: 'enrichedCompanies',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'find-decision-makers',
          name: 'Find Decision Makers',
          type: 'search',
          config: {
            type: 'search',
            searchType: 'people',
            parameters: {
              filters: {
                organization_domains: '{{enrichedCompanies.map(c => c.domain)}}',
                titles: ['CTO', 'VP Engineering', 'Head of Product', 'Director of Operations'],
              },
              limit: 60,
            },
            output: {
              variable: 'decisionMakers',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'score-opportunities',
          name: 'Score Displacement Opportunities',
          type: 'score',
          config: {
            type: 'score',
            source: {
              variable: 'decisionMakers',
            },
            scoringModel: 'displacement',
            output: {
              variable: 'scoredOpportunities',
              includeInsights: true,
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'filter-high-potential',
          name: 'Filter High Potential',
          type: 'filter',
          config: {
            type: 'filter',
            source: {
              variable: 'scoredOpportunities',
            },
            filters: [
              {
                field: 'score',
                operator: 'greater_than',
                value: 75,
              },
              {
                field: 'insights',
                operator: 'contains',
                value: 'switching',
              },
            ],
            operator: 'OR',
            output: {
              variable: 'highPotential',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'add-to-displacement-sequence',
          name: 'Start Displacement Campaign',
          type: 'sequence',
          config: {
            type: 'sequence',
            source: {
              variable: 'highPotential',
            },
            sequence: {
              id: '{{displacementSequenceId}}',
              variant: 'competitor-switch',
            },
            options: {
              skipDuplicates: true,
              sendImmediately: true,
            },
          },
          errorHandling: {
            strategy: 'retry',
            retryConfig: {
              maxAttempts: 2,
              backoff: 'linear',
              delayMs: 2000,
            },
          },
        },
      ],
      settings: {
        concurrency: 2,
        maxExecutionTime: 900000, // 15 minutes
        notifications: {
          onSuccess: true,
          onFailure: true,
          recipients: ['sales-team@company.com'],
        },
      },
    },
  },

  {
    id: 'event-followup',
    name: 'Event Follow-up',
    description: 'Import event attendees, enrich their data, and launch personalized follow-up campaigns',
    category: 'nurturing',
    icon: '📅',
    difficulty: 'easy',
    estimatedTime: '5 minutes',
    requirements: [
      'Event attendee list (CSV)',
      'Follow-up email sequence',
    ],
    variables: [
      {
        name: 'eventName',
        type: 'string',
        required: true,
        description: 'Name of the event',
        default: 'Webinar Q4 2024',
      },
      {
        name: 'attendeeListId',
        type: 'string',
        required: true,
        description: 'Apollo list ID with attendees',
      },
      {
        name: 'followUpDelay',
        type: 'number',
        required: false,
        description: 'Hours to wait before follow-up',
        default: 2,
      },
    ],
    playbook: {
      name: 'Event Follow-up',
      description: 'Automated event attendee follow-up',
      type: 'custom',
      status: 'draft',
      trigger: {
        type: 'manual',
        manual: {
          requiresApproval: false,
        },
      },
      steps: [
        {
          id: 'import-attendees',
          name: 'Import Event Attendees',
          type: 'webhook',
          config: {
            type: 'webhook',
            url: '/api/apollo/lists/{{attendeeListId}}/members',
            method: 'GET',
            output: {
              variable: 'attendees',
            },
          },
          errorHandling: {
            strategy: 'stop',
          },
        },
        {
          id: 'wait-before-followup',
          name: 'Wait Before Follow-up',
          type: 'wait',
          config: {
            type: 'wait',
            duration: {
              value: '{{followUpDelay}}',
              unit: 'hours',
            },
            skipWeekends: false,
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'enrich-attendees',
          name: 'Enrich Attendee Data',
          type: 'enrich',
          config: {
            type: 'enrich',
            enrichType: 'person',
            source: {
              variable: 'attendees',
              field: 'email',
            },
            options: {
              useCache: true,
              priority: 'high',
              updateExisting: true,
            },
            output: {
              variable: 'enrichedAttendees',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'segment-by-engagement',
          name: 'Segment by Engagement',
          type: 'transform',
          config: {
            type: 'transform',
            source: {
              variable: 'enrichedAttendees',
            },
            transformations: [
              {
                type: 'map',
                config: {
                  expression: 'item.engagement_level = item.event_duration > 30 ? "high" : "low"',
                },
              },
              {
                type: 'sort',
                config: {
                  field: 'engagement_level',
                  order: 'desc',
                },
              },
            ],
            output: {
              variable: 'segmentedAttendees',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'high-engagement-sequence',
          name: 'High Engagement Follow-up',
          type: 'sequence',
          config: {
            type: 'sequence',
            source: {
              variable: 'segmentedAttendees.filter(a => a.engagement_level === "high")',
            },
            sequence: {
              id: '{{highEngagementSequenceId}}',
            },
            options: {
              skipDuplicates: true,
              sendImmediately: true,
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'low-engagement-sequence',
          name: 'Low Engagement Follow-up',
          type: 'sequence',
          config: {
            type: 'sequence',
            source: {
              variable: 'segmentedAttendees.filter(a => a.engagement_level === "low")',
            },
            sequence: {
              id: '{{lowEngagementSequenceId}}',
            },
            options: {
              skipDuplicates: true,
              sendImmediately: false,
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
      ],
      settings: {
        concurrency: 5,
        maxExecutionTime: 300000, // 5 minutes
        notifications: {
          onCompletion: true,
        },
      },
    },
  },

  {
    id: 'weekly-enrichment',
    name: 'Weekly Data Enrichment',
    description: 'Automatically enrich all leads added in the past week and update scores',
    category: 'enrichment',
    icon: '🔄',
    difficulty: 'easy',
    estimatedTime: '15-30 minutes',
    requirements: [
      'Active leads in database',
      'Apollo API credits available',
    ],
    variables: [
      {
        name: 'daysBack',
        type: 'number',
        required: false,
        description: 'Number of days to look back',
        default: 7,
      },
      {
        name: 'batchSize',
        type: 'number',
        required: false,
        description: 'Batch size for enrichment',
        default: 50,
      },
    ],
    playbook: {
      name: 'Weekly Data Enrichment',
      description: 'Keep lead data fresh and complete',
      type: 'system',
      status: 'active',
      trigger: {
        type: 'schedule',
        schedule: {
          cron: '0 2 * * 0', // Every Sunday at 2 AM
          timezone: 'UTC',
          active: true,
        },
      },
      steps: [
        {
          id: 'fetch-recent-leads',
          name: 'Fetch Recent Leads',
          type: 'webhook',
          config: {
            type: 'webhook',
            url: '/api/leads?created_after={{daysBack}}d&enriched=false',
            method: 'GET',
            output: {
              variable: 'recentLeads',
            },
          },
          errorHandling: {
            strategy: 'stop',
          },
        },
        {
          id: 'batch-enrich',
          name: 'Batch Enrich Leads',
          type: 'loop',
          config: {
            type: 'loop',
            source: {
              variable: 'recentLeads',
            },
            iterator: {
              variable: 'lead',
              index: 'index',
            },
            steps: ['enrich-single', 'update-score'],
            maxIterations: '{{batchSize}}',
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'enrich-single',
          name: 'Enrich Single Lead',
          type: 'enrich',
          config: {
            type: 'enrich',
            enrichType: 'person',
            source: {
              variable: 'lead',
              field: 'email',
            },
            options: {
              useCache: false,
              priority: 'low',
              updateExisting: true,
            },
            output: {
              variable: 'enrichedLead',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'update-score',
          name: 'Update Lead Score',
          type: 'score',
          config: {
            type: 'score',
            source: {
              variable: 'enrichedLead',
            },
            output: {
              variable: 'scoredLead',
              includeInsights: false,
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'summary-report',
          name: 'Send Summary Report',
          type: 'notify',
          config: {
            type: 'notify',
            channels: ['email'],
            recipients: ['data-team@company.com'],
            message: {
              subject: 'Weekly Enrichment Complete',
              body: 'Enriched {{recentLeads.length}} leads. Success rate: {{(enrichedCount/totalCount)*100}}%',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
      ],
      settings: {
        concurrency: 1,
        maxExecutionTime: 1800000, // 30 minutes
        notifications: {
          onFailure: true,
        },
      },
    },
  },

  {
    id: 'account-expansion',
    name: 'Account Expansion',
    description: 'Find new contacts at existing customer accounts for expansion opportunities',
    category: 'nurturing',
    icon: '📈',
    difficulty: 'medium',
    estimatedTime: '10 minutes',
    requirements: [
      'Existing customer account list',
      'Expansion sequence configured',
    ],
    variables: [
      {
        name: 'customerDomains',
        type: 'array',
        required: true,
        description: 'Domains of existing customers',
        default: [],
      },
      {
        name: 'targetDepartments',
        type: 'array',
        required: true,
        description: 'Departments to target for expansion',
        default: ['Sales', 'Marketing', 'Customer Success'],
      },
      {
        name: 'seniorityLevels',
        type: 'array',
        required: false,
        description: 'Seniority levels to target',
        default: ['Director', 'VP', 'C-Level'],
      },
    ],
    playbook: {
      name: 'Account Expansion',
      description: 'Find expansion opportunities in customer accounts',
      type: 'custom',
      status: 'draft',
      trigger: {
        type: 'schedule',
        schedule: {
          cron: '0 10 15 * *', // 15th of each month at 10 AM
          timezone: 'America/New_York',
          active: true,
        },
      },
      steps: [
        {
          id: 'find-new-contacts',
          name: 'Find New Contacts at Customer Accounts',
          type: 'search',
          config: {
            type: 'search',
            searchType: 'people',
            parameters: {
              filters: {
                organization_domains: '{{customerDomains}}',
                departments: '{{targetDepartments}}',
                seniority_levels: '{{seniorityLevels}}',
                excluded_emails: '{{existingContacts}}',
              },
              limit: 100,
            },
            output: {
              variable: 'newContacts',
            },
          },
          errorHandling: {
            strategy: 'retry',
            retryConfig: {
              maxAttempts: 3,
              backoff: 'exponential',
              delayMs: 1000,
            },
          },
        },
        {
          id: 'enrich-new-contacts',
          name: 'Enrich New Contacts',
          type: 'enrich',
          config: {
            type: 'enrich',
            enrichType: 'person',
            source: {
              variable: 'newContacts',
              field: 'email',
            },
            options: {
              useCache: true,
              priority: 'normal',
            },
            output: {
              variable: 'enrichedNewContacts',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'score-expansion-potential',
          name: 'Score Expansion Potential',
          type: 'score',
          config: {
            type: 'score',
            source: {
              variable: 'enrichedNewContacts',
            },
            scoringModel: 'expansion',
            output: {
              variable: 'scoredExpansion',
              includeInsights: true,
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'prioritize-contacts',
          name: 'Prioritize High-Value Contacts',
          type: 'filter',
          config: {
            type: 'filter',
            source: {
              variable: 'scoredExpansion',
            },
            filters: [
              {
                field: 'score',
                operator: 'greater_than',
                value: 60,
              },
              {
                field: 'seniority',
                operator: 'in',
                value: ['VP', 'C-Level'],
              },
            ],
            operator: 'OR',
            output: {
              variable: 'prioritizedContacts',
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'assign-to-account-managers',
          name: 'Assign to Account Managers',
          type: 'assign',
          config: {
            type: 'assign',
            source: {
              variable: 'prioritizedContacts',
            },
            assignment: {
              type: 'load-balanced',
              targets: ['{{accountManagers}}'],
            },
          },
          errorHandling: {
            strategy: 'continue',
          },
        },
        {
          id: 'start-expansion-sequence',
          name: 'Start Expansion Campaign',
          type: 'sequence',
          config: {
            type: 'sequence',
            source: {
              variable: 'prioritizedContacts',
            },
            sequence: {
              id: '{{expansionSequenceId}}',
              variant: 'warm-account',
            },
            options: {
              skipDuplicates: true,
              sendImmediately: false,
            },
          },
          errorHandling: {
            strategy: 'retry',
            retryConfig: {
              maxAttempts: 2,
              backoff: 'linear',
              delayMs: 2000,
            },
          },
        },
      ],
      settings: {
        concurrency: 3,
        maxExecutionTime: 600000, // 10 minutes
        notifications: {
          onSuccess: true,
          recipients: ['account-team@company.com'],
        },
      },
    },
  },
];

/**
 * Get playbook template by ID
 */
export function getPlaybookTemplate(id: string): PlaybookTemplate | undefined {
  return playbookTemplates.find(template => template.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): PlaybookTemplate[] {
  return playbookTemplates.filter(template => template.category === category);
}

/**
 * Get templates by difficulty
 */
export function getTemplatesByDifficulty(difficulty: 'easy' | 'medium' | 'advanced'): PlaybookTemplate[] {
  return playbookTemplates.filter(template => template.difficulty === difficulty);
}

/**
 * Search templates by keyword
 */
export function searchTemplates(keyword: string): PlaybookTemplate[] {
  const lowercaseKeyword = keyword.toLowerCase();
  return playbookTemplates.filter(template =>
    template.name.toLowerCase().includes(lowercaseKeyword) ||
    template.description.toLowerCase().includes(lowercaseKeyword)
  );
}