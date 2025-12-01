import { Node, Edge } from 'reactflow';

interface SequenceStep {
    id?: string;
    template_id: string;
    step_number: number;
    step_type: string;
    wait_days: number;
    wait_hours: number;
    email_subject?: string;
    email_body?: string;
    task_title?: string;
    task_description?: string;
    conditions?: any;
    next_step_id?: string; // Optional, for direct linking
}

interface SequenceBranch {
    sequence_template_id: string;
    parent_step_id?: string; // Will be filled after step creation
    branch_name: string;
    condition_type: string;
    condition_config: any;
    next_step_id?: string; // Will be filled after step creation
    priority: number;
}

export function convertGraphToSequence(
    templateId: string,
    nodes: Node[],
    edges: Edge[]
): { steps: SequenceStep[]; branches: SequenceBranch[] } {
    const steps: SequenceStep[] = [];
    const branches: SequenceBranch[] = [];

    // Map node IDs to step indices for easier reference
    const nodeToStepIndex = new Map<string, number>();

    // 1. Identify "Step" nodes (Email, Task) vs "Logic" nodes (Delay, Condition)
    // We need to flatten Delay nodes into the *next* step's wait time?
    // Or keep them as separate steps?
    // The schema has `wait_days` on the step. This implies "Wait X days BEFORE executing this step".
    // So if we have Start -> Delay -> Email, the Email step has the wait.
    // If we have Start -> Email -> Delay -> Task, the Task step has the wait.

    // Let's traverse from the root(s).
    // Find nodes with no incoming edges (or specific Start node if we had one).
    // For now, assume any node with no incoming edges is a start node.

    const incomingEdges = new Map<string, Edge[]>();
    edges.forEach(edge => {
        if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, []);
        incomingEdges.get(edge.target)?.push(edge);
    });

    // Sort nodes to ensure deterministic order (e.g. by y position)
    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

    // We need to generate UUIDs for steps beforehand to link them?
    // Or we can use the Node ID as a temporary ID and let the DB/API handle UUIDs.
    // The API route will likely generate UUIDs or let Supabase do it.
    // If we let Supabase do it, we can't link them easily in one go without returning IDs.
    // Best approach: Generate UUIDs here or in the API route.
    // Let's assume the API route will handle UUID generation or we use the Node ID if it's a valid UUID (it's not).

    // Let's just return the logical structure and let the API route handle ID mapping.
    // We'll use Node ID as the reference.

    // Helper to find the "effective" next step and accumulated delay
    // Returns: { targetNodeId, waitDays, waitHours }
    function findNextStep(startNodeId: string): { targetNodeId: string | null; waitDays: number; waitHours: number } {
        let currentNodeId = startNodeId;
        let totalDays = 0;
        let totalHours = 0;

        // Traverse through Delay nodes
        while (true) {
            const outEdges = edges.filter(e => e.source === currentNodeId);
            if (outEdges.length === 0) return { targetNodeId: null, waitDays: totalDays, waitHours: totalHours };

            // Assume single path for Delay nodes
            const nextNodeId = outEdges[0].target;
            const nextNode = nodes.find(n => n.id === nextNodeId);

            if (!nextNode) return { targetNodeId: null, waitDays: totalDays, waitHours: totalHours };

            if (nextNode.type === 'delay') {
                const duration = nextNode.data.duration || 0;
                const unit = nextNode.data.unit || 'days';
                if (unit === 'days') totalDays += duration;
                if (unit === 'hours') totalHours += duration;
                currentNodeId = nextNodeId;
            } else {
                // Found a non-delay node (Email, Task, Condition)
                return { targetNodeId: nextNodeId, waitDays: totalDays, waitHours: totalHours };
            }
        }
    }

    let stepCounter = 1;

    // Process each node that represents a Step (Email, Task)
    // Condition nodes are also "steps" in a way, or they are just branching logic attached to the previous step?
    // The `sequence_branches` table links `parent_step_id` to `next_step_id`.
    // So a Condition node effectively creates branches on the *previous* step?
    // OR, the Condition node IS a step that does nothing but evaluate?
    // The worker supports `type: 'condition'`?
    // `SequenceJob` interface has `type: 'email' | 'task' | 'wait' | 'condition'`.
    // So Condition can be a step.

    for (const node of sortedNodes) {
        if (node.type === 'delay') continue; // Delays are absorbed into next steps

        // Determine wait time from incoming edges (if any)
        // This is tricky because multiple parents might have different delays.
        // But typically in a sequence, a step has one primary parent or we merge paths.
        // For simplicity, we'll look at the *immediate* incoming edge.
        // If the previous node was a Delay, we absorbed it.
        // Wait, the `findNextStep` logic above was "forward looking".
        // But here we are iterating nodes.

        // Better approach:
        // 1. Create Step objects for all non-Delay nodes.
        // 2. Link them using Edges, absorbing Delays.

        const step: SequenceStep = {
            template_id: templateId,
            step_number: stepCounter++,
            step_type: node.type || 'email',
            wait_days: 0,
            wait_hours: 0,
            // Map node data to step fields
            email_subject: node.data.subject,
            email_body: node.data.body,
            task_title: node.data.label, // Use label as title for now
            task_description: node.data.taskDescription,
            conditions: {}, // For legacy or specific condition config
            // We'll use a temporary field to store the Node ID for linking
            // @ts-ignore
            _nodeId: node.id
        };

        steps.push(step);
    }

    // Now process edges to create Branches (and calculate delays)
    // We need to look at the graph connections.

    for (const step of steps) {
        // @ts-ignore
        const nodeId = step._nodeId;

        // Find incoming edges to this node to calculate delay (if previous was Delay)
        // Actually, delay is "Wait before executing THIS step".
        // So we check the path *to* this node.
        // If the path comes from a Delay node, we add that delay.
        // But we need to find the "real" parent (non-Delay).

        // Let's look backwards from this node.
        const inEdges = edges.filter(e => e.target === nodeId);
        if (inEdges.length > 0) {
            // Check the source of the first edge
            let sourceId = inEdges[0].source;
            let sourceNode = nodes.find(n => n.id === sourceId);

            // Backtrack through delays
            while (sourceNode && sourceNode.type === 'delay') {
                const duration = sourceNode.data.duration || 0;
                const unit = sourceNode.data.unit || 'days';
                if (unit === 'days') step.wait_days += duration;
                if (unit === 'hours') step.wait_hours += duration;

                // Go further back
                const prevEdges = edges.filter(e => e.target === sourceId);
                if (prevEdges.length === 0) break;
                sourceId = prevEdges[0].source;
                sourceNode = nodes.find(n => n.id === sourceId);
            }
        }

        // Now process outgoing edges to create Branches
        const outEdges = edges.filter(e => e.source === nodeId);

        // If this is a Condition node, outgoing edges define branches
        if (step.step_type === 'condition') {
            const conditionType = nodes.find(n => n.id === nodeId)?.data.conditionType || 'opened';

            outEdges.forEach((edge, index) => {
                // "yes" handle -> match condition
                // "no" handle -> default/fallback

                // Find the target step (skipping delays)
                const { targetNodeId, waitDays, waitHours } = findNextStep(edge.target);
                if (!targetNodeId) return;

                // We need to pass the delay to the *target* step?
                // We already calculated delay on the target step by looking backwards.
                // So we just need to link the IDs.

                const branch: SequenceBranch = {
                    sequence_template_id: templateId,
                    // @ts-ignore
                    _parentNodeId: nodeId,
                    // @ts-ignore
                    _targetNodeId: targetNodeId,
                    branch_name: edge.sourceHandle === 'yes' ? 'Condition Met' : 'Condition Not Met',
                    condition_type: edge.sourceHandle === 'yes' ? getDbConditionType(conditionType) : 'default',
                    condition_config: edge.sourceHandle === 'yes' ? getDbConditionConfig(conditionType) : {},
                    priority: edge.sourceHandle === 'yes' ? 10 : 100, // Yes has higher priority
                };
                branches.push(branch);
            });
        } else {
            // Normal node (Email/Task) -> Default branch to next step
            if (outEdges.length > 0) {
                const { targetNodeId } = findNextStep(outEdges[0].target);
                if (targetNodeId) {
                    const branch: SequenceBranch = {
                        sequence_template_id: templateId,
                        // @ts-ignore
                        _parentNodeId: nodeId,
                        // @ts-ignore
                        _targetNodeId: targetNodeId,
                        branch_name: 'Next Step',
                        condition_type: 'default',
                        condition_config: {},
                        priority: 100,
                    };
                    branches.push(branch);
                }
            }
        }
    }

    return { steps, branches };
}

function getDbConditionType(uiType: string): string {
    switch (uiType) {
        case 'opened': return 'engagement';
        case 'clicked': return 'engagement';
        case 'replied': return 'engagement';
        default: return 'default';
    }
}

function getDbConditionConfig(uiType: string): any {
    switch (uiType) {
        case 'opened': return { opened_last_email: true };
        case 'clicked': return { clicked_link: true };
        case 'replied': return { replied: true }; // Assuming replied tracking
        default: return {};
    }
}
