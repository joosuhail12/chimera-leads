'use client';

import { useState, useEffect } from 'react';
import { X, Mail, Users, Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SequenceTemplate } from '@/lib/types/sequences';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadIds: string[];
  leadNames?: string[];
  onSuccess?: () => void;
}

export function EnrollmentModal({
  isOpen,
  onClose,
  leadIds,
  leadNames = [],
  onSuccess,
}: EnrollmentModalProps) {
  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sequences/templates?is_active=true');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
        if (data.templates.length > 0) {
          setSelectedTemplate(data.templates[0].id);
        }
      } else {
        setError('Failed to load sequences');
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setError('Failed to load sequences');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedTemplate) {
      setError('Please select a sequence');
      return;
    }

    setEnrolling(true);
    setError(null);

    try {
      const endpoint = leadIds.length === 1
        ? '/api/sequences/enrollments'
        : '/api/sequences/enrollments';

      const body = leadIds.length === 1
        ? {
            lead_id: leadIds[0],
            template_id: selectedTemplate,
          }
        : {
            lead_ids: leadIds,
            template_id: selectedTemplate,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        if (leadIds.length === 1) {
          onSuccess?.();
          onClose();
        } else {
          // Show results for bulk enrollment
          const { enrolled, skipped, errors } = data.results;
          if (errors.length > 0) {
            setError(`Enrolled ${enrolled} leads. ${skipped} skipped. ${errors.length} errors.`);
          } else {
            onSuccess?.();
            onClose();
          }
        }
      } else {
        setError(data.error || 'Failed to enroll leads');
      }
    } catch (error) {
      console.error('Error enrolling leads:', error);
      setError('Failed to enroll leads');
    } finally {
      setEnrolling(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enroll in Sequence
          </DialogTitle>
          <DialogDescription>
            {leadIds.length === 1 ? (
              <>
                Enroll {leadNames[0] || 'this lead'} in an automated email sequence
              </>
            ) : (
              <>
                Enroll {leadIds.length} leads in an automated email sequence
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-600">Loading sequences...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600">
                No active sequences available. Please create a sequence first.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label htmlFor="sequence">Select Sequence</Label>
                <select
                  id="sequence"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={enrolling}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplateData && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm space-y-2">
                    {selectedTemplateData.description && (
                      <p className="text-gray-600">{selectedTemplateData.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {selectedTemplateData.steps?.length || 0} steps
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {selectedTemplateData.total_enrolled || 0} enrolled
                      </span>
                      {selectedTemplateData.avg_reply_rate > 0 && (
                        <span>
                          {selectedTemplateData.avg_reply_rate.toFixed(1)}% reply rate
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enrolling}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={enrolling || loading || templates.length === 0}
          >
            {enrolling ? (
              <>Enrolling...</>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Enroll {leadIds.length > 1 ? `${leadIds.length} Leads` : 'Lead'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}