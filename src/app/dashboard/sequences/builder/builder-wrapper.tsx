'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SequenceBuilder } from '@/components/sequences/sequence-builder';
import { SequenceTemplate, SequenceStep } from '@/lib/types/sequences';

interface SequenceBuilderWrapperProps {
  templateId?: string;
}

export function SequenceBuilderWrapper({ templateId }: SequenceBuilderWrapperProps) {
  const router = useRouter();
  const [template, setTemplate] = useState<SequenceTemplate | undefined>(undefined);
  const [loading, setLoading] = useState(!!templateId);

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    }
  }, [templateId]);

  const loadTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/sequences/templates/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTemplate(data.template);
      }
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (
    templateData: Partial<SequenceTemplate>,
    steps: SequenceStep[]
  ) => {
    try {
      if (templateId && template) {
        // Update existing template
        const templateResponse = await fetch(`/api/sequences/templates/${templateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData),
        });

        if (!templateResponse.ok) {
          throw new Error('Failed to update template');
        }

        // Delete removed steps
        const existingStepIds = template.steps?.map(s => s.id) || [];
        const currentStepIds = steps.filter(s => !s.id.startsWith('temp-')).map(s => s.id);
        const deletedStepIds = existingStepIds.filter(id => !currentStepIds.includes(id));

        for (const stepId of deletedStepIds) {
          await fetch(`/api/sequences/steps/${stepId}`, {
            method: 'DELETE',
          });
        }

        // Update or create steps
        for (const step of steps) {
          if (step.id.startsWith('temp-')) {
            // Create new step
            await fetch('/api/sequences/steps', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...step,
                template_id: templateId,
              }),
            });
          } else {
            // Update existing step
            await fetch(`/api/sequences/steps/${step.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(step),
            });
          }
        }
      } else {
        // Create new template
        const templateResponse = await fetch('/api/sequences/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData),
        });

        if (!templateResponse.ok) {
          throw new Error('Failed to create template');
        }

        const { template: newTemplate } = await templateResponse.json();

        // Create steps
        for (const step of steps) {
          await fetch('/api/sequences/steps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...step,
              template_id: newTemplate.id,
            }),
          });
        }
      }

      // Redirect to sequences list
      router.push('/dashboard/sequences');
    } catch (error) {
      console.error('Error saving sequence:', error);
      alert('Failed to save sequence. Please try again.');
    }
  };

  if (loading) {
    return <BuilderLoading />;
  }

  return <SequenceBuilder template={template} onSave={handleSave} />;
}

function BuilderLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading sequence...</p>
      </div>
    </div>
  );
}