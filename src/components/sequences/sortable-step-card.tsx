'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Mail,
  CheckSquare,
  Clock,
  GitBranch,
  Webhook,
  Edit,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SequenceStep, SequenceStepType } from '@/lib/types/sequences';
import { cn } from '@/lib/utils/cn';

interface SortableStepCardProps {
  step: SequenceStep;
  stepType: {
    type: SequenceStepType;
    label: string;
    icon: React.ElementType;
    description: string;
    color: string;
  };
  onEdit: () => void;
  onDelete: () => void;
}

export function SortableStepCard({
  step,
  stepType,
  onEdit,
  onDelete,
}: SortableStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getStepSummary = () => {
    switch (step.step_type) {
      case 'email':
        return step.email_subject || 'No subject';
      case 'task':
        return step.task_title || 'No title';
      case 'wait':
        const days = step.wait_days || 0;
        const hours = step.wait_hours || 0;
        if (days === 0 && hours === 0) return 'No wait time';
        const parts = [];
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
        return `Wait ${parts.join(' and ')}`;
      case 'conditional':
        return 'Branch on condition';
      case 'webhook':
        return step.webhook_url || 'No URL configured';
      default:
        return 'Configure step';
    }
  };

  const getStepDetails = () => {
    switch (step.step_type) {
      case 'email':
        if (!step.email_body) return null;
        // Extract first line of email body
        const firstLine = step.email_body.split('\n')[0];
        return firstLine.substring(0, 100) + (firstLine.length > 100 ? '...' : '');
      case 'task':
        return step.task_description?.substring(0, 100) || null;
      case 'wait':
        if (step.send_time_window) {
          return `Send between ${step.send_time_window.start} - ${step.send_time_window.end}`;
        }
        return null;
      case 'conditional':
        if (step.conditions) {
          return `If ${step.conditions.type}`;
        }
        return null;
      case 'webhook':
        return step.webhook_method || 'POST';
      default:
        return null;
    }
  };

  const Icon = stepType.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white border rounded-lg shadow-sm transition-all',
        isDragging && 'opacity-50 shadow-lg',
        'hover:shadow-md'
      )}
    >
      <div className="flex items-start p-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="mr-3 mt-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>

        {/* Step Icon */}
        <div className={cn('p-2 rounded-lg mr-3', stepType.color)}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Step Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">Step {step.step_number}</span>
            <ChevronRight className="h-3 w-3 text-gray-400" />
            <span className="text-xs font-medium text-gray-700">
              {stepType.label}
            </span>
          </div>
          <h3 className="font-medium text-gray-900 truncate">
            {getStepSummary()}
          </h3>
          {getStepDetails() && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {getStepDetails()}
            </p>
          )}

          {/* Wait Time Display */}
          {step.step_type !== 'wait' && (step.wait_days > 0 || step.wait_hours > 0) && (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>
                After {step.wait_days > 0 && `${step.wait_days} day${step.wait_days > 1 ? 's' : ''}`}
                {step.wait_days > 0 && step.wait_hours > 0 && ' and '}
                {step.wait_hours > 0 && `${step.wait_hours} hour${step.wait_hours > 1 ? 's' : ''}`}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}