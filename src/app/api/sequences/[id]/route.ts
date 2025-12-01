import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { convertGraphToSequence } from '@/lib/workflows/converter';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: sequence, error } = await supabase
            .from('sequence_templates')
            .select(`
        *,
        steps:sequence_steps(*),
        branches:sequence_branches(*)
      `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return NextResponse.json(sequence);
    } catch (error) {
        console.error('Error fetching sequence:', error);
        return NextResponse.json({ error: 'Failed to fetch sequence' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name, description, settings, visual_config } = body;

        // 1. Update Sequence Template
        const { error: seqError } = await supabase
            .from('sequence_templates')
            .update({
                name,
                description,
                settings,
                visual_config, // Save the React Flow graph
                last_modified_by: user.id,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (seqError) throw seqError;

        // 2. Convert Graph to Steps & Branches
        // If visual_config is provided, we use it to regenerate steps
        if (visual_config && visual_config.nodes && visual_config.edges) {
            const { steps, branches } = convertGraphToSequence(
                id,
                visual_config.nodes,
                visual_config.edges
            );

            // Transaction-like update: Delete old steps/branches and insert new ones
            // Note: Deleting steps cascades to branches usually, but let's be safe.

            // Delete existing steps (cascades to branches)
            await supabase.from('sequence_steps').delete().eq('template_id', id);

            // Insert new steps
            // We need to insert steps first to get IDs, then insert branches

            const nodeIdToStepId = new Map<string, string>();

            for (const step of steps) {
                // @ts-ignore
                const nodeId = step._nodeId;
                // Remove temporary field
                // @ts-ignore
                delete step._nodeId;

                const { data: insertedStep, error: stepError } = await supabase
                    .from('sequence_steps')
                    .insert(step)
                    .select()
                    .single();

                if (stepError) throw stepError;
                if (insertedStep) {
                    nodeIdToStepId.set(nodeId, insertedStep.id);
                }
            }

            // Insert branches
            const branchesToInsert = branches.map(branch => {
                // @ts-ignore
                const parentNodeId = branch._parentNodeId;
                // @ts-ignore
                const targetNodeId = branch._targetNodeId;

                return {
                    sequence_template_id: branch.sequence_template_id,
                    parent_step_id: nodeIdToStepId.get(parentNodeId),
                    next_step_id: nodeIdToStepId.get(targetNodeId),
                    branch_name: branch.branch_name,
                    condition_type: branch.condition_type,
                    condition_config: branch.condition_config,
                    priority: branch.priority,
                };
            }).filter(b => b.parent_step_id && b.next_step_id); // Ensure valid links

            if (branchesToInsert.length > 0) {
                const { error: branchError } = await supabase
                    .from('sequence_branches')
                    .insert(branchesToInsert);

                if (branchError) throw branchError;
            }
        }

        // Fetch updated sequence
        const { data: updatedSequence } = await supabase
            .from('sequence_templates')
            .select(`
        *,
        steps:sequence_steps(*),
        branches:sequence_branches(*)
      `)
            .eq('id', id)
            .single();

        return NextResponse.json(updatedSequence);
    } catch (error) {
        console.error('Error updating sequence:', error);
        return NextResponse.json({ error: 'Failed to update sequence' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { error } = await supabase
            .from('sequence_templates')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting sequence:', error);
        return NextResponse.json({ error: 'Failed to delete sequence' }, { status: 500 });
    }
}
