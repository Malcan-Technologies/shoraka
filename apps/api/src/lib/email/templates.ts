// AdminRole will be available after Prisma generate
type AdminRole = "SUPER_ADMIN" | "COMPLIANCE_OFFICER" | "OPERATIONS_OFFICER" | "FINANCE_OFFICER";

const roleLabels: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPLIANCE_OFFICER: "Compliance Officer",
  OPERATIONS_OFFICER: "Operations Officer",
  FINANCE_OFFICER: "Finance Officer",
};

const roleDescriptions: Record<AdminRole, string> = {
  SUPER_ADMIN: "Full administrative access to all platform features and settings",
  COMPLIANCE_OFFICER: "Manages regulatory compliance, KYC verification, and fraud prevention",
  OPERATIONS_OFFICER: "Handles day-to-day platform operations including loan management and user support",
  FINANCE_OFFICER: "Manages financial operations, transactions, and reporting",
};

export function adminInvitationTemplate(
  inviteLink: string,
  role: AdminRole,
  inviterName?: string
): { subject: string; html: string; text: string } {
  const roleLabel = roleLabels[role];
  const roleDescription = roleDescriptions[role];
  const inviterText = inviterName ? ` by ${inviterName}` : "";

  const subject = `You've been invited to join CashSouk as ${roleLabel}`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Invitation - CashSouk</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e5e5;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1a1a1a;">CashSouk</h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: #666;">P2P Lending Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #1a1a1a;">You've been invited${inviterText}!</h2>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333;">
                You have been invited to join CashSouk as a <strong>${roleLabel}</strong>.
              </p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1a1a1a;">Role: ${roleLabel}</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #666;">${roleDescription}</p>
              </div>
              
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #333;">
                Click the button below to accept your invitation and set up your admin account. This invitation link will expire in 24 hours.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 32px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #007bff; word-break: break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-top: 1px solid #e5e5e5; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
                This invitation was sent by CashSouk. If you didn't expect this invitation, you can safely ignore this email.
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #999; text-align: center;">
                © ${new Date().getFullYear()} CashSouk. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
  
  const text = `
You've been invited${inviterText}!

You have been invited to join CashSouk as a ${roleLabel}.

Role: ${roleLabel}
${roleDescription}

Click the link below to accept your invitation and set up your admin account. This invitation link will expire in 24 hours.

${inviteLink}

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} CashSouk. All rights reserved.
  `.trim();
  
  return { subject, html, text };
}

