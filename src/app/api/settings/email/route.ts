import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET: List organization's email settings
export async function GET(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const organizationId = orgId;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_email_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching email settings:", error);
      return new NextResponse("Internal Error", { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Failed to fetch email settings", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// POST: Add new email address/domain
export async function POST(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { from_name, from_email, reply_to_email, organization_id, created_by } = body;

    if (!from_email || !organization_id) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Validate that user belongs to the organization
    if (orgId !== organization_id) {
      return new NextResponse("Unauthorized for this organization", { status: 403 });
    }

    // Extract domain from email
    const domain = from_email.includes('@') ? from_email.split('@')[1] : null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_email_settings")
      .insert({
        organization_id,
        from_name,
        from_email,
        reply_to_email,
        domain,
        created_by: created_by || userId,
        is_verified: false,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding email setting:", error);
      if (error.code === '23505') { // Unique constraint violation
        return new NextResponse("This email is already configured", { status: 409 });
      }
      return new NextResponse("Internal Error", { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to add email setting", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// PATCH: Update email settings
export async function PATCH(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Missing email setting ID", { status: 400 });
    }

    const body = await request.json();

    const supabase = await createClient();

    // First, verify the email setting belongs to user's organization
    const { data: existing, error: fetchError } = await supabase
      .from("organization_email_settings")
      .select("organization_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return new NextResponse("Email setting not found", { status: 404 });
    }

    if (existing.organization_id !== orgId) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Update the setting
    const { data, error } = await supabase
      .from("organization_email_settings")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating email setting:", error);
      return new NextResponse("Internal Error", { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update email setting", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// DELETE: Remove email configuration
export async function DELETE(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Missing email setting ID", { status: 400 });
    }

    const supabase = await createClient();

    // First, verify the email setting belongs to user's organization
    const { data: existing, error: fetchError } = await supabase
      .from("organization_email_settings")
      .select("organization_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return new NextResponse("Email setting not found", { status: 404 });
    }

    if (existing.organization_id !== orgId) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Delete the setting
    const { error } = await supabase
      .from("organization_email_settings")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting email setting:", error);
      return new NextResponse("Internal Error", { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete email setting", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}