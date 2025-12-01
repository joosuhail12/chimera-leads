import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const sequenceSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    steps: z.array(z.any()), // We'll validate steps more strictly if needed
    settings: z.object({
        exitOnReply: z.boolean(),
        exitOnMeeting: z.boolean(),
        skipWeekends: z.boolean(),
        dailyLimit: z.number(),
        throttle: z.object({
            enabled: z.boolean(),
            maxPerHour: z.number(),
        }).optional(),
    }),
    targeting: z.object({
        lists: z.array(z.string()),
        tags: z.array(z.string()),
    }).optional(),
});

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get organization_id (assuming it's in metadata or we fetch it)
        // For now, we'll assume the user has access to their org's data
        // In a real app, we'd check the user's org context

        const { data: sequences, error } = await supabase
            .from('sequence_templates')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(sequences);
    } catch (error) {
        console.error('Error fetching sequences:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const json = await req.json();
        const body = sequenceSchema.parse(json);

        // Get organization_id from user metadata or context
        // This is a placeholder - you should get the real org ID
        const organization_id = user.user_metadata.organization_id || 'default-org';

        // 1. Create Sequence Template
        const { data: sequence, error: seqError } = await supabase
            .from('sequence_templates')
            .insert({
                organization_id,
                name: body.name,
                description: body.description,
                settings: body.settings,
                created_by: user.id,
                last_modified_by: user.id,
            })
            .select()
            .single();

        if (seqError) throw seqError;

        // 2. Create Sequence Steps
        if (body.steps && body.steps.length > 0) {
            const stepsToInsert = body.steps.map((step: any, index: number) => ({
                template_id: sequence.id,
                step_number: index + 1,
                step_type: step.type,
                wait_days: step.delay?.unit === 'days' ? step.delay.value : 0,
                wait_hours: step.delay?.unit === 'hours' ? step.delay.value : 0,
                email_subject: step.content?.subject,
                email_body: step.content?.body,
                task_title: step.name,
                task_description: step.content?.taskDescription,
                conditions: step.conditions,
            }));

            const { error: stepsError } = await supabase
                .from('sequence_steps')
                .insert(stepsToInsert);

            if (stepsError) throw stepsError;
        }

        return NextResponse.json(sequence);
    } catch (error) {
        console.error('Error creating sequence:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
