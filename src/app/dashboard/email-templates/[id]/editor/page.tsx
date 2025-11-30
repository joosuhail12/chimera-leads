import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmailTemplateBuilder } from "@/components/email-templates/builder";
import type { EmailTemplate } from "@/components/email-templates/manager";

export const dynamic = "force-dynamic";

export default async function EmailTemplateEditorPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = createAdminClient();

    let template: EmailTemplate | null = null;

    if (id !== "new") {
        const { data } = await supabase
            .from("email_templates")
            .select("*")
            .eq("id", id)
            .single();

        if (!data) {
            notFound();
        }
        template = data;
    }

    return <EmailTemplateBuilder template={template} />;
}
