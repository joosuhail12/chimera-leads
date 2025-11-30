/**
 * Seed endpoint to create sample sequence templates
 * GET /api/sequences/seed
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get user's organization
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('organization_id')
      .eq('clerk_user_id', userId)
      .single();

    if (!adminUser?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if we already have templates
    const { data: existing } = await supabase
      .from('sequence_templates')
      .select('id')
      .eq('organization_id', adminUser.organization_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        message: 'Templates already exist',
        skipped: true
      });
    }

    // Create sample templates
    const templates = [
      {
        organization_id: adminUser.organization_id,
        name: 'Cold Outreach - B2B SaaS',
        description: 'Multi-touch sequence for reaching out to B2B SaaS prospects',
        category: 'cold_outreach',
        settings: {
          pauseOnReply: true,
          pauseOnMeeting: true,
          skipWeekends: true,
          dailyLimit: 50,
          timezone: 'America/New_York'
        },
        is_active: true,
        created_by: userId,
        last_modified_by: userId
      },
      {
        organization_id: adminUser.organization_id,
        name: 'Follow-up - Demo Request',
        description: 'Automated follow-up for demo requests',
        category: 'follow_up',
        settings: {
          pauseOnReply: true,
          pauseOnMeeting: true,
          skipWeekends: false,
          dailyLimit: 100,
          timezone: 'America/New_York'
        },
        is_active: true,
        created_by: userId,
        last_modified_by: userId
      },
      {
        organization_id: adminUser.organization_id,
        name: 'Nurture - Trial Users',
        description: 'Educational sequence for trial users',
        category: 'nurture',
        settings: {
          pauseOnReply: false,
          pauseOnMeeting: false,
          skipWeekends: false,
          dailyLimit: 200,
          timezone: 'America/New_York'
        },
        is_active: true,
        created_by: userId,
        last_modified_by: userId
      }
    ];

    const { data: createdTemplates, error: templateError } = await supabase
      .from('sequence_templates')
      .insert(templates)
      .select();

    if (templateError) throw templateError;

    // Add steps to the first template (Cold Outreach)
    if (createdTemplates && createdTemplates[0]) {
      const coldOutreachSteps = [
        {
          template_id: createdTemplates[0].id,
          step_number: 1,
          step_type: 'email',
          wait_days: 0,
          wait_hours: 0,
          email_subject: 'Quick question about {{company}}',
          email_body: `<p>Hi {{first_name}},</p>
<p>I noticed that {{company}} is scaling rapidly. Congrats on the growth!</p>
<p>We help similar B2B SaaS companies automate their sales outreach and increase conversion rates by 40% on average.</p>
<p>Would you be interested in a quick 15-minute call to see if we could help {{company}} as well?</p>
<p>Best regards,<br>Sarah</p>`,
          email_from_name: 'Sarah Johnson'
        },
        {
          template_id: createdTemplates[0].id,
          step_number: 2,
          step_type: 'wait',
          wait_days: 3,
          wait_hours: 0
        },
        {
          template_id: createdTemplates[0].id,
          step_number: 3,
          step_type: 'email',
          wait_days: 0,
          wait_hours: 0,
          email_subject: 'Re: Quick question about {{company}}',
          email_body: `<p>Hi {{first_name}},</p>
<p>Hope you're having a great week! Just wanted to follow up on my previous email.</p>
<p>I understand you're busy, so I'll keep this brief. We recently helped TechCorp increase their qualified leads by 60% in just 2 months.</p>
<p>Here's my calendar link if you'd like to chat: [calendar-link]</p>
<p>No worries if the timing isn't right - just let me know!</p>
<p>Best,<br>Sarah</p>`,
          email_from_name: 'Sarah Johnson'
        },
        {
          template_id: createdTemplates[0].id,
          step_number: 4,
          step_type: 'wait',
          wait_days: 5,
          wait_hours: 0
        },
        {
          template_id: createdTemplates[0].id,
          step_number: 5,
          step_type: 'email',
          wait_days: 0,
          wait_hours: 0,
          email_subject: 'Last check-in',
          email_body: `<p>Hi {{first_name}},</p>
<p>I'll keep this super short - is improving sales outreach a priority for {{company}} right now?</p>
<p>If yes → Let's chat! Here's my calendar: [calendar-link]</p>
<p>If no → No problem! I'd love to stay connected on LinkedIn if you're open to it.</p>
<p>Either way, wishing you and the {{company}} team continued success!</p>
<p>Cheers,<br>Sarah</p>`,
          email_from_name: 'Sarah Johnson'
        }
      ];

      const { error: stepsError } = await supabase
        .from('sequence_steps')
        .insert(coldOutreachSteps);

      if (stepsError) throw stepsError;
    }

    // Add steps to the second template (Demo Follow-up)
    if (createdTemplates && createdTemplates[1]) {
      const demoFollowupSteps = [
        {
          template_id: createdTemplates[1].id,
          step_number: 1,
          step_type: 'email',
          wait_days: 0,
          wait_hours: 1,
          email_subject: 'Thanks for requesting a demo!',
          email_body: `<p>Hi {{first_name}},</p>
<p>Thanks for requesting a demo of our platform! I'm excited to show you how we can help {{company}} streamline your sales process.</p>
<p>I have a few time slots available this week:</p>
<ul>
<li>Tuesday 2-3 PM EST</li>
<li>Wednesday 10-11 AM EST</li>
<li>Thursday 3-4 PM EST</li>
</ul>
<p>You can also book directly on my calendar: [calendar-link]</p>
<p>Looking forward to connecting!</p>
<p>Best,<br>Mike</p>`,
          email_from_name: 'Mike Chen'
        },
        {
          template_id: createdTemplates[1].id,
          step_number: 2,
          step_type: 'wait',
          wait_days: 2,
          wait_hours: 0
        },
        {
          template_id: createdTemplates[1].id,
          step_number: 3,
          step_type: 'task',
          wait_days: 0,
          wait_hours: 0,
          task_title: 'Call {{first_name}} at {{company}}',
          task_description: 'Follow up on demo request - they haven\'t scheduled yet',
          task_priority: 'high',
          task_due_days: 1
        }
      ];

      const { error: stepsError } = await supabase
        .from('sequence_steps')
        .insert(demoFollowupSteps);

      if (stepsError) throw stepsError;
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdTemplates?.length || 0} sample templates`,
      templates: createdTemplates
    });

  } catch (error: any) {
    console.error('Error seeding sequences:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to seed sequences' },
      { status: 500 }
    );
  }
}