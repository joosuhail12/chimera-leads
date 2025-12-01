import { createAdminClient } from "@/lib/supabase/admin";

export type ContactRecord = {
    id: string;
    organization_id: string;
    account_id: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    linkedin_url: string | null;
    location: string | null;
    timezone: string | null;
    status: string;
    lifecycle_stage: string;
    assigned_to: string | null;
    last_contacted_at: string | null;
    created_at: string;
    updated_at: string;
    metadata: Record<string, any>;
    account?: {
        id: string;
        name: string;
    } | null;
};

export type CreateContactParams = {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    title?: string;
    account_id?: string;
    linkedin_url?: string;
    location?: string;
    assigned_to?: string;
};

export type UpdateContactParams = Partial<CreateContactParams> & {
    status?: string;
    lifecycle_stage?: string;
    timezone?: string;
};

export async function getContact(id: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("sales_contacts")
        .select(`
      *,
      account:sales_accounts(id, name)
    `)
        .eq("id", id)
        .single();

    if (error) throw error;
    return data as ContactRecord;
}

export async function createContact(params: CreateContactParams, userId: string, orgId: string) {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("sales_contacts")
        .insert({
            ...params,
            organization_id: orgId,
            created_by: userId,
            status: 'active',
            lifecycle_stage: 'lead'
        })
        .select()
        .single();

    if (error) throw error;
    return data as ContactRecord;
}

export async function updateContact(id: string, params: UpdateContactParams) {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("sales_contacts")
        .update(params)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data as ContactRecord;
}
