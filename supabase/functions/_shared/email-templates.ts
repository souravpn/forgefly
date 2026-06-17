// Email template utilities for Forgefly
// Dark navy theme with emerald/gold accents

export const emailStyles = `
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: #0A1428;
    color: #E5E7EB;
  }
  .email-container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #0A1428;
  }
  .email-header {
    padding: 40px 24px;
    text-align: center;
    background: linear-gradient(135deg, #0A1428 0%, #1a2942 100%);
    border-bottom: 2px solid rgba(16, 185, 129, 0.2);
  }
  .logo {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    border-radius: 12px;
  }
  .brand-name {
    font-size: 28px;
    font-weight: 700;
    color: #FFFFFF;
    margin: 0;
  }
  .tagline {
    font-size: 14px;
    color: #9CA3AF;
    margin: 8px 0 0;
  }
  .email-body {
    padding: 40px 24px;
  }
  .greeting {
    font-size: 24px;
    font-weight: 600;
    color: #FFFFFF;
    margin: 0 0 16px;
  }
  .content {
    font-size: 16px;
    line-height: 1.6;
    color: #D1D5DB;
    margin: 0 0 24px;
  }
  .button {
    display: inline-block;
    padding: 14px 32px;
    background: linear-gradient(135deg, #10B981 0%, #F59E0B 100%);
    color: #FFFFFF;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    margin: 16px 0;
  }
  .button:hover {
    opacity: 0.9;
  }
  .info-box {
    background-color: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 8px;
    padding: 20px;
    margin: 24px 0;
  }
  .info-label {
    font-size: 12px;
    color: #10B981;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 4px;
  }
  .info-value {
    font-size: 18px;
    font-weight: 600;
    color: #FFFFFF;
    margin: 0;
  }
  .divider {
    height: 1px;
    background-color: rgba(255, 255, 255, 0.1);
    margin: 32px 0;
  }
  .footer {
    padding: 32px 24px;
    text-align: center;
    background-color: rgba(255, 255, 255, 0.02);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .footer-text {
    font-size: 14px;
    color: #9CA3AF;
    margin: 8px 0;
  }
  .footer-link {
    color: #10B981;
    text-decoration: none;
  }
  .list-item {
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .list-item:last-child {
    border-bottom: none;
  }
`;

export function getWelcomeEmailTemplate(username: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Forgefly</title>
  <style>${emailStyles}</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <img src="/forgefly-icon.png" alt="Forgefly Logo" class="logo" />
      <h1 class="brand-name">Forgefly</h1>
      <p class="tagline">Forge Your Freedom</p>
    </div>
    
    <div class="email-body">
      <h2 class="greeting">Welcome aboard, ${username}! 🚀</h2>
      
      <p class="content">
        We're thrilled to have you join Forgefly, the AI-powered business OS designed specifically for solopreneurs and freelancers like you.
      </p>
      
      <p class="content">
        You now have access to everything you need to scale your freelance business:
      </p>
      
      <div class="info-box">
        <div class="list-item">
          <p class="info-label">✨ AI Proposal Generation</p>
          <p style="color: #D1D5DB; font-size: 14px; margin: 4px 0 0;">Create winning proposals in minutes</p>
        </div>
        <div class="list-item">
          <p class="info-label">📊 Financial Dashboard</p>
          <p style="color: #D1D5DB; font-size: 14px; margin: 4px 0 0;">Track revenue, expenses, and forecasts</p>
        </div>
        <div class="list-item">
          <p class="info-label">🤖 AI Copilot</p>
          <p style="color: #D1D5DB; font-size: 14px; margin: 4px 0 0;">Your 24/7 business assistant</p>
        </div>
        <div class="list-item">
          <p class="info-label">⚡ Smart Automations</p>
          <p style="color: #D1D5DB; font-size: 14px; margin: 4px 0 0;">Save 12+ hours per week</p>
        </div>
      </div>
      
      <center>
        <a href="${Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "")}/dashboard" class="button">
          Get Started →
        </a>
      </center>
      
      <p class="content">
        Need help getting started? Our AI Copilot is always ready to assist you, or reach out to our support team anytime.
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        <strong>Forgefly</strong> - AI Business OS for Solopreneurs
      </p>
      <p class="footer-text">
        Questions? Reply to this email or visit our <a href="#" class="footer-link">Help Center</a>
      </p>
      <p class="footer-text" style="font-size: 12px; color: #6B7280; margin-top: 16px;">
        You're receiving this email because you signed up for Forgefly.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getProposalEmailTemplate(
  clientName: string,
  proposalTitle: string,
  amount: number,
  proposalLink: string,
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Proposal from Forgefly</title>
  <style>${emailStyles}</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <img src="/forgefly-icon.png" alt="Forgefly Logo" class="logo" />
      <h1 class="brand-name">Forgefly</h1>
      <p class="tagline">Professional Proposal</p>
    </div>
    
    <div class="email-body">
      <h2 class="greeting">Hi ${clientName},</h2>
      
      <p class="content">
        I'm excited to share a new proposal with you. I've put together a comprehensive plan for your project.
      </p>
      
      <div class="info-box">
        <p class="info-label">Proposal</p>
        <p class="info-value">${proposalTitle}</p>
        <div class="divider"></div>
        <p class="info-label">Investment</p>
        <p class="info-value">$${amount.toLocaleString()}</p>
      </div>
      
      <p class="content">
        This proposal includes detailed scope, timeline, deliverables, and terms. Click below to review the full proposal:
      </p>
      
      <center>
        <a href="${proposalLink}" class="button">
          View Proposal →
        </a>
      </center>
      
      <p class="content">
        I'm looking forward to working with you on this project. If you have any questions or would like to discuss the proposal, please don't hesitate to reach out.
      </p>
      
      <p class="content" style="margin-top: 32px;">
        Best regards,<br/>
        <strong style="color: #FFFFFF;">Your Forgefly Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        <strong>Forgefly</strong> - AI Business OS for Solopreneurs
      </p>
      <p class="footer-text" style="font-size: 12px; color: #6B7280; margin-top: 16px;">
        This proposal was sent via Forgefly
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getClientMessageTemplate(
  clientName: string,
  senderName: string,
  subject: string,
  message: string,
  portalUrl?: string,
): string {
  const messageHtml = message.replace(/\n/g, '<br/>');
  const ctaBlock = portalUrl ? `
    <div style="text-align:center;margin:32px 0;">
      <a href="${portalUrl}" class="button" style="background:linear-gradient(135deg,#10B981 0%,#F59E0B 100%);">
        View in portal →
      </a>
    </div>` : '';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>${emailStyles}</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <img src="https://miaoda-conversation-file.s3cdn.medo.dev/user-bj1cwp7n1qm8/conv-bj1thg4coydc/20260510/file-bj7c19f23ym8.png" alt="Forgefly Logo" class="logo" />
      <h1 class="brand-name">Forgefly</h1>
      <p class="tagline">Message from ${senderName}</p>
    </div>
    <div class="email-body">
      <h2 class="greeting">Hi ${clientName},</h2>
      <p class="content">${messageHtml}</p>
      ${ctaBlock}
      <p class="content" style="margin-top: 32px;">
        Best regards,<br/>
        <strong style="color: #FFFFFF;">${senderName}</strong>
      </p>
    </div>
    <div class="footer">
      <p class="footer-text"><strong>Forgefly</strong> — AI Business OS for Solopreneurs</p>
      <p class="footer-text" style="font-size: 12px; color: #6B7280; margin-top: 16px;">
        Sent via Forgefly on behalf of ${senderName}
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getAgencyUpgradeEmailTemplate(username: string, billingCycle: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Forgefly Agency!</title>
  <style>${emailStyles}</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <img src="https://miaoda-conversation-file.s3cdn.medo.dev/user-bj1cwp7n1qm8/conv-bj1thg4coydc/20260510/file-bj7c19f23ym8.png" alt="Forgefly Logo" class="logo" />
      <h1 class="brand-name">Forgefly</h1>
      <p class="tagline">You've upgraded to Agency 🎉</p>
    </div>

    <div class="email-body">
      <h2 class="greeting">Congratulations, ${username}!</h2>

      <p class="content">
        You're now on the <strong style="color: #F59E0B;">Forgefly Agency Plan</strong>. Your business just leveled up.
      </p>

      <div class="info-box">
        <div class="list-item">
          <p class="info-label">✨ Unlimited Clients & Projects</p>
          <p style="color: #D1D5DB; font-size: 14px; margin: 4px 0 0;">Scale without limits</p>
        </div>
        <div class="list-item">
          <p class="info-label">🤖 Advanced AI Copilot</p>
          <p style="color: #D1D5DB; font-size: 14px; margin: 4px 0 0;">Full business intelligence at your fingertips</p>
        </div>
        <div class="list-item">
          <p class="info-label">⚡ Priority Support</p>
          <p style="color: #D1D5DB; font-size: 14px; margin: 4px 0 0;">Get help when you need it most</p>
        </div>
        <div class="list-item">
          <p class="info-label">📊 Advanced Analytics</p>
          <p style="color: #D1D5DB; font-size: 14px; margin: 4px 0 0;">Deep insights into your business performance</p>
        </div>
      </div>

      <p class="content">
        Your <strong>${billingCycle}</strong> subscription is now active. You'll be billed automatically and can manage your plan anytime from your dashboard.
      </p>

      <center>
        <a href="https://www.forgefly.io/dashboard" class="button">
          Go to Dashboard →
        </a>
      </center>

      <p class="content" style="margin-top: 32px;">
        Welcome to the agency tier! We can't wait to see what you build.<br/>
        <strong style="color: #FFFFFF;">The Forgefly Team</strong>
      </p>
    </div>

    <div class="footer">
      <p class="footer-text">
        <strong>Forgefly</strong> - AI Business OS for Solopreneurs
      </p>
      <p class="footer-text" style="font-size: 12px; color: #6B7280; margin-top: 16px;">
        You're receiving this email because you upgraded your Forgefly plan.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export interface EmailTemplate {
  subject: string
  html: string
}

export function getPortalInviteEmailTemplate(data: {
  clientName: string
  clientFirstName?: string
  businessName: string
  freelancerName?: string
  serviceName: string
  portalUrl: string
  token: string
  problemSnippet?: string | null
}): EmailTemplate {
  const {
    clientName,
    clientFirstName,
    businessName,
    freelancerName,
    serviceName,
    portalUrl,
    token,
    problemSnippet,
  } = data
  const firstName = clientFirstName ?? clientName.split(' ')[0]
  const senderName = freelancerName ?? businessName
  // Extract just the first name of the sender for the sign-off
  const senderFirstName = senderName.split(' ')[0]
  // Pull the short URL token for display (e.g. "loom-sarah-7f3a")
  const displayToken = token ?? portalUrl.split('/').pop() ?? portalUrl

  const openingLine = problemSnippet
    ? `Thanks for reaching out — ${problemSnippet.charAt(0).toLowerCase()}${problemSnippet.slice(1)} is exactly the kind of problem ${serviceName} is built for.`
    : `Thanks for reaching out. I've put together a proposal for <strong style="color:#FFFFFF;">${serviceName}</strong>.`

  return {
    subject: `${serviceName} — ${businessName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${serviceName} proposal</title>
</head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">

    <!-- Card -->
    <div style="background-color:#1F2937;border-radius:12px;overflow:hidden;">

      <!-- Top accent strip -->
      <div style="height:4px;background:linear-gradient(90deg,#10B981,#059669);"></div>

      <!-- Body -->
      <div style="padding:32px;">

        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#E5E7EB;">
          Hi ${firstName},
        </p>

        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#E5E7EB;">
          ${openingLine}
        </p>

        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#E5E7EB;">
          I've put together a proposal. You can view the full details, track the project, and pay securely through your client portal:
        </p>

        <!-- Portal box -->
        <div style="background-color:#111827;border:1px solid #374151;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0 0 6px;font-size:12px;color:#6EE7B7;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Your client portal</p>
          <a href="${portalUrl}" style="display:block;font-family:'Courier New',Courier,monospace;font-size:14px;color:#E5E7EB;text-decoration:none;word-break:break-all;margin-bottom:8px;">${displayToken}</a>
          <p style="margin:0;font-size:12px;color:#6B7280;">Sign in with your Google account to access</p>
        </div>

        <!-- CTA button -->
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${portalUrl}" style="display:inline-block;background-color:#10B981;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            Open Client Portal →
          </a>
        </div>

        <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#9CA3AF;">
          From the portal you can: view the proposal, approve and pay, send messages, and track project progress once we kick off.
        </p>

        <p style="margin:0;font-size:16px;color:#E5E7EB;">
          — ${senderFirstName}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:11px;color:#4B5563;margin-top:20px;">
      Powered by <strong>Forgefly</strong> · Sent on behalf of ${businessName}
    </p>
  </div>
</body>
</html>
    `,
  }
}

export function getNewRequestEmailTemplate(data: {
  freelancerName: string
  clientName: string
  clientCompany: string
  serviceName: string
  dashboardUrl: string
}): EmailTemplate {
  const { freelancerName, clientName, clientCompany, serviceName, dashboardUrl } = data
  const companyStr = clientCompany ? ` from ${clientCompany}` : ''
  return {
    subject: `New proposal request from ${clientName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Proposal Request</title>
  <style>${emailStyles}</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 class="brand-name">Forgefly</h1>
      <p class="tagline">New Proposal Request</p>
    </div>
    <div class="email-body">
      <h2 class="greeting">Hey ${freelancerName}! 👋</h2>
      <p class="content">
        <strong style="color: #FFFFFF;">${clientName}</strong>${companyStr} just submitted a proposal request for
        <strong style="color: #10B981;">${serviceName || 'your services'}</strong>.
      </p>
      <div class="info-box">
        <p class="info-label">Client</p>
        <p class="info-value">${clientName}${companyStr}</p>
        <div class="divider"></div>
        <p class="info-label">Interested In</p>
        <p class="info-value">${serviceName || 'General Inquiry'}</p>
      </div>
      <p class="content">
        Head to your Requests inbox to review the details and draft a proposal with AI.
      </p>
      <center>
        <a href="${dashboardUrl}" class="button">View Request →</a>
      </center>
    </div>
    <div class="footer">
      <p class="footer-text"><strong>Forgefly</strong> — AI Business OS for Solopreneurs</p>
    </div>
  </div>
</body>
</html>
    `,
  }
}

export function getInvoiceEmailTemplate(
  clientName: string,
  invoiceNumber: string,
  amount: number,
  dueDate: string,
  paymentLink: string,
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice from Forgefly</title>
  <style>${emailStyles}</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <img src="/forgefly-icon.png" alt="Forgefly Logo" class="logo" />
      <h1 class="brand-name">Forgefly</h1>
      <p class="tagline">Invoice</p>
    </div>
    
    <div class="email-body">
      <h2 class="greeting">Hi ${clientName},</h2>
      
      <p class="content">
        Thank you for your business! Here's your invoice for the work completed.
      </p>
      
      <div class="info-box">
        <p class="info-label">Invoice Number</p>
        <p class="info-value">${invoiceNumber}</p>
        <div class="divider"></div>
        <p class="info-label">Amount Due</p>
        <p class="info-value" style="color: #10B981; font-size: 32px;">$${amount.toLocaleString()}</p>
        <div class="divider"></div>
        <p class="info-label">Due Date</p>
        <p class="info-value">${dueDate}</p>
      </div>
      
      <p class="content">
        You can pay this invoice securely online using the button below. We accept all major credit cards via Stripe.
      </p>
      
      <center>
        <a href="${paymentLink}" class="button">
          Pay Invoice →
        </a>
      </center>
      
      <p class="content" style="font-size: 14px; color: #9CA3AF;">
        💳 Secure payment powered by Stripe<br/>
        🔒 Your payment information is encrypted and secure
      </p>
      
      <p class="content" style="margin-top: 32px;">
        Thank you for your prompt payment!<br/>
        <strong style="color: #FFFFFF;">Your Forgefly Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p class="footer-text">
        <strong>Forgefly</strong> - AI Business OS for Solopreneurs
      </p>
      <p class="footer-text">
        Questions about this invoice? Reply to this email
      </p>
      <p class="footer-text" style="font-size: 12px; color: #6B7280; margin-top: 16px;">
        This invoice was sent via Forgefly
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

export function getDeletionOtpEmailTemplate(data: { code: string; expiresMinutes: number }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirm Account Deletion</title>
<style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">Forgefly</h1>
    </div>
    <div class="content-box">
      <p class="content" style="font-size: 16px; font-weight: 600; color: #EF4444;">
        ⚠️ Account deletion confirmation
      </p>
      <p class="content">
        We received a request to permanently delete your Forgefly account and all associated data.
        Use the code below to confirm. This action <strong>cannot be undone</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: #1F2937; border: 2px solid #EF444440; border-radius: 12px; padding: 20px 40px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #9CA3AF; letter-spacing: 0.1em; text-transform: uppercase;">Confirmation code</p>
          <p style="margin: 0; font-size: 38px; font-weight: 700; letter-spacing: 0.3em; color: #FFFFFF; font-family: monospace;">${data.code}</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #9CA3AF;">Expires in ${data.expiresMinutes} minutes</p>
        </div>
      </div>
      <p class="content" style="color: #9CA3AF; font-size: 13px;">
        If you did not request this, you can safely ignore this email. Your account will not be affected.
      </p>
    </div>
    <div class="footer">
      <p class="footer-text"><strong>Forgefly</strong> — AI Business OS for Solopreneurs</p>
      <p class="footer-text">Need help? Reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// ─── Daily digest ─────────────────────────────────────────────────────────────

const NUDGE_TYPE_LABEL: Record<string, string> = {
  overdue_invoice:  'Overdue invoice',
  stale_lead:       'Stale lead',
  unsent_proposal:  'Draft proposal',
  new_request:      'New request',
  client_message:   'Client message',
  portal_visit:     'Portal visit',
}

export function getDailyDigestEmailTemplate(data: {
  username: string
  nudges: Array<{ title: string; body: string; type: string; actionUrl: string | null }>
  dashboardUrl: string
}): { subject: string; html: string } {
  const { username, nudges, dashboardUrl } = data
  const count = nudges.length
  const subject = `${count} thing${count === 1 ? '' : 's'} waiting for you — Forgefly`

  const items = nudges.map((n) => {
    const label = NUDGE_TYPE_LABEL[n.type] ?? 'Update'
    const url = n.actionUrl
      ? `${dashboardUrl.replace('/dashboard', '')}${n.actionUrl}`
      : dashboardUrl
    return `
      <div style="border-left:3px solid #10B981;padding:12px 16px;margin-bottom:12px;background:#111827;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 2px 0;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#10B981;">${label}</p>
        <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:#F9FAFB;">${n.title}</p>
        <p style="margin:0 0 8px 0;font-size:13px;color:#9CA3AF;">${n.body}</p>
        <a href="${url}" style="font-size:12px;color:#10B981;text-decoration:none;font-weight:500;">Take action →</a>
      </div>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Daily digest</title>
<style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 class="logo">Forgefly</h1></div>
    <div class="content-box">
      <p class="content" style="font-size:18px;font-weight:700;color:#F9FAFB;margin-bottom:4px;">Good morning, ${username} 👋</p>
      <p class="content" style="color:#9CA3AF;margin-top:0;">Here's what needs your attention today.</p>
      <div style="margin:24px 0;">${items}</div>
      <div style="text-align:center;margin-top:28px;">
        <a href="${dashboardUrl}" class="button">Open dashboard</a>
      </div>
      <p style="text-align:center;margin-top:20px;font-size:11px;color:#6B7280;">
        Sent because you have unread notifications and haven't checked in recently.
      </p>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}
