import { AppError } from "../../lib/http/error-handler";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    legalExternalAcceptance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../lib/s3/client", () => ({
  generatePresignedViewUrl: jest.fn(async () => ({
    viewUrl: "https://example.com/view.pdf",
    expiresIn: 60,
  })),
}));

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("./repository", () => ({
  legalDocumentRepository: {
    findPublishedByType: jest.fn(),
  },
}));

import { prisma } from "../../lib/prisma";
import { legalDocumentRepository } from "./repository";
import { legalExternalAcceptanceService } from "./external-acceptance-service";

const mockReq = {
  headers: {
    "user-agent": "JestAgent/1.0",
    "x-forwarded-for": "203.0.113.10",
  },
} as never;

const guarantor = {
  id: "rec-1",
  role_key: "guarantor",
  name: "Siti",
  email: "siti@example.com",
  ic_number: "900101015432",
};

const published = {
  id: "ver-1",
  legal_document_id: "ld-1",
  version: 1,
  status: "PUBLISHED" as const,
  s3_key: "legal-documents/guarantor-warning-statement/v1.pdf",
  file_name: "warning.pdf",
  content_type: "application/pdf",
  file_size: 100,
  file_hash: "abc",
  reacceptance_required: false,
  uploaded_by: "admin",
  published_by: "admin",
  published_at: new Date(),
  archived_by: null,
  archived_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  legal_document: {
    id: "ld-1",
    type: "GUARANTOR_WARNING_STATEMENT" as const,
    title: "Guarantor Warning Statement",
    description: null,
    audience: "GUARANTOR" as const,
    required_for_onboarding: false,
    public_visibility: false,
    show_in_account: false,
    created_at: new Date(),
    updated_at: new Date(),
  },
};

describe("LegalExternalAcceptanceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (legalDocumentRepository.findPublishedByType as jest.Mock).mockResolvedValue(published);
  });

  it("directors do not need the guarantor warning", async () => {
    await expect(
      legalExternalAcceptanceService.assertSigningRecipientAccepted({
        id: "dir-1",
        role_key: "issuer_director",
      })
    ).resolves.toBeUndefined();
    expect(legalDocumentRepository.findPublishedByType).not.toHaveBeenCalled();
  });

  it("blocks guarantor signing when no published warning exists", async () => {
    (legalDocumentRepository.findPublishedByType as jest.Mock).mockResolvedValue(null);
    await expect(
      legalExternalAcceptanceService.assertSigningRecipientAccepted(guarantor)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "LEGAL_DOCUMENT_UNAVAILABLE",
    } satisfies Partial<AppError>);
  });

  it("blocks guarantor signing until the current version is accepted", async () => {
    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValue({
      status: "OPENED",
    });
    await expect(
      legalExternalAcceptanceService.assertSigningRecipientAccepted(guarantor)
    ).rejects.toMatchObject({ code: "WARNING_ACKNOWLEDGEMENT_REQUIRED" });
  });

  it("allows guarantor signing after ACCEPTED on the published version", async () => {
    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValue({
      status: "ACCEPTED",
    });
    await expect(
      legalExternalAcceptanceService.assertSigningRecipientAccepted(guarantor)
    ).resolves.toBeUndefined();
  });

  it("does not treat an older version as accepted after a new publish", async () => {
    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      legalExternalAcceptanceService.assertSigningRecipientAccepted(guarantor)
    ).rejects.toMatchObject({ code: "WARNING_ACKNOWLEDGEMENT_REQUIRED" });
    expect(prisma.legalExternalAcceptance.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source_type_source_id_legal_document_version_id: {
            source_type: "SIGNING_RECIPIENT",
            source_id: "rec-1",
            legal_document_version_id: "ver-1",
          },
        },
      })
    );
  });

  it("requires open before accept", async () => {
    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      legalExternalAcceptanceService.recordAcceptedForSigningRecipient(mockReq, guarantor)
    ).rejects.toMatchObject({ code: "OPEN_REQUIRED" });
  });

  it("creates an OPENED row then accepts without inserting LegalDocumentAcceptance", async () => {
    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (prisma.legalExternalAcceptance.create as jest.Mock).mockResolvedValue({ id: "acc-1" });

    await legalExternalAcceptanceService.recordOpenedForSigningRecipient(mockReq, guarantor);
    expect(prisma.legalExternalAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source_type: "SIGNING_RECIPIENT",
          source_id: "rec-1",
          party_email: "siti@example.com",
          party_ic_number: "900101015432",
          status: "OPENED",
        }),
      })
    );

    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "acc-1",
      status: "OPENED",
    });
    (prisma.legalExternalAcceptance.update as jest.Mock).mockResolvedValue({ id: "acc-1" });

    await legalExternalAcceptanceService.recordAcceptedForSigningRecipient(mockReq, guarantor);
    expect(prisma.legalExternalAcceptance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACCEPTED",
          acknowledgement_text: "I have read and understood this warning statement.",
        }),
      })
    );
  });

  it("accept is idempotent when already ACCEPTED", async () => {
    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValue({
      id: "acc-1",
      status: "ACCEPTED",
    });
    await legalExternalAcceptanceService.recordAcceptedForSigningRecipient(mockReq, guarantor);
    expect(prisma.legalExternalAcceptance.update).not.toHaveBeenCalled();
  });

  it("session warning is null for directors and required for guarantors", async () => {
    expect(
      await legalExternalAcceptanceService.getWarningForSigningRecipient({
        id: "dir-1",
        role_key: "issuer_director",
      })
    ).toBeNull();

    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValue(null);
    const warning = await legalExternalAcceptanceService.getWarningForSigningRecipient(guarantor);
    expect(warning).toMatchObject({
      required: true,
      status: "not_opened",
      legal_document_version_id: "ver-1",
    });
  });

  it("maps accepted timestamps per signing recipient", async () => {
    (prisma.legalExternalAcceptance.findMany as jest.Mock).mockResolvedValue([
      { source_id: "rec-1", accepted_at: new Date("2026-08-13T00:00:00.000Z") },
    ]);
    const map = await legalExternalAcceptanceService.acceptedAtBySigningRecipientIds([
      "rec-1",
      "rec-2",
    ]);
    expect(map.get("rec-1")).toBe("2026-08-13T00:00:00.000Z");
    expect(map.get("rec-2")).toBeUndefined();
  });
});
