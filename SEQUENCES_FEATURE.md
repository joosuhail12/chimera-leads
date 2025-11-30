# Prospecting Sequences Feature

## Overview

The Prospecting Sequences feature enables automated multi-touch email outreach campaigns with intelligent scheduling, personalization, and tracking. This feature is designed for B2B sales teams to nurture leads through automated sequences while maintaining a personal touch.

## Key Features

### 1. Sequence Templates
- **Reusable Workflows**: Create templates once, use multiple times
- **Categories**: Cold outreach, nurture, follow-up, win-back, custom
- **Settings**: Configure pause conditions, daily limits, time windows, timezone
- **Performance Metrics**: Track open rates, reply rates, completion rates

### 2. Step Types
- **Email Steps**: HTML emails with variable personalization
- **Wait Steps**: Delays between actions (days/hours)
- **Task Steps**: Create CRM tasks for manual actions
- **Conditional Steps**: Branch based on lead behavior
- **Webhook Steps**: Integrate with external systems

### 3. Smart Automation
- **Pause on Reply**: Automatically pause when lead responds
- **Pause on Meeting**: Stop sequence when meeting is booked
- **Skip Weekends**: Only send on business days
- **Daily Limits**: Control sending volume
- **Time Windows**: Send during optimal hours

### 4. Email Tracking
- **Open Tracking**: Pixel-based open detection
- **Click Tracking**: Track which links are clicked
- **Reply Detection**: Monitor for responses
- **Bounce Handling**: Automatic bounce management

## Database Schema

### Core Tables

1. **sequence_templates**: Template definitions
   - organization_id (TEXT): Multi-tenancy
   - name, description, category
   - settings (JSONB): Configuration options
   - Performance metrics

2. **sequence_steps**: Individual workflow steps
   - Step types and configuration
   - Email content and timing
   - Conditional logic

3. **sequence_enrollments**: Lead enrollment tracking
   - Status management (active, paused, completed)
   - Progress tracking
   - Performance metrics per enrollment

4. **sequence_step_executions**: Execution history
   - Success/failure tracking
   - Email provider details
   - Retry management

5. **sequence_email_events**: Email engagement tracking
   - Opens, clicks, replies, bounces
   - Geographic and device data

## API Endpoints

### Templates
- `GET /api/sequences/templates` - List all templates
- `POST /api/sequences/templates` - Create template
- `GET /api/sequences/templates/:id` - Get single template
- `PUT /api/sequences/templates/:id` - Update template
- `DELETE /api/sequences/templates/:id` - Soft delete template

### Steps
- `GET /api/sequences/steps?template_id=` - List steps
- `POST /api/sequences/steps` - Add step
- `PUT /api/sequences/steps/:id` - Update step
- `DELETE /api/sequences/steps/:id` - Delete step

### Enrollments
- `POST /api/sequences/enrollments` - Enroll single lead
- `POST /api/sequences/enrollments/bulk` - Bulk enroll
- `PUT /api/sequences/enrollments/:id/status` - Pause/resume
- `GET /api/sequences/enrollments?lead_id=` - Get lead enrollments

### Execution
- `POST /api/sequences/execute` - Manual execution trigger
- `GET /api/sequences/metrics` - Global metrics

### Tracking
- `GET /api/sequences/track/open?eid=` - Open tracking pixel
- `GET /api/sequences/track/click?eid=&url=` - Click tracking redirect

## UI Components

### Dashboard (`/dashboard/sequences`)
- List all sequence templates
- Global performance metrics
- Quick actions (create, view, edit)

### Sequence Builder (`/dashboard/sequences/builder`)
- Drag-and-drop step creation
- Visual workflow editor
- Step configuration panels
- Variable insertion helpers

### Components
- `SequenceList`: Template listing with stats
- `SequenceBuilder`: Drag-and-drop editor
- `SequenceMetrics`: Performance dashboard
- `EnrollmentModal`: Lead enrollment interface
- `StepEditor`: Step configuration forms

## Variable System

Supported variables in email content:
- `{{first_name}}` - Lead's first name
- `{{last_name}}` - Lead's last name
- `{{company}}` - Company name
- `{{email}}` - Email address
- `{{custom_field_name}}` - Any custom field value

## Setup Instructions

### 1. Database Setup
```bash
# Run migrations (already completed)
npx supabase db push
```

### 2. Environment Variables
Required in `.env.local`:
```
# AWS SES for email sending
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# App URL for tracking links
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 3. Email Configuration
1. Verify sender domain in AWS SES
2. Move out of sandbox for production
3. Configure bounce/complaint handling

### 4. Sequence Execution

#### Option A: Cron Job (Recommended)
Create `/api/cron/sequences/route.ts`:
```typescript
export async function GET() {
  const result = await SequenceExecutor.processScheduledSteps();
  return NextResponse.json(result);
}
```

Set up external cron (Vercel Cron, GitHub Actions, etc.) to call endpoint every 5-15 minutes.

#### Option B: Background Worker
Use a service like Inngest, Temporal, or BullMQ for reliable background processing.

## Usage Guide

### Creating a Sequence Template

1. Navigate to **CRM → Sequences**
2. Click **New Sequence**
3. Configure template:
   - Name and description
   - Category (cold outreach, nurture, etc.)
   - Settings (pause conditions, limits)
4. Add steps using drag-and-drop:
   - Email steps with personalized content
   - Wait steps for timing
   - Task steps for manual follow-up
5. Save template

### Enrolling Leads

1. From Pipeline view:
   - Select leads to enroll
   - Click "Enroll in Sequence"
   - Choose template
   - Set start time

2. From Lead Detail:
   - Click "Actions → Enroll in Sequence"
   - Select template
   - Configure enrollment

### Monitoring Performance

1. **Template Metrics**:
   - Total enrolled
   - Average open/reply rates
   - Completion rates

2. **Enrollment Tracking**:
   - Current step progress
   - Email engagement
   - Pause/resume controls

3. **Email Events**:
   - Real-time tracking
   - Geographic data
   - Device/client info

## Best Practices

### Email Content
- Keep subject lines under 50 characters
- Personalize beyond just {{first_name}}
- A/B test different approaches
- Include clear CTAs

### Timing
- Space emails 3-7 days apart
- Send during business hours (9 AM - 5 PM recipient timezone)
- Avoid Mondays and Fridays for cold outreach
- Use shorter sequences (3-5 emails) for better engagement

### Compliance
- Include unsubscribe links
- Honor opt-outs immediately
- Follow CAN-SPAM/GDPR requirements
- Maintain suppression lists

## Troubleshooting

### Emails Not Sending
1. Check AWS SES configuration
2. Verify sender domain
3. Check daily limits
4. Review execution logs

### Tracking Not Working
1. Verify NEXT_PUBLIC_APP_URL is set
2. Check tracking endpoint accessibility
3. Review browser/email client blocking

### Performance Issues
1. Add database indexes if needed
2. Limit concurrent enrollments
3. Optimize email content size
4. Use batch processing for bulk operations

## Future Enhancements

1. **A/B Testing**: Test different subject lines and content
2. **AI Personalization**: GPT-powered dynamic content
3. **Advanced Analytics**: Cohort analysis, attribution
4. **Multi-channel**: Add SMS, LinkedIn, calls
5. **Smart Scheduling**: ML-based optimal send times
6. **Template Library**: Pre-built industry templates
7. **Team Collaboration**: Shared templates and insights

## Security Considerations

- All queries filter by organization_id for multi-tenancy
- Clerk authentication required for all endpoints
- Email content sanitized to prevent XSS
- Rate limiting on enrollment endpoints
- Tracking pixels use signed tokens

## Support

For issues or questions:
1. Check error logs in Supabase dashboard
2. Review AWS SES metrics
3. Verify Clerk organization settings
4. Contact support with enrollment IDs for debugging