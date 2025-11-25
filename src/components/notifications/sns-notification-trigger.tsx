"use client";

import { useState } from "react";
import { sendSnsNotification } from "@/app/actions/send-sns-notification";

export function SnsNotificationTrigger() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-gray-50">
            Send SNS notification
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Publishes a test payload to your configured AWS SNS topic.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            setStatus("loading");
            setErrorMessage(null);
            const result = await sendSnsNotification(
              "Here's a sample message from Chimera."
            );
            if (result.success) {
              setStatus("success");
              setTimeout(() => setStatus("idle"), 3000);
            } else {
              setErrorMessage(result.error);
              setStatus("error");
            }
          }}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-300/70 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending…" : "Send test"}
        </button>
      </div>
      {status === "error" ? (
        <p className="mt-2 text-xs text-red-500">
          {errorMessage ??
            "Failed to publish notification. Check your AWS configuration."}
        </p>
      ) : null}
      {status === "success" ? (
        <p className="mt-2 text-xs text-sky-600">
          Test notification sent to SNS topic.
        </p>
      ) : null}
    </div>
  );
}
