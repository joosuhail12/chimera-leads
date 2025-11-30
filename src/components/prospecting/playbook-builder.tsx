'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  Connection,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Search,
  Database,
  Target,
  Filter,
  Users,
  Clock,
  Webhook,
  GitBranch,
  Bell,
  Play,
  Save,
  Download,
  Upload,
  Settings,
  Plus,
  X,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { StepType, PlaybookStep } from '@/lib/types/playbook';

// Custom node types for different step types
const nodeTypes = {
  search: SearchNode,
  enrich: EnrichNode,
  score: ScoreNode,
  filter: FilterNode,
  sequence: SequenceNode,
  wait: WaitNode,
  webhook: WebhookNode,
  condition: ConditionNode,
  notify: NotifyNode,
};

// Node color schemes
const nodeColors: Record<string, string> = {
  search: 'bg-blue-50 border-blue-300',
  enrich: 'bg-purple-50 border-purple-300',
  score: 'bg-yellow-50 border-yellow-300',
  filter: 'bg-green-50 border-green-300',
  sequence: 'bg-indigo-50 border-indigo-300',
  wait: 'bg-gray-50 border-gray-300',
  webhook: 'bg-orange-50 border-orange-300',
  condition: 'bg-pink-50 border-pink-300',
  notify: 'bg-cyan-50 border-cyan-300',
};

// Base node component
function BaseNode({ data, type, icon, children }: any) {
  return (
    <div className={`px-4 py-3 rounded-lg border-2 min-w-[200px] ${nodeColors[type]}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-medium">{data.label}</span>
      </div>
      {children}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// Custom node components
function SearchNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="search" icon={<Search className="h-4 w-4 text-blue-600" />}>
      <div className="text-xs text-gray-600">
        <div>Type: {data.config?.searchType || 'people'}</div>
        <div>Limit: {data.config?.limit || 25}</div>
      </div>
    </BaseNode>
  );
}

function EnrichNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="enrich" icon={<Database className="h-4 w-4 text-purple-600" />}>
      <div className="text-xs text-gray-600">
        <div>Type: {data.config?.enrichType || 'person'}</div>
        <div>Cache: {data.config?.useCache ? 'Yes' : 'No'}</div>
      </div>
    </BaseNode>
  );
}

function ScoreNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="score" icon={<Target className="h-4 w-4 text-yellow-600" />}>
      <div className="text-xs text-gray-600">
        <div>Model: {data.config?.model || 'default'}</div>
        <div>Insights: {data.config?.includeInsights ? 'Yes' : 'No'}</div>
      </div>
    </BaseNode>
  );
}

function FilterNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="filter" icon={<Filter className="h-4 w-4 text-green-600" />}>
      <div className="text-xs text-gray-600">
        <div>Filters: {data.config?.filters?.length || 0}</div>
        <div>Operator: {data.config?.operator || 'AND'}</div>
      </div>
    </BaseNode>
  );
}

function SequenceNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="sequence" icon={<Users className="h-4 w-4 text-indigo-600" />}>
      <div className="text-xs text-gray-600">
        <div>Sequence: {data.config?.sequenceName || 'Not set'}</div>
        <div>Skip Dupes: {data.config?.skipDuplicates ? 'Yes' : 'No'}</div>
      </div>
    </BaseNode>
  );
}

function WaitNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="wait" icon={<Clock className="h-4 w-4 text-gray-600" />}>
      <div className="text-xs text-gray-600">
        <div>Duration: {data.config?.duration || '1 hour'}</div>
        <div>Skip Weekends: {data.config?.skipWeekends ? 'Yes' : 'No'}</div>
      </div>
    </BaseNode>
  );
}

function WebhookNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="webhook" icon={<Webhook className="h-4 w-4 text-orange-600" />}>
      <div className="text-xs text-gray-600">
        <div>Method: {data.config?.method || 'POST'}</div>
        <div>URL: {data.config?.url ? 'Configured' : 'Not set'}</div>
      </div>
    </BaseNode>
  );
}

function ConditionNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="condition" icon={<GitBranch className="h-4 w-4 text-pink-600" />}>
      <div className="text-xs text-gray-600">
        <div>Conditions: {data.config?.conditions?.length || 0}</div>
        <div>Operator: {data.config?.operator || 'AND'}</div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '25%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '75%' }}
      />
    </BaseNode>
  );
}

function NotifyNode({ data }: NodeProps) {
  return (
    <BaseNode data={data} type="notify" icon={<Bell className="h-4 w-4 text-cyan-600" />}>
      <div className="text-xs text-gray-600">
        <div>Channels: {data.config?.channels?.join(', ') || 'email'}</div>
        <div>Recipients: {data.config?.recipients?.length || 0}</div>
      </div>
    </BaseNode>
  );
}

// Step palette configuration
const stepPalette = [
  { type: 'search', label: 'Search', icon: Search, description: 'Search for people or companies' },
  { type: 'enrich', label: 'Enrich', icon: Database, description: 'Enrich contact or company data' },
  { type: 'score', label: 'Score', icon: Target, description: 'Calculate lead scores' },
  { type: 'filter', label: 'Filter', icon: Filter, description: 'Filter results by criteria' },
  { type: 'sequence', label: 'Sequence', icon: Users, description: 'Add to email sequence' },
  { type: 'wait', label: 'Wait', icon: Clock, description: 'Delay execution' },
  { type: 'webhook', label: 'Webhook', icon: Webhook, description: 'Call external API' },
  { type: 'condition', label: 'Condition', icon: GitBranch, description: 'Branch on conditions' },
  { type: 'notify', label: 'Notify', icon: Bell, description: 'Send notifications' },
];

interface PlaybookBuilderProps {
  initialPlaybook?: any;
  onSave?: (playbook: any) => void;
}

export function PlaybookBuilder({ initialPlaybook, onSave }: PlaybookBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialPlaybook?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialPlaybook?.edges || []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [playbookName, setPlaybookName] = useState(initialPlaybook?.name || 'New Playbook');
  const [playbookDescription, setPlaybookDescription] = useState(initialPlaybook?.description || '');
  const { toast } = useToast();

  // Handle node selection
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
  }, []);

  // Handle connection creation
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    }, eds));
  }, [setEdges]);

  // Add new node from palette
  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position: {
        x: Math.random() * 500,
        y: Math.random() * 300,
      },
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
        config: {},
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // Update node configuration
  const updateNodeConfig = (nodeId: string, config: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config } }
          : node
      )
    );
  };

  // Delete selected node
  const deleteNode = () => {
    if (!selectedNode) return;

    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    setShowNodeConfig(false);
  };

  // Save playbook
  const savePlaybook = () => {
    const playbook = {
      name: playbookName,
      description: playbookDescription,
      nodes,
      edges,
      steps: convertNodesToSteps(nodes, edges),
    };

    if (onSave) {
      onSave(playbook);
    }

    toast({
      title: 'Playbook Saved',
      description: `${playbookName} has been saved successfully.`,
    });
  };

  // Convert visual nodes to playbook steps
  const convertNodesToSteps = (nodes: Node[], edges: Edge[]): PlaybookStep[] => {
    return nodes.map(node => ({
      id: node.id,
      name: node.data.label,
      type: node.type as StepType,
      config: node.data.config,
      nextSteps: edges
        .filter(e => e.source === node.id)
        .map(e => ({ stepId: e.target })),
      errorHandling: {
        strategy: 'continue',
      },
    }));
  };

  // Export playbook as JSON
  const exportPlaybook = () => {
    const playbook = {
      name: playbookName,
      description: playbookDescription,
      nodes,
      edges,
    };

    const blob = new Blob([JSON.stringify(playbook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playbookName.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
  };

  // Import playbook from JSON
  const importPlaybook = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const playbook = JSON.parse(e.target?.result as string);
        setPlaybookName(playbook.name || 'Imported Playbook');
        setPlaybookDescription(playbook.description || '');
        setNodes(playbook.nodes || []);
        setEdges(playbook.edges || []);

        toast({
          title: 'Playbook Imported',
          description: 'Successfully imported playbook configuration.',
        });
      } catch (error) {
        toast({
          title: 'Import Failed',
          description: 'Invalid playbook file format.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-[800px] w-full">
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-xl">
              <Input
                value={playbookName}
                onChange={(e) => setPlaybookName(e.target.value)}
                className="text-lg font-semibold mb-2"
                placeholder="Playbook Name"
              />
              <Textarea
                value={playbookDescription}
                onChange={(e) => setPlaybookDescription(e.target.value)}
                className="text-sm"
                placeholder="Playbook Description"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportPlaybook}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" asChild>
                <label>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={importPlaybook}
                  />
                </label>
              </Button>
              <Button size="sm" onClick={savePlaybook}>
                <Save className="h-4 w-4 mr-2" />
                Save Playbook
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-140px)] p-0">
          <div className="flex h-full">
            {/* Step Palette */}
            <div className="w-64 border-r p-4 overflow-y-auto">
              <h3 className="font-medium mb-3">Step Types</h3>
              <div className="space-y-2">
                {stepPalette.map((step) => {
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.type}
                      onClick={() => addNode(step.type)}
                      className="w-full p-3 text-left rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{step.label}</span>
                      </div>
                      <p className="text-xs text-gray-600">{step.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flow Canvas */}
            <div className="flex-1">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background variant="dots" gap={12} size={1} />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node Configuration Sheet */}
      <Sheet open={showNodeConfig} onOpenChange={setShowNodeConfig}>
        <SheetContent className="w-[400px]">
          {selectedNode && (
            <>
              <SheetHeader>
                <SheetTitle>Configure Step</SheetTitle>
                <SheetDescription>
                  Configure the settings for this workflow step
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-6">
                <div>
                  <Label>Step Name</Label>
                  <Input
                    value={selectedNode.data.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, label: newLabel } }
                            : n
                        )
                      );
                    }}
                  />
                </div>

                {/* Type-specific configuration */}
                {selectedNode.type === 'search' && (
                  <>
                    <div>
                      <Label>Search Type</Label>
                      <Select
                        value={selectedNode.data.config?.searchType || 'people'}
                        onValueChange={(value) =>
                          updateNodeConfig(selectedNode.id, {
                            ...selectedNode.data.config,
                            searchType: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="people">People</SelectItem>
                          <SelectItem value="companies">Companies</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Result Limit</Label>
                      <Input
                        type="number"
                        value={selectedNode.data.config?.limit || 25}
                        onChange={(e) =>
                          updateNodeConfig(selectedNode.id, {
                            ...selectedNode.data.config,
                            limit: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                  </>
                )}

                {selectedNode.type === 'wait' && (
                  <>
                    <div>
                      <Label>Duration</Label>
                      <Input
                        value={selectedNode.data.config?.duration || '1 hour'}
                        onChange={(e) =>
                          updateNodeConfig(selectedNode.id, {
                            ...selectedNode.data.config,
                            duration: e.target.value,
                          })
                        }
                        placeholder="e.g., 2 hours, 1 day"
                      />
                    </div>
                  </>
                )}

                {/* Add more type-specific configurations as needed */}

                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteNode}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Delete Step
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}