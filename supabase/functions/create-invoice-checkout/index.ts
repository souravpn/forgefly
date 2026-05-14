import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19.1.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const successUrlPath = '/payment/success?session_id={CHECKOUT_SESSION_ID}';
const cancelUrlPath = '/invoices';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ok(data: any): Response {
  return new Response(
    JSON.stringify({ code: "SUCCESS", message: "Success", data }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    }
  );
}

function fail(msg: string, code = 400): Response {
  return new Response(
    JSON.stringify({ code: "FAIL", message: msg }),
    {
      status: code,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    }
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: authError } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null }, error: null };

    if (!user) {
      throw new Error("Authentication required");
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, clients(name, email)")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found or access denied");
    }

    if (invoice.payment_status === 'paid') {
      throw new Error("Invoice is already paid");
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Create Stripe checkout session
    const origin = req.headers.get("origin") || "";
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: invoice.currency || 'usd',
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.description || `Payment for invoice ${invoice.invoice_number}`,
            },
            unit_amount: Math.round(Number(invoice.amount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}${successUrlPath}`,
      cancel_url: `${origin}${cancelUrlPath}`,
      customer_email: invoice.clients?.email || undefined,
      metadata: {
        invoice_id: invoice.id,
        user_id: user.id,
        invoice_number: invoice.invoice_number,
      },
    });

    // Update invoice with session ID
    await supabase
      .from("invoices")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", invoice.id);

    // Create payment record
    await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        client_id: invoice.client_id,
        invoice_id: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency || 'usd',
        status: 'pending',
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent as string,
      });

    return ok({
      url: session.url,
      sessionId: session.id,
      invoiceId: invoice.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return fail(error instanceof Error ? error.message : "Payment processing failed", 500);
  }
});
