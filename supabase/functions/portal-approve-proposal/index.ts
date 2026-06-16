import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is authenticated
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { engagementId, action } = await req.json() as {
      engagementId?: string;
      action?: "approve" | "request_changes";
    };

    if (!engagementId || !action) {
      return new Response(JSON.stringify({ error: "engagementId and action are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has access to this engagement via engagement_access
    const { data: accessRow } = await admin
      .from("engagement_access")
      .select("id, client_email")
      .eq("engagement_id", engagementId)
      .or(`client_user_id.eq.${user.id},client_email.eq.${user.email}`)
      .maybeSingle();

    if (!accessRow) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load engagement + business + freelancer profile
    const { data: engagement, error: engErr } = await admin
      .from("engagements")
      .select("*, businesses!inner(id, name, user_id, contact_email, extracted_data)")
      .eq("id", engagementId)
      .single();

    if (engErr || !engagement) {
      return new Response(JSON.stringify({ error: "Engagement not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const business = engagement.businesses as {
      id: string; name: string; user_id: string;
      contact_email: string | null; extracted_data: Record<string, unknown> | null;
    };

    // 1. Update engagement status
    const newEngagementStatus = action === "approve" ? "active" : "proposal_sent";
    await admin
      .from("engagements")
      .update({ status: newEngagementStatus })
      .eq("id", engagementId);

    // 2. Update linked proposal (match by business + contact + sent status)
    if (action === "approve" && engagement.contact_id) {
      await admin
        .from("proposals")
        .update({ status: "accepted" })
        .eq("user_id", business.user_id)
        .eq("client_id", engagement.contact_id)
        .eq("status", "sent");
    }

    // 3. Advance pipeline lead to Closed Won on approval
    if (action === "approve" && engagement.contact_id) {
      await admin
        .from("pipeline_leads")
        .update({ stage: "Closed Won" })
        .eq("business_id", business.id)
        .eq("contact_id", engagement.contact_id)
        .neq("stage", "Closed Won");
    }

    // 4. Notify the freelancer by email
    if (action === "approve" && RESEND_API_KEY) {
      // Get freelancer's email from their auth profile
      const { data: freelancerUser } = await admin.auth.admin.getUserById(business.user_id);
      const freelancerEmail = business.contact_email ?? freelancerUser?.user?.email;

      if (freelancerEmail) {
        const clientEmail = accessRow.client_email ?? user.email ?? "your client";
        const serviceName = engagement.service_name ?? "your proposal";
        const businessName = business.name;
        const portalUrl = `${Deno.env.get("SITE_URL") ?? "https://www.forgefly.io"}/portal/${engagement.portal_token}`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `Forgefly <hello@forgefly.io>`,
            to: [freelancerEmail],
            subject: `✅ Proposal approved — ${serviceName}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#0f0f0f;color:#e5e5e5;border-radius:12px">
                <h2 style="color:#10b981;margin-top:0">Proposal approved 🎉</h2>
                <p><strong>${clientEmail}</strong> approved <strong>${serviceName}</strong> on your ${businessName} portal.</p>
                <p style="margin-top:24px">
                  <a href="${portalUrl}" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                    View portal →
                  </a>
                </p>
                <p style="color:#666;font-size:12px;margin-top:32px">Powered by Forgefly</p>
              </div>
            `,
          }),
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("portal-approve-proposal error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
