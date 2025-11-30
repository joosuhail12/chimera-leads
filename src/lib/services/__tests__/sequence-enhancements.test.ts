/**
 * Test Suite for Sequence Enrollment Enhancements
 * Verifies suppression, timezone, auto-enrollment, and A/B testing features
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SuppressionService } from '../suppression';
import { EmailValidator } from '../../email/validator';
import { TimezoneService } from '../timezone';
import { AutoEnrollmentEngine } from '../auto-enrollment';
import { ABTestingService } from '../ab-testing';
import { SequenceEnrollmentService } from '../sequences';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      limit: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    sql: jest.fn((template, ...values) => template),
  })),
}));

describe('Suppression Service', () => {
  describe('canEnrollLead', () => {
    it('should check if a lead can be enrolled', async () => {
      const result = await SuppressionService.canEnrollLead(
        'lead-123',
        'org-123',
        'test@example.com'
      );

      expect(result).toHaveProperty('canEnroll');
      expect(result).toHaveProperty('reason');
    });

    it('should handle suppressed leads correctly', async () => {
      // Mock suppressed lead
      const mockClient = require('@/lib/supabase/server').createClient();
      mockClient.rpc.mockResolvedValueOnce({ data: false, error: null });

      const result = await SuppressionService.canEnrollLead(
        'suppressed-lead',
        'org-123',
        'suppressed@example.com'
      );

      expect(result.canEnroll).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('addSuppression', () => {
    it('should add email to suppression list', async () => {
      const suppression = await SuppressionService.addSuppression(
        {
          email: 'blocked@example.com',
          reason: 'unsubscribe',
          source: 'manual',
        },
        'org-123',
        'user-123'
      );

      expect(suppression).toBeDefined();
    });

    it('should validate suppression data', async () => {
      await expect(
        SuppressionService.addSuppression(
          {
            // Missing required field (email, domain, or lead_id)
            reason: 'unsubscribe',
          } as any,
          'org-123',
          'user-123'
        )
      ).rejects.toThrow();
    });
  });

  describe('updatePreferences', () => {
    it('should update unsubscribe preferences', async () => {
      const preferences = await SuppressionService.updatePreferences(
        'lead-123',
        'org-123',
        {
          all_sequences: false,
          marketing_emails: true,
          max_emails_per_week: 5,
        }
      );

      expect(preferences).toBeDefined();
    });
  });
});

describe('Email Validator', () => {
  describe('validateSyntax', () => {
    it('should validate correct email syntax', () => {
      expect(EmailValidator.validateSyntax('valid@example.com')).toBe(true);
      expect(EmailValidator.validateSyntax('user+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email syntax', () => {
      expect(EmailValidator.validateSyntax('invalid')).toBe(false);
      expect(EmailValidator.validateSyntax('@example.com')).toBe(false);
      expect(EmailValidator.validateSyntax('user@')).toBe(false);
      expect(EmailValidator.validateSyntax('user..name@example.com')).toBe(false);
    });
  });

  describe('validateDomain', () => {
    it('should detect disposable domains', () => {
      const result = EmailValidator.validateDomain('user@mailinator.com');
      expect(result.is_disposable).toBe(true);
    });

    it('should validate legitimate domains', () => {
      const result = EmailValidator.validateDomain('user@gmail.com');
      expect(result.valid).toBe(true);
      expect(result.is_disposable).toBe(false);
    });
  });

  describe('isRoleAccount', () => {
    it('should detect role-based accounts', () => {
      expect(EmailValidator.isRoleAccount('admin@company.com')).toBe(true);
      expect(EmailValidator.isRoleAccount('support@company.com')).toBe(true);
      expect(EmailValidator.isRoleAccount('info@company.com')).toBe(true);
    });

    it('should not flag personal accounts', () => {
      expect(EmailValidator.isRoleAccount('john.doe@company.com')).toBe(false);
      expect(EmailValidator.isRoleAccount('jane@company.com')).toBe(false);
    });
  });

  describe('verifyDeliverability', () => {
    it('should perform comprehensive validation', async () => {
      const result = await EmailValidator.verifyDeliverability(
        'test@example.com',
        'org-123',
        {
          checkMX: true,
          checkSuppression: true,
        }
      );

      expect(result).toHaveProperty('is_valid');
      expect(result).toHaveProperty('is_deliverable');
      expect(result).toHaveProperty('syntax_valid');
      expect(result).toHaveProperty('domain_valid');
      expect(result).toHaveProperty('mx_records_valid');
      expect(result).toHaveProperty('is_suppressed');
    });
  });
});

describe('Timezone Service', () => {
  describe('detectTimezone', () => {
    it('should detect timezone from phone number', async () => {
      const mockClient = require('@/lib/supabase/server').createClient();
      mockClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: {
          phone: '+12125551234', // New York area code
          country: 'US',
          state: 'NY',
        },
        error: null,
      });

      const result = await TimezoneService.detectTimezone('lead-123', 'org-123');

      expect(result.detected).toBe(true);
      expect(result.timezone).toBe('America/New_York');
      expect(result.source).toBe('phone');
    });

    it('should fall back to default timezone', async () => {
      const mockClient = require('@/lib/supabase/server').createClient();
      mockClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const result = await TimezoneService.detectTimezone('lead-123', 'org-123');

      expect(result.detected).toBe(true);
      expect(result.timezone).toBeDefined();
      expect(result.confidence).toBe('low');
    });
  });

  describe('getOptimalSendWindow', () => {
    it('should calculate optimal send window', async () => {
      const window = await TimezoneService.getOptimalSendWindow(
        'lead-123',
        'org-123'
      );

      expect(window).toHaveProperty('start');
      expect(window).toHaveProperty('end');
      expect(window).toHaveProperty('nextWindowUTC');
      expect(window).toHaveProperty('timezone');
    });

    it('should respect preferred time window', async () => {
      const window = await TimezoneService.getOptimalSendWindow(
        'lead-123',
        'org-123',
        { start: '14:00', end: '16:00' }
      );

      expect(window.start).toBe('14:00');
      expect(window.end).toBe('16:00');
    });
  });

  describe('convertToTimezone', () => {
    it('should convert UTC to local timezone', () => {
      const utcTime = new Date('2024-01-15T15:00:00Z');
      const localTime = TimezoneService.convertToTimezone(utcTime, 'America/New_York');

      // EST is UTC-5, so 15:00 UTC = 10:00 EST
      expect(localTime.getHours()).toBeLessThan(15);
    });
  });
});

describe('Auto-Enrollment Engine', () => {
  describe('createRule', () => {
    it('should create auto-enrollment rule', async () => {
      const mockClient = require('@/lib/supabase/server').createClient();
      mockClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: { id: 'template-123' },
        error: null,
      });
      mockClient.from().insert().select().single.mockResolvedValueOnce({
        data: {
          id: 'rule-123',
          name: 'Test Rule',
          template_id: 'template-123',
        },
        error: null,
      });

      const rule = await AutoEnrollmentEngine.createRule(
        {
          name: 'Test Rule',
          template_id: 'template-123',
          trigger_type: 'lead_created',
          trigger_config: {},
          is_active: true,
          priority: 100,
          delay_minutes: 0,
        },
        'org-123',
        'user-123'
      );

      expect(rule).toBeDefined();
      expect(rule.name).toBe('Test Rule');
    });
  });

  describe('processTrigger', () => {
    it('should process trigger events', async () => {
      const mockClient = require('@/lib/supabase/server').createClient();
      mockClient.from().select().eq().eq().eq().order.mockResolvedValueOnce({
        data: [
          {
            id: 'rule-123',
            name: 'Test Rule',
            trigger_type: 'lead_created',
            trigger_config: {},
            template_id: 'template-123',
            priority: 100,
          },
        ],
        error: null,
      });

      const result = await AutoEnrollmentEngine.processTrigger(
        'lead_created',
        { lead_id: 'lead-123' },
        'org-123'
      );

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('enrolled');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('trigger matching', () => {
    it('should match lead status change triggers', () => {
      const rule = {
        trigger_type: 'lead_status_change',
        trigger_config: {
          from_status: 'cold',
          to_status: 'warm',
        },
      } as any;

      const matches = (AutoEnrollmentEngine as any).matchesTriggerConditions(
        rule,
        {
          old_status: 'cold',
          new_status: 'warm',
        }
      );

      expect(matches).toBe(true);
    });

    it('should match score threshold triggers', () => {
      const rule = {
        trigger_type: 'lead_score_threshold',
        trigger_config: {
          min_score: 70,
          max_score: 100,
        },
      } as any;

      const matches = (AutoEnrollmentEngine as any).matchesTriggerConditions(
        rule,
        { score: 85 }
      );

      expect(matches).toBe(true);
    });
  });
});

describe('A/B Testing Service', () => {
  describe('createTest', () => {
    it('should create A/B test with control variant', async () => {
      const mockClient = require('@/lib/supabase/server').createClient();
      mockClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: { id: 'template-123' },
        error: null,
      });
      mockClient.from().insert().select().single.mockResolvedValueOnce({
        data: {
          id: 'test-123',
          name: 'Subject Line Test',
          template_id: 'template-123',
        },
        error: null,
      });
      mockClient.from().insert().select().single.mockResolvedValueOnce({
        data: {
          id: 'variant-control',
          test_id: 'test-123',
          variant_type: 'control',
        },
        error: null,
      });

      const test = await ABTestingService.createTest(
        {
          template_id: 'template-123',
          name: 'Subject Line Test',
          traffic_percentage: 100,
          settings: {
            confidence_level: 0.95,
            auto_conclude: true,
            primary_metric: 'reply_rate',
          }
        },
        'user-123',
        'org-123'
      );

      expect(test).toBeDefined();
      expect(test.name).toBe('Subject Line Test');
    });
  });

  describe('calculateVariantMetrics', () => {
    it('should calculate variant performance metrics', () => {
      const variant = {
        id: 'variant-123',
        variant_type: 'variant_a' as const,
        changes: {},
      } as any;

      const enrollments = [
        {
          emails_sent: 100,
          emails_opened: 45,
          emails_clicked: 15,
          replies_received: 5,
          meetings_booked: 2,
          status: 'active',
        },
        {
          emails_sent: 100,
          emails_opened: 50,
          emails_clicked: 20,
          replies_received: 8,
          meetings_booked: 3,
          status: 'active',
        },
      ];

      const metrics = (ABTestingService as any).calculateVariantMetrics(
        variant,
        enrollments,
        'reply_rate'
      );

      expect(metrics.enrollments).toBe(2);
      expect(metrics.emails_sent).toBe(200);
      expect(metrics.open_rate).toBeCloseTo(47.5, 1);
      expect(metrics.reply_rate).toBeCloseTo(6.5, 1);
    });
  });

  describe('performStatisticalAnalysis', () => {
    it('should identify statistically significant winners', () => {
      const variants = [
        {
          variant_type: 'control' as const,
          conversion_rate: 5,
          confidence_interval_lower: 4,
          confidence_interval_upper: 6,
          enrollments: 1000,
        },
        {
          variant_type: 'variant_a' as const,
          conversion_rate: 8,
          confidence_interval_lower: 7,
          confidence_interval_upper: 9,
          enrollments: 1000,
        },
      ] as any;

      const analysis = (ABTestingService as any).performStatisticalAnalysis(
        variants,
        95
      );

      expect(analysis.isSignificant).toBe(true);
      expect(analysis.winner).toBeDefined();
      expect(analysis.winner.variant_type).toBe('variant_a');
      expect(analysis.winner.improvement_percentage).toBeCloseTo(60, 0);
    });
  });
});

describe('Integration Tests', () => {
  describe('Enrollment with Suppression Check', () => {
    it('should prevent enrollment of suppressed leads', async () => {
      const mockClient = require('@/lib/supabase/server').createClient();

      // Mock suppressed lead
      mockClient.rpc.mockResolvedValueOnce({ data: false, error: null });
      mockClient.from().select().eq().single.mockResolvedValueOnce({
        data: {
          organization_id: 'org-123',
        },
        error: null,
      });
      mockClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: {
          id: 'lead-123',
          email: 'suppressed@example.com',
          organization_id: 'org-123',
        },
        error: null,
      });

      await expect(
        SequenceEnrollmentService.enroll(
          {
            lead_id: 'lead-123',
            template_id: 'template-123',
          },
          'user-123'
        )
      ).rejects.toThrow(/Cannot enroll lead/);
    });
  });

  describe('Enrollment with Email Validation', () => {
    it('should validate email before enrollment', async () => {
      const mockClient = require('@/lib/supabase/server').createClient();

      // Mock valid lead
      mockClient.from().select().eq().single.mockResolvedValueOnce({
        data: { organization_id: 'org-123' },
        error: null,
      });
      mockClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: {
          id: 'lead-123',
          email: 'invalid..email@example.com',
          organization_id: 'org-123',
        },
        error: null,
      });
      mockClient.rpc.mockResolvedValueOnce({ data: true, error: null });

      await expect(
        SequenceEnrollmentService.enroll(
          {
            lead_id: 'lead-123',
            template_id: 'template-123',
          },
          'user-123'
        )
      ).rejects.toThrow(/Invalid email/);
    });
  });
});

// Export for test runner
export default {
  SuppressionService,
  EmailValidator,
  TimezoneService,
  AutoEnrollmentEngine,
  ABTestingService,
};