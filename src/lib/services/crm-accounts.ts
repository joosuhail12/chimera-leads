import { createAdminClient } from "@/lib/supabase/admin";

export type AccountRecord = {
    id: string;
    organization_id: string;
    name: string;
    domain: string | null;
    industry: string | null;
    size: string | null;
    location: string | null;
    description: string | null;
    linkedin_url: string | null;
    website: string | null;
    annual_revenue: string | null;
    founded_year: number | null;
    status: string;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
    metadata: Record<string, any>;
};

export type CreateAccountParams = {
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
    location?: string;
    website?: string;
    linkedin_url?: string;
    description?: string;
    assigned_to?: string;
};

export type UpdateAccountParams = Partial<CreateAccountParams> & {
    status?: string;
    annual_revenue?: string;
    founded_year?: number;
};

export async function getAccount(id: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("sales_accounts")
        .select("*")
        .eq("id", id)
        .single();

    if (error) throw error;
    return data as AccountRecord;
}

export async function createAccount(params: CreateAccountParams, userId: string, orgId: string) {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("sales_accounts")
        .insert({
            ...params,
            organization_id: orgId,
            created_by: userId,
            status: 'active'
        })
        .select()
        .single();

    if (error) throw error;
    return data as AccountRecord;
}

export async function updateAccount(id: string, params: UpdateAccountParams) {
    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("sales_accounts")
        .update(params)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data as AccountRecord;
}

export async function getAccountContacts(accountId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("sales_contacts")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

export async function getAccountLeads(accountId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("sales_leads")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}
