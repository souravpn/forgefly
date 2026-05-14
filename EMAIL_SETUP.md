# Quick Email Setup Guide

## 1. Get Resend API Key

1. Go to https://resend.com
2. Sign up for free account (100 emails/day)
3. Navigate to **API Keys** section
4. Click **Create API Key**
5. Copy the key (starts with `re_`)

## 2. Add API Key to Supabase

The system will prompt you to add the `RESEND_API_KEY` when you first try to send an email.

## 3. Test Email Functionality

### Test Welcome Email
1. Create a new user account
2. Welcome email sent automatically
3. Check email inbox

### Test Proposal Email
1. Go to **Proposals** page
2. Create a proposal with client email
3. Click **Send** button
4. Confirm in dialog
5. Check client email

### Test Invoice Email
1. Go to **Invoices** page
2. Create an invoice with client email
3. Click **Send** button
4. Confirm in dialog
5. Check client email

## 4. Email Features

✅ **Welcome Email**
- Sent automatically after signup
- Features Forgefly branding
- Lists key features
- Call-to-action to dashboard

✅ **Proposal Email**
- Professional proposal presentation
- Investment amount highlighted
- Secure proposal link
- Branded design

✅ **Invoice Email**
- Invoice number and amount
- Due date
- Stripe payment link
- Security badges

## 5. Design System

All emails use the Forgefly brand colors:
- **Background**: Dark Navy (#0A1428)
- **Primary**: Emerald (#10B981)
- **Secondary**: Gold (#F59E0B)
- **Text**: White/Gray

## 6. Rate Limiting

- **Limit**: 10 emails per minute per user
- **Purpose**: Prevent abuse and API quota exhaustion
- **Error**: User-friendly message if limit exceeded

## 7. Production Tips

### Before Going Live:
1. Add verified domain to Resend
2. Update `from` email address in Edge Function
3. Configure SPF/DKIM records
4. Test deliverability
5. Monitor Edge Function logs

### Domain Verification:
```typescript
// Update in: supabase/functions/send-email/index.ts
let from = 'Forgefly <hello@yourdomain.com>';
```

## 8. Troubleshooting

**Email not sending?**
- Check Resend API key is configured
- Verify Edge Function is deployed
- Check browser console for errors
- Review Supabase logs

**Email goes to spam?**
- Verify domain with Resend
- Add SPF/DKIM records
- Test with mail-tester.com

**Rate limit hit?**
- Wait 1 minute
- Or increase limit in Edge Function

## 9. Files Modified

- `supabase/functions/_shared/email-templates.ts` - Email HTML templates
- `supabase/functions/send-email/index.ts` - Email sending Edge Function
- `src/pages/ProposalsPage.tsx` - Proposal email integration
- `src/pages/InvoicesPage.tsx` - Invoice email integration
- `src/contexts/AuthContext.tsx` - Welcome email on signup

## 10. Demo Ready! 🚀

All email functionality is production-ready and demo-ready for the Build with MeDo Hackathon!

**Key Highlights**:
- Beautiful branded emails matching website design
- Automatic welcome emails
- Professional proposal and invoice emails
- Stripe payment link integration
- Rate limiting and security
- Error handling and logging
- Mobile-responsive templates

**Perfect for showcasing professional business automation!** 📧✨
