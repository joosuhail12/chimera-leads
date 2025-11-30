'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, StopCircle, Mail, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SequenceEnrollment } from '@/lib/types/sequences';
import { cn } from '@/lib/utils/cn';
import { format } from 'date-fns';

interface LeadEnrollmentsProps {
  leadId: string;
}

export function LeadEnrollments({ leadId }: LeadEnrollmentsProps) {
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEnrollments();
  }, [leadId]);

  const loadEnrollments = async () => {
    try {
      const response = await fetch(`/api/sequences/enrollments?lead_id=${leadId}`);
      if (response.ok) {
        const data = await response.json();
        setEnrollments(data.enrollments);
      }
    } catch (error) {
      console.error('Error loading enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateEnrollmentStatus = async (
    enrollmentId: string,
    status: 'active' | 'paused' | 'stopped',
    reason?: string
  ) => {
    try {
      const response = await fetch(`/api/sequences/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });

      if (response.ok) {
        await loadEnrollments();
      }
    } catch (error) {
      console.error('Error updating enrollment:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-500">Loading sequences...</div>
      </div>
    );
  }

  if (enrollments.length === 0) {
    return (
      <div className="p-4 text-center">
        <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No active sequences</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {enrollments.map((enrollment) => (
        <div
          key={enrollment.id}
          className="p-4 border rounded-lg bg-white"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-medium">
                {(enrollment as any).template?.name || 'Unknown Sequence'}
              </h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span className={cn(
                  'px-2 py-0.5 rounded-full',
                  enrollment.status === 'active' && 'bg-green-100 text-green-700',
                  enrollment.status === 'paused' && 'bg-yellow-100 text-yellow-700',
                  enrollment.status === 'completed' && 'bg-blue-100 text-blue-700',
                  enrollment.status === 'stopped' && 'bg-red-100 text-red-700'
                )}>
                  {enrollment.status}
                </span>
                <span>Step {enrollment.current_step} of {(enrollment as any).template?.steps?.length || '?'}</span>
              </div>
            </div>

            {/* Actions */}
            {enrollment.status === 'active' && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateEnrollmentStatus(enrollment.id, 'paused', 'Manually paused')}
                  className="h-8 w-8 p-0"
                  title="Pause"
                >
                  <Pause className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateEnrollmentStatus(enrollment.id, 'stopped', 'Manually stopped')}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  title="Stop"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
            {enrollment.status === 'paused' && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateEnrollmentStatus(enrollment.id, 'active')}
                  className="h-8 w-8 p-0"
                  title="Resume"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateEnrollmentStatus(enrollment.id, 'stopped', 'Manually stopped')}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  title="Stop"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t text-xs">
            <div>
              <div className="text-gray-500">Emails Sent</div>
              <div className="font-medium">{enrollment.emails_sent}</div>
            </div>
            <div>
              <div className="text-gray-500">Opened</div>
              <div className="font-medium">{enrollment.emails_opened}</div>
            </div>
            <div>
              <div className="text-gray-500">Clicked</div>
              <div className="font-medium">{enrollment.emails_clicked}</div>
            </div>
            <div>
              <div className="text-gray-500">Replied</div>
              <div className="font-medium">{enrollment.replies_received}</div>
            </div>
          </div>

          {/* Timeline info */}
          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>
                Enrolled {format(new Date(enrollment.enrolled_at), 'MMM d, yyyy')}
              </span>
              {enrollment.next_step_scheduled_at && enrollment.status === 'active' && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Next: {format(new Date(enrollment.next_step_scheduled_at), 'MMM d, h:mm a')}
                </span>
              )}
              {enrollment.completed_at && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Completed {format(new Date(enrollment.completed_at), 'MMM d')}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}