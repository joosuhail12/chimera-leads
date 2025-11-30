'use client';

import { useState } from 'react';
import { Mail, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnrollmentModal } from './enrollment-modal';

interface EnrollmentButtonProps {
  leadId: string;
  leadName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  onSuccess?: () => void;
}

export function EnrollmentButton({
  leadId,
  leadName,
  variant = 'outline',
  size = 'sm',
  className,
  onSuccess,
}: EnrollmentButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowModal(true)}
        className={className}
      >
        <Mail className="h-4 w-4 mr-2" />
        Add to Sequence
      </Button>

      <EnrollmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        leadIds={[leadId]}
        leadNames={leadName ? [leadName] : []}
        onSuccess={onSuccess}
      />
    </>
  );
}

interface BulkEnrollmentButtonProps {
  leadIds: string[];
  disabled?: boolean;
  onSuccess?: () => void;
}

export function BulkEnrollmentButton({
  leadIds,
  disabled = false,
  onSuccess,
}: BulkEnrollmentButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowModal(true)}
        disabled={disabled || leadIds.length === 0}
      >
        <Play className="h-4 w-4 mr-2" />
        Add to Sequence ({leadIds.length})
      </Button>

      <EnrollmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        leadIds={leadIds}
        onSuccess={onSuccess}
      />
    </>
  );
}