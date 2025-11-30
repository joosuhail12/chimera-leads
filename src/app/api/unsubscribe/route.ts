import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CHANNELS = new Set<marketing_channel>(["email", "sms", "push"]);
type marketing_channel = "email" | "sms" | "push";

function renderHtml(message: string) {
  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Chimera notifications</title>
        <style>
          body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#f5f7fb; color:#0f172a; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
          .card { background:#fff; border-radius:18px; padding:32px; max-width:420px; box-shadow:0 25px 50px -25px rgba(15,23,42,.45); text-align:center; }
          h1 { font-size:20px; margin-bottom:12px; }
          p { font-size:14px; color:#475569; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Notification preferences updated</h1>
          <p>${message}</p>
        </div>
      </body>
    </html>`,
    {
      headers: { "content-type": "text/html; charset=utf-8" },
    }
  );
}

function verifyToken(
  audienceId: string,
  channel: marketing_channel,
  token: string | null
) {
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET;
  if (!secret) {
    throw new Error(
      "MARKETING_UNSUBSCRIBE_SECRET is not configured. Unable to verify unsubscribe links."
    );
  }

  if (!token) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${audienceId}:${channel}`)
    .digest("hex");

  return token === expected;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const audienceId = url.searchParams.get("audienceId");
  const channelParam = (url.searchParams.get("channel") ??
    "email") as marketing_channel;
  const token = url.searchParams.get("token");
  const scope = url.searchParams.get("scope") ?? "channel";
  const reason =
    url.searchParams.get("reason") ?? "user_clicked_unsubscribe_link";

  if (!audienceId) {
    return NextResponse.json(
      { error: "Missing audienceId" },
      { status: 400 }
    );
  }

  if (!CHANNELS.has(channelParam)) {
    return NextResponse.json(
      { error: "Unsupported channel. Use email, sms, or push." },
      { status: 400 }
    );
  }

  try {
    const valid = verifyToken(audienceId, channelParam, token);
    if (!valid) {
      return NextResponse.json({ error: "Invalid unsubscribe token." }, { status: 401 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Server is not configured to process unsubscribe links." },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();
  const preferenceUpdates: Record<string, unknown> = {
    audience_id: audienceId,
  };

  if (scope === "global") {
    preferenceUpdates.email_status = "unsubscribed";
    preferenceUpdates.sms_status = "unsubscribed";
    preferenceUpdates.push_status = "unsubscribed";
  } else {
    preferenceUpdates[`${channelParam}_status`] = "unsubscribed";
  }

  const { error } = await supabase
    .from("marketing_subscription_preferences")
    .upsert(preferenceUpdates, { onConflict: "audience_id" })
    .select("audience_id")
    .single();

  if (error) {
    console.error("Failed to update marketing_subscription_preferences", error);
    return NextResponse.json(
      { error: "Unable to update subscription preferences." },
      { status: 500 }
    );
  }

  if (scope === "global") {
    const { data: audienceRecord } = await supabase
      .from("audience")
      .select("email")
      .eq("id", audienceId)
      .single();

    const { data: suppressionList } = await supabase
      .from("suppression_lists")
      .select("id")
      .eq("scope", "global")
      .eq("name", "Global Suppression")
      .limit(1)
      .single();

    if (suppressionList?.id) {
      await supabase
        .from("suppression_entries")
        .insert({
          suppression_list_id: suppressionList.id,
          audience_id: audienceId,
          email: audienceRecord?.email ?? null,
          reason,
        });
    }
  }

  return renderHtml(
    scope === "global"
      ? "You will no longer receive marketing messages from Chimera."
      : `You will no longer receive ${channelParam} updates.`
  );
}
