import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmailTemplatesManager } from "@/components/email-templates/manager";

export const metadata: Metadata = {
  title: "Email Templates | Chimera Dashboard",
};

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <EmailTemplatesManager templates={data ?? []} />
    </div>
  );
}
