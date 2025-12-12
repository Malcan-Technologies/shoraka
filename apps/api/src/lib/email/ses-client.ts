import { SESClient, SendEmailCommand, SendEmailCommandInput } from "@aws-sdk/client-ses";
import { logger } from "../logger";

const sesClient = new SESClient({
  region: process.env.COGNITO_REGION || "ap-southeast-5",
  // Credentials loaded automatically from:
  // 1. IAM role (in ECS/production)
  // 2. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  // 3. ~/.aws/credentials (local dev)
});

const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@cashsouk.com";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export async function sendEmail(options: EmailOptions): Promise<{ messageId: string }> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  
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
      {
        messageId: response.MessageId,
        to: recipients,
        subject: options.subject,
      },
      "Email sent successfully via SES"
    );

    return { messageId: response.MessageId || "" };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        to: recipients,
        subject: options.subject,
      },
      "Failed to send email via SES"
    );
    throw error;
  }
}


