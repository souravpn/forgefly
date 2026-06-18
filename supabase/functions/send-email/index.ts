import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getWelcomeEmailTemplate, getProposalEmailTemplate, getInvoiceEmailTemplate, getClientMessageTemplate, getPortalInviteEmailTemplate, getDeletionOtpEmailTemplate, getAccountantExportEmailTemplate } from '../_shared/email-templates.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_API_URL = 'https://api.resend.com/emails';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: Track email sends per user
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // emails per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { type, to, cc, reply_to, data, attachments } = await req.json();

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let subject = '';
    let html = '';
    let from = 'Forgefly <hello@forgefly.io>';

    // Generate email based on type
    switch (type) {
      case 'welcome':
        subject = 'Welcome to Forgefly! 🚀';
        html = getWelcomeEmailTemplate(data.username);
        from = 'Forgefly <hello@forgefly.io>';
        break;

      case 'proposal':
        subject = `New Proposal: ${data.proposalTitle}`;
        html = getProposalEmailTemplate(
          data.clientName,
          data.proposalTitle,
          data.amount,
          data.proposalLink
        );
        break;

      case 'invoice':
        subject = `Invoice ${data.invoiceNumber} from Forgefly`;
        html = getInvoiceEmailTemplate(
          data.clientName,
          data.invoiceNumber,
          data.amount,
          data.dueDate,
          data.paymentLink
        );
        from = 'Forgefly Billing <billing@forgefly.io>';
        break;

      case 'client_message':
        if (!data.subject || !data.message) {
          return new Response(
            JSON.stringify({ error: 'subject and message are required for client_message' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        subject = data.subject;
        html = getClientMessageTemplate(
          data.clientName,
          data.senderName || 'Your Freelancer',
          data.subject,
          data.message,
          data.portalUrl,
        );
        from = `${data.senderName || 'Forgefly'} <hello@forgefly.io>`;
        break;

      case 'portal_invite': {
        const tmpl = getPortalInviteEmailTemplate({
          clientName: data.clientName,
          clientFirstName: data.clientFirstName,
          businessName: data.businessName,
          freelancerName: data.freelancerName,
          serviceName: data.serviceName,
          portalUrl: data.portalUrl,
          token: data.token,
          problemSnippet: data.problemSnippet ?? null,
        });
        subject = tmpl.subject;
        html = tmpl.html;
        from = `${data.businessName || 'Forgefly'} <hello@forgefly.io>`;
        break;
      }

      case 'deletion_otp':
        subject = 'Your Forgefly account deletion code';
        html = getDeletionOtpEmailTemplate({ code: data.code, expiresMinutes: data.expiresMinutes ?? 10 });
        break;

      case 'accountant_export': {
        const tmpl = getAccountantExportEmailTemplate({
          businessName: data.businessName,
          year: data.year,
          freelancerName: data.freelancerName,
          downloadNote: data.downloadNote ?? '',
        });
        subject = tmpl.subject;
        html = tmpl.html;
        from = `${data.freelancerName || 'Forgefly'} <hello@forgefly.io>`;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid email type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Send email via Resend
    const resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(cc ? { cc: [cc] } : {}),
        ...(reply_to ? { reply_to: [reply_to] } : {}),
        subject,
        html,
        // attachments: [{ filename, content (base64) }]
        ...(attachments?.length ? { attachments } : {}),
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: resendData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful email send
    console.log(`Email sent successfully: ${type} to ${to} (user: ${user.id})`);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
