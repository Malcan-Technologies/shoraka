jest.mock("../../../lib/s3/client", () => ({
  getS3ObjectBuffer: jest.fn(),
}));

jest.mock("../../../lib/email/ses-client", () => ({
  sendEmailWithAttachments: jest.fn(),
}));

import { getS3ObjectBuffer } from "../../../lib/s3/client";
import { sendEmailWithAttachments } from "../../../lib/email/ses-client";
import type { TrusteeLetterConfig } from "@cashsouk/types";
import {
  buildTrusteeInstructionEmailContent,
  extractLatestSettlementTrusteeLetterS3Key,
  safeTrusteePdfFilename,
  sendTrusteeInstructionPdfEmail,
} from "./trustee-instruction-email";

const config: TrusteeLetterConfig = {
  trusteeName: "RHB Trustees Berhad",
  trusteeAddressLine1: "Level 11",
  trusteeAddressLine2: "Jalan Tun Razak",
  attentionPerson: "Ms Lim",
  defaultContactPerson: "CashSouk Finance Team",
  authorisedSignatoryLabel: "Authorised Signatories",
  platformDisplayName: "CashSouk Sdn Bhd",
  autoSendTrusteeEmail: true,
  trusteeEmail: "trustee@example.com",
  trusteeCcEmails: ["ops@example.com", "ops@example.com", ""],
};

describe("trustee instruction email builder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("identifies purpose and reference in subject and escaped HTML", () => {
    const content = buildTrusteeInstructionEmailContent({
      kind: "ISSUER_DISBURSEMENT",
      reference: "WD-<script>1",
      platformDisplayName: "CashSouk Sdn Bhd",
    });

    expect(content.subject).toBe("Trustee instruction — Issuer disbursement — WD-<script>1");
    expect(content.text).toContain("Purpose: Issuer disbursement");
    expect(content.text).toContain("Reference: WD-<script>1");
    expect(content.html).toContain("WD-&lt;script&gt;1");
    expect(content.html).not.toContain("<script>");
  });

  it("builds a safe pdf filename", () => {
    expect(safeTrusteePdfFilename("WD 2026/ABC", "SETTLEMENT")).toBe(
      "trustee-settlement-WD-2026-ABC.pdf"
    );
    expect(safeTrusteePdfFilename("   ", "INVESTOR_WITHDRAWAL")).toBe(
      "trustee-investor-withdrawal-instruction.pdf"
    );
  });

  it("extracts the latest settlement-scoped S3 key and ignores other settlements", () => {
    const s3Key = extractLatestSettlementTrusteeLetterS3Key(
      [
        {
          createdAt: "2026-08-24T12:00:00.000Z",
          metadata: { settlementId: "set-1", s3Key: "old.pdf" },
        },
        {
          createdAt: "2026-08-24T13:00:00.000Z",
          metadata: { settlementId: "set-1", s3Key: "latest.pdf" },
        },
        {
          createdAt: "2026-08-24T14:00:00.000Z",
          metadata: { settlementId: "set-2", s3Key: "other.pdf" },
        },
        {
          createdAt: "2026-08-24T15:00:00.000Z",
          metadata: { settlementId: "set-1", s3Key: "   " },
        },
      ],
      "set-1"
    );

    expect(s3Key).toBe("latest.pdf");
    expect(extractLatestSettlementTrusteeLetterS3Key([], "set-1")).toBeNull();
  });

  it("loads the generated PDF and sends it as an attachment", async () => {
    (getS3ObjectBuffer as jest.Mock).mockResolvedValue(Buffer.from("%PDF"));
    (sendEmailWithAttachments as jest.Mock).mockResolvedValue({ messageId: "ses-1" });

    await expect(
      sendTrusteeInstructionPdfEmail({
        kind: "SETTLEMENT",
        reference: "STL-1",
        s3Key: "note-letters/n1/letter.pdf",
        config,
      })
    ).resolves.toEqual({ messageId: "ses-1" });

    expect(getS3ObjectBuffer).toHaveBeenCalledWith("note-letters/n1/letter.pdf");
    expect(sendEmailWithAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "trustee@example.com",
        cc: ["ops@example.com"],
        subject: "Trustee instruction — Settlement trustee instruction — STL-1",
        attachments: [
          expect.objectContaining({
            filename: "trustee-settlement-STL-1.pdf",
            contentType: "application/pdf",
          }),
        ],
      })
    );
  });

  it("drops CC addresses that match the To address", async () => {
    (getS3ObjectBuffer as jest.Mock).mockResolvedValue(Buffer.from("%PDF"));
    (sendEmailWithAttachments as jest.Mock).mockResolvedValue({ messageId: "ses-2" });

    await sendTrusteeInstructionPdfEmail({
      kind: "INVESTOR_WITHDRAWAL",
      reference: "WD-1",
      s3Key: "letter.pdf",
      config: {
        ...config,
        trusteeCcEmails: ["TRUSTEE@example.com", "ops@example.com"],
      },
    });

    expect(sendEmailWithAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "trustee@example.com",
        cc: ["ops@example.com"],
      })
    );
  });

  it("rejects auto-send when trusteeEmail is missing", async () => {
    await expect(
      sendTrusteeInstructionPdfEmail({
        kind: "INVESTOR_WITHDRAWAL",
        reference: "WD-1",
        s3Key: "letter.pdf",
        config: { ...config, trusteeEmail: undefined },
      })
    ).rejects.toMatchObject({ code: "TRUSTEE_EMAIL_NOT_CONFIGURED" });
    expect(getS3ObjectBuffer).not.toHaveBeenCalled();
  });
});
