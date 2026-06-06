import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { token, proposalId, action } = await req.json();

    if (!token || !proposalId || !action) {
      return new Response(JSON.stringify({ error: "token, proposalId, and action are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "approve" && action !== "request_changes") {
      return new Response(JSON.stringify({ error: "action must be approve or request_changes" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate portal token
    const { data: tokenData, error: tokenError } = await supabase
      .from("client_portal_tokens")
      .select("client_id, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: "Invalid portal token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Portal token has expired" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify proposal belongs to this client
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, status, project_id")
      .eq("id", proposalId)
      .eq("client_id", tokenData.client_id)
      .single();

    if (proposalError || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (proposal.status !== "sent") {
      return new Response(JSON.stringify({ error: "Proposal is not in a state that can be actioned" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = action === "approve" ? "accepted" : "rejected";

    // Update proposal status
    const { error: updateError } = await supabase
      .from("proposals")
      .update({ status: newStatus })
      .eq("id", proposalId);

    if (updateError) throw updateError;

    // On approval, move associated project to in_progress
    if (action === "approve" && proposal.project_id) {
      await supabase
        .from("projects")
        .update({ status: "in_progress" })
        .eq("id", proposal.project_id)
        .eq("status", "lead");
    }

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in portal-approve-proposal:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
