import { Metadata } from "next";
import { CustomFieldsManager } from "@/components/custom-fields/manager";

export const metadata: Metadata = {
  title: "Custom Fields | Chimera Dashboard",
};

export default function CustomFieldsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Data model
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Custom fields
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Define additional metadata for leads, newsletter contacts, and startup
          applications. Fields become available immediately inside APIs and data
          exports.
        </p>
      </header>
      <CustomFieldsManager />
    </div>
  );
}
