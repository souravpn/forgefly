import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-12-18.acacia',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_KEY') ?? ''
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log('Webhook event received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;
        const userId = session.metadata?.user_id;
        const clientId = session.metadata?.client_id;

        if (!invoiceId || !userId) {
          console.error('Missing metadata in checkout session');
          break;
        }

        const paymentIntentId = session.payment_intent as string;

        await supabaseAdmin
          .from('invoices')
          .update({
            status: 'paid',
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntentId,
          })
          .eq('id', invoiceId);

        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          
          await supabaseAdmin
            .from('payments')
            .insert({
              user_id: userId,
              client_id: clientId || null,
              invoice_id: invoiceId,
              stripe_payment_intent_id: paymentIntentId,
              stripe_charge_id: paymentIntent.latest_charge as string || null,
              amount: session.amount_total ? session.amount_total / 100 : 0,
              currency: session.currency || 'usd',
              status: 'succeeded',
              payment_method_type: paymentIntent.payment_method_types?.[0] || null,
            });
        }

        console.log('Payment processed successfully for invoice:', invoiceId);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        const { data: invoice } = await supabaseAdmin
          .from('invoices')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .maybeSingle();

        if (invoice) {
          await supabaseAdmin
            .from('invoices')
            .update({
              payment_status: 'failed',
            })
            .eq('id', invoice.id);
        }

        console.log('Payment failed for payment intent:', paymentIntent.id);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('stripe_charge_id', charge.id)
          .maybeSingle();

        if (payment) {
          await supabaseAdmin
            .from('payments')
            .update({
              status: 'refunded',
            })
            .eq('id', payment.id);

          if (payment.invoice_id) {
            await supabaseAdmin
              .from('invoices')
              .update({
                payment_status: 'unpaid',
                status: 'sent',
              })
              .eq('id', payment.invoice_id);
          }
        }

        console.log('Charge refunded:', charge.id);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
