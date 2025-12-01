'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    Connection,
    Edge,
    Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WorkflowSidebar } from './workflow-sidebar';
import { PropertiesPanel } from './properties-panel';
import { Button } from '@/components/ui/button';
import { Save, Play, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';

// Custom Nodes (we'll implement these next)
import { EmailNode } from './nodes/email-node';
import { DelayNode } from './nodes/delay-node';
import { ConditionNode } from './nodes/condition-node';
import { TaskNode } from './nodes/task-node';

const nodeTypes = {
    email: EmailNode,
    delay: DelayNode,
    condition: ConditionNode,
    task: TaskNode,
};

interface WorkflowBuilderProps {
    workflowId: string;
}

export function WorkflowBuilder({ workflowId }: WorkflowBuilderProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [workflowName, setWorkflowName] = useState('New Workflow');
    const { toast } = useToast();

    // Load workflow on mount
    useEffect(() => {
        if (workflowId && workflowId !== 'new') {
            loadWorkflow();
        }
    }, [workflowId]);

    const loadWorkflow = async () => {
        try {
            const res = await fetch(`/api/sequences/${workflowId}`);
            if (res.ok) {
                const data = await res.json();
                setWorkflowName(data.name);

                if (data.visual_config) {
                    const { nodes: loadedNodes, edges: loadedEdges } = data.visual_config;
                    setNodes(loadedNodes || []);
                    setEdges(loadedEdges || []);
                }
            }
        } catch (error) {
            console.error('Failed to load workflow', error);
            toast({
                title: 'Error',
                description: 'Failed to load workflow data',
                variant: 'destructive',
            });
        }
    };

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');

            // check if the dropped element is valid
            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: { label: `${type} node` },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes]
    );

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    const handleSave = async () => {
        if (reactFlowInstance) {
            const flow = reactFlowInstance.toObject();

            const payload = {
                name: workflowName,
                description: 'Created via Visual Builder',
                settings: {}, // Default settings
                visual_config: flow,
            };

            try {
                let url = '/api/sequences';
                let method = 'POST';

                if (workflowId && workflowId !== 'new') {
                    url = `/api/sequences/${workflowId}`;
                    method = 'PUT';
                }

                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) throw new Error('Failed to save');

                const savedData = await res.json();

                // If created new, redirect or update ID (for now just toast)
                if (workflowId === 'new') {
                    // Ideally redirect to the new ID
                    window.location.href = `/dashboard/workflows/${savedData.id}`;
                }

                toast({
                    title: 'Workflow Saved',
                    description: 'Your workflow has been saved successfully.',
                });
            } catch (error) {
                toast({
                    title: 'Save Failed',
                    description: 'Unable to save workflow. Please try again.',
                    variant: 'destructive',
                });
            }
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="h-14 border-b bg-white px-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/workflows">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="font-semibold">{workflowName}</h2>
                        <p className="text-xs text-gray-500">Draft</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSave}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                    </Button>
                    <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Activate
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                <WorkflowSidebar />

                <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
                    <ReactFlowProvider>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onInit={setReactFlowInstance}
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onNodeClick={onNodeClick}
                            onPaneClick={onPaneClick}
                            nodeTypes={nodeTypes}
                            fitView
                        >
                            <Controls />
                            <Background />
                        </ReactFlow>
                    </ReactFlowProvider>
                </div>

                {selectedNode && (
                    <PropertiesPanel
                        node={selectedNode}
                        onChange={(updatedData) => {
                            setNodes((nds) =>
                                nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updatedData } } : n))
                            );
                        }}
                    />
                )}
            </div>
        </div>
    );
}
