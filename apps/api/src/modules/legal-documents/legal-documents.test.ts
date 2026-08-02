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
    issuerOrganization: { findFirst: jest.fn(), updateMany: jest.fn() },
    investorOrganization: { findFirst: jest.fn(), updateMany: jest.fn() },
    legalDocumentAcceptance: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
  validateSiteDocument: jest.fn(() => ({ valid: true })),
}));

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from "../../lib/prisma";
import { legalDocumentAcceptanceService } from "./acceptance-service";
import { legalDocumentRepository } from "./repository";
import { legalDocumentService } from "./service";
import { documentLogRepository } from "../site-documents/repository";
import { createLegalDocumentSchema } from "./schemas";
import { validateSiteDocument } from "../../lib/s3/client";

const mockReq = {
  headers: {
    "user-agent": "JestAgent/1.0",
    "x-forwarded-for": "203.0.113.10",
  },
  socket: { remoteAddress: "127.0.0.1" },
} as never;

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
      created_at: new Date(),
      updated_at: new Date(),
    },
    ...overrides,
  };
}

describe("legal document acceptance service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(documentLogRepository, "create").mockResolvedValue({} as never);
  });

  it("does not return draft documents to users", async () => {
    jest.spyOn(legalDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
    });

    const status = await legalDocumentAcceptanceService.getRequiredDocuments(
      "u1",
      "org1",
      "ISSUER"
    );

    expect(status.documents).toEqual([]);
    expect(status.all_accepted).toBe(true);
  });

  it("rejects acceptance before open when open-before-accept is required", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
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

  it("rejects non-owner acceptance", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "owner",
      tnc_accepted: false,
    });
    jest
      .spyOn(legalDocumentRepository, "findVersionById")
      .mockResolvedValue(publishedVersion() as never);

    await expect(
      legalDocumentAcceptanceService.recordAccepted(mockReq, "member", "ver1", "org1", "ISSUER")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
          ip_address: "203.0.113.10",
          user_agent: "JestAgent/1.0",
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
    jest.spyOn(documentLogRepository, "create").mockResolvedValue({} as never);

    await legalDocumentService.publishVersion(
      "ver1",
      { reacceptanceRequired: true },
      "admin1",
      mockReq
    );

    expect(prisma.issuerOrganization.updateMany).not.toHaveBeenCalled();
    expect(prisma.investorOrganization.updateMany).not.toHaveBeenCalled();
    expect(documentLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LEGAL_VERSION_PUBLISHED",
        metadata: expect.objectContaining({
          reacceptance_required: true,
          legal_document_version_id: "ver1",
        }),
      })
    );
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
    jest.spyOn(documentLogRepository, "create").mockResolvedValue({} as never);

    const restored = await legalDocumentService.restoreVersion("ver1", "admin1", mockReq);
    expect(restored.status).toBe("DRAFT");
    expect(documentLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LEGAL_VERSION_RESTORED",
        metadata: expect.objectContaining({ restored_as: "DRAFT" }),
      })
    );
  });

  it("blocks restore of archived published when a newer published exists", async () => {
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
    jest.spyOn(legalDocumentRepository, "findPublishedByDocumentId").mockResolvedValue(
      publishedVersion({
        id: "ver2",
        version: 2,
        status: "PUBLISHED",
      }) as never
    );

    await expect(
      legalDocumentService.restoreVersion("ver1", "admin1", mockReq)
    ).rejects.toMatchObject({ code: "NEWER_PUBLISHED_EXISTS" });
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
      }) as never
    );
    jest.spyOn(documentLogRepository, "create").mockResolvedValue({} as never);

    const replaced = await legalDocumentService.replaceDraftFile(
      "ver2",
      {
        s3Key: "legal-documents/new-key.pdf",
        fileName: "fixed.pdf",
        contentType: "application/pdf",
        fileSize: 1200,
      },
      "admin1",
      mockReq
    );

    expect(replaced.version).toBe(2);
    expect(replaced.fileName).toBe("fixed.pdf");
    expect(replaced.status).toBe("DRAFT");
    expect(documentLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LEGAL_VERSION_UPDATED",
        metadata: expect.objectContaining({
          replaced_in_place: true,
          version: 2,
        }),
      })
    );
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
    jest.spyOn(documentLogRepository, "create").mockResolvedValue({} as never);
    jest.spyOn(legalDocumentRepository, "findPublishedByDocumentId").mockResolvedValue(null);

    const archived = await legalDocumentService.archiveVersion("ver2", "admin1", mockReq);
    expect(archived.status).toBe("ARCHIVED");
    expect(documentLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "LEGAL_VERSION_ARCHIVED",
        metadata: expect.objectContaining({
          previous_status: "PUBLISHED",
          new_status: "ARCHIVED",
        }),
      })
    );
    const stillPublished = await legalDocumentRepository.findPublishedByDocumentId("ld1");
    expect(stillPublished).toBeNull();
  });
});

describe("legal document upload validation", () => {
  it("rejects non-PDF uploads", async () => {
    (validateSiteDocument as jest.Mock).mockReturnValueOnce({
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
