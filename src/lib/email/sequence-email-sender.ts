/**
 * Email sending service for sequences
 * Uses AWS SES for sending emails with tracking
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

// Initialize SES client
const sesClient = new SESv2Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface SendSequenceEmailParams {
  to: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  enrollmentId: string;
  stepId: string;
  executionId?: string;
}

export interface SendSequenceEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email for a sequence step
 */
export async function sendSequenceEmail(
  params: SendSequenceEmailParams
): Promise<SendSequenceEmailResult> {
  try {
    // Add tracking pixel for opens
    const trackingPixel = generateTrackingPixel(params.enrollmentId, params.executionId);
    const trackedHtml = params.bodyHtml + trackingPixel;

    // Add tracking to links for clicks
    const trackedHtmlWithLinks = addLinkTracking(
      trackedHtml,
      params.enrollmentId,
      params.executionId
    );

    // Prepare the email command
    const command = new SendEmailCommand({
      FromEmailAddress: params.fromName
        ? `"${params.fromName}" <${params.from}>`
        : params.from,
      ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
      Destination: {
        ToAddresses: [params.to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: params.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: trackedHtmlWithLinks,
              Charset: 'UTF-8',
            },
            Text: {
              Data: params.bodyText,
              Charset: 'UTF-8',
            },
          },
        },
      },
      // Add custom headers for tracking
      EmailTags: [
        {
          Name: 'enrollment_id',
          Value: params.enrollmentId,
        },
        {
          Name: 'step_id',
          Value: params.stepId,
        },
      ],
    });

    // Send the email
    const response = await sesClient.send(command);

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error: any) {
    console.error('Error sending sequence email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Generate a tracking pixel for email opens
 */
function generateTrackingPixel(enrollmentId: string, executionId?: string): string {
  if (!executionId) return '';

  const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sequences/track/open?eid=${executionId}&t=${Date.now()}`;

  return `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;
}

/**
 * Add click tracking to links in HTML
 */
function addLinkTracking(html: string, enrollmentId: string, executionId?: string): string {
  if (!executionId) return html;

  // Simple regex to find links (more sophisticated parsing might be needed)
  const linkRegex = /<a\s+([^>]*href=["']([^"']+)["'][^>]*)>/gi;

  return html.replace(linkRegex, (match, attributes, url) => {
    // Skip if already tracked or if it's an unsubscribe link
    if (url.includes('/api/sequences/track/') || url.includes('unsubscribe')) {
      return match;
    }

    // Create tracking URL
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sequences/track/click?eid=${executionId}&url=${encodeURIComponent(url)}&t=${Date.now()}`;

    // Replace the original URL with tracking URL
    return match.replace(url, trackingUrl);
  });
}

/**
 * Convert HTML to plain text (basic implementation)
 */
export function htmlToText(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Validate email configuration
 */
export async function validateEmailConfig(): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        isValid: false,
        error: 'AWS credentials not configured',
      };
    }

    // You could add a test email send here to verify SES is working
    // For now, just return success if credentials exist
    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || 'Email configuration validation failed',
    };
  }
}

/**
 * Get email sending limits and quota
 */
export async function getEmailQuota(): Promise<{
  maxSendRate: number;
  max24HourSend: number;
  sentLast24Hours: number;
}> {
  // This would typically call SES GetSendQuota API
  // For now, return default values
  return {
    maxSendRate: 14, // emails per second
    max24HourSend: 50000, // daily limit
    sentLast24Hours: 0, // would need to track this
  };
}