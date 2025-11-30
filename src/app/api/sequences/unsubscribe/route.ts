/**
 * Unsubscribe Handler API
 * Handles unsubscribe requests from email links and preference updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { SuppressionService } from '@/lib/services/suppression';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const UnsubscribeQuerySchema = z.object({
  token: z.string().uuid(),
  action: z.enum(['all', 'preferences']).optional().default('preferences'),
  reason: z.string().optional(),
  feedback: z.string().optional(),
});

const PreferenceUpdateSchema = z.object({
  all_sequences: z.boolean().optional(),
  marketing_emails: z.boolean().optional(),
  transactional_emails: z.boolean().optional(),
  max_emails_per_week: z.number().min(0).max(50).optional(),
  preferred_send_days: z.array(z.number().min(0).max(6)).optional(),
  preferred_send_time_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  preferred_send_time_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  email_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  excluded_sequence_template_ids: z.array(z.string().uuid()).optional(),
  excluded_sequence_categories: z.array(z.string()).optional(),
});

// ============================================
// GET HANDLER - Display unsubscribe page
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const action = searchParams.get('action');

    if (!token) {
      return new NextResponse(generateErrorPage('Invalid unsubscribe link'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Validate token format
    const tokenValidation = z.string().uuid().safeParse(token);
    if (!tokenValidation.success) {
      return new NextResponse(generateErrorPage('Invalid unsubscribe token'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Get preferences by token
    const preferences = await SuppressionService.getPreferencesByToken(token);

    if (!preferences) {
      return new NextResponse(generateErrorPage('Unsubscribe link has expired or is invalid'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // If action is 'all', immediately unsubscribe from everything
    if (action === 'all') {
      await SuppressionService.updatePreferences(
        preferences.lead_id!,
        preferences.organization_id,
        {
          all_sequences: true,
          marketing_emails: true,
          email_enabled: false,
          unsubscribe_reason: 'one_click_unsubscribe',
        }
      );

      return new NextResponse(generateSuccessPage(preferences.email), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Otherwise, show preference center
    return new NextResponse(generatePreferencePage(preferences, token), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('Error handling unsubscribe GET request:', error);
    return new NextResponse(generateErrorPage('An error occurred'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// ============================================
// POST HANDLER - Update preferences
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate token
    const { token, ...preferences } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Get existing preferences
    const existingPrefs = await SuppressionService.getPreferencesByToken(token);

    if (!existingPrefs) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    // Validate preferences update
    const validatedPrefs = PreferenceUpdateSchema.parse(preferences);

    // Update preferences
    const updated = await SuppressionService.updatePreferences(
      existingPrefs.lead_id!,
      existingPrefs.organization_id,
      validatedPrefs
    );

    // If unsubscribing from all, also add to suppression list
    if (validatedPrefs.all_sequences) {
      await SuppressionService.addSuppression(
        {
          lead_id: existingPrefs.lead_id,
          email: existingPrefs.email,
          reason: 'unsubscribe',
          source: 'unsubscribe_link',
        },
        existingPrefs.organization_id,
        'system'
      );
    }

    return NextResponse.json({
      success: true,
      preferences: updated,
    });

  } catch (error) {
    console.error('Error updating preferences:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid preferences', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

// ============================================
// HTML GENERATORS
// ============================================

function generatePreferencePage(preferences: any, token: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Preferences</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      max-width: 600px;
      width: 100%;
      padding: 40px;
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }

    .email {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      color: #444;
      font-size: 18px;
      margin-bottom: 15px;
      font-weight: 600;
    }

    .option {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .option:hover {
      background: #e9ecef;
    }

    .option input {
      margin-right: 12px;
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .option label {
      cursor: pointer;
      flex: 1;
      color: #555;
    }

    .frequency {
      display: flex;
      gap: 10px;
      margin-top: 15px;
      flex-wrap: wrap;
    }

    .frequency input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      width: 150px;
    }

    .buttons {
      display: flex;
      gap: 12px;
      margin-top: 30px;
    }

    button {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #5a67d8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: #e2e8f0;
      color: #4a5568;
    }

    .btn-secondary:hover {
      background: #cbd5e0;
    }

    .btn-danger {
      background: #f56565;
      color: white;
    }

    .btn-danger:hover {
      background: #e53e3e;
    }

    .message {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: none;
    }

    .message.success {
      background: #c6f6d5;
      color: #22543d;
      border: 1px solid #9ae6b4;
    }

    .message.error {
      background: #fed7d7;
      color: #742a2a;
      border: 1px solid #fc8181;
    }

    .divider {
      height: 1px;
      background: #e2e8f0;
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Preferences</h1>
    <div class="email">Managing preferences for: ${preferences.email}</div>

    <div id="message" class="message"></div>

    <form id="preferencesForm">
      <div class="section">
        <div class="section-title">Email Types</div>

        <div class="option">
          <input type="checkbox" id="marketing" name="marketing_emails"
                 ${!preferences.marketing_emails ? '' : 'checked'}>
          <label for="marketing">Marketing & Promotional Emails</label>
        </div>

        <div class="option">
          <input type="checkbox" id="sequences" name="all_sequences"
                 ${!preferences.all_sequences ? 'checked' : ''}>
          <label for="sequences">Sales Outreach Sequences</label>
        </div>

        <div class="option">
          <input type="checkbox" id="transactional" name="transactional_emails"
                 ${!preferences.transactional_emails ? '' : 'checked'}>
          <label for="transactional">Important Account Updates</label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Frequency Preferences</div>

        <div class="frequency">
          <input type="number" id="maxEmails" name="max_emails_per_week"
                 placeholder="Max emails per week" min="0" max="50"
                 value="${preferences.max_emails_per_week || ''}">
        </div>
      </div>

      <div class="divider"></div>

      <div class="buttons">
        <button type="submit" class="btn-primary">Save Preferences</button>
        <button type="button" class="btn-danger" id="unsubscribeAll">Unsubscribe from All</button>
      </div>
    </form>
  </div>

  <script>
    const form = document.getElementById('preferencesForm');
    const message = document.getElementById('message');
    const token = '${token}';

    function showMessage(text, type) {
      message.textContent = text;
      message.className = 'message ' + type;
      message.style.display = 'block';

      if (type === 'success') {
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const preferences = {
        token: token,
        marketing_emails: formData.get('marketing_emails') === 'on',
        all_sequences: formData.get('all_sequences') !== 'on',
        transactional_emails: formData.get('transactional_emails') === 'on',
      };

      const maxEmails = formData.get('max_emails_per_week');
      if (maxEmails) {
        preferences.max_emails_per_week = parseInt(maxEmails);
      }

      try {
        const response = await fetch('/api/sequences/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferences)
        });

        if (response.ok) {
          showMessage('Preferences updated successfully!', 'success');
        } else {
          showMessage('Failed to update preferences. Please try again.', 'error');
        }
      } catch (error) {
        showMessage('An error occurred. Please try again.', 'error');
      }
    });

    document.getElementById('unsubscribeAll').addEventListener('click', async () => {
      if (confirm('Are you sure you want to unsubscribe from all emails?')) {
        try {
          const response = await fetch('/api/sequences/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: token,
              all_sequences: true,
              marketing_emails: false,
              transactional_emails: false,
              email_enabled: false
            })
          });

          if (response.ok) {
            showMessage('You have been unsubscribed from all emails.', 'success');
          } else {
            showMessage('Failed to unsubscribe. Please try again.', 'error');
          }
        } catch (error) {
          showMessage('An error occurred. Please try again.', 'error');
        }
      }
    });
  </script>
</body>
</html>
  `;
}

function generateSuccessPage(email: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed Successfully</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }

    .icon {
      width: 80px;
      height: 80px;
      background: #48bb78;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .icon svg {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 3;
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
    }

    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 20px;
    }

    .email {
      font-weight: 500;
      color: #444;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h1>Unsubscribed Successfully</h1>
    <p>
      <span class="email">${email}</span> has been unsubscribed from all email communications.
    </p>
    <p>
      We're sorry to see you go. If you change your mind, you can always re-subscribe
      through your account settings.
    </p>
  </div>
</body>
</html>
  `;
}

function generateErrorPage(message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }

    .icon {
      width: 80px;
      height: 80px;
      background: #f56565;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .icon svg {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 3;
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
    }

    p {
      color: #666;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h1>Unsubscribe Error</h1>
    <p>${message}</p>
    <p>Please contact support if you continue to experience issues.</p>
  </div>
</body>
</html>
  `;
}