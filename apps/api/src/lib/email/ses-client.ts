import { SESClient, SendEmailCommand, SendEmailCommandInput, SendRawEmailCommand } from "@aws-sdk/client-ses";
import MailComposer from "nodemailer/lib/mail-composer";
import { logger } from "../logger";

const sesClient = new SESClient({
  region: process.env.SES_REGION || "ap-southeast-2",
  // Credentials loaded automatically from:
  // 1. IAM role (in ECS/production)
  // 2. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  // 3. ~/.aws/credentials (local dev)
});

const EMAIL_FROM = process.env.EMAIL_FROM || "no-reply@cashsouk.com";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailWithAttachmentsOptions extends EmailOptions {
  attachments?: EmailAttachment[];
}

function toRecipientList(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

export function dedupeSesDestinations(addresses: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of addresses) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function logSesContext(options: EmailOptions, extra: Record<string, unknown> = {}) {
  const toCount = toRecipientList(options.to).length;
  const ccCount = options.cc?.length ?? 0;
  const bccCount = options.bcc?.length ?? 0;
  return {
    toCount,
    ccCount,
    bccCount,
    recipientCount: toCount + ccCount + bccCount,
    from: EMAIL_FROM,
    subject: options.subject,
    region: process.env.SES_REGION || "ap-southeast-2",
    ...extra,
  };
}

function enhanceSesError(error: unknown): Error {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("Could not load credentials") || errorMessage.includes("credentials")) {
    return new Error(
      `AWS SES credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, or configure AWS credentials file at ~/.aws/credentials. Original error: ${errorMessage}`
    );
  }
  if (errorMessage.includes("Email address not verified") || errorMessage.includes("not verified")) {
    return new Error(
      `Sender email ${EMAIL_FROM} is not verified in SES. Please verify it in AWS SES Console → Verified identities. Original error: ${errorMessage}`
    );
  }
  if (errorMessage.includes("MessageRejected") || errorMessage.includes("rejected")) {
    return new Error(
      `Email rejected by SES. Possible causes: 1) Recipient not verified (if in sandbox mode), 2) Sender not verified, 3) Email on suppression list. Check AWS SES Console for details. Original error: ${errorMessage}`
    );
  }
  return error instanceof Error ? error : new Error(errorMessage);
}

export async function buildRawEmailMessage(options: EmailWithAttachmentsOptions): Promise<Buffer> {
  const recipients = toRecipientList(options.to);
  const composer = new MailComposer({
    from: EMAIL_FROM,
    to: recipients,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: (options.attachments ?? []).map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  });
  return composer.compile().build();
}

export async function sendEmail(options: EmailOptions): Promise<{ messageId: string }> {
  const recipients = toRecipientList(options.to);

  const params: SendEmailCommandInput = {
    Source: EMAIL_FROM,
    Destination: {
      ToAddresses: recipients,
      CcAddresses: options.cc,
      BccAddresses: options.bcc,
    },
    Message: {
      Subject: {
        Data: options.subject,
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: options.html,
          Charset: "UTF-8",
        },
        ...(options.text && {
          Text: {
            Data: options.text,
            Charset: "UTF-8",
          },
        }),
      },
    },
    ...(options.replyTo && {
      ReplyToAddresses: [options.replyTo],
    }),
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);

    logger.info(
      { messageId: response.MessageId, ...logSesContext(options) },
      "Email sent successfully via SES"
    );

    return { messageId: response.MessageId || "" };
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), ...logSesContext(options) }, "Failed to send email via SES");
    throw enhanceSesError(error);
  }
}

export async function sendEmailWithAttachments(
  options: EmailWithAttachmentsOptions
): Promise<{ messageId: string }> {
  const destinations = dedupeSesDestinations([
    ...toRecipientList(options.to),
    ...(options.cc ?? []),
    ...(options.bcc ?? []),
  ]);
  const rawMessage = await buildRawEmailMessage(options);

  try {
    const response = await sesClient.send(
      new SendRawEmailCommand({
        Source: EMAIL_FROM,
        Destinations: destinations,
        RawMessage: { Data: rawMessage },
      })
    );

    logger.info(
      {
        messageId: response.MessageId,
        ...logSesContext(options, { attachmentCount: options.attachments?.length ?? 0 }),
      },
      "Raw email sent successfully via SES"
    );

    return { messageId: response.MessageId || "" };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        ...logSesContext(options, { attachmentCount: options.attachments?.length ?? 0 }),
      },
      "Failed to send raw email via SES"
    );
    throw enhanceSesError(error);
  }
}
