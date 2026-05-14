# Forgefly Stripe Integration Setup Guide

## Overview
Forgefly now includes full Stripe payment integration for accepting payments on invoices and managing service packages. This guide will help you configure Stripe for your hackathon demo.

## Prerequisites
- Stripe account (sign up at https://stripe.com)
- Forgefly application deployed with Supabase backend

## Setup Steps

### 1. Get Your Stripe API Keys

1. Log in to your Stripe Dashboard: https://dashboard.stripe.com
2. Click on **Developers** in the left sidebar
3. Click on **API keys**
4. You'll see two keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`) - Click "Reveal test key"

### 2. Configure Stripe Keys in Forgefly

When you first access the Invoices page or try to create a package, Forgefly will prompt you to enter:

1. **STRIPE_PUBLISHABLE_KEY**: Your publishable key (pk_test_...)
2. **STRIPE_SECRET_KEY**: Your secret key (sk_test_...)
3. **STRIPE_WEBHOOK_SECRET**: We'll set this up in step 3

### 3. Set Up Stripe Webhooks

Webhooks allow Stripe to notify Forgefly when payments succeed or fail.

1. In Stripe Dashboard, go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL:
   ```
   https://swoeymxafinvbnjgrhqy.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events to listen to:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Click **Add endpoint**
6. Click on the newly created endpoint
7. Click **Reveal** under "Signing secret"
8. Copy the signing secret (starts with `whsec_...`)
9. Add this as **STRIPE_WEBHOOK_SECRET** in Forgefly

## Testing Payments

### Test Card Numbers

Use these test card numbers in Stripe Checkout:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

For all test cards:
- Use any future expiration date (e.g., 12/34)
- Use any 3-digit CVC (e.g., 123)
- Use any ZIP code (e.g., 12345)

### Payment Flow

1. **Create an Invoice**:
   - Go to Invoices page
   - Click "Create Invoice"
   - Fill in client, project, amount, and dates
   - Save the invoice

2. **Send the Invoice**:
   - Click "Send" on the invoice
   - Status changes to "Sent"

3. **Pay with Stripe**:
   - Click "Pay with Stripe" button
   - You'll be redirected to Stripe Checkout
   - Enter test card: `4242 4242 4242 4242`
   - Complete the payment

4. **Verify Payment**:
   - You'll be redirected to the success page
   - Invoice status automatically updates to "Paid"
   - Payment appears in Dashboard under "Recent Payments"
   - Revenue statistics update automatically

## Features

### Service Packages
- Create one-time or monthly recurring packages
- Set custom pricing and features
- Activate/deactivate packages
- Track package subscriptions

### Invoice Payments
- "Pay with Stripe" button on sent invoices
- Secure Stripe Checkout hosted page
- Automatic status updates via webhooks
- Payment history tracking

### Dashboard Analytics
- Total revenue (includes Stripe payments)
- Pending invoices amount
- Recent payment transactions
- Real-time updates

### Payment Security
- All payments processed through Stripe's secure infrastructure
- PCI compliance handled by Stripe
- Webhook signature verification
- Test mode for safe development

## Troubleshooting

### Payment not updating invoice status
- Check that webhook is configured correctly
- Verify webhook secret is correct
- Check Supabase Edge Function logs

### Checkout session creation fails
- Verify Stripe secret key is correct
- Check that client has an email address
- Review browser console for errors

### Webhook events not received
- Confirm webhook URL is correct
- Check that webhook is not disabled in Stripe
- Verify selected events include `checkout.session.completed`

## Production Deployment

When ready for production:

1. Switch to Stripe live mode keys
2. Update webhook endpoint to production URL
3. Replace test keys with live keys (pk_live_... and sk_live_...)
4. Test with real payment methods
5. Monitor Stripe Dashboard for transactions

## Support

For Stripe-specific issues:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com

For Forgefly issues:
- Check Supabase logs
- Review Edge Function logs
- Verify database schema and RLS policies

## Security Notes

- Never commit API keys to version control
- Keep secret keys secure and private
- Use environment variables for all keys
- Regularly rotate API keys
- Monitor Stripe Dashboard for suspicious activity
