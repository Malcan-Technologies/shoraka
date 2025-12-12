import { SESClient, SendEmailCommand, SendEmailCommandInput } from "@aws-sdk/client-ses";
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
        from: EMAIL_FROM,
        subject: options.subject,
        region: process.env.SES_REGION || "ap-southeast-2",
      },
      "Email sent successfully via SES"
    );

    // Log additional info for debugging
    logger.info(
      {
        messageId: response.MessageId,
        recipients,
        from: EMAIL_FROM,
        note: "If email not received, check: 1) SES sandbox mode (verify recipient), 2) Sender verification, 3) Spam folder, 4) SES bounce/complaint suppression list",
      },
      "SES email delivery info"
    );

    return { messageId: response.MessageId || "" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide helpful error messages for common SES issues
    let enhancedError: Error;
    if (errorMessage.includes("Could not load credentials") || errorMessage.includes("credentials")) {
      enhancedError = new Error(
        `AWS SES credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, or configure AWS credentials file at ~/.aws/credentials. Original error: ${errorMessage}`
      );
    } else if (errorMessage.includes("Email address not verified") || errorMessage.includes("not verified")) {
      enhancedError = new Error(
        `Sender email ${EMAIL_FROM} is not verified in SES. Please verify it in AWS SES Console → Verified identities. Original error: ${errorMessage}`
      );
    } else if (errorMessage.includes("MessageRejected") || errorMessage.includes("rejected")) {
      enhancedError = new Error(
        `Email rejected by SES. Possible causes: 1) Recipient not verified (if in sandbox mode), 2) Sender not verified, 3) Email on suppression list. Check AWS SES Console for details. Original error: ${errorMessage}`
      );
    } else {
      enhancedError = error instanceof Error ? error : new Error(errorMessage);
    }
    
    logger.error(
      {
        error: errorMessage,
        to: recipients,
        from: EMAIL_FROM,
        subject: options.subject,
        region: process.env.SES_REGION || "ap-southeast-2",
      },
      "Failed to send email via SES"
    );
    throw enhancedError;
  }
}


