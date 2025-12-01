'use client';

import { useState, useRef } from 'react';
import {
  Mail,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Copy,
  Save,
  Play,
  Pause,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Target,
  Zap,
  GitBranch,
  Users,
  Filter,
  BarChart3,
  Edit,
  Eye,
  Send,
  FileText,
  Phone,
  MessageSquare,
  Link,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/components/ui/use-toast';

interface SequenceStep {
  id: string;
  type: 'email' | 'task' | 'call' | 'linkedin' | 'sms' | 'condition';
  name: string;
  delay: {
    value: number;
    unit: 'hours' | 'days' | 'weeks';
  };
  content: {
    subject?: string;
    body?: string;
    template?: string;
    taskDescription?: string;
    message?: string;
  };
  conditions?: {
    type: 'opened' | 'clicked' | 'replied' | 'not_opened' | 'not_clicked' | 'not_replied';
    timeframe?: number;
  };
  branches?: {
    yes: string[]; // Step IDs
    no: string[]; // Step IDs
  };
  settings: {
    sendTime?: string;
    timezone?: 'recipient' | 'sender';
    trackOpens?: boolean;
    trackClicks?: boolean;
    followUpIfNoReply?: boolean;
  };
}

interface Sequence {
  id: string;
  name: string;
  description: string;
  steps: SequenceStep[];
  settings: {
    exitOnReply: boolean;
    exitOnMeeting: boolean;
    skipWeekends: boolean;
    dailyLimit: number;
    throttle: {
      enabled: boolean;
      maxPerHour: number;
    };
  };
  targeting: {
    lists: string[];
    tags: string[];
    scoreMin?: number;
    scoreMax?: number;
    customFields?: Record<string, any>;
  };
  status: 'draft' | 'active' | 'paused' | 'completed';
  metrics?: {
    enrolled: number;
    active: number;
    completed: number;
    replies: number;
    meetings: number;
  };
}

const stepTemplates = {
  email: {
    firstTouch: {
      name: 'First Touch',
      subject: 'Quick question about {{company}}',
      body: `Hi {{first_name}},

I noticed {{personalized_observation}}.

{{value_proposition}}

Worth a quick chat?

Best,
{{sender_name}}`,
    },
    followUp1: {
      name: 'Follow-up 1',
      subject: 'Re: {{previous_subject}}',
      body: `Hi {{first_name}},

Hope you're having a great week. Following up on my previous note.

{{social_proof}}

Would {{day}} or {{day2}} work for a brief call?

Thanks,
{{sender_name}}`,
    },
    breakUp: {
      name: 'Break-up',
      subject: 'Should I close your file?',
      body: `Hi {{first_name}},

I've reached out a few times about {{value_proposition}}.

Since I haven't heard back, I'll assume the timing isn't right.

If that changes, feel free to reach out.

Best,
{{sender_name}}`,
    },
  },
};

export function SequenceBuilder() {
  const [sequence, setSequence] = useState<Sequence>({
    id: '',
    name: '',
    description: '',
    steps: [],
    settings: {
      exitOnReply: true,
      exitOnMeeting: true,
      skipWeekends: true,
      dailyLimit: 100,
      throttle: {
        enabled: false,
        maxPerHour: 20,
      },
    },
    targeting: {
      lists: [],
      tags: [],
    },
    status: 'draft',
  });

  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const { toast } = useToast();

  // Add new step
  const addStep = (type: SequenceStep['type']) => {
    const newStep: SequenceStep = {
      id: `step-${Date.now()}`,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${sequence.steps.length + 1}`,
      delay: {
        value: sequence.steps.length === 0 ? 0 : 3,
        unit: 'days',
      },
      content: {},
      settings: {
        trackOpens: true,
        trackClicks: true,
        timezone: 'recipient',
      },
    };

    setSequence({
      ...sequence,
      steps: [...sequence.steps, newStep],
    });

    setSelectedStep(newStep.id);
  };

  // Delete step
  const deleteStep = (stepId: string) => {
    setSequence({
      ...sequence,
      steps: sequence.steps.filter(s => s.id !== stepId),
    });

    if (selectedStep === stepId) {
      setSelectedStep(null);
    }
  };

  // Update step
  const updateStep = (stepId: string, updates: Partial<SequenceStep>) => {
    setSequence({
      ...sequence,
      steps: sequence.steps.map(s =>
        s.id === stepId ? { ...s, ...updates } : s
      ),
    });
  };

  // Handle drag end
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(sequence.steps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSequence({
      ...sequence,
      steps: items,
    });
  };

  // Apply template
  const applyTemplate = (template: any) => {
    if (!selectedStep) return;

    updateStep(selectedStep, {
      content: {
        subject: template.subject,
        body: template.body,
      },
    });

    setShowTemplateDialog(false);
    toast({
      title: 'Template Applied',
      description: 'Email template has been applied to the step',
    });
  };

  // Save sequence
  const saveSequence = async () => {
    setIsBuilding(true);

    try {
      const response = await fetch(sequence.id ? `/api/sequences/${sequence.id}` : '/api/sequences', {
        method: sequence.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sequence),
      });

      if (!response.ok) throw new Error('Failed to save sequence');

      const saved = await response.json();
      setSequence(saved);

      toast({
        title: 'Sequence Saved',
        description: 'Your sequence has been saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Unable to save sequence. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsBuilding(false);
    }
  };

  // Launch sequence
  const launchSequence = async () => {
    if (!sequence.name || sequence.steps.length === 0) {
      toast({
        title: 'Incomplete Sequence',
        description: 'Please add a name and at least one step',
        variant: 'destructive',
      });
      return;
    }

    setIsBuilding(true);

    try {
      const response = await fetch(`/api/sequences/${sequence.id}/launch`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to launch sequence');

      setSequence({
        ...sequence,
        status: 'active',
      });

      toast({
        title: 'Sequence Launched',
        description: 'Your sequence is now active and enrolling leads',
      });
    } catch (error) {
      toast({
        title: 'Launch Failed',
        description: 'Unable to launch sequence. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsBuilding(false);
    }
  };

  // Get step icon
  const getStepIcon = (type: SequenceStep['type']) => {
    const icons = {
      email: Mail,
      task: FileText,
      call: Phone,
      linkedin: MessageSquare,
      sms: MessageSquare,
      condition: GitBranch,
    };
    const Icon = icons[type];
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Sequence Builder
              </CardTitle>
              <CardDescription>
                Create multi-step outreach campaigns with automation
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTestDialog(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={saveSequence}
                disabled={isBuilding}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button
                size="sm"
                onClick={launchSequence}
                disabled={isBuilding || sequence.steps.length === 0}
              >
                <Play className="h-4 w-4 mr-2" />
                Launch
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sequence Steps */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sequence Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sequence Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Sequence Name</Label>
                <Input
                  placeholder="e.g., Q4 Cold Outreach Campaign"
                  value={sequence.name}
                  onChange={(e) => setSequence({ ...sequence, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe the goal and strategy of this sequence..."
                  value={sequence.description}
                  onChange={(e) => setSequence({ ...sequence, description: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Sequence Steps</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addStep('email')}>
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addStep('task')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Task
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addStep('condition')}>
                    <GitBranch className="h-4 w-4 mr-2" />
                    Condition
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sequence.steps.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No steps added yet</p>
                  <p className="text-sm mt-1">Click the buttons above to add steps</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="steps">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                        {sequence.steps.map((step, index) => (
                          <Draggable key={step.id} draggableId={step.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`border rounded-lg p-4 ${snapshot.isDragging ? 'shadow-lg' : ''
                                  } ${selectedStep === step.id ? 'border-blue-500 bg-blue-50' : ''}`}
                                onClick={() => setSelectedStep(step.id)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 bg-gray-100 rounded">
                                      {getStepIcon(step.type)}
                                    </div>
                                    <div>
                                      <p className="font-medium">{step.name}</p>
                                      {index > 0 && (
                                        <p className="text-sm text-gray-600 mt-1">
                                          Wait {step.delay.value} {step.delay.unit}
                                        </p>
                                      )}
                                      {step.content.subject && (
                                        <p className="text-sm text-gray-500 mt-1">
                                          {step.content.subject}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteStep(step.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Step Editor */}
        <div className="space-y-4">
          {selectedStep && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Step Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const step = sequence.steps.find(s => s.id === selectedStep);
                  if (!step) return null;

                  return (
                    <>
                      <div>
                        <Label>Step Name</Label>
                        <Input
                          value={step.name}
                          onChange={(e) => updateStep(step.id, { name: e.target.value })}
                        />
                      </div>

                      {sequence.steps.indexOf(step) > 0 && (
                        <div>
                          <Label>Delay</Label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={step.delay.value}
                              onChange={(e) => updateStep(step.id, {
                                delay: { ...step.delay, value: parseInt(e.target.value) },
                              })}
                            />
                            <Select
                              value={step.delay.unit}
                              onValueChange={(value: any) => updateStep(step.id, {
                                delay: { ...step.delay, unit: value },
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hours">Hours</SelectItem>
                                <SelectItem value="days">Days</SelectItem>
                                <SelectItem value="weeks">Weeks</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {step.type === 'email' && (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Label>Subject Line</Label>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowTemplateDialog(true)}
                              >
                                Use Template
                              </Button>
                            </div>
                            <Input
                              placeholder="Email subject..."
                              value={step.content.subject || ''}
                              onChange={(e) => updateStep(step.id, {
                                content: { ...step.content, subject: e.target.value },
                              })}
                            />
                          </div>
                          <div>
                            <Label>Email Body</Label>
                            <Textarea
                              placeholder="Email content..."
                              value={step.content.body || ''}
                              onChange={(e) => updateStep(step.id, {
                                content: { ...step.content, body: e.target.value },
                              })}
                              rows={10}
                            />
                          </div>
                        </>
                      )}

                      {step.type === 'task' && (
                        <div>
                          <Label>Task Description</Label>
                          <Textarea
                            placeholder="What needs to be done..."
                            value={step.content.taskDescription || ''}
                            onChange={(e) => updateStep(step.id, {
                              content: { ...step.content, taskDescription: e.target.value },
                            })}
                            rows={4}
                          />
                        </div>
                      )}

                      {step.type === 'condition' && (
                        <div>
                          <Label>Condition Type</Label>
                          <Select
                            value={step.conditions?.type}
                            onValueChange={(value: any) => updateStep(step.id, {
                              conditions: { ...step.conditions, type: value },
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="opened">If opened</SelectItem>
                              <SelectItem value="clicked">If clicked</SelectItem>
                              <SelectItem value="replied">If replied</SelectItem>
                              <SelectItem value="not_opened">If not opened</SelectItem>
                              <SelectItem value="not_clicked">If not clicked</SelectItem>
                              <SelectItem value="not_replied">If not replied</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between">
                            Advanced Settings
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 pt-3">
                          <div className="flex items-center justify-between">
                            <Label>Track Opens</Label>
                            <Switch
                              checked={step.settings.trackOpens}
                              onCheckedChange={(checked) => updateStep(step.id, {
                                settings: { ...step.settings, trackOpens: checked },
                              })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Track Clicks</Label>
                            <Switch
                              checked={step.settings.trackClicks}
                              onCheckedChange={(checked) => updateStep(step.id, {
                                settings: { ...step.settings, trackClicks: checked },
                              })}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sequence Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Exit on Reply</Label>
                <Switch
                  checked={sequence.settings.exitOnReply}
                  onCheckedChange={(checked) => setSequence({
                    ...sequence,
                    settings: { ...sequence.settings, exitOnReply: checked },
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Skip Weekends</Label>
                <Switch
                  checked={sequence.settings.skipWeekends}
                  onCheckedChange={(checked) => setSequence({
                    ...sequence,
                    settings: { ...sequence.settings, skipWeekends: checked },
                  })}
                />
              </div>
              <div>
                <Label>Daily Send Limit</Label>
                <Input
                  type="number"
                  value={sequence.settings.dailyLimit}
                  onChange={(e) => setSequence({
                    ...sequence,
                    settings: { ...sequence.settings, dailyLimit: parseInt(e.target.value) },
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Templates</DialogTitle>
            <DialogDescription>
              Select a template to apply to the current step
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(stepTemplates.email).map(([key, template]) => (
              <Card key={key} className="cursor-pointer hover:border-blue-500" onClick={() => applyTemplate(template)}>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">{template.name}</h4>
                  <p className="text-sm text-gray-600 mb-2">Subject: {template.subject}</p>
                  <p className="text-xs text-gray-500 whitespace-pre-line">{template.body.substring(0, 100)}...</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}