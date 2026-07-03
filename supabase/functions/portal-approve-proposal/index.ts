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

    const body = await req.json() as {
      engagementId?: string;
      proposalId?: string;
      action?: "approve" | "request_changes" | "track_viewed";
    };
    const { engagementId, proposalId, action } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── New path: proposalId-based (contact hub) ──────────────────────────────
    if (proposalId) {
      const { data: proposal, error: propErr } = await admin
        .from("proposals")
        .select("id, title, status, client_email, client_name, business_id, total_amount, viewed_at")
        .eq("id", proposalId)
        .maybeSingle();

      if (propErr || !proposal) {
        return new Response(JSON.stringify({ error: "Proposal not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate: caller's email must match proposal.client_email
      if (proposal.client_email !== user.email) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load business for email notification
      const { data: business } = await admin
        .from("businesses")
        .select("id, name, user_id, contact_email, extracted_data")
        .eq("id", proposal.business_id)
        .maybeSingle();

      if (action === "track_viewed") {
        if (proposal.status === "sent" && !proposal.viewed_at) {
          await admin
            .from("proposals")
            .update({ viewed_at: new Date().toISOString(), status: "viewed" })
            .eq("id", proposalId);
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "approve") {
        // 1. Update proposal status
        await admin
          .from("proposals")
          .update({ status: "accepted", responded_at: new Date().toISOString() })
          .eq("id", proposalId);

        // 2. Find contact by business_id + client_email
        const { data: contact } = await admin
          .from("contacts")
          .select("id")
          .eq("business_id", proposal.business_id)
          .eq("email", proposal.client_email)
          .maybeSingle();

        if (contact) {
          // 3. Advance pipeline lead stage
          await admin
            .from("pipeline_leads")
            .update({ stage: "Negotiating" })
            .eq("business_id", proposal.business_id)
            .eq("contact_id", contact.id)
            .not("stage", "in", '("Closed Won","Lost")');

          // 4. Set contact lifecycle_status to engaged
          await admin
            .from("contacts")
            .update({ lifecycle_status: "engaged" })
            .eq("id", contact.id);
        }

        // 5a. In-app nudge for freelancer (shows in dashboard bell immediately)
        if (business) {
          await admin.from("nudges").insert({
            user_id: business.user_id,
            business_id: business.id,
            type: "proposal_accepted",
            title: `${proposal.client_email} approved a proposal`,
            body: proposal.title || "A proposal was accepted.",
            action_url: "/dashboard/proposals",
          });

          await admin.from("notifications").insert({
            business_id: business.id,
            client_id: contact?.id ?? null,
            recipient_role: "freelancer",
            type: "proposal_accepted",
            title: `${proposal.client_email} approved a proposal`,
            body: proposal.title || "A proposal was accepted.",
            entity_type: "proposal",
            entity_id: proposalId,
          });
        }

        // 5b. Notify freelancer by email
        if (business && RESEND_API_KEY) {
          const { data: freelancerUser } = await admin.auth.admin.getUserById(business.user_id);
          const freelancerEmail = business.contact_email ?? freelancerUser?.user?.email;

          if (freelancerEmail) {
            const siteUrl = Deno.env.get("SITE_URL") ?? "https://www.forgefly.io";
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Forgefly <hello@forgefly.io>",
                to: [freelancerEmail],
                subject: `✅ Proposal approved — ${proposal.title || "your proposal"}`,
                html: `
                  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#0f0f0f;color:#e5e5e5;border-radius:12px">
                    <h2 style="color:#10b981;margin-top:0">Proposal approved 🎉</h2>
                    <p><strong>${proposal.client_email}</strong> approved <strong>${proposal.title || "your proposal"}</strong>.</p>
                    <p style="margin-top:24px">
                      <a href="${siteUrl}/dashboard/proposals" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                        View in dashboard →
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
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Legacy path: engagementId-based ───────────────────────────────────────

    if (!engagementId) {
      return new Response(JSON.stringify({ error: "engagementId or proposalId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    if (action === "track_viewed") {
      await admin
        .from("proposals")
        .update({ viewed_at: new Date().toISOString(), status: "viewed" })
        .eq("business_id", business.id)
        .eq("client_email", accessRow.client_email)
        .eq("status", "sent")
        .is("viewed_at", null);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newEngagementStatus = action === "approve" ? "active" : "proposal_sent";
    await admin.from("engagements").update({ status: newEngagementStatus }).eq("id", engagementId);

    if (action === "approve") {
      // NOTE: proposals.client_id references `clients`, while engagement.contact_id
      // references `contacts` — they are different ID spaces and must never be
      // compared directly. Match the proposal by business + client email + title instead.
      const clientEmail = accessRow.client_email ?? user.email ?? null;
      let matchedProposalId: string | null = null;

      if (clientEmail) {
        const proposalQuery = admin
          .from("proposals")
          .select("id")
          .eq("business_id", business.id)
          .eq("client_email", clientEmail)
          .eq("status", "sent");

        const { data: matchedProposal } = engagement.service_name
          ? await proposalQuery.eq("title", engagement.service_name).maybeSingle()
          : await proposalQuery.maybeSingle();

        if (matchedProposal) {
          matchedProposalId = matchedProposal.id;
          await admin
            .from("proposals")
            .update({ status: "accepted", responded_at: new Date().toISOString() })
            .eq("id", matchedProposal.id);
        }
      }

      if (engagement.contact_id) {
        await admin
          .from("pipeline_leads")
          .update({ stage: "Negotiating" })
          .eq("business_id", business.id)
          .eq("contact_id", engagement.contact_id)
          .not("stage", "in", '("Closed Won","Lost")');

        await admin
          .from("contacts")
          .update({ lifecycle_status: "engaged" })
          .eq("id", engagement.contact_id);
      }

      // In-app nudge + notification for freelancer (legacy path was missing these)
      const clientLabel = clientEmail ?? "A client";
      await admin.from("nudges").insert({
        user_id: business.user_id,
        business_id: business.id,
        type: "proposal_accepted",
        title: `${clientLabel} approved a proposal`,
        body: engagement.service_name || "A proposal was accepted.",
        action_url: "/dashboard/proposals",
      });

      await admin.from("notifications").insert({
        business_id: business.id,
        client_id: engagement.contact_id ?? null,
        recipient_role: "freelancer",
        type: "proposal_accepted",
        title: `${clientLabel} approved a proposal`,
        body: engagement.service_name || "A proposal was accepted.",
        entity_type: "proposal",
        entity_id: matchedProposalId,
      });
    }

    if (action === "approve" && RESEND_API_KEY) {
      const { data: freelancerUser } = await admin.auth.admin.getUserById(business.user_id);
      const freelancerEmail = business.contact_email ?? freelancerUser?.user?.email;

      if (freelancerEmail) {
        const clientEmail = accessRow.client_email ?? user.email ?? "your client";
        const serviceName = engagement.service_name ?? "your proposal";
        const siteUrl = Deno.env.get("SITE_URL") ?? "https://www.forgefly.io";
        const portalUrl = `${siteUrl}/portal/${engagement.portal_token}`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Forgefly <hello@forgefly.io>",
            to: [freelancerEmail],
            subject: `✅ Proposal approved — ${serviceName}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#0f0f0f;color:#e5e5e5;border-radius:12px">
                <h2 style="color:#10b981;margin-top:0">Proposal approved 🎉</h2>
                <p><strong>${clientEmail}</strong> approved <strong>${serviceName}</strong> on your ${business.name} portal.</p>
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
