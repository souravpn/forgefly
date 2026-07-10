import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19.1.0";
import { resolveContactIdByPhone, sendWhatsapp } from "../_shared/whatsappSend.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

async function updateInvoiceAndPayment(
  sessionId: string,
  session: Stripe.Checkout.Session
): Promise<boolean> {
  try {
    // Get invoice by session ID
    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("id, payment_status, user_id, client_id, invoice_number")
      .eq("stripe_checkout_session_id", sessionId)
      .single();

    if (fetchError || !invoice) {
      console.error("Invoice not found:", fetchError);
      return false;
    }

    if (invoice.payment_status === "paid") {
      return true; // Already paid
    }

    // Update invoice status
    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", invoice.id)
      .eq("payment_status", "unpaid"); // Optimistic locking

    if (invoiceError) {
      console.error("Failed to update invoice:", invoiceError);
      return false;
    }

    // Update payment record
    const { error: paymentError } = await supabase
      .from("payments")
      .update({
        status: "paid",
        customer_email: session.customer_details?.email,
        customer_name: session.customer_details?.name,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_checkout_session_id", sessionId);

    if (paymentError) {
      console.error("Failed to update payment:", paymentError);
    }

    // WhatsApp notifications — best-effort, only fires on the transition we just made
    const { data: business } = await supabase
      .from("businesses")
      .select("id, contact_phone")
      .eq("user_id", invoice.user_id)
      .eq("status", "active")
      .maybeSingle();

    if (business) {
      if (business.contact_phone) {
        await sendWhatsapp(supabase, {
          businessId: business.id,
          toPhone: business.contact_phone,
          bodyText: `Invoice ${invoice.invoice_number} was paid.`,
        });
      }
      if (invoice.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("phone")
          .eq("id", invoice.client_id)
          .maybeSingle();
        if (client?.phone) {
          const clientId = await resolveContactIdByPhone(supabase, business.id, client.phone);
          await sendWhatsapp(supabase, {
            businessId: business.id,
            toPhone: client.phone,
            clientId,
            bodyText: `Payment received for invoice ${invoice.invoice_number} — thank you!`,
          });
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Error updating invoice and payment:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return ok({
        verified: false,
        status: session.payment_status,
        sessionId: session.id,
      });
    }

    // Update invoice and payment records
    const updated = await updateInvoiceAndPayment(sessionId, session);

    return ok({
      verified: true,
      status: "paid",
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
      amount: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email,
      customerName: session.customer_details?.name,
      invoiceUpdated: updated,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return fail(error instanceof Error ? error.message : "Payment verification failed", 500);
  }
});
