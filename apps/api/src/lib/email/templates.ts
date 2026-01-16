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
  OPERATIONS_OFFICER:
    "Handles day-to-day platform operations including loan management and user support",
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fafafa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fafafa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e8e8e8;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #8A0304;">CashSouk</h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: #6F4924;">P2P Lending Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #1a1a1a;">You've been invited${inviterText}!</h2>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333;">
                You have been invited to join CashSouk as a <strong>${roleLabel}</strong>.
              </p>
              
              <div style="background-color: #fafafa; border-left: 4px solid #8A0304; padding: 16px; margin: 24px 0; border-radius: 4px;">
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
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #8A0304; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 10px 20px -10px rgba(138, 3, 4, 0.35);">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 32px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #CE2922; word-break: break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e8e8e8; border-radius: 0 0 12px 12px;">
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

type OrganizationMemberRole = "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";

const orgRoleLabels: Record<OrganizationMemberRole, string> = {
  ORGANIZATION_ADMIN: "Organization Admin",
  ORGANIZATION_MEMBER: "Organization Member",
};

const orgRoleDescriptions: Record<OrganizationMemberRole, string> = {
  ORGANIZATION_ADMIN: "Full administrative access to manage organization members and settings",
  ORGANIZATION_MEMBER: "Member access to view and participate in organization activities",
};

export function organizationInvitationTemplate(
  inviteLink: string,
  role: OrganizationMemberRole,
  organizationName: string,
  portalType: "investor" | "issuer",
  inviterName?: string
): { subject: string; html: string; text: string } {
  const roleLabel = orgRoleLabels[role];
  const roleDescription = orgRoleDescriptions[role];
  const inviterText = inviterName ? ` by ${inviterName}` : "";
  const portalLabel = portalType === "investor" ? "Investor" : "Issuer";

  const subject = `You've been invited to join ${organizationName} on CashSouk`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organization Invitation - CashSouk</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #fafafa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fafafa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e8e8e8;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #8A0304;">CashSouk</h1>
              <p style="margin: 8px 0 0; font-size: 16px; color: #6F4924;">P2P Lending Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #1a1a1a;">You've been invited${inviterText}!</h2>
              
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333;">
                You have been invited to join <strong>${organizationName}</strong> as a <strong>${roleLabel}</strong> on the CashSouk ${portalLabel} Portal.
              </p>
              
              <div style="background-color: #fafafa; border-left: 4px solid #8A0304; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1a1a1a;">Role: ${roleLabel}</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #666;">${roleDescription}</p>
              </div>
              
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 1.6; color: #333;">
                Click the button below to accept your invitation and join the organization. This invitation link will expire in 7 days.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #8A0304; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 10px 20px -10px rgba(138, 3, 4, 0.35);">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 32px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #CE2922; word-break: break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e8e8e8; border-radius: 0 0 12px 12px;">
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

You have been invited to join ${organizationName} as a ${roleLabel} on the CashSouk ${portalLabel} Portal.

Role: ${roleLabel}
${roleDescription}

Click the link below to accept your invitation and join the organization. This invitation link will expire in 7 days.

${inviteLink}

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} CashSouk. All rights reserved.
  `.trim();

  return { subject, html, text };
}
