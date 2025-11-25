"use client";

import { useState } from "react";
import { triggerKnockWorkflow } from "@/app/actions/trigger-knock-workflow";

export function KnockWorkflowTrigger() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Trigger sample notification
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sends the knock-quickstart workflow to your inbox.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            setStatus("loading");
            setErrorMessage(null);
            try {
              const result = await triggerKnockWorkflow(
                "Here's a message from Knock."
              );
              if (result.success) {
                setStatus("success");
                setTimeout(() => setStatus("idle"), 3000);
              } else {
                setErrorMessage(result.error);
                setStatus("error");
              }
            } catch (error) {
              console.error(error);
              setErrorMessage("Unexpected error triggering workflow.");
              setStatus("error");
            }
          }}
          className="rounded-lg bg-chimera-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-chimera-teal/90 disabled:cursor-not-allowed disabled:bg-gray-400"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending..." : "Send test"}
        </button>
      </div>
      {status === "error" ? (
        <p className="mt-2 text-xs text-red-500">
          {errorMessage ?? "Failed to trigger workflow. Check your Knock keys."}
        </p>
      ) : null}
      {status === "success" ? (
        <p className="mt-2 text-xs text-chimera-teal">
          Notification triggered! Check the inbox button.
        </p>
      ) : null}
    </div>
  );
}
