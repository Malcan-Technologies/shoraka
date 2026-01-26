import { Notification, User } from '@prisma/client';
import { EmailOptions } from '../../lib/email/ses-client';

export function buildNotificationEmail(notification: Notification, user: User): EmailOptions {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const portalUrl = notification.link_path ? `${appUrl}${notification.link_path}` : appUrl;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
        .header { margin-bottom: 20px; border-bottom: 2px solid #8A0304; padding-bottom: 10px; }
        .header h2 { color: #8A0304; margin: 0; }
        .content { margin-bottom: 30px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #8A0304; color: #ffffff !important; text-decoration: none; border-radius: 4px; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .footer a { color: #8A0304; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${notification.title}</h2>
        </div>
        <div class="content">
          <p>Hello ${user.first_name || 'there'},</p>
          <p>${notification.message}</p>
          ${notification.link_path ? `
            <div style="margin-top: 25px;">
              <a href="${portalUrl}" class="button">View Details</a>
            </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>You are receiving this because you have notifications enabled for your account.</p>
          <p><a href="${appUrl}/account">Manage notification preferences</a></p>
          <p>&copy; ${new Date().getFullYear()} CashSouk. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    to: user.email,
    subject: `[CashSouk] ${notification.title}`,
    html,
    text: `${notification.title}\n\nHello ${user.first_name || 'there'},\n\n${notification.message}\n\nView details: ${portalUrl}\n\nManage preferences: ${appUrl}/account`,
  };
}
