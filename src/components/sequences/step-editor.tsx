'use client';

import { useState } from 'react';
import { X, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SequenceStep, TaskPriority, LinkedInStepConfig } from '@/lib/types/sequences';
import { LinkedInStepEditor } from './linkedin-step-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StepEditorProps {
  step: SequenceStep;
  isNew: boolean;
  onSave: (step: SequenceStep) => void;
  onCancel: () => void;
}

export function StepEditor({ step, isNew, onSave, onCancel }: StepEditorProps) {
  const [editedStep, setEditedStep] = useState<SequenceStep>(step);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateStep = (updates: Partial<SequenceStep>) => {
    setEditedStep({ ...editedStep, ...updates });
    // Clear errors for updated fields
    const errorKeys = Object.keys(updates);
    if (errorKeys.length > 0) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        errorKeys.forEach((key) => delete newErrors[key]);
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (editedStep.step_type) {
      case 'email':
        if (!editedStep.email_subject) {
          newErrors.email_subject = 'Subject is required';
        }
        if (!editedStep.email_body) {
          newErrors.email_body = 'Email body is required';
        }
        break;
      case 'task':
        if (!editedStep.task_title) {
          newErrors.task_title = 'Task title is required';
        }
        break;
      case 'webhook':
        if (!editedStep.webhook_url) {
          newErrors.webhook_url = 'Webhook URL is required';
        } else {
          try {
            new URL(editedStep.webhook_url);
          } catch {
            newErrors.webhook_url = 'Invalid URL format';
          }
        }
        break;
      case 'call':
        if (!editedStep.task_title) {
          newErrors.task_title = 'Call title is required';
        }
        break;
      case 'manual_email':
        if (!editedStep.email_subject) {
          newErrors.email_subject = 'Subject is required';
        }
        if (!editedStep.email_body) {
          newErrors.email_body = 'Email body is required';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(editedStep);
    }
  };

  const getVariableHelp = () => (
    <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-600 mt-0.5" />
        <div className="text-blue-700">
          <p className="font-medium mb-1">Available Variables:</p>
          <ul className="space-y-1 text-xs">
            <li><code className="bg-white px-1 rounded">{'{first_name}'}</code> - Lead's first name</li>
            <li><code className="bg-white px-1 rounded">{'{last_name}'}</code> - Lead's last name</li>
            <li><code className="bg-white px-1 rounded">{'{company}'}</code> - Company name</li>
            <li><code className="bg-white px-1 rounded">{'{email}'}</code> - Email address</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">
          {isNew ? 'Add' : 'Edit'} {editedStep.step_type.charAt(0).toUpperCase() + editedStep.step_type.slice(1)} Step
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Wait Time (for all non-wait steps) */}
        {editedStep.step_type !== 'wait' && (
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3">Wait Before This Step</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="wait_days" className="text-xs">Days</Label>
                <Input
                  id="wait_days"
                  type="number"
                  min="0"
                  value={editedStep.wait_days || 0}
                  onChange={(e) => updateStep({ wait_days: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="wait_hours" className="text-xs">Hours</Label>
                <Input
                  id="wait_hours"
                  type="number"
                  min="0"
                  max="23"
                  value={editedStep.wait_hours || 0}
                  onChange={(e) => updateStep({ wait_hours: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Time to wait after the previous step before executing this one
            </p>
          </div>
        )}

        {/* Step-specific fields */}
        {editedStep.step_type === 'email' && (
          <>
            <div className="mb-4">
              <Label htmlFor="email_subject">Subject Line *</Label>
              <Input
                id="email_subject"
                value={editedStep.email_subject || ''}
                onChange={(e) => updateStep({ email_subject: e.target.value })}
                placeholder="E.g., Quick question about {company}"
                className={errors.email_subject ? 'border-red-500' : ''}
              />
              {errors.email_subject && (
                <p className="text-xs text-red-500 mt-1">{errors.email_subject}</p>
              )}
            </div>

            <div className="mb-4">
              <Label htmlFor="email_body">Email Body *</Label>
              <Textarea
                id="email_body"
                value={editedStep.email_body || ''}
                onChange={(e) => updateStep({ email_body: e.target.value })}
                placeholder="Hi {first_name},&#10;&#10;I noticed that..."
                rows={10}
                className={errors.email_body ? 'border-red-500' : ''}
              />
              {errors.email_body && (
                <p className="text-xs text-red-500 mt-1">{errors.email_body}</p>
              )}
            </div>

            {getVariableHelp()}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email_from_name" className="text-xs">From Name</Label>
                <Input
                  id="email_from_name"
                  value={editedStep.email_from_name || ''}
                  onChange={(e) => updateStep({ email_from_name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="email_reply_to" className="text-xs">Reply To</Label>
                <Input
                  id="email_reply_to"
                  type="email"
                  value={editedStep.email_reply_to || ''}
                  onChange={(e) => updateStep({ email_reply_to: e.target.value })}
                  placeholder="reply@example.com"
                />
              </div>
            </div>

            {/* A/B Testing Section */}
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">A/B Testing</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const variants = editedStep.variants || [];
                    const newVariant = {
                      id: `temp-variant-${Date.now()}`,
                      step_id: editedStep.id,
                      variant_type: `variant_${String.fromCharCode(97 + variants.length)}`, // variant_a, variant_b, etc.
                      email_subject: editedStep.email_subject,
                      email_body: editedStep.email_body,
                      traffic_percentage: 50,
                      is_active: true,
                    };
                    updateStep({ variants: [...variants, newVariant] });
                  }}
                >
                  Add Variant
                </Button>
              </div>

              {(editedStep.variants || []).map((variant, index) => (
                <div key={variant.id} className="mb-4 p-4 border rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm capitalize">
                      {variant.variant_type.replace('_', ' ')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newVariants = [...(editedStep.variants || [])];
                        newVariants.splice(index, 1);
                        updateStep({ variants: newVariants });
                      }}
                      className="h-6 w-6 p-0 text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Subject Line</Label>
                      <Input
                        value={variant.email_subject || ''}
                        onChange={(e) => {
                          const newVariants = [...(editedStep.variants || [])];
                          newVariants[index] = { ...variant, email_subject: e.target.value };
                          updateStep({ variants: newVariants });
                        }}
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email Body</Label>
                      <Textarea
                        value={variant.email_body || ''}
                        onChange={(e) => {
                          const newVariants = [...(editedStep.variants || [])];
                          newVariants[index] = { ...variant, email_body: e.target.value };
                          updateStep({ variants: newVariants });
                        }}
                        className="bg-white"
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Traffic %</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={variant.traffic_percentage}
                        onChange={(e) => {
                          const newVariants = [...(editedStep.variants || [])];
                          newVariants[index] = { ...variant, traffic_percentage: parseInt(e.target.value) || 0 };
                          updateStep({ variants: newVariants });
                        }}
                        className="bg-white w-24"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {editedStep.step_type === 'task' && (
          <>
            <div className="mb-4">
              <Label htmlFor="task_title">Task Title *</Label>
              <Input
                id="task_title"
                value={editedStep.task_title || ''}
                onChange={(e) => updateStep({ task_title: e.target.value })}
                placeholder="E.g., Call {first_name} at {company}"
                className={errors.task_title ? 'border-red-500' : ''}
              />
              {errors.task_title && (
                <p className="text-xs text-red-500 mt-1">{errors.task_title}</p>
              )}
            </div>

            <div className="mb-4">
              <Label htmlFor="task_description">Description</Label>
              <Textarea
                id="task_description"
                value={editedStep.task_description || ''}
                onChange={(e) => updateStep({ task_description: e.target.value })}
                placeholder="Additional details about the task..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="task_priority">Priority</Label>
                <Select
                  value={editedStep.task_priority || 'medium'}
                  onValueChange={(value) => updateStep({ task_priority: value as TaskPriority })}
                >
                  <SelectTrigger id="task_priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task_due_days">Due In (Days)</Label>
                <Input
                  id="task_due_days"
                  type="number"
                  min="0"
                  value={editedStep.task_due_days || 1}
                  onChange={(e) => updateStep({ task_due_days: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          </>
        )}

        {editedStep.step_type === 'wait' && (
          <>
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-3">Wait Duration</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="wait_days">Days</Label>
                  <Input
                    id="wait_days"
                    type="number"
                    min="0"
                    value={editedStep.wait_days || 0}
                    onChange={(e) => updateStep({ wait_days: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="wait_hours">Hours</Label>
                  <Input
                    id="wait_hours"
                    type="number"
                    min="0"
                    max="23"
                    value={editedStep.wait_hours || 0}
                    onChange={(e) => updateStep({ wait_hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <Label>Send Time Window (Optional)</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label htmlFor="send_start" className="text-xs">Start Time</Label>
                  <Input
                    id="send_start"
                    type="time"
                    value={editedStep.send_time_window?.start || ''}
                    onChange={(e) => updateStep({
                      send_time_window: {
                        ...editedStep.send_time_window,
                        start: e.target.value,
                        end: editedStep.send_time_window?.end || '17:00',
                      } as any
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="send_end" className="text-xs">End Time</Label>
                  <Input
                    id="send_end"
                    type="time"
                    value={editedStep.send_time_window?.end || ''}
                    onChange={(e) => updateStep({
                      send_time_window: {
                        ...editedStep.send_time_window,
                        start: editedStep.send_time_window?.start || '09:00',
                        end: e.target.value,
                      } as any
                    })}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Only proceed to next step during this time window
              </p>
            </div>
          </>
        )}

        {editedStep.step_type === 'manual_email' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={editedStep.email_subject || ''}
                onChange={(e) => updateStep({ email_subject: e.target.value })}
                placeholder="Email subject..."
                className={errors.email_subject ? 'border-red-500' : ''}
              />
              {errors.email_subject && <p className="text-xs text-red-500">{errors.email_subject}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={editedStep.email_body || ''}
                onChange={(e) => updateStep({ email_body: e.target.value })}
                placeholder="Write your email content here..."
                className={`min-h-[200px] font-mono text-sm ${errors.email_body ? 'border-red-500' : ''}`}
              />
              {errors.email_body && <p className="text-xs text-red-500">{errors.email_body}</p>}
              {getVariableHelp()}
            </div>
          </div>
        )}

        {editedStep.step_type === 'call' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="call-title">Call Title</Label>
              <Input
                id="call-title"
                value={editedStep.task_title || ''}
                onChange={(e) => updateStep({ task_title: e.target.value })}
                placeholder="e.g. Intro Call"
                className={errors.task_title ? 'border-red-500' : ''}
              />
              {errors.task_title && <p className="text-xs text-red-500">{errors.task_title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="call-script">Script / Talking Points (Optional)</Label>
              <Textarea
                id="call-script"
                value={editedStep.task_description || ''}
                onChange={(e) => updateStep({ task_description: e.target.value })}
                placeholder="- Introduce yourself&#10;- Mention mutual connection&#10;- Ask about..."
                rows={6}
              />
              {getVariableHelp()}
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={editedStep.task_priority || 'medium'}
                onValueChange={(value: any) => updateStep({ task_priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {(editedStep.step_type.startsWith('linkedin_')) && (
          <LinkedInStepEditor
            stepType={editedStep.step_type}
            config={editedStep.linkedin_config}
            onChange={(config) => updateStep({ linkedin_config: config })}
          />
        )}

        {editedStep.step_type === 'conditional' && (
          <div className="mb-4">
            <Label>Condition Type</Label>
            <Select
              value={editedStep.conditions?.type || 'email_opened'}
              onValueChange={(value) => updateStep({
                conditions: {
                  ...editedStep.conditions,
                  type: value,
                } as any
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email_opened">Email Opened</SelectItem>
                <SelectItem value="email_clicked">Email Clicked</SelectItem>
                <SelectItem value="replied">Replied</SelectItem>
                <SelectItem value="not_replied">Not Replied</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-2">
              Branch the sequence based on lead behavior
            </p>
          </div>
        )}

        {editedStep.step_type === 'webhook' && (
          <>
            <div className="mb-4">
              <Label htmlFor="webhook_url">Webhook URL *</Label>
              <Input
                id="webhook_url"
                type="url"
                value={editedStep.webhook_url || ''}
                onChange={(e) => updateStep({ webhook_url: e.target.value })}
                placeholder="https://api.example.com/webhook"
                className={errors.webhook_url ? 'border-red-500' : ''}
              />
              {errors.webhook_url && (
                <p className="text-xs text-red-500 mt-1">{errors.webhook_url}</p>
              )}
            </div>

            <div className="mb-4">
              <Label htmlFor="webhook_method">HTTP Method</Label>
              <Select
                value={editedStep.webhook_method || 'POST'}
                onValueChange={(value) => updateStep({ webhook_method: value })}
              >
                <SelectTrigger id="webhook_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 p-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          {isNew ? 'Add Step' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}