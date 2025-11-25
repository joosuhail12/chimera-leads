import { Metadata } from "next";
import { MarketingListsManager } from "@/components/marketing-lists/manager";

export const metadata: Metadata = {
  title: "Marketing Lists | Chimera Dashboard",
};

export default function MarketingListsPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Marketing
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Subscriber lists
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create and refresh audience segments to power newsletters and lifecycle
          campaigns.
        </p>
      </header>

      <MarketingListsManager />
    </div>
  );
}
