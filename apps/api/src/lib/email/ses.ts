import { sendEmail } from "./ses-client";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends the RegTank individual onboarding verify link via AWS SES (fallback if RegTank does not email).
 * Uses the same SES client config as {@link sendEmail} (EMAIL_FROM, SES_REGION, default AWS credentials).
 */
export async function sendOnboardingEmail(params: { to: string; verifyLink: string }): Promise<void> {
  const { to, verifyLink } = params;
  const safe = escapeHtml(verifyLink);
  await sendEmail({
    to,
    subject: "Complete your verification",
    text: [
      "Hi,",
      "",
      "Please complete your verification using the link below:",
      "",
      verifyLink,
      "",
      "This link will expire in 24 hours.",
      "",
      "Thank you.",
    ].join("\n"),
    html: [
      "<p>Hi,</p>",
      "<p>Please complete your verification using the link below:</p>",
      `<p><a href="${safe}">Start verification</a></p>`,
      `<p style="word-break:break-all;">Or copy this URL:<br/>${safe}</p>`,
      "<p>This link will expire in 24 hours.</p>",
      "<p>Thank you.</p>",
    ].join(""),
  });
}
