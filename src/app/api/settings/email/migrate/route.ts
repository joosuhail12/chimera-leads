import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

// This is a temporary route to create the table if it doesn't exist
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const supabase = await createClient();

    // Create the table if it doesn't exist
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create organization email settings table for managing custom domains and email addresses
        CREATE TABLE IF NOT EXISTS organization_email_settings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id TEXT NOT NULL UNIQUE,
          from_name TEXT,
          from_email TEXT NOT NULL,
          reply_to_email TEXT,
          domain TEXT,
          is_verified BOOLEAN DEFAULT FALSE,
          verification_token TEXT,
          dkim_tokens TEXT[],
          spf_record TEXT,
          dkim_verified BOOLEAN DEFAULT FALSE,
          spf_verified BOOLEAN DEFAULT FALSE,
          verification_status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_by TEXT,
          CONSTRAINT unique_org_email UNIQUE(organization_id, from_email)
        );

        -- Create indexes if they don't exist
        CREATE INDEX IF NOT EXISTS idx_org_email_settings_org_id ON organization_email_settings(organization_id);
        CREATE INDEX IF NOT EXISTS idx_org_email_settings_verified ON organization_email_settings(is_verified);
      `
    }).single();

    if (error) {
      console.error("Migration error:", error);
      // If exec_sql doesn't exist, try direct query
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS organization_email_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id TEXT NOT NULL UNIQUE,
          from_name TEXT,
          from_email TEXT NOT NULL,
          reply_to_email TEXT,
          domain TEXT,
          is_verified BOOLEAN DEFAULT FALSE,
          verification_token TEXT,
          dkim_tokens TEXT[],
          spf_record TEXT,
          dkim_verified BOOLEAN DEFAULT FALSE,
          spf_verified BOOLEAN DEFAULT FALSE,
          verification_status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_by TEXT,
          CONSTRAINT unique_org_email UNIQUE(organization_id, from_email)
        )
      `;

      // This won't work with Supabase client, but we'll return instructions
      return NextResponse.json({
        success: false,
        message: "Please run the migration manually in Supabase SQL Editor",
        sql: createTableQuery
      });
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully"
    });
  } catch (error) {
    console.error("Failed to run migration", error);
    return NextResponse.json({
      success: false,
      error: "Failed to run migration",
      message: "Please run the migration manually in Supabase SQL Editor"
    }, { status: 500 });
  }
}