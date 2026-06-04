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
): string {
  const messageHtml = message.replace(/\n/g, '<br/>');
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
