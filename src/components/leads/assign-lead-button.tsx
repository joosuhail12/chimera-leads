"use client";

import { useState } from "react";

type AssignLeadButtonProps = {
  leadId: string;
  isAssignedToCurrentUser: boolean;
  assignedToLabel?: string | null;
};

export function AssignLeadButton({
  leadId,
  isAssignedToCurrentUser,
  assignedToLabel,
}: AssignLeadButtonProps) {
  const [isAssigned, setIsAssigned] = useState(isAssignedToCurrentUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async () => {
    if (isAssigned || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to assign lead");
      }

      setIsAssigned(true);
    } catch (err) {
      console.error(err);
      setError("Could not assign lead. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleAssign}
        disabled={isAssigned || isSubmitting}
        className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
          isAssigned
            ? "cursor-not-allowed border border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
            : "border border-chimera-teal/30 bg-white text-chimera-teal hover:bg-chimera-teal/10 dark:border-chimera-teal/40 dark:bg-gray-900"
        }`}
      >
        {isAssigned ? "Assigned to you" : isSubmitting ? "Assigning..." : "Assign to me"}
      </button>
      {assignedToLabel && !isAssigned ? (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          Currently assigned to {assignedToLabel}
        </p>
      ) : null}
      {error ? (
        <p className="text-center text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
