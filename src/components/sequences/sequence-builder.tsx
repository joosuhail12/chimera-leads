'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Plus,
  Mail,
  CheckSquare,
  Clock,
  GitBranch,
  Webhook,
  GripVertical,
  Save,
  AlertCircle,
  Linkedin,
  Phone,
  UserPlus,
  MessageSquare,
  Eye,
  ThumbsUp,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SequenceStep, SequenceStepType, SequenceTemplate } from '@/lib/types/sequences';
import { SortableStepCard } from './sortable-step-card';
import { StepEditor } from './step-editor';
import { TemplateSettings } from './template-settings';

interface SequenceBuilderProps {
  template?: SequenceTemplate;
  onSave: (template: Partial<SequenceTemplate>, steps: SequenceStep[]) => Promise<void>;
}

const STEP_TYPES: {
  type: SequenceStepType;
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
}[] = [
    {
      type: 'email',
      label: 'Email',
      icon: Mail,
      description: 'Send an email to the lead',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      type: 'task',
      label: 'Task',
      icon: CheckSquare,
      description: 'Create a task for the owner',
      color: 'bg-green-100 text-green-700',
    },
    {
      type: 'manual_email',
      label: 'Manual Email',
      icon: Send,
      description: 'Task to send an email manually',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      type: 'call',
      label: 'Call',
      icon: Phone,
      description: 'Phone call task',
      color: 'bg-green-50 text-green-600',
    },
    {
      type: 'linkedin_connection',
      label: 'LinkedIn Connect',
      icon: UserPlus,
      description: 'Send connection request',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      type: 'linkedin_message',
      label: 'LinkedIn Message',
      icon: MessageSquare,
      description: 'Send direct message',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      type: 'linkedin_profile_view',
      label: 'View Profile',
      icon: Eye,
      description: 'View LinkedIn profile',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      type: 'linkedin_engagement',
      label: 'Engagement',
      icon: ThumbsUp,
      description: 'Like or comment on post',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      type: 'wait',
      label: 'Wait',
      icon: Clock,
      description: 'Wait before next step',
      color: 'bg-yellow-100 text-yellow-700',
    },
    {
      type: 'conditional',
      label: 'Conditional',
      icon: GitBranch,
      description: 'Branch based on conditions',
      color: 'bg-purple-100 text-purple-700',
    },
    {
      type: 'webhook',
      label: 'Webhook',
      icon: Webhook,
      description: 'Call an external API',
      color: 'bg-orange-100 text-orange-700',
    },
  ];

export function SequenceBuilder({ template, onSave }: SequenceBuilderProps) {
  const [steps, setSteps] = useState<SequenceStep[]>(template?.steps || []);
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [isEditingNew, setIsEditingNew] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [templateName, setTemplateName] = useState(template?.name || '');
  const [templateDescription, setTemplateDescription] = useState(template?.description || '');
  const [templateSettings, setTemplateSettings] = useState(template?.settings || {
    pauseOnReply: true,
    pauseOnMeeting: true,
    skipWeekends: true,
    dailyLimit: 50,
    timezone: 'America/New_York',
  });
  const [showSettings, setShowSettings] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        // Update step numbers
        return newItems.map((item, index) => ({
          ...item,
          step_number: index + 1,
        }));
      });
    }

    setActiveId(null);
  };

  const addStep = (type: SequenceStepType) => {
    const newStep: SequenceStep = {
      id: `temp-${Date.now()}`,
      template_id: template?.id || '',
      step_number: steps.length + 1,
      step_type: type,
      wait_days: type === 'wait' ? 1 : 0,
      wait_hours: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Set default values based on type
    switch (type) {
      case 'email':
        newStep.email_subject = '';
        newStep.email_body = '';
        break;
      case 'task':
        newStep.task_title = '';
        newStep.task_description = '';
        newStep.task_priority = 'medium';
        newStep.task_due_days = 1;
        break;
      case 'manual_email':
        newStep.email_subject = '';
        newStep.email_body = '';
        break;
      case 'call':
        newStep.task_title = '';
        newStep.task_description = '';
        newStep.task_priority = 'medium';
        break;
      case 'linkedin_connection':
      case 'linkedin_message':
      case 'linkedin_profile_view':
      case 'linkedin_engagement':
        newStep.linkedin_config = {
          action_type: type === 'linkedin_connection' ? 'connect' :
            type === 'linkedin_message' ? 'message' :
              type === 'linkedin_profile_view' ? 'view_profile' : 'like_post',
          automation_mode: 'semi_auto',
          skip_if_connected: true,
          require_connection: true,
          view_duration_seconds: 5,
          scroll_profile: true,
        };
        break;
      case 'webhook':
        newStep.webhook_url = '';
        newStep.webhook_method = 'POST';
        break;
    }

    setEditingStep(newStep);
    setIsEditingNew(true);
  };

  const saveStep = (step: SequenceStep) => {
    if (isEditingNew) {
      setSteps([...steps, step]);
    } else {
      setSteps(steps.map((s) => (s.id === step.id ? step : s)));
    }
    setEditingStep(null);
    setIsEditingNew(false);
  };

  const deleteStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId).map((s, index) => ({
      ...s,
      step_number: index + 1,
    })));
  };

  const handleSave = async () => {
    if (!templateName) {
      alert('Please enter a template name');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        {
          name: templateName,
          description: templateDescription,
          settings: templateSettings,
        },
        steps
      );
    } catch (error) {
      console.error('Error saving sequence:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const activeStep = activeId ? steps.find((s) => s.id === activeId) : null;

  return (
    <div className="flex h-full">
      {/* Main Builder Area */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Sequence Name"
            className="text-2xl font-bold bg-transparent border-none outline-none w-full mb-2"
          />
          <textarea
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.target.value)}
            placeholder="Add a description..."
            className="text-gray-600 bg-transparent border-none outline-none w-full resize-none"
            rows={2}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {STEP_TYPES.map((stepType) => (
              <Button
                key={stepType.type}
                variant="outline"
                size="sm"
                onClick={() => addStep(stepType.type)}
                className="flex items-center gap-2"
              >
                <stepType.icon className="h-4 w-4" />
                <span>{stepType.label}</span>
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              Settings
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !templateName}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Sequence'}
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 border rounded-lg bg-gray-50">
            <TemplateSettings
              settings={templateSettings}
              onChange={setTemplateSettings}
            />
          </div>
        )}

        {/* Steps */}
        {steps.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No steps yet
            </h3>
            <p className="text-gray-500 mb-4">
              Add your first step to start building your sequence
            </p>
            <div className="flex justify-center gap-2">
              {STEP_TYPES.slice(0, 3).map((stepType) => (
                <Button
                  key={stepType.type}
                  variant="outline"
                  size="sm"
                  onClick={() => addStep(stepType.type)}
                  className="flex items-center gap-2"
                >
                  <stepType.icon className="h-4 w-4" />
                  <span>{stepType.label}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={steps.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {steps.map((step) => {
                  const stepType = STEP_TYPES.find((t) => t.type === step.step_type);
                  return (
                    <SortableStepCard
                      key={step.id}
                      step={step}
                      stepType={stepType!}
                      onEdit={() => {
                        setEditingStep(step);
                        setIsEditingNew(false);
                      }}
                      onDelete={() => deleteStep(step.id)}
                    />
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId && activeStep ? (
                <div className="bg-white border rounded-lg shadow-lg p-4 opacity-90">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <span className="font-medium">
                      Step {activeStep.step_number}
                    </span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Add Step Button at End */}
        {steps.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addStep('email')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          </div>
        )}
      </div>

      {/* Step Editor Sidebar */}
      {editingStep && (
        <div className="w-[480px] border-l bg-white shadow-lg">
          <StepEditor
            step={editingStep}
            isNew={isEditingNew}
            onSave={saveStep}
            onCancel={() => {
              setEditingStep(null);
              setIsEditingNew(false);
            }}
          />
        </div>
      )}
    </div>
  );
}