/**
 * Behavioral Events API
 * Ingests and processes behavioral events to trigger sequence actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { BehavioralTriggersService } from '@/lib/services/behavioral-triggers';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

const TrackEventSchema = z.object({
  event_type: z.string(),
  event_data: z.record(z.any()),
  lead_id: z.string().uuid().optional(),
  contact_email: z.string().email().optional(),
  session_id: z.string().optional(),
  source: z.string().optional(),
});

const BatchTrackSchema = z.object({
  events: z.array(TrackEventSchema),
});

// ============================================
// GET - Get behavioral events for a lead
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('lead_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!leadId) {
      return NextResponse.json(
        { error: 'lead_id parameter is required' },
        { status: 400 }
      );
    }

    const events = await BehavioralTriggersService.getLeadEvents(leadId, limit);

    return NextResponse.json({
      events,
      count: events.length,
    });

  } catch (error) {
    console.error('Error fetching behavioral events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Track behavioral event(s)
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get organization ID from headers or session
    const orgId = request.headers.get('x-organization-id');
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 401 }
      );
    }

    // Check if batch or single event
    const isBatch = Array.isArray(body.events);

    if (isBatch) {
      // Batch tracking
      const validated = BatchTrackSchema.parse(body);
      const results = [];

      for (const event of validated.events) {
        try {
          const eventId = await BehavioralTriggersService.trackEvent(
            event,
            orgId
          );
          results.push({ success: true, event_id: eventId });
        } catch (error: any) {
          results.push({ success: false, error: error.message });
        }
      }

      return NextResponse.json({
        tracked: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      });

    } else {
      // Single event tracking
      const validated = TrackEventSchema.parse(body);

      // Add additional context
      const enrichedEvent = {
        ...validated,
        source: validated.source || 'api',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
      };

      const eventId = await BehavioralTriggersService.trackEvent(
        enrichedEvent,
        orgId
      );

      return NextResponse.json({
        success: true,
        event_id: eventId,
      });
    }

  } catch (error) {
    console.error('Error tracking behavioral event:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

// ============================================
// Specialized tracking endpoints
// ============================================

/**
 * Track page visit event
 */
export async function trackPageVisit(
  url: string,
  duration: number,
  leadId?: string,
  sessionId?: string,
  orgId?: string
) {
  return BehavioralTriggersService.trackEvent(
    {
      event_type: 'page_visit',
      event_data: {
        url,
        duration_seconds: duration,
        timestamp: new Date().toISOString(),
      },
      lead_id: leadId,
      session_id: sessionId,
      source: 'website',
    },
    orgId!
  );
}

/**
 * Track email engagement event
 */
export async function trackEmailEngagement(
  type: 'open' | 'click' | 'reply',
  emailId: string,
  leadId: string,
  linkUrl?: string,
  orgId?: string
) {
  const eventData: any = {
    email_id: emailId,
    timestamp: new Date().toISOString(),
  };

  if (type === 'click' && linkUrl) {
    eventData.link_url = linkUrl;
  }

  return BehavioralTriggersService.trackEvent(
    {
      event_type: `email_${type}`,
      event_data: eventData,
      lead_id: leadId,
      source: 'email',
    },
    orgId!
  );
}

/**
 * Track form submission event
 */
export async function trackFormSubmission(
  formId: string,
  formData: Record<string, any>,
  leadId?: string,
  email?: string,
  orgId?: string
) {
  return BehavioralTriggersService.trackEvent(
    {
      event_type: 'form_submission',
      event_data: {
        form_id: formId,
        form_data: formData,
        timestamp: new Date().toISOString(),
      },
      lead_id: leadId,
      contact_email: email,
      source: 'website',
    },
    orgId!
  );
}

/**
 * Track LinkedIn engagement event
 */
export async function trackLinkedInEngagement(
  action: 'profile_view' | 'connection_accepted' | 'message_sent',
  leadId: string,
  profileUrl?: string,
  orgId?: string
) {
  return BehavioralTriggersService.trackEvent(
    {
      event_type: `linkedin_${action}`,
      event_data: {
        profile_url: profileUrl,
        timestamp: new Date().toISOString(),
      },
      lead_id: leadId,
      source: 'linkedin',
    },
    orgId!
  );
}

/**
 * Track document/video engagement
 */
export async function trackContentEngagement(
  type: 'document' | 'video',
  contentId: string,
  engagementData: {
    duration?: number;
    completion_percentage?: number;
    pages_viewed?: number;
  },
  leadId: string,
  orgId?: string
) {
  return BehavioralTriggersService.trackEvent(
    {
      event_type: `${type}_${(engagementData.completion_percentage ?? 0) >= 80 ? 'watched' : 'viewed'}`,
      event_data: {
        content_id: contentId,
        ...engagementData,
        timestamp: new Date().toISOString(),
      },
      lead_id: leadId,
      source: 'content',
    },
    orgId!
  );
}