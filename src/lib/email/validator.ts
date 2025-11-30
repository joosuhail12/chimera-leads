/**
 * Email Validation Service
 * Validates email addresses for syntax, deliverability, and suppression status
 */

import { createClient } from '@/lib/supabase/server';
import { SuppressionService } from '@/lib/services/suppression';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface EmailValidationResult {
  email: string;
  is_valid: boolean;
  is_deliverable: boolean;
  is_suppressed: boolean;
  syntax_valid: boolean;
  domain_valid: boolean;
  mx_records_valid: boolean;
  is_disposable: boolean;
  is_role_account: boolean;
  suppression_reason?: string;
  validation_errors: string[];
  validated_at: string;
}

export interface BulkValidationResult {
  total: number;
  valid: number;
  invalid: number;
  suppressed: number;
  results: EmailValidationResult[];
}

// ============================================
// CONSTANTS
// ============================================

// Common disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'guerrillamail.com',
  'mailinator.com',
  'maildrop.cc',
  '10minutemail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'fakeinbox.com',
  'trashmail.com',
  'sharklasers.com',
  'guerrillamail.biz',
  'guerrillamailblock.com',
  'spam4.me',
  'dodgeit.com',
  'getnada.com',
  'temp-mail.org',
  'tempinbox.com',
]);

// Common role-based email prefixes
const ROLE_ACCOUNTS = new Set([
  'admin',
  'info',
  'support',
  'sales',
  'marketing',
  'contact',
  'help',
  'hello',
  'office',
  'team',
  'press',
  'media',
  'pr',
  'billing',
  'legal',
  'hr',
  'careers',
  'jobs',
  'noreply',
  'no-reply',
  'donotreply',
  'unsubscribe',
  'abuse',
  'postmaster',
  'webmaster',
  'hostmaster',
]);

// ============================================
// EMAIL VALIDATOR CLASS
// ============================================

export class EmailValidator {
  /**
   * Validate email syntax using RFC 5322 regex
   */
  static validateSyntax(email: string): boolean {
    if (!email || typeof email !== 'string') return false;

    // Basic length check
    if (email.length < 3 || email.length > 254) return false;

    // RFC 5322 compliant regex (simplified for practical use)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(email)) return false;

    // Check for valid local and domain parts
    const [localPart, domain] = email.split('@');

    // Local part checks
    if (localPart.length > 64) return false;
    if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
    if (localPart.includes('..')) return false;

    // Domain checks
    if (!domain || domain.length < 3) return false;
    if (domain.startsWith('.') || domain.startsWith('-')) return false;
    if (domain.endsWith('.') || domain.endsWith('-')) return false;
    if (!domain.includes('.')) return false;

    return true;
  }

  /**
   * Check if email domain is valid
   */
  static validateDomain(email: string): {
    valid: boolean;
    domain: string;
    is_disposable: boolean;
  } {
    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain) {
      return { valid: false, domain: '', is_disposable: false };
    }

    // Check domain format
    const domainRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const valid = domainRegex.test(domain);

    // Check if disposable
    const is_disposable = DISPOSABLE_DOMAINS.has(domain);

    return { valid, domain, is_disposable };
  }

  /**
   * Check if email is a role account
   */
  static isRoleAccount(email: string): boolean {
    const localPart = email.split('@')[0]?.toLowerCase();
    return ROLE_ACCOUNTS.has(localPart);
  }

  /**
   * Check MX records for domain (requires external service in production)
   */
  static async checkMXRecords(domain: string): Promise<boolean> {
    // In production, you would use DNS lookup or an external service
    // For now, we'll do a basic check and assume valid for known providers
    const knownProviders = [
      'gmail.com',
      'yahoo.com',
      'outlook.com',
      'hotmail.com',
      'icloud.com',
      'aol.com',
      'protonmail.com',
      'fastmail.com',
    ];

    // Check if it's a known provider
    if (knownProviders.some(provider => domain.endsWith(provider))) {
      return true;
    }

    // In production, integrate with a service like:
    // - Cloudflare DNS API
    // - Google DNS API
    // - Or use a Node.js DNS library (requires server environment)

    // For now, return true if domain format is valid
    return true;
  }

  /**
   * Check email against suppression lists
   */
  static async checkSuppression(
    email: string,
    orgId: string,
    leadId?: string
  ): Promise<{
    is_suppressed: boolean;
    reason?: string;
  }> {
    // Check global suppressions
    const isGloballySuppressed = await SuppressionService.isGloballySuppressed(email, orgId);

    if (isGloballySuppressed) {
      return {
        is_suppressed: true,
        reason: 'Email is in suppression list',
      };
    }

    // If we have a lead ID, check lead-specific suppressions
    if (leadId) {
      const { canEnroll, reason } = await SuppressionService.canEnrollLead(leadId, orgId, email);

      if (!canEnroll) {
        return {
          is_suppressed: true,
          reason: reason || 'Lead cannot be enrolled',
        };
      }
    }

    return { is_suppressed: false };
  }

  /**
   * Verify email deliverability (comprehensive check)
   */
  static async verifyDeliverability(
    email: string,
    orgId: string,
    options?: {
      checkMX?: boolean;
      checkSuppression?: boolean;
      leadId?: string;
    }
  ): Promise<EmailValidationResult> {
    const result: EmailValidationResult = {
      email,
      is_valid: false,
      is_deliverable: false,
      is_suppressed: false,
      syntax_valid: false,
      domain_valid: false,
      mx_records_valid: false,
      is_disposable: false,
      is_role_account: false,
      validation_errors: [],
      validated_at: new Date().toISOString(),
    };

    // 1. Syntax validation
    result.syntax_valid = this.validateSyntax(email);
    if (!result.syntax_valid) {
      result.validation_errors.push('Invalid email syntax');
    }

    // 2. Domain validation
    const domainCheck = this.validateDomain(email);
    result.domain_valid = domainCheck.valid;
    result.is_disposable = domainCheck.is_disposable;

    if (!domainCheck.valid) {
      result.validation_errors.push('Invalid domain');
    }
    if (domainCheck.is_disposable) {
      result.validation_errors.push('Disposable email address');
    }

    // 3. Role account check
    result.is_role_account = this.isRoleAccount(email);
    if (result.is_role_account) {
      result.validation_errors.push('Role-based email account');
    }

    // 4. MX records check (optional)
    if (options?.checkMX && domainCheck.valid) {
      result.mx_records_valid = await this.checkMXRecords(domainCheck.domain);
      if (!result.mx_records_valid) {
        result.validation_errors.push('No valid MX records found');
      }
    } else {
      result.mx_records_valid = true; // Assume valid if not checking
    }

    // 5. Suppression check (optional)
    if (options?.checkSuppression) {
      const suppressionCheck = await this.checkSuppression(
        email,
        orgId,
        options.leadId
      );
      result.is_suppressed = suppressionCheck.is_suppressed;
      result.suppression_reason = suppressionCheck.reason;

      if (suppressionCheck.is_suppressed) {
        result.validation_errors.push(suppressionCheck.reason || 'Email is suppressed');
      }
    }

    // Determine overall validity
    result.is_valid = result.syntax_valid && result.domain_valid;
    result.is_deliverable =
      result.is_valid &&
      result.mx_records_valid &&
      !result.is_suppressed &&
      !result.is_disposable;

    return result;
  }

  /**
   * Validate and update lead email status in database
   */
  static async validateAndUpdateLead(
    leadId: string,
    email: string,
    orgId: string
  ): Promise<EmailValidationResult> {
    const supabase = await createClient();

    // Perform validation
    const validation = await this.verifyDeliverability(email, orgId, {
      checkMX: true,
      checkSuppression: true,
      leadId,
    });

    // Update lead record with validation results
    await supabase
      .from('sales_leads')
      .update({
        email_valid: validation.is_deliverable,
        email_validated_at: validation.validated_at,
        email_validation_error: validation.validation_errors.join('; ') || null,
      })
      .eq('id', leadId)
      .eq('organization_id', orgId);

    return validation;
  }

  /**
   * Bulk validate emails
   */
  static async bulkValidate(
    emails: string[],
    orgId: string,
    options?: {
      checkMX?: boolean;
      checkSuppression?: boolean;
      updateDatabase?: boolean;
    }
  ): Promise<BulkValidationResult> {
    const results: EmailValidationResult[] = [];
    let valid = 0;
    let invalid = 0;
    let suppressed = 0;

    // Process in parallel batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(email =>
          this.verifyDeliverability(email, orgId, {
            checkMX: options?.checkMX,
            checkSuppression: options?.checkSuppression,
          })
        )
      );

      for (const result of batchResults) {
        results.push(result);

        if (result.is_deliverable) {
          valid++;
        } else if (result.is_suppressed) {
          suppressed++;
        } else {
          invalid++;
        }
      }
    }

    // Optionally update database with results
    if (options?.updateDatabase) {
      const supabase = await createClient();

      // Get leads by email
      const { data: leads } = await supabase
        .from('sales_leads')
        .select('id, email')
        .eq('organization_id', orgId)
        .in('email', emails);

      if (leads) {
        // Update each lead with validation results
        for (const lead of leads) {
          const validation = results.find(r => r.email === lead.email);
          if (validation) {
            await supabase
              .from('sales_leads')
              .update({
                email_valid: validation.is_deliverable,
                email_validated_at: validation.validated_at,
                email_validation_error: validation.validation_errors.join('; ') || null,
              })
              .eq('id', lead.id);
          }
        }
      }
    }

    return {
      total: emails.length,
      valid,
      invalid,
      suppressed,
      results,
    };
  }

  /**
   * Extract and validate emails from text
   */
  static extractAndValidateEmails(text: string): string[] {
    // Regex to extract emails from text
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];

    // Validate and deduplicate
    const validEmails = new Set<string>();
    for (const email of matches) {
      if (this.validateSyntax(email.toLowerCase())) {
        validEmails.add(email.toLowerCase());
      }
    }

    return Array.from(validEmails);
  }

  /**
   * Generate email validation report
   */
  static generateValidationReport(results: EmailValidationResult[]): {
    summary: {
      total: number;
      valid: number;
      invalid: number;
      suppressed: number;
      disposable: number;
      role_accounts: number;
    };
    by_error: Record<string, number>;
    recommendations: string[];
  } {
    const summary = {
      total: results.length,
      valid: results.filter(r => r.is_deliverable).length,
      invalid: results.filter(r => !r.is_valid).length,
      suppressed: results.filter(r => r.is_suppressed).length,
      disposable: results.filter(r => r.is_disposable).length,
      role_accounts: results.filter(r => r.is_role_account).length,
    };

    // Count errors
    const errorCounts: Record<string, number> = {};
    for (const result of results) {
      for (const error of result.validation_errors) {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (summary.disposable > 0) {
      recommendations.push(`Remove ${summary.disposable} disposable email addresses to improve deliverability`);
    }

    if (summary.role_accounts > results.length * 0.2) {
      recommendations.push('High percentage of role accounts detected - consider targeting personal emails for better engagement');
    }

    if (summary.suppressed > 0) {
      recommendations.push(`${summary.suppressed} emails are suppressed and will not receive messages`);
    }

    if (summary.valid < results.length * 0.8) {
      recommendations.push('Email list quality is below 80% - consider cleaning your list');
    }

    return {
      summary,
      by_error: errorCounts,
      recommendations,
    };
  }
}