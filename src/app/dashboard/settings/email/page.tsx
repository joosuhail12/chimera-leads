import { DomainSettings } from "@/components/settings/domain-settings";

export default function EmailSettingsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="mb-8 text-3xl font-bold">Email Settings</h1>
      <DomainSettings />
    </div>
  );
}