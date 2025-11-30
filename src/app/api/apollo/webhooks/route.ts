import { NextRequest, NextResponse } from 'next/server';
import { ApolloService } from '@/lib/services/apollo';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Webhook signature verification
function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-apollo-signature');
    const webhookSecret = process.env.APOLLO_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Parse webhook event
    const event = JSON.parse(rawBody);

    // Validate required fields
    if (!event.id || !event.type || !event.data) {
      return NextResponse.json(
        { error: 'Invalid webhook format' },
        { status: 400 }
      );
    }

    // Determine organization from event data
    // This might need adjustment based on Apollo's webhook structure
    let orgId = event.organization_id || event.data.organization_id;

    // If no org ID in event, try to look it up based on the data
    if (!orgId && event.data.email) {
      const supabase = await createClient();
      const { data: lead } = await supabase
        .from('sales_leads')
        .select('organization_id')
        .eq('email', event.data.email)
        .single();

      if (lead) {
        orgId = lead.organization_id;
      }
    }

    if (!orgId) {
      console.warn('Webhook received without organization context:', event.id);
      // Still process but without org context
      orgId = 'unknown';
    }

    // Process webhook through Apollo service
    const apolloService = new ApolloService(undefined, orgId);
    await apolloService.handleWebhook({
      id: event.id,
      type: event.type,
      data: event.data,
      signature: signature || undefined,
    });

    // Log webhook receipt
    console.log(`Apollo webhook processed: ${event.type} - ${event.id}`);

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      eventId: event.id,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);

    if (error instanceof Error) {
      // Don't expose internal errors in webhook responses
      console.error('Webhook error details:', error.message);
    }

    // Return success to avoid webhook retries for processing errors
    // Log the error internally for debugging
    return NextResponse.json({
      success: false,
      message: 'Webhook received but processing failed',
    });
  }
}

// GET endpoint to check webhook processing status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('webhook_id');
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (webhookId) {
      // Get specific webhook
      const { data, error } = await supabase
        .from('apollo_webhooks')
        .select('*')
        .eq('webhook_id', webhookId)
        .eq('organization_id', orgId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        webhook: data,
      });
    } else {
      // Get recent webhooks
      const { data, error } = await supabase
        .from('apollo_webhooks')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        webhooks: data,
        total: data.length,
      });
    }
  } catch (error) {
    console.error('Webhook status error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve webhook status' },
      { status: 500 }
    );
  }
}