import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { EmailTemplates } from './types/database';

// Guard against client-side imports
if (typeof window !== 'undefined') {
  throw new Error(
    '❌ lib/mailgun.ts cannot be imported on the client side. ' +
    'This module uses Mailgun API keys and must only run on the server.'
  );
}

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
  console.warn(
    'Missing Mailgun environment variables. ' +
    'Please ensure MAILGUN_API_KEY and MAILGUN_DOMAIN are set.'
  );
}

/**
 * Create Mailgun client instance
 */
function createMailgunClient() {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    throw new Error('Mailgun not configured');
  }

  const mailgun = new Mailgun(formData);
  return mailgun.client({
    username: 'api',
    key: MAILGUN_API_KEY,
  });
}

/**
 * Template placeholder replacement
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
  let rendered = template;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replaceAll(placeholder, value || '');
  }

  return rendered;
}

/**
 * Build company footer HTML
 */
export function buildCompanyFooter(settings: {
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  hours?: string | null;
  website_url?: string | null;
}): string {
  const parts: string[] = [];

  if (settings.company_name) {
    parts.push(`<strong>${settings.company_name}</strong>`);
  }

  if (settings.phone) {
    parts.push(settings.phone);
  }

  if (settings.email) {
    parts.push(settings.email);
  }

  if (settings.address_line1) {
    const addressParts = [settings.address_line1];
    if (settings.address_line2) addressParts.push(settings.address_line2);
    if (settings.city) addressParts.push(settings.city);
    if (settings.state) addressParts.push(settings.state);
    if (settings.zip) addressParts.push(settings.zip);
    parts.push(addressParts.join(', '));
  }

  if (settings.hours) {
    parts.push(settings.hours);
  }

  if (settings.website_url) {
    parts.push(`<a href="${settings.website_url}" style="color: #3b82f6;">${settings.website_url}</a>`);
  }

  return `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; text-align: center;">${parts.join(' • ')}</div>`;
}

/**
 * Send email via Mailgun
 */
export async function sendEmail({
  to,
  cc,
  from,
  subject,
  html,
  tags,
}: {
  to: string[];
  cc?: string[];
  from: string;
  subject: string;
  html: string;
  tags?: string[];
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const mg = createMailgunClient();

    const messageData: any = {
      from,
      to: to.join(', '),
      subject,
      html,
    };

    if (cc && cc.length > 0) {
      messageData.cc = cc.join(', ');
    }

    if (tags && tags.length > 0) {
      messageData['o:tag'] = tags;
    }

    const result = await mg.messages.create(MAILGUN_DOMAIN!, messageData);

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error) {
    console.error('Mailgun send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send initial order email
 */
export async function sendInitialEmail({
  orderId,
  orderToken,
  orderTitle,
  customerEmail,
  ccEmails,
  fromEmail,
  orderAmount,
  templates,
  settings,
  appBaseUrl,
}: {
  orderId: string;
  orderToken: string;
  orderTitle: string;
  customerEmail: string;
  ccEmails: string[];
  fromEmail: string;
  orderAmount: number | null;
  templates: EmailTemplates;
  settings: any;
  appBaseUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const orderUrl = `${appBaseUrl}/o/${orderToken}`;

  const templateData = {
    ORDER_TITLE: orderTitle,
    ORDER_URL: orderUrl,
    ORDER_AMOUNT: orderAmount ? `$${(orderAmount / 100).toFixed(2)}` : '',
    COMPANY_NAME: settings.company_name || '',
    COMPANY_PHONE: settings.phone || '',
    COMPANY_EMAIL: settings.email || '',
    COMPANY_ADDRESS: [
      settings.address_line1,
      settings.address_line2,
      settings.city,
      settings.state,
      settings.zip,
    ]
      .filter(Boolean)
      .join(', '),
    COMPANY_HOURS: settings.hours || '',
    COMPANY_WEBSITE_URL: settings.website_url || '',
  };

  const subject = renderTemplate(templates.initial_email_subject, templateData);
  const bodyHtml = renderTemplate(templates.initial_email_body_html, templateData);
  const footer = buildCompanyFooter(settings);
  const html = `${bodyHtml}${footer}`;

  return sendEmail({
    to: [customerEmail],
    cc: ccEmails,
    from: fromEmail,
    subject,
    html,
    tags: ['initial', `order:${orderId}`],
  });
}

/**
 * Send message notification to admin
 */
export async function sendMessageToAdmin({
  orderId,
  orderToken,
  orderTitle,
  messageBody,
  adminEmail,
  fromEmail,
  templates,
  settings,
  appBaseUrl,
}: {
  orderId: string;
  orderToken: string;
  orderTitle: string;
  messageBody: string;
  adminEmail: string;
  fromEmail: string;
  templates: EmailTemplates;
  settings: any;
  appBaseUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const orderUrl = `${appBaseUrl}/admin/orders/${orderId}`;

  const templateData = {
    ORDER_TITLE: orderTitle,
    ORDER_URL: orderUrl,
    MESSAGE_BODY: messageBody,
    COMPANY_NAME: settings.company_name || '',
    COMPANY_PHONE: settings.phone || '',
    COMPANY_EMAIL: settings.email || '',
    COMPANY_ADDRESS: '',
    COMPANY_HOURS: settings.hours || '',
    COMPANY_WEBSITE_URL: settings.website_url || '',
  };

  const subject = renderTemplate(templates.msg_to_admin_subject, templateData);
  const bodyHtml = renderTemplate(templates.msg_to_admin_body_html, templateData);
  const footer = buildCompanyFooter(settings);
  const html = `${bodyHtml}${footer}`;

  return sendEmail({
    to: [adminEmail],
    from: fromEmail,
    subject,
    html,
    tags: ['message-notification', 'to-admin', `order:${orderId}`],
  });
}

/**
 * Send message notification to customer
 */
export async function sendMessageToCustomer({
  orderId,
  orderToken,
  orderTitle,
  messageBody,
  customerEmail,
  ccEmails,
  fromEmail,
  templates,
  settings,
  appBaseUrl,
}: {
  orderId: string;
  orderToken: string;
  orderTitle: string;
  messageBody: string;
  customerEmail: string;
  ccEmails: string[];
  fromEmail: string;
  templates: EmailTemplates;
  settings: any;
  appBaseUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const orderUrl = `${appBaseUrl}/o/${orderToken}`;

  const templateData = {
    ORDER_TITLE: orderTitle,
    ORDER_URL: orderUrl,
    MESSAGE_BODY: messageBody,
    COMPANY_NAME: settings.company_name || '',
    COMPANY_PHONE: settings.phone || '',
    COMPANY_EMAIL: settings.email || '',
    COMPANY_ADDRESS: '',
    COMPANY_HOURS: settings.hours || '',
    COMPANY_WEBSITE_URL: settings.website_url || '',
  };

  const subject = renderTemplate(templates.msg_to_customer_subject, templateData);
  const bodyHtml = renderTemplate(templates.msg_to_customer_body_html, templateData);
  const footer = buildCompanyFooter(settings);
  const html = `${bodyHtml}${footer}`;

  return sendEmail({
    to: [customerEmail],
    cc: ccEmails,
    from: fromEmail,
    subject,
    html,
    tags: ['message-notification', 'to-customer', `order:${orderId}`],
  });
}

/**
 * Send admin alert for email issues
 */
export async function sendAdminAlert({
  orderId,
  orderTitle,
  customerEmail,
  failureReason,
  failureStatus,
  adminEmail,
  fromEmail,
  appBaseUrl,
}: {
  orderId: string;
  orderTitle: string;
  customerEmail: string;
  failureReason: string;
  failureStatus: string;
  adminEmail: string;
  fromEmail: string;
  appBaseUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const orderUrl = `${appBaseUrl}/admin/orders/${orderId}`;

  const subject = `Email Delivery Issue: ${orderTitle}`;
  const html = `
    <h2>Email Delivery Issue Detected</h2>
    <p>An email delivery issue has been detected for one of your orders.</p>

    <h3>Order Details:</h3>
    <ul>
      <li><strong>Order:</strong> ${orderTitle}</li>
      <li><strong>Customer Email:</strong> ${customerEmail}</li>
      <li><strong>Status:</strong> ${failureStatus}</li>
      <li><strong>Reason:</strong> ${failureReason}</li>
    </ul>

    <p><a href="${orderUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">View Order</a></p>

    <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">This is an automated alert from XPress Payment & Approvals App.</p>
  `;

  return sendEmail({
    to: [adminEmail],
    from: fromEmail,
    subject,
    html,
    tags: ['admin-alert', 'email-issue', `order:${orderId}`],
  });
}

/**
 * Send reminder email
 */
export async function sendReminderEmail({
  orderId,
  orderToken,
  orderTitle,
  customerEmail,
  ccEmails,
  fromEmail,
  templates,
  settings,
  appBaseUrl,
  isFinalWarning,
  daysUntilCancellation,
}: {
  orderId: string;
  orderToken: string;
  orderTitle: string;
  customerEmail: string;
  ccEmails: string[];
  fromEmail: string;
  templates: EmailTemplates;
  settings: any;
  appBaseUrl: string;
  isFinalWarning?: boolean;
  daysUntilCancellation?: number;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const orderUrl = `${appBaseUrl}/o/${orderToken}`;

  const templateData = {
    ORDER_TITLE: orderTitle,
    ORDER_URL: orderUrl,
    COMPANY_NAME: settings.company_name || '',
    COMPANY_PHONE: settings.phone || '',
    COMPANY_EMAIL: settings.email || '',
    COMPANY_ADDRESS: [
      settings.address_line1,
      settings.address_line2,
      settings.city,
      settings.state,
      settings.zip,
    ]
      .filter(Boolean)
      .join(', '),
    COMPANY_HOURS: settings.hours || '',
    COMPANY_WEBSITE_URL: settings.website_url || '',
  };

  let subject = renderTemplate(templates.reminder_email_subject, templateData);
  let bodyHtml = renderTemplate(templates.reminder_email_body_html, templateData);

  // Add final warning if applicable
  if (isFinalWarning && daysUntilCancellation !== undefined) {
    const warningHtml = `
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b; font-weight: bold;">⚠️ Final Reminder</p>
        <p style="margin: 5px 0 0 0; color: #7f1d1d;">
          This order will be automatically cancelled in ${daysUntilCancellation} days if not approved.
        </p>
      </div>
    `;
    bodyHtml = bodyHtml.replace('</div>', `${warningHtml}</div>`);
  }

  const footer = buildCompanyFooter(settings);
  const html = `${bodyHtml}${footer}`;

  return sendEmail({
    to: [customerEmail],
    cc: ccEmails,
    from: fromEmail,
    subject,
    html,
    tags: [
      'reminder',
      isFinalWarning ? 'final-reminder' : 'reminder',
      `order:${orderId}`,
    ],
  });
}

/**
 * Send cancellation email
 */
export async function sendCancellationEmail({
  orderId,
  orderToken,
  orderTitle,
  customerEmail,
  ccEmails,
  fromEmail,
  templates,
  settings,
  appBaseUrl,
}: {
  orderId: string;
  orderToken: string;
  orderTitle: string;
  customerEmail: string;
  ccEmails: string[];
  fromEmail: string;
  templates: EmailTemplates;
  settings: any;
  appBaseUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const orderUrl = `${appBaseUrl}/o/${orderToken}`;

  const templateData = {
    ORDER_TITLE: orderTitle,
    ORDER_URL: orderUrl,
    COMPANY_NAME: settings.company_name || '',
    COMPANY_PHONE: settings.phone || '',
    COMPANY_EMAIL: settings.email || '',
    COMPANY_ADDRESS: [
      settings.address_line1,
      settings.address_line2,
      settings.city,
      settings.state,
      settings.zip,
    ]
      .filter(Boolean)
      .join(', '),
    COMPANY_HOURS: settings.hours || '',
    COMPANY_WEBSITE_URL: settings.website_url || '',
  };

  const subject = renderTemplate(templates.cancellation_email_subject, templateData);
  const bodyHtml = renderTemplate(templates.cancellation_email_body_html, templateData);
  const footer = buildCompanyFooter(settings);
  const html = `${bodyHtml}${footer}`;

  return sendEmail({
    to: [customerEmail],
    cc: ccEmails,
    from: fromEmail,
    subject,
    html,
    tags: ['cancellation', `order:${orderId}`],
  });
}

/**
 * Send revival email
 */
export async function sendRevivalEmail({
  orderId,
  orderToken,
  orderTitle,
  customerEmail,
  ccEmails,
  fromEmail,
  templates,
  settings,
  appBaseUrl,
}: {
  orderId: string;
  orderToken: string;
  orderTitle: string;
  customerEmail: string;
  ccEmails: string[];
  fromEmail: string;
  templates: EmailTemplates;
  settings: any;
  appBaseUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const orderUrl = `${appBaseUrl}/o/${orderToken}`;

  const templateData = {
    ORDER_TITLE: orderTitle,
    ORDER_URL: orderUrl,
    COMPANY_NAME: settings.company_name || '',
    COMPANY_PHONE: settings.phone || '',
    COMPANY_EMAIL: settings.email || '',
    COMPANY_ADDRESS: [
      settings.address_line1,
      settings.address_line2,
      settings.city,
      settings.state,
      settings.zip,
    ]
      .filter(Boolean)
      .join(', '),
    COMPANY_HOURS: settings.hours || '',
    COMPANY_WEBSITE_URL: settings.website_url || '',
  };

  const subject = renderTemplate(templates.revival_email_subject, templateData);
  const bodyHtml = renderTemplate(templates.revival_email_body_html, templateData);
  const footer = buildCompanyFooter(settings);
  const html = `${bodyHtml}${footer}`;

  return sendEmail({
    to: [customerEmail],
    cc: ccEmails,
    from: fromEmail,
    subject,
    html,
    tags: ['revival', `order:${orderId}`],
  });
}

/**
 * Verify Mailgun webhook signature
 */
export function verifyWebhookSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

  if (!signingKey) {
    console.error('MAILGUN_WEBHOOK_SIGNING_KEY not configured');
    return false;
  }

  const crypto = require('crypto');
  const encodedToken = crypto
    .createHmac('sha256', signingKey)
    .update(timestamp + token)
    .digest('hex');

  return encodedToken === signature;
}
