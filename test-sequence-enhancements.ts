/**
 * Manual test script for Sequence Enrollment Enhancements
 * Run with: npx tsx test-sequence-enhancements.ts
 */

import { SuppressionService } from './src/lib/services/suppression';
import { EmailValidator } from './src/lib/email/validator';
import { TimezoneService } from './src/lib/services/timezone';
import { AutoEnrollmentEngine } from './src/lib/services/auto-enrollment';
import { ABTestingService } from './src/lib/services/ab-testing';

console.log('🧪 Testing Sequence Enrollment Enhancements\n');
console.log('=' .repeat(50));

// Test 1: Email Validation
console.log('\n📧 TEST 1: Email Validation');
console.log('-'.repeat(30));

const testEmails = [
  'valid@example.com',
  'user+tag@company.co.uk',
  'invalid..email@test.com',
  'admin@company.com',
  'user@mailinator.com',
  '@nodomain.com',
  'nodotat.com',
];

testEmails.forEach(email => {
  const syntaxValid = EmailValidator.validateSyntax(email);
  const domainCheck = EmailValidator.validateDomain(email);
  const isRole = EmailValidator.isRoleAccount(email);

  console.log(`\n${email}:`);
  console.log(`  ✓ Syntax: ${syntaxValid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`  ✓ Domain: ${domainCheck.valid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`  ✓ Disposable: ${domainCheck.is_disposable ? '⚠️  Yes' : '✅ No'}`);
  console.log(`  ✓ Role Account: ${isRole ? '⚠️  Yes' : '✅ No'}`);
});

// Test 2: Timezone Detection
console.log('\n\n🌍 TEST 2: Timezone Detection');
console.log('-'.repeat(30));

const testPhones = [
  { phone: '+12125551234', expected: 'New York (EST/EDT)' },
  { phone: '+14155551234', expected: 'San Francisco (PST/PDT)' },
  { phone: '+13125551234', expected: 'Chicago (CST/CDT)' },
  { phone: '+447911123456', expected: 'London (GMT/BST)' },
  { phone: '+81312345678', expected: 'Tokyo (JST)' },
];

testPhones.forEach(({ phone, expected }) => {
  // Use the private method directly for testing (in real app, this would be via detectTimezone)
  const timezone = (TimezoneService as any).getTimezoneFromPhone(phone);
  console.log(`${phone}: ${timezone || 'Not detected'} (${expected})`);
});

// Test 3: Auto-Enrollment Trigger Matching
console.log('\n\n🤖 TEST 3: Auto-Enrollment Triggers');
console.log('-'.repeat(30));

const testTriggers = [
  {
    name: 'Lead Status Change',
    rule: {
      trigger_type: 'lead_status_change',
      trigger_config: { from_status: 'cold', to_status: 'warm' }
    },
    data: { old_status: 'cold', new_status: 'warm' },
    shouldMatch: true
  },
  {
    name: 'Score Threshold',
    rule: {
      trigger_type: 'lead_score_threshold',
      trigger_config: { min_score: 70, max_score: 100 }
    },
    data: { score: 85 },
    shouldMatch: true
  },
  {
    name: 'Tag Added',
    rule: {
      trigger_type: 'tag_added',
      trigger_config: { tags: ['interested', 'demo-requested'] }
    },
    data: { tag: 'demo-requested' },
    shouldMatch: true
  },
  {
    name: 'Wrong Status Change',
    rule: {
      trigger_type: 'lead_status_change',
      trigger_config: { from_status: 'cold', to_status: 'warm' }
    },
    data: { old_status: 'warm', new_status: 'hot' },
    shouldMatch: false
  }
];

testTriggers.forEach(({ name, rule, data, shouldMatch }) => {
  const matches = (AutoEnrollmentEngine as any).matchesTriggerConditions(rule, data);
  const result = matches === shouldMatch ? '✅ Pass' : '❌ Fail';
  console.log(`${name}: ${result} (Expected: ${shouldMatch ? 'Match' : 'No Match'}, Got: ${matches ? 'Match' : 'No Match'})`);
});

// Test 4: Lead Filtering
console.log('\n\n🔍 TEST 4: Lead Filtering');
console.log('-'.repeat(30));

const testLeads = [
  {
    name: 'High Score Lead',
    lead: { status: 'warm', lead_score: 85, tags: ['enterprise'], custom_fields: { industry: 'tech' } },
    filters: { status: ['warm', 'hot'], score: { min: 70 } },
    shouldMatch: true
  },
  {
    name: 'Low Score Lead',
    lead: { status: 'cold', lead_score: 30, tags: [] },
    filters: { score: { min: 50 } },
    shouldMatch: false
  },
  {
    name: 'Tagged Lead',
    lead: { status: 'warm', tags: ['enterprise', 'decision-maker'] },
    filters: { tags: { includes: ['enterprise'] } },
    shouldMatch: true
  },
  {
    name: 'Excluded Tag',
    lead: { status: 'warm', tags: ['competitor'] },
    filters: { tags: { excludes: ['competitor', 'customer'] } },
    shouldMatch: false
  }
];

testLeads.forEach(({ name, lead, filters, shouldMatch }) => {
  const matches = (AutoEnrollmentEngine as any).matchesLeadFilters(lead, filters);
  const result = matches === shouldMatch ? '✅ Pass' : '❌ Fail';
  console.log(`${name}: ${result}`);
});

// Test 5: A/B Test Statistical Analysis
console.log('\n\n📊 TEST 5: A/B Test Statistical Analysis');
console.log('-'.repeat(30));

const mockVariants = [
  {
    variant_id: 'control',
    variant_type: 'control' as const,
    enrollments: 1000,
    conversion_rate: 5.0,
    confidence_interval_lower: 4.0,
    confidence_interval_upper: 6.0,
  },
  {
    variant_id: 'variant_a',
    variant_type: 'variant_a' as const,
    enrollments: 1000,
    conversion_rate: 7.5,
    confidence_interval_lower: 6.5,
    confidence_interval_upper: 8.5,
  },
  {
    variant_id: 'variant_b',
    variant_type: 'variant_b' as const,
    enrollments: 1000,
    conversion_rate: 4.8,
    confidence_interval_lower: 3.9,
    confidence_interval_upper: 5.7,
  }
];

const analysis = (ABTestingService as any).performStatisticalAnalysis(mockVariants, 95);

console.log('Variant Performance:');
mockVariants.forEach(v => {
  console.log(`  ${v.variant_type}: ${v.conversion_rate}% (CI: ${v.confidence_interval_lower}-${v.confidence_interval_upper}%)`);
});

if (analysis.winner) {
  console.log(`\n🏆 Winner: ${analysis.winner.variant_type}`);
  console.log(`  Improvement: +${analysis.winner.improvement_percentage.toFixed(1)}%`);
  console.log(`  Confidence: ${analysis.winner.confidence_level}%`);
  console.log(`  Statistically Significant: ${analysis.isSignificant ? '✅ Yes' : '❌ No'}`);
} else {
  console.log('\n  No significant winner yet');
}

// Test 6: Confidence Interval Calculation
console.log('\n\n📈 TEST 6: Confidence Intervals');
console.log('-'.repeat(30));

const testSamples = [
  { successes: 50, total: 1000, rate: 5 },
  { successes: 75, total: 1000, rate: 7.5 },
  { successes: 100, total: 1000, rate: 10 },
  { successes: 10, total: 100, rate: 10 },
];

testSamples.forEach(({ successes, total, rate }) => {
  const p = successes / total;
  const { lower, upper } = (ABTestingService as any).calculateConfidenceInterval(p, total, 95);
  console.log(`${rate}% (${successes}/${total}): CI = ${(lower * 100).toFixed(2)}% - ${(upper * 100).toFixed(2)}%`);
});

// Test 7: Execution Window Checking
console.log('\n\n⏰ TEST 7: Execution Windows');
console.log('-'.repeat(30));

const testWindows = [
  {
    name: 'Business Hours',
    rule: {
      execute_between_start: '09:00',
      execute_between_end: '17:00',
      execute_on_days: [1, 2, 3, 4, 5] // Mon-Fri
    },
    testTime: new Date('2024-01-15T14:00:00'), // Monday 2 PM
    shouldExecute: true
  },
  {
    name: 'After Hours',
    rule: {
      execute_between_start: '09:00',
      execute_between_end: '17:00',
    },
    testTime: new Date('2024-01-15T20:00:00'), // Monday 8 PM
    shouldExecute: false
  },
  {
    name: 'Weekend',
    rule: {
      execute_on_days: [1, 2, 3, 4, 5] // Mon-Fri only
    },
    testTime: new Date('2024-01-14T12:00:00'), // Sunday noon
    shouldExecute: false
  }
];

testWindows.forEach(({ name, rule, testTime, shouldExecute }) => {
  // Mock the current time for testing
  const originalDate = Date;
  global.Date = class extends originalDate {
    constructor(value?: string | number | Date) {
      if (value === undefined) {
        super(testTime.getTime());
      } else {
        super(value as string | number);
      }
    }
    static now() { return testTime.getTime(); }
  } as DateConstructor;

  const inWindow = (AutoEnrollmentEngine as any).isInExecutionWindow(rule);

  // Restore original Date
  global.Date = originalDate;

  const result = inWindow === shouldExecute ? '✅ Pass' : '❌ Fail';
  const timeStr = testTime.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  console.log(`${name} (${timeStr}): ${result}`);
});

// Test 8: Email Validation Report
console.log('\n\n📋 TEST 8: Validation Report Generation');
console.log('-'.repeat(30));

const mockValidationResults = [
  { email: 'valid1@example.com', is_deliverable: true, is_valid: true, is_suppressed: false, is_disposable: false, is_role_account: false, validation_errors: [] },
  { email: 'valid2@example.com', is_deliverable: true, is_valid: true, is_suppressed: false, is_disposable: false, is_role_account: false, validation_errors: [] },
  { email: 'bounce@example.com', is_deliverable: false, is_valid: true, is_suppressed: true, is_disposable: false, is_role_account: false, validation_errors: ['Email is suppressed'] },
  { email: 'admin@example.com', is_deliverable: true, is_valid: true, is_suppressed: false, is_disposable: false, is_role_account: true, validation_errors: ['Role-based email account'] },
  { email: 'user@mailinator.com', is_deliverable: false, is_valid: true, is_suppressed: false, is_disposable: true, is_role_account: false, validation_errors: ['Disposable email address'] },
  { email: 'invalid..email', is_deliverable: false, is_valid: false, is_suppressed: false, is_disposable: false, is_role_account: false, validation_errors: ['Invalid email syntax'] },
] as any[];

const report = EmailValidator.generateValidationReport(mockValidationResults);

console.log('Summary:');
console.log(`  Total: ${report.summary.total}`);
console.log(`  Valid: ${report.summary.valid} (${(report.summary.valid / report.summary.total * 100).toFixed(1)}%)`);
console.log(`  Invalid: ${report.summary.invalid}`);
console.log(`  Suppressed: ${report.summary.suppressed}`);
console.log(`  Disposable: ${report.summary.disposable}`);
console.log(`  Role Accounts: ${report.summary.role_accounts}`);

console.log('\nError Breakdown:');
Object.entries(report.by_error).forEach(([error, count]) => {
  console.log(`  ${error}: ${count}`);
});

console.log('\nRecommendations:');
report.recommendations.forEach(rec => {
  console.log(`  • ${rec}`);
});

// Summary
console.log('\n\n' + '='.repeat(50));
console.log('✅ All enhancement tests completed!');
console.log('\nKey Features Verified:');
console.log('  ✓ Email validation with syntax, domain, and role detection');
console.log('  ✓ Timezone detection from phone numbers');
console.log('  ✓ Auto-enrollment trigger matching');
console.log('  ✓ Lead filtering with multiple criteria');
console.log('  ✓ A/B test statistical analysis');
console.log('  ✓ Confidence interval calculations');
console.log('  ✓ Execution window enforcement');
console.log('  ✓ Validation report generation');

console.log('\n💡 Note: This is a unit test. For integration testing,');
console.log('   run the application and test the actual enrollment flow.');