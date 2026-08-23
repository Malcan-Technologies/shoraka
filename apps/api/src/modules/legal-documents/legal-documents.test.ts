import {
  getRequiredLegalTypesForAudience,
  ISSUER_REQUIRED_LEGAL_TYPES,
  INVESTOR_REQUIRED_LEGAL_TYPES,
  isLegalDocumentType,
} from "@cashsouk/types";

describe("legal document type helpers", () => {
  it("issuer sees shared + issuer documents only", () => {
    const types = getRequiredLegalTypesForAudience("ISSUER");
    expect(types).toEqual(ISSUER_REQUIRED_LEGAL_TYPES);
    expect(types).not.toContain("INVESTOR_AGREEMENT");
  });

  it("investor sees shared + investor documents only", () => {
    const types = getRequiredLegalTypesForAudience("INVESTOR");
    expect(types).toEqual(INVESTOR_REQUIRED_LEGAL_TYPES);
    expect(types).not.toContain("ISSUER_AGREEMENT");
  });

  it("uses TERMS_OF_USE and PDPA_NOTICE_AND_CONSENT type names", () => {
    expect(isLegalDocumentType("TERMS_OF_USE")).toBe(true);
    expect(isLegalDocumentType("PDPA_NOTICE_AND_CONSENT")).toBe(true);
    expect(isLegalDocumentType("PDPA_NOTICE")).toBe(false);
    expect(isLegalDocumentType("TERMS_AND_CONDITIONS")).toBe(false);
    expect(isLegalDocumentType("RISK_DISCLOSURE")).toBe(false);
    expect(ISSUER_REQUIRED_LEGAL_TYPES.filter((t) => t === "TERMS_OF_USE")).toHaveLength(1);
  });
});

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: { findFirst: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    investorOrganization: { findFirst: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    legalDocumentAcceptance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    legalAdminAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("../../lib/s3/client", () => ({
  generatePresignedDownloadUrl: jest.fn(async () => ({
    downloadUrl: "https://example.com/download.pdf",
    expiresIn: 60,
  })),
  generatePresignedViewUrl: jest.fn(async () => ({
    viewUrl: "https://example.com/view.pdf",
    expiresIn: 60,
  })),
  generatePresignedUploadUrl: jest.fn(async () => ({
    uploadUrl: "https://example.com/upload",
    expiresIn: 60,
  })),
  generateLegalDocumentKey: jest.fn(
    ({ type, version, cuid, extension }) =>
      `legal-documents/${String(type).toLowerCase()}/v${version}-2026-01-01-${cuid}.${extension}`
  ),
  getFileExtension: jest.fn(() => "pdf"),
  validatePdfUpload: jest.fn(() => ({ valid: true })),
  deleteS3Object: jest.fn(async () => undefined),
  copyS3Object: jest.fn(async () => undefined),
}));

jest.mock("../../lib/s3/legal-document-object", () => ({
  isLegalDocumentS3Key: jest.fn((key: string) => String(key).startsWith("legal-documents/")),
  sanitizeS3KeyForLog: jest.fn((key: string) => key),
  assertStoredLegalPdf: jest.fn(async ({ claimedFileSize }) => ({
    fileHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    fileSize: claimedFileSize ?? 100,
  })),
}));

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from "../../lib/prisma";
import { legalDocumentAcceptanceService } from "./acceptance-service";
import { legalDocumentRepository } from "./repository";
import { legalDocumentService } from "./service";
import { createLegalDocumentSchema } from "./schemas";
import { copyS3Object, deleteS3Object, validatePdfUpload } from "../../lib/s3/client";
import { assertStoredLegalPdf } from "../../lib/s3/legal-document-object";
import { auditContextForActor } from "./audit/context";

const mockReq = {
  headers: {
    "user-agent": "JestAgent/1.0",
    "x-forwarded-for": "203.0.113.10",
  },
  socket: { remoteAddress: "127.0.0.1" },
} as never;

function adminContext(actorUserId = "admin1") {
  return auditContextForActor(mockReq, actorUserId);
}

function publishedVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "ver1",
    legal_document_id: "ld1",
    version: 1,
    status: "PUBLISHED",
    s3_key: "legal-documents/pdpa/v1.pdf",
    file_name: "pdpa.pdf",
    content_type: "application/pdf",
    file_size: 100,
    file_hash: "abc",
    reacceptance_required: false,
    uploaded_by: "admin1",
    published_by: "admin1",
    published_at: new Date(),
    archived_by: null,
    archived_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    legal_document: {
      id: "ld1",
      type: "PDPA_NOTICE_AND_CONSENT",
      title: "PDPA",
      description: null,
      audience: "BOTH",
      required_for_onboarding: true,
      public_visibility: true,
      show_in_account: false,
      created_at: new Date(),
      updated_at: new Date(),
    },
    ...overrides,
  };
}

describe("legal document acceptance service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "owner@example.com",
      first_name: "Owner",
      last_name: "User",
    });
    (prisma.legalAdminAuditLog.create as jest.Mock).mockResolvedValue({ id: "audit1" });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(prisma));
    jest.spyOn(legalDocumentRepository, "findAllPublishedByDocumentId").mockResolvedValue([]);
  });

  it("does not return draft documents to users", async () => {
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });

    const status = await legalDocumentAcceptanceService.getRequiredDocuments(
      "u1",
      "org1",
      "ISSUER"
    );

    expect(status.documents).toEqual([]);
    expect(status.all_accepted).toBe(true);
  });

  it("reports no required documents when nothing is published for onboarding", async () => {
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });

    const status = await legalDocumentAcceptanceService.hasCompletedRequiredAcceptances(
      "u1",
      "org1",
      "ISSUER"
    );

    expect(status).toEqual({
      hasRequiredDocuments: false,
      allAccepted: true,
    });
  });

  it("blocks accept-tnc readiness when a required published document is not accepted", async () => {
    jest
      .spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences")
      .mockImplementation(async (type) =>
        type === "PDPA_NOTICE_AND_CONSENT" ? (publishedVersion() as never) : null
      );
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockImplementation(
      async (args: { where: { status?: string } }) => {
        if (args.where.status === "ACCEPTED") return null;
        return { status: "OPENED", opened_at: new Date() };
      }
    );

    const status = await legalDocumentAcceptanceService.hasCompletedRequiredAcceptances(
      "u1",
      "org1",
      "ISSUER"
    );

    expect(status.hasRequiredDocuments).toBe(true);
    expect(status.allAccepted).toBe(false);
  });

  it("allows accept-tnc readiness when all currently required published documents are accepted", async () => {
    jest
      .spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences")
      .mockImplementation(async (type) =>
        type === "PDPA_NOTICE_AND_CONSENT" ? (publishedVersion() as never) : null
      );
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue({
      status: "ACCEPTED",
      accepted_at: new Date(),
    });

    const status = await legalDocumentAcceptanceService.hasCompletedRequiredAcceptances(
      "u1",
      "org1",
      "ISSUER"
    );

    expect(status).toEqual({
      hasRequiredDocuments: true,
      allAccepted: true,
    });
  });

  it("does not require unpublished or non-required document types for onboarding readiness", async () => {
    const findPublished = jest
      .spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences")
      .mockImplementation(async (type) =>
        type === "TERMS_OF_USE"
          ? (publishedVersion({
              id: "ver-tou",
              legal_document: {
                ...publishedVersion().legal_document,
                type: "TERMS_OF_USE",
                title: "Terms",
              },
            }) as never)
          : null
      );
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org2",
      owner_user_id: "u2",
      tnc_accepted: false,
    });
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue({
      status: "ACCEPTED",
      accepted_at: new Date(),
    });

    const status = await legalDocumentAcceptanceService.hasCompletedRequiredAcceptances(
      "u2",
      "org2",
      "INVESTOR"
    );

    expect(findPublished).toHaveBeenCalled();
    expect(status).toEqual({
      hasRequiredDocuments: true,
      allAccepted: true,
    });
    expect(status.hasRequiredDocuments).toBe(true);
    expect(findPublished.mock.calls.length).toBeGreaterThan(1);
  });

  it("rejects acceptance before open when open-before-accept is required", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });
    jest
      .spyOn(legalDocumentRepository, "findVersionById")
      .mockResolvedValue(publishedVersion() as never);
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      legalDocumentAcceptanceService.recordAccepted(mockReq, "u1", "ver1", "org1", "ISSUER")
    ).rejects.toMatchObject({ code: "OPEN_REQUIRED" });
  });

  it("records open and is idempotent", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });
    jest
      .spyOn(legalDocumentRepository, "findVersionById")
      .mockResolvedValue(publishedVersion() as never);

    const openedRow = {
      id: "acc1",
      status: "OPENED",
      legal_document_version_id: "ver1",
    };
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(openedRow);
    (prisma.legalDocumentAcceptance.create as jest.Mock).mockResolvedValue(openedRow);

    const first = await legalDocumentAcceptanceService.recordOpened(
      mockReq,
      "u1",
      "ver1",
      "org1",
      "ISSUER"
    );
    expect(first.status).toBe("OPENED");

    const second = await legalDocumentAcceptanceService.recordOpened(
      mockReq,
      "u1",
      "ver1",
      "org1",
      "ISSUER"
    );
    expect(second.status).toBe("OPENED");
    expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledTimes(1);
  });

  it("accepts after open and is idempotent", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        file_hash: "hash2",
        legal_document: {
          id: "ld1",
          type: "TERMS_OF_USE",
          title: "Terms",
          description: null,
          audience: "BOTH",
          required_for_onboarding: true,
          public_visibility: true,
          show_in_account: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      }) as never
    );

    const opened = {
      id: "acc1",
      status: "OPENED",
      opened_at: new Date(),
      legal_document_version_id: "ver2",
    };
    const accepted = { ...opened, status: "ACCEPTED", accepted_at: new Date() };

    (prisma.legalDocumentAcceptance.findFirst as jest.Mock)
      .mockResolvedValueOnce(opened)
      .mockResolvedValueOnce(accepted);
    (prisma.legalDocumentAcceptance.update as jest.Mock).mockResolvedValue(accepted);

    const first = await legalDocumentAcceptanceService.recordAccepted(
      mockReq,
      "u1",
      "ver2",
      "org1",
      "ISSUER"
    );
    expect(first.status).toBe("ACCEPTED");
    expect(prisma.legalDocumentAcceptance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACCEPTED",
          document_hash: "hash2",
          legal_document_id: "ld1",
          document_type: "TERMS_OF_USE",
          version_number: 2,
          user_email_snapshot: "owner@example.com",
          acknowledgement_text: expect.stringContaining("agree"),
          accepted_ip_address: "203.0.113.10",
        }),
      })
    );

    const second = await legalDocumentAcceptanceService.recordAccepted(
      mockReq,
      "u1",
      "ver2",
      "org1",
      "ISSUER"
    );
    expect(second.status).toBe("ACCEPTED");
    expect(prisma.legalDocumentAcceptance.update).toHaveBeenCalledTimes(1);
  });

  it("allows a member to accept after opening", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "owner",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });
    jest
      .spyOn(legalDocumentRepository, "findVersionById")
      .mockResolvedValue(publishedVersion() as never);

    const opened = {
      id: "acc1",
      status: "OPENED",
      opened_at: new Date(),
      legal_document_version_id: "ver1",
    };
    const accepted = { ...opened, status: "ACCEPTED", accepted_at: new Date() };
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(opened);
    (prisma.legalDocumentAcceptance.update as jest.Mock).mockResolvedValue(accepted);

    const result = await legalDocumentAcceptanceService.recordAccepted(
      mockReq,
      "member",
      "ver1",
      "org1",
      "ISSUER"
    );
    expect(result.status).toBe("ACCEPTED");
  });

  it("rejects acceptance of archived documents", async () => {
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org2",
      owner_user_id: "u2",
      tnc_accepted: true,
      onboarding_status: "COMPLETED",
    });
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        status: "ARCHIVED",
        legal_document: {
          id: "ld2",
          type: "INVESTOR_AGREEMENT",
          title: "Investor Agreement",
          description: null,
          audience: "INVESTOR",
          required_for_onboarding: true,
          public_visibility: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      }) as never
    );

    await expect(
      legalDocumentAcceptanceService.recordAccepted(mockReq, "u2", "ver2", "org2", "INVESTOR")
    ).rejects.toMatchObject({ code: "INVALID_DOCUMENT" });
  });

  it("blocks investor from issuer-only documents", async () => {
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org2",
      owner_user_id: "u2",
      tnc_accepted: true,
      onboarding_status: "COMPLETED",
    });
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver3",
        legal_document: {
          id: "ld3",
          type: "ISSUER_AGREEMENT",
          title: "Issuer Agreement",
          description: null,
          audience: "ISSUER",
          required_for_onboarding: true,
          public_visibility: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      }) as never
    );
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue({
      id: "acc",
      status: "OPENED",
    });

    await expect(
      legalDocumentAcceptanceService.recordAccepted(mockReq, "u2", "ver3", "org2", "INVESTOR")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("records IP address and user agent on open", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
      name: "Acme Issuer",
      type: "COMPANY",
    });
    jest
      .spyOn(legalDocumentRepository, "findVersionById")
      .mockResolvedValue(publishedVersion() as never);
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.legalDocumentAcceptance.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => data
    );

    await legalDocumentAcceptanceService.recordOpened(mockReq, "u1", "ver1", "org1", "ISSUER");

    expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          opened_ip_address: "203.0.113.10",
          opened_user_agent: "JestAgent/1.0",
          legal_document_version_id: "ver1",
        }),
      })
    );
  });

  it("does not create pending reacceptance when reacceptance_required=false", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
      onboarding_status: "COMPLETED",
    });
    jest
      .spyOn(legalDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue(null);
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

    const pending = await legalDocumentAcceptanceService.getPendingReacceptanceDocuments(
      "u1",
      "org1",
      "ISSUER"
    );
    expect(pending).toEqual([]);

    const compliance = await legalDocumentAcceptanceService.getComplianceStatus(
      "u1",
      "org1",
      "ISSUER"
    );
    expect(compliance.hasPendingReacceptance).toBe(false);
    expect(compliance.blockedActions).toEqual([]);
    expect(compliance.tncAccepted).toBe(true);
    expect(compliance.isOrganisationOwner).toBe(true);
  });

  it("creates pending reacceptance when reacceptance_required=true and not accepted", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
      onboarding_status: "COMPLETED",
    });

    jest
      .spyOn(legalDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockImplementation(async (type) => {
        if (type !== "PDPA_NOTICE_AND_CONSENT") return null;
        return publishedVersion({
          id: "doc-v2",
          version: 2,
          reacceptance_required: true,
          file_hash: "v2",
          file_name: "pdpa-v2.pdf",
        }) as never;
      });
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);

    const pending = await legalDocumentAcceptanceService.getPendingReacceptanceDocuments(
      "u1",
      "org1",
      "ISSUER"
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].legalDocumentVersionId).toBe("doc-v2");
    expect(pending[0].legalDocumentId).toBe("ld1");
    expect(pending[0].version).toBe(2);

    const compliance = await legalDocumentAcceptanceService.getComplianceStatus(
      "u1",
      "org1",
      "ISSUER"
    );
    expect(compliance.hasPendingReacceptance).toBe(true);
    expect(compliance.blockedActions).toEqual([
      "NEW_FINANCING_APPLICATION",
      "NEW_UTILISATION",
    ]);
    expect(compliance.tncAccepted).toBe(true);
    expect(compliance.onboardingComplete).toBe(true);
  });

  it("does not pending-reaccept for incomplete organizations even when tnc_accepted", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org-new",
      owner_user_id: "u1",
      tnc_accepted: true,
      onboarding_status: "IN_PROGRESS",
    });
    jest
      .spyOn(legalDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue(
        publishedVersion({
          id: "doc-v2",
          version: 2,
          reacceptance_required: true,
        }) as never
      );
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

    const pending = await legalDocumentAcceptanceService.getPendingReacceptanceDocuments(
      "u1",
      "org-new",
      "ISSUER"
    );
    expect(pending).toEqual([]);

    const compliance = await legalDocumentAcceptanceService.getComplianceStatus(
      "u1",
      "org-new",
      "ISSUER"
    );
    expect(compliance.onboardingComplete).toBe(false);
    expect(compliance.hasPendingReacceptance).toBe(false);
    expect(compliance.blockedActions).toEqual([]);

    await expect(
      legalDocumentAcceptanceService.assertNoPendingReacceptance(
        "u1",
        "org-new",
        "ISSUER",
        "NEW_FINANCING_APPLICATION"
      )
    ).resolves.toBeUndefined();
  });

  it("blocks new issuer transactions while pending reacceptance", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
      onboarding_status: "COMPLETED",
    });
    jest
      .spyOn(legalDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue(
        publishedVersion({
          id: "doc-v2",
          version: 3,
          reacceptance_required: true,
          legal_document: {
            id: "ld1",
            type: "ISSUER_AGREEMENT",
            title: "Issuer Agreement",
            description: null,
            audience: "ISSUER",
            required_for_onboarding: true,
            public_visibility: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        }) as never
      );
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

    await expect(
      legalDocumentAcceptanceService.assertNoPendingReacceptance(
        "u1",
        "org1",
        "ISSUER",
        "NEW_FINANCING_APPLICATION"
      )
    ).rejects.toMatchObject({
      code: "LEGAL_REACCEPTANCE_REQUIRED",
      message: "Accept the latest legal documents before starting a new financing transaction.",
    });
  });

  it("blocks new investor investments while pending reacceptance", async () => {
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org2",
      owner_user_id: "u2",
      tnc_accepted: true,
      onboarding_status: "COMPLETED",
    });
    jest
      .spyOn(legalDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue(
        publishedVersion({
          id: "doc-inv",
          version: 2,
          reacceptance_required: true,
          legal_document: {
            id: "ld-inv",
            type: "INVESTOR_AGREEMENT",
            title: "Investor Agreement",
            description: null,
            audience: "INVESTOR",
            required_for_onboarding: true,
            public_visibility: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        }) as never
      );
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

    await expect(
      legalDocumentAcceptanceService.assertNoPendingReacceptance(
        "u2",
        "org2",
        "INVESTOR",
        "NEW_INVESTMENT"
      )
    ).rejects.toMatchObject({
      code: "LEGAL_REACCEPTANCE_REQUIRED",
      message: "Accept the latest legal documents before starting a new investment transaction.",
    });
  });

  it("removes transaction blocks after org acceptance", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
      onboarding_status: "COMPLETED",
    });
    jest
      .spyOn(legalDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue(
        publishedVersion({
          id: "doc-v2",
          version: 2,
          reacceptance_required: true,
        }) as never
      );
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue({
      id: "acc",
      status: "ACCEPTED",
      organization_id: "org1",
      legal_document_version_id: "doc-v2",
    });
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

    await expect(
      legalDocumentAcceptanceService.assertNoPendingReacceptance(
        "u1",
        "org1",
        "ISSUER",
        "NEW_FINANCING_APPLICATION"
      )
    ).resolves.toBeUndefined();
  });

  it("publish does not reset tnc_accepted", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver1",
        status: "DRAFT",
        reacceptance_required: false,
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "publishVersion").mockResolvedValue(
      publishedVersion({
        id: "ver1",
        status: "PUBLISHED",
        reacceptance_required: true,
      }) as never
    );
    await legalDocumentService.publishVersion(
      "ver1",
      { reacceptanceRequired: true },
      "admin1",
      adminContext()
    );

    expect(prisma.issuerOrganization.updateMany).not.toHaveBeenCalled();
    expect(prisma.investorOrganization.updateMany).not.toHaveBeenCalled();
  });

  it("restores archived draft to draft", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver1",
        status: "ARCHIVED",
        published_at: null,
        published_by: null,
        archived_at: new Date(),
        archived_by: "admin1",
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "findDraftByDocumentId").mockResolvedValue(null);
    jest.spyOn(legalDocumentRepository, "restoreVersionToDraft").mockResolvedValue(
      publishedVersion({
        id: "ver1",
        status: "DRAFT",
        published_at: null,
        published_by: null,
        archived_at: null,
        archived_by: null,
      }) as never
    );
    const restored = await legalDocumentService.restoreVersion("ver1", "admin1", adminContext());
    expect(restored.status).toBe("DRAFT");
  });

  it("blocks restore of a previously published archived version", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver1",
        version: 1,
        status: "ARCHIVED",
        published_at: new Date("2026-08-01"),
        archived_at: new Date("2026-08-02"),
        archived_by: "admin1",
      }) as never
    );
    const restoreToDraft = jest
      .spyOn(legalDocumentRepository, "restoreVersionToDraft")
      .mockResolvedValue(publishedVersion() as never);
    const publish = jest
      .spyOn(legalDocumentRepository, "publishVersion")
      .mockResolvedValue(publishedVersion() as never);

    await expect(
      legalDocumentService.restoreVersion("ver1", "admin1", adminContext())
    ).rejects.toMatchObject({ code: "VERSION_IMMUTABLE" });
    expect(restoreToDraft).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("rejects publishing an archived version even if the API is called directly", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver1",
        status: "ARCHIVED",
        published_at: new Date("2026-08-01"),
      }) as never
    );

    const publish = jest
      .spyOn(legalDocumentRepository, "publishVersion")
      .mockResolvedValue(publishedVersion() as never);

    await expect(
      legalDocumentService.publishVersion(
        "ver1",
        { reacceptanceRequired: false },
        "admin1",
        adminContext()
      )
    ).rejects.toMatchObject({ code: "INVALID_STATUS" });
    expect(publish).not.toHaveBeenCalled();
  });

  const clonedFileHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("creates a new draft from an archived published version without mutating the source", async () => {
    const source = publishedVersion({
      id: "ver1",
      version: 1,
      status: "ARCHIVED",
      published_at: new Date("2026-08-01"),
      published_by: "admin-original",
      archived_at: new Date("2026-08-02"),
      archived_by: "admin1",
      file_hash: clonedFileHash,
      file_name: "pdpa-v1.pdf",
      s3_key: "legal-documents/pdpa/v1.pdf",
      reacceptance_required: true,
    });
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(source as never);
    jest.spyOn(legalDocumentRepository, "findDraftByDocumentId").mockResolvedValue(null);
    jest.spyOn(legalDocumentRepository, "getLatestVersionNumber").mockResolvedValue(2);
    const createVersion = jest.spyOn(legalDocumentRepository, "createVersion").mockResolvedValue(
      publishedVersion({
        id: "ver3",
        version: 3,
        status: "DRAFT",
        published_at: null,
        published_by: null,
        archived_at: null,
        archived_by: null,
        file_hash: clonedFileHash,
        file_name: "pdpa-v1.pdf",
        s3_key: "legal-documents/pdpa-notice-and-consent/v3-2026-01-01-cuid.pdf",
        reacceptance_required: false,
        uploaded_by: "admin1",
      }) as never
    );
    (prisma.legalDocumentAcceptance.update as jest.Mock).mockClear();
    (prisma.legalDocumentAcceptance.deleteMany as jest.Mock).mockClear();
    const restoreToDraft = jest.spyOn(legalDocumentRepository, "restoreVersionToDraft");
    const publish = jest.spyOn(legalDocumentRepository, "publishVersion");

    const created = await legalDocumentService.createVersionFromArchivedPublished(
      "ver1",
      "admin1",
      adminContext()
    );

    expect(created.id).toBe("ver3");
    expect(created.version).toBe(3);
    expect(created.status).toBe("DRAFT");
    expect(copyS3Object).toHaveBeenCalledWith({
      sourceKey: "legal-documents/pdpa/v1.pdf",
      destinationKey: expect.stringMatching(/^legal-documents\//),
    });
    expect(createVersion).toHaveBeenCalledWith(
      "ld1",
      3,
      expect.objectContaining({
        fileName: "pdpa-v1.pdf",
        contentType: "application/pdf",
        fileHash: clonedFileHash,
        fileSize: 100,
      }),
      "admin1",
      expect.anything()
    );
    expect(createVersion.mock.calls[0][2]).not.toHaveProperty("publishedAt");
    expect(prisma.legalDocumentAcceptance.update).not.toHaveBeenCalled();
    expect(prisma.legalDocumentAcceptance.deleteMany).not.toHaveBeenCalled();
    expect(restoreToDraft).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(source.status).toBe("ARCHIVED");
    expect(source.published_at).toEqual(new Date("2026-08-01"));
    expect(source.published_by).toBe("admin-original");
    expect(source.archived_at).toEqual(new Date("2026-08-02"));
    expect(source.archived_by).toBe("admin1");
    expect(prisma.legalAdminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: "LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION",
          legal_document_version_id: "ver3",
          metadata: expect.objectContaining({
            sourceVersionId: "ver1",
            sourceVersionNumber: 1,
            newVersionId: "ver3",
            newVersionNumber: 3,
            fileHash: clonedFileHash,
            fileName: "pdpa-v1.pdf",
            status: "DRAFT",
          }),
        }),
      })
    );
  });

  it("rejects create-from-version when a draft already exists", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver1",
        status: "ARCHIVED",
        published_at: new Date("2026-08-01"),
        file_hash: clonedFileHash,
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "findDraftByDocumentId").mockResolvedValue(
      publishedVersion({ id: "ver-draft", status: "DRAFT", published_at: null }) as never
    );
    const createVersion = jest.spyOn(legalDocumentRepository, "createVersion");

    await expect(
      legalDocumentService.createVersionFromArchivedPublished("ver1", "admin1", adminContext())
    ).rejects.toMatchObject({ code: "DRAFT_EXISTS" });
    expect(createVersion).not.toHaveBeenCalled();
    expect(copyS3Object).not.toHaveBeenCalled();
  });

  it("does not treat V1 acceptance as acceptance of a cloned published V3", async () => {
    const v3 = publishedVersion({
      id: "ver3",
      version: 3,
      status: "PUBLISHED",
      file_hash: clonedFileHash,
      reacceptance_required: true,
    });
    jest
      .spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences")
      .mockImplementation(async (type) =>
        type === "PDPA_NOTICE_AND_CONSENT" ? (v3 as never) : null
      );
    jest
      .spyOn(legalDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockImplementation(async (type) =>
        type === "PDPA_NOTICE_AND_CONSENT" ? (v3 as never) : null
      );
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
      onboarding_status: "COMPLETED",
      name: "Acme Issuer",
      type: "COMPANY",
    });
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockImplementation(
      async ({ where }: { where: { legal_document_version_id?: string } }) => {
        if (where.legal_document_version_id === "ver1") {
          return { id: "acc-v1", status: "ACCEPTED", legal_document_version_id: "ver1" };
        }
        return null;
      }
    );

    const required = await legalDocumentAcceptanceService.getRequiredDocuments(
      "u1",
      "org1",
      "ISSUER"
    );
    expect(required.documents[0]?.legalDocumentVersionId).toBe("ver3");
    expect(required.documents[0]?.acceptance_status).not.toBe("ACCEPTED");
    expect(required.all_accepted).toBe(false);

    const pending = await legalDocumentAcceptanceService.getPendingReacceptanceDocuments(
      "u1",
      "org1",
      "ISSUER"
    );
    expect(pending.map((doc) => doc.legalDocumentVersionId)).toContain("ver3");
  });

  it("replaces draft PDF in place without creating a new version number", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "DRAFT",
        published_at: null,
        published_by: null,
        file_name: "old.pdf",
        s3_key: "legal-documents/old-key.pdf",
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "replaceDraftFile").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "DRAFT",
        published_at: null,
        published_by: null,
        file_name: "fixed.pdf",
        s3_key: "legal-documents/new-key.pdf",
        file_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "countVersionsByS3Key").mockResolvedValue(0);

    const replaced = await legalDocumentService.replaceDraftFile(
      "ver2",
      {
        s3Key: "legal-documents/new-key.pdf",
        fileName: "fixed.pdf",
        contentType: "application/pdf",
        fileSize: 1200,
      },
      adminContext()
    );

    expect(assertStoredLegalPdf).toHaveBeenCalledWith({
      s3Key: "legal-documents/new-key.pdf",
      claimedFileSize: 1200,
    });
    expect(legalDocumentRepository.replaceDraftFile).toHaveBeenCalledWith(
      "ver2",
      expect.objectContaining({
        s3Key: "legal-documents/new-key.pdf",
        fileHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fileSize: 1200,
      }),
      expect.anything()
    );
    expect(deleteS3Object).toHaveBeenCalledWith("legal-documents/old-key.pdf");
    expect(replaced.version).toBe(2);
    expect(replaced.fileName).toBe("fixed.pdf");
    expect(replaced.status).toBe("DRAFT");
    expect(replaced.fileHash).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
  });

  it("does not delete old S3 object when draft replace hash validation fails", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "DRAFT",
        s3_key: "legal-documents/old-key.pdf",
      }) as never
    );
    const replaceSpy = jest.spyOn(legalDocumentRepository, "replaceDraftFile");
    (assertStoredLegalPdf as jest.Mock).mockRejectedValueOnce({
      code: "VALIDATION_ERROR",
      message: "not pdf",
      statusCode: 400,
    });
    jest.spyOn(legalDocumentRepository, "countVersionsByS3Key").mockResolvedValue(0);

    await expect(
      legalDocumentService.replaceDraftFile(
        "ver2",
        {
          s3Key: "legal-documents/new-key.pdf",
          fileName: "fixed.pdf",
          contentType: "application/pdf",
          fileSize: 1200,
        },
        adminContext()
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(replaceSpy).not.toHaveBeenCalled();
    expect(deleteS3Object).toHaveBeenCalledWith("legal-documents/new-key.pdf");
    expect(deleteS3Object).not.toHaveBeenCalledWith("legal-documents/old-key.pdf");
  });

  it("ignores client hash and stores server hash on createDraftVersion", async () => {
    jest.spyOn(legalDocumentRepository, "findById").mockResolvedValue({
      id: "ld1",
      type: "TERMS_OF_USE",
      title: "Terms",
      description: null,
      audience: "BOTH",
      required_for_onboarding: true,
      public_visibility: true,
      show_in_account: false,
      created_at: new Date(),
      updated_at: new Date(),
    } as never);
    jest.spyOn(legalDocumentRepository, "getLatestVersionNumber").mockResolvedValue(0);
    jest.spyOn(legalDocumentRepository, "createVersion").mockResolvedValue(
      publishedVersion({
        id: "ver-new",
        version: 1,
        status: "DRAFT",
        published_at: null,
        published_by: null,
        file_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        s3_key: "legal-documents/new.pdf",
      }) as never
    );

    const created = await legalDocumentService.createDraftVersion(
      "ld1",
      {
        s3Key: "legal-documents/new.pdf",
        fileName: "terms.pdf",
        contentType: "application/pdf",
        fileSize: 500,
      },
      "admin1",
      adminContext()
    );

    expect(assertStoredLegalPdf).toHaveBeenCalled();
    expect(legalDocumentRepository.createVersion).toHaveBeenCalledWith(
      "ld1",
      1,
      expect.objectContaining({
        fileHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        fileSize: 500,
      }),
      "admin1",
      expect.anything()
    );
    expect(created.fileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects publish without file hash", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        status: "DRAFT",
        file_hash: null,
        published_at: null,
        published_by: null,
      }) as never
    );
    await expect(
      legalDocumentService.publishVersion(
        "ver2",
        { reacceptanceRequired: false },
        "admin1",
        adminContext()
      )
    ).rejects.toMatchObject({ code: "HASH_REQUIRED" });
  });

  it("does not delete old object when keys are equal", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "DRAFT",
        s3_key: "legal-documents/same.pdf",
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "replaceDraftFile").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "DRAFT",
        s3_key: "legal-documents/same.pdf",
        file_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "countVersionsByS3Key").mockResolvedValue(0);
    (deleteS3Object as jest.Mock).mockClear();

    await legalDocumentService.replaceDraftFile(
      "ver2",
      {
        s3Key: "legal-documents/same.pdf",
        fileName: "same.pdf",
        contentType: "application/pdf",
        fileSize: 100,
      },
      adminContext()
    );

    expect(deleteS3Object).not.toHaveBeenCalled();
  });

  it("does not delete published object via replace path", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        status: "PUBLISHED",
        s3_key: "legal-documents/pub.pdf",
      }) as never
    );
    await expect(
      legalDocumentService.replaceDraftFile(
        "ver2",
        {
          s3Key: "legal-documents/new.pdf",
          fileName: "n.pdf",
          contentType: "application/pdf",
          fileSize: 10,
        },
        adminContext()
      )
    ).rejects.toMatchObject({ code: "INVALID_STATUS" });
    expect(deleteS3Object).not.toHaveBeenCalled();
  });

  it("keeps DB update when old S3 delete fails", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "DRAFT",
        s3_key: "legal-documents/old-key.pdf",
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "replaceDraftFile").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "DRAFT",
        s3_key: "legal-documents/new-key.pdf",
        file_name: "fixed.pdf",
        file_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "countVersionsByS3Key").mockResolvedValue(0);
    (deleteS3Object as jest.Mock).mockRejectedValueOnce(new Error("s3 down"));

    const replaced = await legalDocumentService.replaceDraftFile(
      "ver2",
      {
        s3Key: "legal-documents/new-key.pdf",
        fileName: "fixed.pdf",
        contentType: "application/pdf",
        fileSize: 1200,
      },
      adminContext()
    );
    expect(replaced.fileName).toBe("fixed.pdf");
    expect(legalDocumentRepository.replaceDraftFile).toHaveBeenCalled();
  });

  it("archives published version and leaves no automatic fallback", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "PUBLISHED",
        reacceptance_required: true,
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "archiveVersion").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "ARCHIVED",
        reacceptance_required: true,
        archived_at: new Date(),
        archived_by: "admin1",
      }) as never
    );
    jest.spyOn(legalDocumentRepository, "findPublishedByDocumentId").mockResolvedValue(null);

    const archived = await legalDocumentService.archiveVersion("ver2", "admin1", adminContext());
    expect(archived.status).toBe("ARCHIVED");
    const stillPublished = await legalDocumentRepository.findPublishedByDocumentId("ld1");
    expect(stillPublished).toBeNull();
  });
});

describe("legal document upload validation", () => {
  it("rejects non-PDF uploads", async () => {
    (validatePdfUpload as jest.Mock).mockReturnValueOnce({
      valid: false,
      error: "Only PDF files are allowed",
    });
    jest.spyOn(legalDocumentRepository, "findById").mockResolvedValue({
      id: "ld1",
      type: "PDPA_NOTICE_AND_CONSENT",
      title: "PDPA",
      description: null,
      audience: "BOTH",
      required_for_onboarding: true,
      public_visibility: false,
      created_at: new Date(),
      updated_at: new Date(),
      versions: [],
    } as never);

    await expect(
      legalDocumentService.requestVersionUploadUrl(
        "ld1",
        {
          fileName: "note.txt",
          contentType: "application/pdf",
          fileSize: 100,
        },
        "admin1"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("legal document definition schema", () => {
  it("accepts create definition payloads with defaults", () => {
    const parsed = createLegalDocumentSchema.parse({
      type: "PDPA_NOTICE_AND_CONSENT",
      title: "PDPA Notice and Consent",
      audience: "BOTH",
    });

    expect(parsed.requiredForOnboarding).toBe(true);
    expect(parsed.publicVisibility).toBe(false);
    expect(parsed.showInAccount).toBe(false);
  });

  it("accepts independent showInAccount from onboarding and public visibility", () => {
    const parsed = createLegalDocumentSchema.parse({
      type: "TERMS_OF_USE",
      title: "Terms of Use",
      audience: "BOTH",
      requiredForOnboarding: true,
      publicVisibility: false,
      showInAccount: true,
    });
    expect(parsed.requiredForOnboarding).toBe(true);
    expect(parsed.publicVisibility).toBe(false);
    expect(parsed.showInAccount).toBe(true);
  });

  it("does not map RISK_DISCLOSURE to RISK_STATEMENT", () => {
    expect(() =>
      createLegalDocumentSchema.parse({
        type: "RISK_DISCLOSURE",
        title: "Disclosure",
        audience: "BOTH",
      })
    ).toThrow();
  });
});

describe("public legal documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists only published versions with public_visibility=true", async () => {
    jest.spyOn(legalDocumentRepository, "findPublicPublishedVersions").mockResolvedValue([
      {
        id: "ver-public",
        legal_document_id: "ld1",
        version: 2,
        status: "PUBLISHED",
        file_name: "terms.pdf",
        published_at: new Date("2026-08-01T00:00:00.000Z"),
        legal_document: {
          id: "ld1",
          type: "TERMS_OF_USE",
          title: "Terms of Use",
          description: "Public terms",
          audience: "BOTH",
          public_visibility: true,
        },
      },
    ] as never);

    const docs = await legalDocumentAcceptanceService.listPublicPublishedDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      type: "TERMS_OF_USE",
      slug: "terms-of-use",
      description: "Public terms",
      audience: "BOTH",
    });
    expect(docs[0]).not.toHaveProperty("s3_key");
    expect(docs[0]).not.toHaveProperty("s3Key");
  });

  it("lists account documents only when show_in_account and published", async () => {
    jest.spyOn(legalDocumentRepository, "findAccountPublishedVersions").mockResolvedValue([
      publishedVersion({
        id: "ver-acc",
        legal_document: {
          id: "ld1",
          type: "TERMS_OF_USE",
          title: "Terms of Use",
          description: null,
          audience: "BOTH",
          required_for_onboarding: false,
          public_visibility: false,
          show_in_account: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      }),
    ] as never);

    const docs = await legalDocumentAcceptanceService.listAccountDocuments(
      { user_id: "u1", roles: ["ISSUER"] },
      "ISSUER"
    );
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      type: "TERMS_OF_USE",
      legalDocumentVersionId: "ver-acc",
      title: "Terms of Use",
    });
  });

  it("does not list account documents when none are show_in_account published", async () => {
    jest
      .spyOn(legalDocumentRepository, "findAccountPublishedVersions")
      .mockResolvedValue([] as never);
    await expect(
      legalDocumentAcceptanceService.listAccountDocuments(
        { user_id: "u2", roles: ["INVESTOR"] },
        "INVESTOR"
      )
    ).resolves.toEqual([]);
  });

  it("rejects account document audience outside the user portal roles", async () => {
    await expect(
      legalDocumentAcceptanceService.listAccountDocuments(
        { user_id: "u1", roles: ["ISSUER"] },
        "INVESTOR"
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects admin-only users from account legal documents", async () => {
    await expect(
      legalDocumentAcceptanceService.listAccountDocuments(
        { user_id: "admin1", roles: ["ADMIN"] },
        "ISSUER"
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("issuer account list only requests issuer-applicable audiences", async () => {
    const spy = jest
      .spyOn(legalDocumentRepository, "findAccountPublishedVersions")
      .mockResolvedValue([] as never);

    await legalDocumentAcceptanceService.listAccountDocuments(
      { user_id: "u1", roles: ["ISSUER"] },
      "ISSUER"
    );

    expect(spy).toHaveBeenCalledWith(["ISSUER", "BOTH"]);
  });

  it("investor account list only requests investor-applicable audiences", async () => {
    const spy = jest
      .spyOn(legalDocumentRepository, "findAccountPublishedVersions")
      .mockResolvedValue([] as never);

    await legalDocumentAcceptanceService.listAccountDocuments(
      { user_id: "u2", roles: ["INVESTOR"] },
      "INVESTOR"
    );

    expect(spy).toHaveBeenCalledWith(["INVESTOR", "BOTH"]);
  });

  it("resolves public document by slug", async () => {
    jest.spyOn(legalDocumentRepository, "findPublicPublishedByType").mockResolvedValue({
      id: "ver-pdpa",
      legal_document_id: "ld2",
      version: 1,
      status: "PUBLISHED",
      file_name: "pdpa.pdf",
      published_at: new Date("2026-08-01T00:00:00.000Z"),
      legal_document: {
        id: "ld2",
        type: "PDPA_NOTICE_AND_CONSENT",
        title: "PDPA Notice and Consent",
        description: null,
        audience: "BOTH",
        public_visibility: true,
      },
    } as never);

    const doc = await legalDocumentAcceptanceService.getPublicDocumentBySlug(
      "pdpa-notice-and-consent"
    );
    expect(doc.legalDocumentVersionId).toBe("ver-pdpa");
    expect(doc.slug).toBe("pdpa-notice-and-consent");
  });

  it("rejects public download when public_visibility is false", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue({
      id: "ver-private",
      status: "PUBLISHED",
      legal_document: {
        public_visibility: false,
        audience: "ISSUER",
      },
    } as never);

    await expect(
      legalDocumentAcceptanceService.getPublicDownloadUrl("ver-private")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects draft versions from public download", async () => {
    jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue({
      id: "ver-draft",
      status: "DRAFT",
      legal_document: {
        public_visibility: true,
      },
    } as never);

    await expect(
      legalDocumentAcceptanceService.getPublicDownloadUrl("ver-draft")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("legal document onboarding readiness", () => {
  function stubPublishedRequired(
    rows: Array<{ type: string; audience: "BOTH" | "ISSUER" | "INVESTOR" }>
  ) {
    jest
      .spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences")
      .mockImplementation(async (type, audiences) => {
        const match = rows.find(
          (row) => row.type === type && audiences.includes(row.audience)
        );
        if (!match) return null;
        return publishedVersion({
          legal_document: {
            ...publishedVersion().legal_document,
            type: match.type,
            audience: match.audience,
          },
        }) as never;
      });
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("Issuer 0 / Investor >0 → issuer is not ready", async () => {
    stubPublishedRequired([{ type: "INVESTOR_AGREEMENT", audience: "INVESTOR" }]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: false },
      investor: { hasPublishedRequiredDocuments: true },
    });
  });

  it("Investor 0 / Issuer >0 → investor is not ready", async () => {
    stubPublishedRequired([{ type: "ISSUER_AGREEMENT", audience: "ISSUER" }]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: true },
      investor: { hasPublishedRequiredDocuments: false },
    });
  });

  it("Issuer 0 / Investor 0 → neither audience is ready", async () => {
    stubPublishedRequired([]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: false },
      investor: { hasPublishedRequiredDocuments: false },
    });
  });

  it("Issuer >0 / Investor >0 → both audiences are ready", async () => {
    stubPublishedRequired([{ type: "PDPA_NOTICE_AND_CONSENT", audience: "BOTH" }]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: true },
      investor: { hasPublishedRequiredDocuments: true },
    });
  });

  it("does not warn Issuer when some required types are published and another is only draft", async () => {
    stubPublishedRequired([{ type: "PDPA_NOTICE_AND_CONSENT", audience: "BOTH" }]);
    const result = await legalDocumentAcceptanceService.getOnboardingReadiness();
    expect(result.issuer.hasPublishedRequiredDocuments).toBe(true);
  });

  it("does not warn Investor when some required types are published and another is only draft", async () => {
    stubPublishedRequired([{ type: "PDPA_NOTICE_AND_CONSENT", audience: "BOTH" }]);
    const result = await legalDocumentAcceptanceService.getOnboardingReadiness();
    expect(result.investor.hasPublishedRequiredDocuments).toBe(true);
  });

  it("counts audience-specific documents only for the matching audience", async () => {
    stubPublishedRequired([
      { type: "ISSUER_WARNING_STATEMENT", audience: "ISSUER" },
      { type: "INVESTOR_WARNING_STATEMENT", audience: "INVESTOR" },
    ]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: true },
      investor: { hasPublishedRequiredDocuments: true },
    });

    stubPublishedRequired([{ type: "ISSUER_AGREEMENT", audience: "ISSUER" }]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: true },
      investor: { hasPublishedRequiredDocuments: false },
    });
  });

  it("counts shared BOTH documents for both audiences", async () => {
    stubPublishedRequired([{ type: "TERMS_OF_USE", audience: "BOTH" }]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: true },
      investor: { hasPublishedRequiredDocuments: true },
    });
  });

  it("does not count archived versions as published", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repositorySource = readFileSync(join(__dirname, "repository.ts"), "utf8");
    const fnStart = repositorySource.indexOf("async findPublishedByTypeAndAudiences");
    const fnBody = repositorySource.slice(fnStart, fnStart + 700);
    expect(fnBody).toContain('status: "PUBLISHED"');
    expect(fnBody).not.toContain("ARCHIVED");

    stubPublishedRequired([]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: false },
      investor: { hasPublishedRequiredDocuments: false },
    });
  });

  it("does not count DRAFT versions as published", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repositorySource = readFileSync(join(__dirname, "repository.ts"), "utf8");
    const fnStart = repositorySource.indexOf("async findPublishedByTypeAndAudiences");
    const fnBody = repositorySource.slice(fnStart, fnStart + 700);
    expect(fnBody).toContain('status: "PUBLISHED"');
    expect(fnBody).not.toContain("DRAFT");

    stubPublishedRequired([]);
    await expect(legalDocumentAcceptanceService.getOnboardingReadiness()).resolves.toEqual({
      issuer: { hasPublishedRequiredDocuments: false },
      investor: { hasPublishedRequiredDocuments: false },
    });
  });

  it("admin readiness endpoint uses view permission and the acceptance resolver", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const controller = readFileSync(join(__dirname, "admin-controller.ts"), "utf8");
    expect(controller).toContain('"/onboarding-readiness"');
    expect(controller).toContain('requirePermission("document_management.view")');
    expect(controller).toContain("getOnboardingReadiness");

    const acceptance = readFileSync(join(__dirname, "acceptance-service.ts"), "utf8");
    expect(acceptance).toContain("getRequiredLegalTypesForAudience");
    expect(acceptance).toContain("resolveActivePublishedByTypeAndAudiences");
    expect(acceptance).toContain("if (!published) continue");
  });
});
