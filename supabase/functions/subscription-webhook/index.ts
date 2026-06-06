import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'npm:stripe@19.1.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getAgencyUpgradeEmailTemplate } from '../_shared/email-templates.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function sendAgencyUpgradeEmail(userId: string, billingCycle: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured, skipping email');
    return;
  }

  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!authUser?.user?.email) {
      console.error('Could not retrieve user email for', userId);
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username, full_name')
      .eq('id', userId)
      .single();

    const displayName = profile?.full_name || profile?.username || 'there';
    const html = getAgencyUpgradeEmailTemplate(displayName, billingCycle);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Forgefly <hello@forgefly.io>',
        to: [authUser.user.email],
        subject: 'Welcome to Forgefly Agency! 🎉',
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Failed to send agency upgrade email:', err);
    } else {
      console.log('Agency upgrade email sent to', authUser.user.email);
    }
  } catch (err) {
    console.error('Error sending agency upgrade email:', err);
  }
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log('Webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const billingCycle = session.metadata?.billing_cycle ?? 'monthly';

        if (!userId) {
          console.error('No user_id in session metadata');
          break;
        }

        // Get subscription details
        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Determine amount from actual Stripe price
        const unitAmount = subscription.items.data[0]?.price?.unit_amount ?? 100;

        // Update user subscription in database
        await supabaseAdmin
          .from('subscriptions')
          .update({
            tier: 'agency',
            status: 'active',
            billing_cycle: billingCycle,
            amount: unitAmount,
            stripe_subscription_id: subscriptionId,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log('Subscription activated for user:', userId);

        // Send congratulatory email
        await sendAgencyUpgradeEmail(userId, billingCycle);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by customer ID
        const { data: userSub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userSub) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active' : 'inactive',
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userSub.user_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by customer ID
        const { data: userSub } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (userSub) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              tier: 'freelancer',
              status: 'cancelled',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userSub.user_id);
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
