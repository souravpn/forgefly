import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19.1.0";

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

    const { token, invoiceId } = await req.json();

    if (!token || !invoiceId) {
      return new Response(JSON.stringify({ error: "token and invoiceId are required" }), {
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

    // Verify invoice belongs to this client
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount, description, payment_status, user_id")
      .eq("id", invoiceId)
      .eq("client_id", tokenData.client_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoice.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "Invoice is already paid" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });

    const siteUrl = Deno.env.get("SITE_URL") || "https://www.forgefly.io";
    const portalUrl = `${siteUrl}/portal/${token}`;

    // Look up freelancer's connected Stripe account
    const { data: freelancerProfile } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_account_status")
      .eq("id", invoice.user_id)
      .single();

    const connectedAccountId =
      freelancerProfile?.stripe_account_status === "active"
        ? freelancerProfile.stripe_account_id
        : null;

    // Platform fee: set PLATFORM_FEE_PERCENT env var (e.g. "2" for 2%). Defaults to 0.
    const feePercent = Number(Deno.env.get("PLATFORM_FEE_PERCENT") ?? "0");
    const unitAmount = Math.round(Number(invoice.amount) * 100);
    const applicationFeeAmount = connectedAccountId
      ? Math.round(unitAmount * (feePercent / 100))
      : 0;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.description || `Payment for invoice ${invoice.invoice_number}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${portalUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${portalUrl}?payment=cancelled`,
    };

    if (connectedAccountId) {
      sessionParams.payment_intent_data = {
        transfer_data: { destination: connectedAccountId },
        ...(applicationFeeAmount > 0 && { application_fee_amount: applicationFeeAmount }),
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Update invoice with session ID
    await supabase
      .from("invoices")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", invoiceId);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in portal-create-checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
