const sendMock = jest.fn();
const loggerInfo = jest.fn();
const loggerError = jest.fn();

jest.mock("@aws-sdk/client-ses", () => ({
  SESClient: jest.fn().mockImplementation(() => ({ send: sendMock })),
  SendEmailCommand: jest.fn().mockImplementation((input) => ({ input, _type: "SendEmail" })),
  SendRawEmailCommand: jest.fn().mockImplementation((input) => ({ input, _type: "SendRawEmail" })),
}));

jest.mock("../logger", () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfo(...args),
    error: (...args: unknown[]) => loggerError(...args),
    warn: jest.fn(),
  },
}));

import { SendRawEmailCommand } from "@aws-sdk/client-ses";
import {
  buildRawEmailMessage,
  dedupeSesDestinations,
  sendEmail,
  sendEmailWithAttachments,
} from "./ses-client";

function loggedText(): string {
  return JSON.stringify([...loggerInfo.mock.calls, ...loggerError.mock.calls]);
}

describe("SES attachment helper", () => {
  const previousFrom = process.env.EMAIL_FROM;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_FROM = "no-reply@cashsouk.com";
  });

  afterAll(() => {
    process.env.EMAIL_FROM = previousFrom;
  });

  it("builds RFC MIME with From, subject, and attachment filename without a display name", async () => {
    const raw = await buildRawEmailMessage({
      to: "trustee@example.com",
      cc: ["ops@example.com"],
      subject: "Trustee instruction — Issuer disbursement — WD-1",
      html: "<p>Dear Trustee,</p>",
      text: "Dear Trustee,",
      attachments: [
        {
          filename: "trustee-issuer-disbursement-WD-1.pdf",
          content: Buffer.from("%PDF-mock"),
          contentType: "application/pdf",
        },
      ],
    });

    const mime = raw.toString("utf8");
    expect(mime).toContain("From: no-reply@cashsouk.com");
    expect(mime).not.toMatch(/From: ".+" </);
    expect(mime).toContain("To: trustee@example.com");
    expect(mime).toMatch(/Subject:/);
    expect(mime).toMatch(/Trustee[_ ]instruction/);
    expect(mime).toContain("WD-1");
    expect(mime).toContain("trustee-issuer-disbursement-WD-1.pdf");
    expect(mime).toContain("Content-Type: application/pdf");
  });

  it("dedupes Destinations case-insensitively without changing MIME headers", async () => {
    sendMock.mockResolvedValue({ MessageId: "ses-msg-1" });

    await sendEmailWithAttachments({
      to: "trustee@example.com",
      cc: ["TRUSTEE@example.com", "ops@example.com"],
      bcc: ["ops@example.com"],
      subject: "Trustee instruction",
      html: "<p>secret-body</p>",
      text: "secret-body",
    });

    expect(SendRawEmailCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Source: "no-reply@cashsouk.com",
        Destinations: ["trustee@example.com", "ops@example.com"],
        RawMessage: { Data: expect.any(Buffer) },
      })
    );
    const raw = (SendRawEmailCommand as unknown as jest.Mock).mock.calls[0][0].RawMessage.Data as Buffer;
    const mime = raw.toString("utf8");
    expect(mime).toContain("To: trustee@example.com");
    expect(mime).toContain("Cc: TRUSTEE@example.com, ops@example.com");
  });

  it("sends raw MIME via SES and logs counts without recipient addresses or body", async () => {
    sendMock.mockResolvedValue({ MessageId: "ses-msg-1" });

    const result = await sendEmailWithAttachments({
      to: "trustee@example.com",
      cc: ["ops@example.com"],
      subject: "Trustee instruction",
      html: "<p>secret-body</p>",
      text: "secret-body",
      attachments: [
        {
          filename: "letter.pdf",
          content: Buffer.from("pdf-bytes"),
          contentType: "application/pdf",
        },
      ],
    });

    expect(result).toEqual({ messageId: "ses-msg-1" });
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "ses-msg-1",
        toCount: 1,
        ccCount: 1,
        bccCount: 0,
        recipientCount: 2,
        from: "no-reply@cashsouk.com",
        subject: "Trustee instruction",
        attachmentCount: 1,
      }),
      "Raw email sent successfully via SES"
    );
    expect(loggedText()).not.toContain("trustee@example.com");
    expect(loggedText()).not.toContain("ops@example.com");
    expect(loggedText()).not.toContain("secret-body");
    expect(loggedText()).not.toContain("pdf-bytes");
  });

  it("logs sendEmail failures without recipient addresses", async () => {
    sendMock.mockRejectedValue(new Error("MessageRejected"));

    await expect(
      sendEmail({
        to: "trustee@example.com",
        cc: ["ops@example.com"],
        subject: "Plain notice",
        html: "<p>secret-body</p>",
      })
    ).rejects.toThrow(/Email rejected by SES/);

    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        toCount: 1,
        ccCount: 1,
        bccCount: 0,
        recipientCount: 2,
        subject: "Plain notice",
      }),
      "Failed to send email via SES"
    );
    expect(loggedText()).not.toContain("trustee@example.com");
    expect(loggedText()).not.toContain("ops@example.com");
    expect(loggedText()).not.toContain("secret-body");
  });

  it("throws an enhanced error when SES rejects the raw message", async () => {
    sendMock.mockRejectedValue(new Error("MessageRejected"));

    await expect(
      sendEmailWithAttachments({
        to: "trustee@example.com",
        subject: "Trustee instruction",
        html: "<p>Hi</p>",
      })
    ).rejects.toThrow(/Email rejected by SES/);
  });

  it("dedupes destination lists case-insensitively", () => {
    expect(
      dedupeSesDestinations(["trustee@example.com", " TRUSTEE@example.com ", "ops@example.com", ""])
    ).toEqual(["trustee@example.com", "ops@example.com"]);
  });
});
