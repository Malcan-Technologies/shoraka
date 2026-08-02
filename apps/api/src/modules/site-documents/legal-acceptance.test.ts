import {
  getRequiredLegalTypesForAudience,
  ISSUER_REQUIRED_LEGAL_TYPES,
  INVESTOR_REQUIRED_LEGAL_TYPES,
  isOnboardingLegalDocumentType,
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

  it("treats Terms of Use as a single TERMS_AND_CONDITIONS type", () => {
    expect(isOnboardingLegalDocumentType("TERMS_AND_CONDITIONS")).toBe(true);
    expect(ISSUER_REQUIRED_LEGAL_TYPES.filter((t) => t === "TERMS_AND_CONDITIONS")).toHaveLength(1);
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
  generatePresignedUploadUrl: jest.fn(),
  generateSiteDocumentKey: jest.fn(),
  getFileExtension: jest.fn(() => "pdf"),
  validateSiteDocument: jest.fn(() => ({ valid: true })),
  deleteS3Object: jest.fn(),
}));

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from "../../lib/prisma";
import { legalDocumentAcceptanceService } from "./acceptance-service";
import { siteDocumentRepository, documentLogRepository } from "./repository";
import { siteDocumentService } from "./service";
import { validateSiteDocument } from "../../lib/s3/client";

const mockReq = {
  headers: {
    "user-agent": "JestAgent/1.0",
    "x-forwarded-for": "203.0.113.10",
  },
  socket: { remoteAddress: "127.0.0.1" },
} as never;

describe("legal document acceptance service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(documentLogRepository, "create").mockResolvedValue({} as never);
  });

  it("does not return draft documents to users", async () => {
    jest.spyOn(siteDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);
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
    jest.spyOn(siteDocumentRepository, "findById").mockResolvedValue({
      id: "doc1",
      type: "PDPA_NOTICE",
      title: "PDPA",
      status: "PUBLISHED",
      audience: "BOTH",
      acceptance_required: true,
      open_before_accept_required: true,
      version: 1,
      file_hash: "abc",
    } as never);
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      legalDocumentAcceptanceService.recordAccepted(mockReq, "u1", "doc1", "org1", "ISSUER")
    ).rejects.toMatchObject({ code: "OPEN_REQUIRED" });
  });

  it("records open and is idempotent", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
    });
    jest.spyOn(siteDocumentRepository, "findById").mockResolvedValue({
      id: "doc1",
      type: "PDPA_NOTICE",
      title: "PDPA",
      status: "PUBLISHED",
      audience: "BOTH",
      acceptance_required: true,
      open_before_accept_required: true,
      version: 1,
      file_hash: "abc",
    } as never);

    const openedRow = { id: "acc1", status: "OPENED", document_id: "doc1" };
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(openedRow);
    (prisma.legalDocumentAcceptance.create as jest.Mock).mockResolvedValue(openedRow);

    const first = await legalDocumentAcceptanceService.recordOpened(
      mockReq,
      "u1",
      "doc1",
      "org1",
      "ISSUER"
    );
    expect(first.status).toBe("OPENED");

    const second = await legalDocumentAcceptanceService.recordOpened(
      mockReq,
      "u1",
      "doc1",
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
    jest.spyOn(siteDocumentRepository, "findById").mockResolvedValue({
      id: "doc1",
      type: "TERMS_AND_CONDITIONS",
      title: "Terms",
      status: "PUBLISHED",
      audience: "BOTH",
      acceptance_required: true,
      open_before_accept_required: true,
      version: 2,
      file_hash: "hash2",
    } as never);

    const opened = {
      id: "acc1",
      status: "OPENED",
      opened_at: new Date(),
      document_id: "doc1",
    };
    const accepted = { ...opened, status: "ACCEPTED", accepted_at: new Date() };

    (prisma.legalDocumentAcceptance.findFirst as jest.Mock)
      .mockResolvedValueOnce(opened)
      .mockResolvedValueOnce(accepted);
    (prisma.legalDocumentAcceptance.update as jest.Mock).mockResolvedValue(accepted);

    const first = await legalDocumentAcceptanceService.recordAccepted(
      mockReq,
      "u1",
      "doc1",
      "org1",
      "ISSUER"
    );
    expect(first.status).toBe("ACCEPTED");

    const second = await legalDocumentAcceptanceService.recordAccepted(
      mockReq,
      "u1",
      "doc1",
      "org1",
      "ISSUER"
    );
    expect(second.status).toBe("ACCEPTED");
    expect(prisma.legalDocumentAcceptance.update).toHaveBeenCalledTimes(1);
  });

  it("rejects acceptance of archived documents", async () => {
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org2",
      owner_user_id: "u2",
      tnc_accepted: true,
    });
    jest.spyOn(siteDocumentRepository, "findById").mockResolvedValue({
      id: "doc2",
      type: "INVESTOR_AGREEMENT",
      status: "ARCHIVED",
      audience: "INVESTOR",
      acceptance_required: true,
      open_before_accept_required: true,
      version: 1,
    } as never);

    await expect(
      legalDocumentAcceptanceService.recordAccepted(mockReq, "u2", "doc2", "org2", "INVESTOR")
    ).rejects.toMatchObject({ code: "INVALID_DOCUMENT" });
  });

  it("blocks investor from issuer-only documents", async () => {
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org2",
      owner_user_id: "u2",
      tnc_accepted: true,
    });
    jest.spyOn(siteDocumentRepository, "findById").mockResolvedValue({
      id: "doc3",
      type: "ISSUER_AGREEMENT",
      status: "PUBLISHED",
      audience: "ISSUER",
      acceptance_required: true,
      open_before_accept_required: false,
      version: 1,
    } as never);
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue({
      id: "acc",
      status: "OPENED",
    });

    await expect(
      legalDocumentAcceptanceService.recordAccepted(mockReq, "u2", "doc3", "org2", "INVESTOR")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("records IP address and user agent on open", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: false,
    });
    jest.spyOn(siteDocumentRepository, "findById").mockResolvedValue({
      id: "doc1",
      type: "PDPA_NOTICE",
      status: "PUBLISHED",
      audience: "BOTH",
      acceptance_required: true,
      open_before_accept_required: true,
      version: 1,
      file_hash: "abc",
    } as never);
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.legalDocumentAcceptance.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => data
    );

    await legalDocumentAcceptanceService.recordOpened(mockReq, "u1", "doc1", "org1", "ISSUER");

    expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ip_address: "203.0.113.10",
          user_agent: "JestAgent/1.0",
        }),
      })
    );
  });

  it("does not create pending reacceptance when reacceptance_required=false", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
    });
    jest
      .spyOn(siteDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue(null);

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
  });

  it("creates pending reacceptance when reacceptance_required=true and not accepted", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
    });

    jest
      .spyOn(siteDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockImplementation(async (type) => {
        if (type !== "PDPA_NOTICE") return null;
        return {
          id: "doc-v2",
          type: "PDPA_NOTICE",
          title: "PDPA",
          status: "PUBLISHED",
          audience: "BOTH",
          acceptance_required: true,
          reacceptance_required: true,
          open_before_accept_required: true,
          version: 2,
          file_hash: "v2",
          file_name: "pdpa-v2.pdf",
        } as never;
      });

    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);

    const pending = await legalDocumentAcceptanceService.getPendingReacceptanceDocuments(
      "u1",
      "org1",
      "ISSUER"
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].documentVersionId).toBe("doc-v2");
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
  });

  it("blocks new issuer transactions while pending reacceptance", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
    });
    jest
      .spyOn(siteDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue({
        id: "doc-v2",
        type: "ISSUER_AGREEMENT",
        title: "Issuer Agreement",
        status: "PUBLISHED",
        audience: "ISSUER",
        acceptance_required: true,
        reacceptance_required: true,
        open_before_accept_required: true,
        version: 3,
        file_hash: "x",
        file_name: "ia.pdf",
      } as never);
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
    jest.spyOn(siteDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

    await expect(
      legalDocumentAcceptanceService.assertNoPendingReacceptance(
        "u1",
        "org1",
        "ISSUER",
        "NEW_FINANCING_APPLICATION"
      )
    ).rejects.toMatchObject({ code: "LEGAL_REACCEPTANCE_REQUIRED" });
  });

  it("blocks new investor investments while pending reacceptance", async () => {
    (prisma.investorOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org2",
      owner_user_id: "u2",
      tnc_accepted: true,
    });
    jest
      .spyOn(siteDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue({
        id: "doc-inv",
        type: "INVESTOR_AGREEMENT",
        title: "Investor Agreement",
        status: "PUBLISHED",
        audience: "INVESTOR",
        acceptance_required: true,
        reacceptance_required: true,
        open_before_accept_required: true,
        version: 2,
        file_hash: "y",
        file_name: "iva.pdf",
      } as never);
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
    jest.spyOn(siteDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

    await expect(
      legalDocumentAcceptanceService.assertNoPendingReacceptance(
        "u2",
        "org2",
        "INVESTOR",
        "NEW_INVESTMENT"
      )
    ).rejects.toMatchObject({ code: "LEGAL_REACCEPTANCE_REQUIRED" });
  });

  it("removes transaction blocks after org acceptance", async () => {
    (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "org1",
      owner_user_id: "u1",
      tnc_accepted: true,
    });
    jest
      .spyOn(siteDocumentRepository, "findPublishedReacceptanceByTypeAndAudiences")
      .mockResolvedValue({
        id: "doc-v2",
        type: "PDPA_NOTICE",
        status: "PUBLISHED",
        audience: "BOTH",
        acceptance_required: true,
        reacceptance_required: true,
        open_before_accept_required: true,
        version: 2,
        file_name: "pdpa.pdf",
        file_hash: "h",
        title: "PDPA",
      } as never);
    (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue({
      id: "acc",
      status: "ACCEPTED",
      organization_id: "org1",
      document_id: "doc-v2",
    });
    jest.spyOn(siteDocumentRepository, "findPublishedByTypeAndAudiences").mockResolvedValue(null);

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
    jest.spyOn(siteDocumentRepository, "findById").mockResolvedValue({
      id: "doc1",
      status: "DRAFT",
      type: "PDPA_NOTICE",
      title: "PDPA",
      audience: "BOTH",
      acceptance_required: true,
      reacceptance_required: false,
      version: 1,
      file_hash: "abc",
    } as never);
    jest.spyOn(siteDocumentRepository, "publish").mockResolvedValue({
      id: "doc1",
      status: "PUBLISHED",
      type: "PDPA_NOTICE",
      title: "PDPA",
      audience: "BOTH",
      acceptance_required: true,
      reacceptance_required: true,
      version: 1,
      file_hash: "abc",
    } as never);
    jest.spyOn(documentLogRepository, "create").mockResolvedValue({} as never);

    await siteDocumentService.publishDocument("doc1", "admin1", mockReq, true);

    expect(prisma.issuerOrganization.updateMany).not.toHaveBeenCalled();
    expect(prisma.investorOrganization.updateMany).not.toHaveBeenCalled();
    expect(documentLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "DOCUMENT_PUBLISHED",
        metadata: expect.objectContaining({
          reacceptance_required: true,
        }),
      })
    );
  });
});

describe("site document upload validation", () => {
  it("rejects non-PDF uploads", async () => {
    (validateSiteDocument as jest.Mock).mockReturnValueOnce({
      valid: false,
      error: "Only PDF files are allowed",
    });

    await expect(
      siteDocumentService.requestUploadUrl(
        {
          type: "PDPA_NOTICE",
          title: "PDPA",
          fileName: "note.txt",
          contentType: "application/pdf",
          fileSize: 100,
          showInAccount: false,
          audience: "BOTH",
          acceptanceRequired: true,
          openBeforeAcceptRequired: true,
          reacceptanceRequired: false,
        },
        "admin1"
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
