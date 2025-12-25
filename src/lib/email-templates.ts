import { EmailTemplates } from './types/database';

/**
 * Default email templates
 */
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  initial_email_subject: 'Action Required: {{ORDER_TITLE}}',
  initial_email_body_html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Action Required for Your Order</h2>
      <p>Hello,</p>
      <p>We have prepared your order and need your review and approval:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">{{ORDER_TITLE}}</h3>
        {{ORDER_AMOUNT}}
      </div>
      <p>Please click the link below to review files and approve:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{ORDER_URL}}" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Order</a>
      </p>
      <p>If you have any questions, please reply to this email.</p>
      <p>Thank you!</p>
    </div>
  `,

  reminder_email_subject: 'Reminder: {{ORDER_TITLE}} - Action Required',
  reminder_email_body_html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reminder: Action Required</h2>
      <p>This is a friendly reminder that we're waiting for your approval on:</p>
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">{{ORDER_TITLE}}</h3>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{ORDER_URL}}" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Now</a>
      </p>
    </div>
  `,

  cancellation_email_subject: 'Order Cancelled: {{ORDER_TITLE}}',
  cancellation_email_body_html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Order Cancelled</h2>
      <p>Your order has been cancelled:</p>
      <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <h3 style="margin-top: 0;">{{ORDER_TITLE}}</h3>
      </div>
      <p>If you believe this was done in error, please contact us.</p>
    </div>
  `,

  revival_email_subject: 'Order Reactivated: {{ORDER_TITLE}}',
  revival_email_body_html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Order Reactivated</h2>
      <p>Good news! Your order has been reactivated:</p>
      <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid: #22c55e;">
        <h3 style="margin-top: 0;">{{ORDER_TITLE}}</h3>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{ORDER_URL}}" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Order</a>
      </p>
    </div>
  `,

  msg_to_customer_subject: 'New Message: {{ORDER_TITLE}}',
  msg_to_customer_body_html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Message on Your Order</h2>
      <p>You have received a new message regarding:</p>
      <h3>{{ORDER_TITLE}}</h3>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; white-space: pre-wrap;">{{MESSAGE_BODY}}</p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{ORDER_URL}}" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View & Reply</a>
      </p>
    </div>
  `,

  msg_to_admin_subject: 'Customer Message: {{ORDER_TITLE}}',
  msg_to_admin_body_html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>New Customer Message</h2>
      <p>A customer has sent a message on:</p>
      <h3>{{ORDER_TITLE}}</h3>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; white-space: pre-wrap;">{{MESSAGE_BODY}}</p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{ORDER_URL}}" style="display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">View Order & Reply</a>
      </p>
    </div>
  `,
};
