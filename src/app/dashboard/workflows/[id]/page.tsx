import { WorkflowBuilder } from '@/components/workflows/workflow-builder';

export default function WorkflowBuilderPage({ params }: { params: { id: string } }) {
    return (
        <div className="h-[calc(100vh-4rem)]">
            <WorkflowBuilder workflowId={params.id} />
        </div>
    );
}
