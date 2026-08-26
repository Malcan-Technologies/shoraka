import {
  LEGAL_DOCUMENT_CHECKBOX_WORDING,
  type LegalDocumentType,
} from "@cashsouk/types";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: { findFirst: jest.fn(), findMany: jest.fn() },
    investorOrganization: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn(), delete: jest.fn() },
    legalDocument: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    legalDocumentVersion: { findFirst: jest.fn(), findMany: jest.fn() },
    legalDocumentAcceptance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    legalDocumentAuditLog: {
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
  generatePresignedUploadUrl: jest.fn(),
  generateLegalDocumentKey: jest.fn(() => "legal-documents/test/v1.pdf"),
  getFileExtension: jest.fn(() => "pdf"),
  validatePdfUpload: jest.fn(() => ({ valid: true })),
  deleteS3Object: jest.fn(),
}));

jest.mock("../../lib/s3/legal-document-object", () => ({
  isLegalDocumentS3Key: jest.fn(() => true),
  sanitizeS3KeyForLog: jest.fn((key: string) => key),
  assertStoredLegalPdf: jest.fn(async ({ claimedFileSize }) => ({
    fileHash: "hash123",
    fileSize: claimedFileSize ?? 100,
  })),
}));

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from "../../lib/prisma";
import { legalDocumentAcceptanceAdminService } from "./acceptance-admin-service";
import { legalDocumentAcceptanceService } from "./acceptance-service";
import { legalDocumentAuditAdminService } from "./audit-admin-service";
import { legalDocumentRepository } from "./repository";
import { legalDocumentService } from "./service";

const openReq = {
  headers: {
    "user-agent": "OpenAgent/1.0",
    "x-forwarded-for": "198.51.100.10",
  },
  socket: { remoteAddress: "127.0.0.1" },
  res: { locals: { correlationId: "corr-open" } },
} as never;

const acceptReq = {
  headers: {
    "user-agent": "AcceptAgent/2.0",
    "x-forwarded-for": "203.0.113.20",
  },
  socket: { remoteAddress: "127.0.0.1" },
  res: { locals: { correlationId: "corr-accept" } },
} as never;

const adminReq = {
  headers: {
    "user-agent": "AdminAgent/1.0",
    "x-forwarded-for": "192.0.2.5",
  },
  socket: { remoteAddress: "127.0.0.1" },
  res: { locals: { correlationId: "corr-admin" } },
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
      type: "TERMS_OF_USE",
      title: "Terms of Use",
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

function issuerOrg() {
  return {
    id: "org1",
    owner_user_id: "u1",
    tnc_accepted: false,
    onboarding_status: "IN_PROGRESS",
    name: "Acme Issuer",
    type: "COMPANY",
  };
}

describe("legal acceptance audit trail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "owner@example.com",
      first_name: "Owner",
      last_name: "User",
    });
    (prisma.issuerOrganization.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.investorOrganization.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.legalDocumentAuditLog.create as jest.Mock).mockResolvedValue({ id: "audit1" });
    jest.spyOn(legalDocumentRepository, "findAllPublishedByDocumentId").mockResolvedValue([]);
  });

  describe("user acceptance OPEN/ACCEPT separation", () => {
    it("OPEN stores open-specific metadata", async () => {
      (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue(issuerOrg());
      jest
        .spyOn(legalDocumentRepository, "findVersionById")
        .mockResolvedValue(publishedVersion() as never);
      (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.legalDocumentAcceptance.create as jest.Mock).mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({ id: "acc1", ...data })
      );

      await legalDocumentAcceptanceService.recordOpened(
        openReq,
        "u1",
        "ver1",
        "org1",
        "ISSUER"
      );

      expect(prisma.legalDocumentAcceptance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "OPENED",
            opened_ip_address: "198.51.100.10",
            opened_user_agent: "OpenAgent/1.0",
            organization_name_snapshot: "Acme Issuer",
            organization_type_snapshot: "COMPANY",
            status: "OPENED",
          }),
        })
      );
    });

    it("ACCEPT preserves OPEN metadata and stores accept-specific metadata", async () => {
      (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue(issuerOrg());
      jest
        .spyOn(legalDocumentRepository, "findVersionById")
        .mockResolvedValue(publishedVersion() as never);

      const opened = {
        id: "acc1",
        status: "OPENED",
        opened_at: new Date("2026-01-01T00:00:00.000Z"),
        opened_ip_address: "198.51.100.10",
        opened_user_agent: "OpenAgent/1.0",
        opened_device_info: "desktop",
        user_email_snapshot: "owner@example.com",
        user_name_snapshot: "Owner User",
      };
      (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(opened);
      (prisma.legalDocumentAcceptance.update as jest.Mock).mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({ ...opened, ...data })
      );

      await legalDocumentAcceptanceService.recordAccepted(
        acceptReq,
        "u1",
        "ver1",
        "org1",
        "ISSUER"
      );

      expect(prisma.legalDocumentAcceptance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ACCEPTED",
            accepted_ip_address: "203.0.113.20",
            accepted_user_agent: "AcceptAgent/2.0",
            acknowledgement_text: LEGAL_DOCUMENT_CHECKBOX_WORDING.TERMS_OF_USE,
          }),
        })
      );
      const updateCall = (prisma.legalDocumentAcceptance.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.opened_ip_address).toBeUndefined();
      expect(updateCall.data.opened_user_agent).toBeUndefined();
    });

    it("different OPEN and ACCEPT metadata remain independently retrievable", async () => {
      const row = {
        id: "acc1",
        legal_document_version_id: "ver1",
        legal_document_id: "ld1",
        document_type: "TERMS_OF_USE",
        version_number: 1,
        user_id: "u1",
        organization_id: "org1",
        organization_name_snapshot: "Acme Issuer",
        organization_type_snapshot: "COMPANY",
        audience_role: "ISSUER",
        status: "ACCEPTED",
        opened_at: new Date("2026-01-01T00:00:00.000Z"),
        accepted_at: new Date("2026-01-02T00:00:00.000Z"),
        opened_ip_address: "198.51.100.10",
        opened_user_agent: "OpenAgent/1.0",
        opened_device_info: "desktop",
        accepted_ip_address: "203.0.113.20",
        accepted_user_agent: "AcceptAgent/2.0",
        accepted_device_info: "mobile",
        document_hash: "abc",
        acknowledgement_text: LEGAL_DOCUMENT_CHECKBOX_WORDING.TERMS_OF_USE,
        user_email_snapshot: "owner@example.com",
        user_name_snapshot: "Owner User",
        created_at: new Date(),
        user: {
          user_id: "u1",
          email: "owner@example.com",
          first_name: "Owner",
          last_name: "User",
        },
        version: {
          id: "ver1",
          version: 1,
          status: "PUBLISHED",
          file_name: "terms.pdf",
          content_type: "application/pdf",
          file_size: 100,
          file_hash: "abc",
          s3_key: "legal-documents/terms/v1.pdf",
          legal_document: { id: "ld1", type: "TERMS_OF_USE", title: "Terms" },
        },
      };

      (prisma.legalDocumentAcceptance.findUnique as jest.Mock).mockResolvedValue(row);

      const detail = await legalDocumentAcceptanceAdminService.getAcceptanceById("acc1");

      expect(detail.openedIpAddress).toBe("198.51.100.10");
      expect(detail.acceptedIpAddress).toBe("203.0.113.20");
      expect(detail.openedUserAgent).toBe("OpenAgent/1.0");
      expect(detail.acceptedUserAgent).toBe("AcceptAgent/2.0");
      expect(detail.organizationName).toBe("Acme Issuer");
      expect(detail.organizationAccountType).toBe("COMPANY");
    });

    it("direct ACCEPT without OPEN still fails", async () => {
      (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue(issuerOrg());
      jest
        .spyOn(legalDocumentRepository, "findVersionById")
        .mockResolvedValue(publishedVersion() as never);
      (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        legalDocumentAcceptanceService.recordAccepted(acceptReq, "u1", "ver1", "org1", "ISSUER")
      ).rejects.toMatchObject({ code: "OPEN_REQUIRED" });
    });

    it("re-opening preserves first OPEN metadata", async () => {
      (prisma.issuerOrganization.findFirst as jest.Mock).mockResolvedValue(issuerOrg());
      jest
        .spyOn(legalDocumentRepository, "findVersionById")
        .mockResolvedValue(publishedVersion() as never);

      const existing = {
        id: "acc1",
        status: "OPENED",
        opened_at: new Date("2026-01-01T00:00:00.000Z"),
        opened_ip_address: "198.51.100.10",
        opened_user_agent: "OpenAgent/1.0",
      };
      (prisma.legalDocumentAcceptance.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await legalDocumentAcceptanceService.recordOpened(
        acceptReq,
        "u1",
        "ver1",
        "org1",
        "ISSUER"
      );

      expect(result).toEqual(existing);
      expect(prisma.legalDocumentAcceptance.update).not.toHaveBeenCalled();
      expect(prisma.legalDocumentAcceptance.create).not.toHaveBeenCalled();
    });
  });

  describe("retention after user deletion", () => {
    it("acceptance detail remains readable when user relation is null", async () => {
      const row = {
        id: "acc-deleted-user",
        legal_document_version_id: "ver1",
        legal_document_id: "ld1",
        document_type: "TERMS_OF_USE",
        version_number: 1,
        user_id: null,
        organization_id: "org1",
        organization_name_snapshot: "Acme Issuer",
        organization_type_snapshot: "COMPANY",
        audience_role: "ISSUER",
        status: "ACCEPTED",
        opened_at: new Date(),
        accepted_at: new Date(),
        opened_ip_address: "198.51.100.10",
        opened_user_agent: "OpenAgent/1.0",
        opened_device_info: null,
        accepted_ip_address: "203.0.113.20",
        accepted_user_agent: "AcceptAgent/2.0",
        accepted_device_info: null,
        document_hash: "abc",
        acknowledgement_text: LEGAL_DOCUMENT_CHECKBOX_WORDING.TERMS_OF_USE,
        user_email_snapshot: "deleted@example.com",
        user_name_snapshot: "Deleted User",
        created_at: new Date(),
        user: null,
        version: {
          id: "ver1",
          version: 1,
          status: "PUBLISHED",
          file_name: "terms.pdf",
          content_type: "application/pdf",
          file_size: 100,
          file_hash: "abc",
          s3_key: "legal-documents/terms/v1.pdf",
          legal_document: { id: "ld1", type: "TERMS_OF_USE", title: "Terms" },
        },
      };

      (prisma.legalDocumentAcceptance.findUnique as jest.Mock).mockResolvedValue(row);

      const detail = await legalDocumentAcceptanceAdminService.getAcceptanceById("acc-deleted-user");

      expect(detail.userId).toBeNull();
      expect(detail.userName).toBe("Deleted User");
      expect(detail.userEmail).toBe("deleted@example.com");
      expect(detail.organizationName).toBe("Acme Issuer");
    });
  });

  describe("admin audit log", () => {
    it("create document writes audit row", async () => {
      jest.spyOn(legalDocumentRepository, "findByType").mockResolvedValue(null);
      jest.spyOn(legalDocumentRepository, "create").mockResolvedValue({
        id: "ld-new",
        type: "TERMS_OF_USE",
        title: "Terms",
        description: null,
        audience: "BOTH",
        required_for_onboarding: true,
        public_visibility: false,
        show_in_account: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

      await legalDocumentService.createDefinition(
        {
          type: "TERMS_OF_USE",
          title: "Terms",
          audience: "BOTH",
          requiredForOnboarding: true,
          publicVisibility: false,
          showInAccount: false,
        },
        "admin1",
        adminReq
      );

      expect(prisma.legalDocumentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LEGAL_DOCUMENT_CREATED",
            actor_user_id: "admin1",
            after_json: expect.objectContaining({
              required_for_onboarding: true,
              public_visibility: false,
            }),
          }),
        })
      );
    });

    it("update required_for_onboarding captures before/after", async () => {
      jest.spyOn(legalDocumentRepository, "findById").mockResolvedValue({
        id: "ld1",
        type: "TERMS_OF_USE",
        title: "Terms",
        description: null,
        audience: "BOTH",
        required_for_onboarding: true,
        public_visibility: false,
        show_in_account: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);
      jest.spyOn(legalDocumentRepository, "update").mockResolvedValue({
        id: "ld1",
        type: "TERMS_OF_USE",
        title: "Terms",
        description: null,
        audience: "BOTH",
        required_for_onboarding: false,
        public_visibility: false,
        show_in_account: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

      await legalDocumentService.updateDefinition(
        "ld1",
        { requiredForOnboarding: false },
        "admin1",
        adminReq
      );

      expect(prisma.legalDocumentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LEGAL_DOCUMENT_UPDATED",
            before_json: { required_for_onboarding: true },
            after_json: { required_for_onboarding: false },
          }),
        })
      );
    });

    it("publish captures reacceptance flag and auto-archives previous version", async () => {
      jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
        publishedVersion({ id: "ver2", status: "DRAFT", version: 2 }) as never
      );
      jest
        .spyOn(legalDocumentRepository, "findAllPublishedByDocumentId")
        .mockResolvedValue([{ id: "ver1", version: 1, file_hash: "old-hash" }]);
      jest.spyOn(legalDocumentRepository, "publishVersion").mockResolvedValue(
        publishedVersion({
          id: "ver2",
          status: "PUBLISHED",
          version: 2,
          reacceptance_required: true,
        }) as never
      );

      await legalDocumentService.publishVersion(
        "ver2",
        { reacceptanceRequired: true },
        "admin1",
        adminReq
      );

      expect(prisma.legalDocumentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LEGAL_VERSION_PUBLISHED",
            after_json: expect.objectContaining({
              reacceptance_required: true,
              status: "PUBLISHED",
            }),
          }),
        })
      );
      expect(prisma.legalDocumentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LEGAL_VERSION_ARCHIVED",
            legal_document_version_id: "ver1",
            reason: "auto_archived_on_publish",
          }),
        })
      );
    });

    it("restore archived version to published auto-archives current version with audit trail", async () => {
      jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
        publishedVersion({
          id: "ver3",
          version: 3,
          status: "ARCHIVED",
          published_at: new Date("2026-08-01"),
          archived_at: new Date("2026-08-02"),
          archived_by: "admin1",
        }) as never
      );
      jest.spyOn(legalDocumentRepository, "findPublishedByDocumentId").mockResolvedValue(
        publishedVersion({ id: "ver2", version: 2, status: "PUBLISHED" }) as never
      );
      jest
        .spyOn(legalDocumentRepository, "findAllPublishedByDocumentId")
        .mockResolvedValue([{ id: "ver2", version: 2, file_hash: "ver2-hash" }]);
      jest.spyOn(legalDocumentRepository, "publishVersion").mockResolvedValue(
        publishedVersion({
          id: "ver3",
          status: "PUBLISHED",
          version: 3,
        }) as never
      );
      (prisma.legalDocumentAuditLog.create as jest.Mock).mockClear();

      await legalDocumentService.restoreVersion("ver3", "admin1", adminReq);

      const archiveCalls = (prisma.legalDocumentAuditLog.create as jest.Mock).mock.calls.filter(
        ([arg]: [{ data: { action: string } }]) => arg.data.action === "LEGAL_VERSION_ARCHIVED"
      );
      expect(archiveCalls).toHaveLength(1);
      expect(archiveCalls[0][0]).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LEGAL_VERSION_ARCHIVED",
            legal_document_version_id: "ver2",
            version_number: 2,
            document_hash: "ver2-hash",
            before_json: { status: "PUBLISHED" },
            after_json: { status: "ARCHIVED" },
            reason: "auto_archived_on_restore_publish",
          }),
        })
      );

      expect(prisma.legalDocumentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LEGAL_VERSION_RESTORED",
            legal_document_version_id: "ver3",
          }),
        })
      );
    });

    it("restore archived version to published without another published version creates no archive audit", async () => {
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
      jest.spyOn(legalDocumentRepository, "findPublishedByDocumentId").mockResolvedValue(null);
      jest.spyOn(legalDocumentRepository, "findAllPublishedByDocumentId").mockResolvedValue([]);
      jest.spyOn(legalDocumentRepository, "publishVersion").mockResolvedValue(
        publishedVersion({ id: "ver1", status: "PUBLISHED", version: 1 }) as never
      );
      (prisma.legalDocumentAuditLog.create as jest.Mock).mockClear();

      await legalDocumentService.restoreVersion("ver1", "admin1", adminReq);

      const archiveCalls = (prisma.legalDocumentAuditLog.create as jest.Mock).mock.calls.filter(
        ([arg]: [{ data: { action: string } }]) => arg.data.action === "LEGAL_VERSION_ARCHIVED"
      );
      expect(archiveCalls).toHaveLength(0);
      expect(prisma.legalDocumentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LEGAL_VERSION_RESTORED",
          }),
        })
      );
    });

    it("restore archived version to draft creates no archive audit", async () => {
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
        publishedVersion({ id: "ver1", status: "DRAFT" }) as never
      );
      (prisma.legalDocumentAuditLog.create as jest.Mock).mockClear();

      await legalDocumentService.restoreVersion("ver1", "admin1", adminReq);

      const archiveCalls = (prisma.legalDocumentAuditLog.create as jest.Mock).mock.calls.filter(
        ([arg]: [{ data: { action: string } }]) => arg.data.action === "LEGAL_VERSION_ARCHIVED"
      );
      expect(archiveCalls).toHaveLength(0);
      expect(prisma.legalDocumentAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "LEGAL_VERSION_RESTORED",
            after_json: { status: "DRAFT", restored_as: "DRAFT" },
          }),
        })
      );
    });

    it("lists audit logs for admin export", async () => {
      const createdAt = new Date("2026-08-01T00:00:00.000Z");
      (prisma.legalDocumentAuditLog.findMany as jest.Mock).mockResolvedValue([
        {
          id: "log1",
          action: "LEGAL_VERSION_PUBLISHED",
          legal_document_id: "ld1",
          legal_document_version_id: "ver2",
          document_type: "TERMS_OF_USE",
          version_number: 2,
          document_hash: "hash2",
          actor_user_id: "admin1",
          actor_name_snapshot: "Admin User",
          actor_email_snapshot: "admin@example.com",
          before_json: { status: "DRAFT" },
          after_json: { status: "PUBLISHED", reacceptance_required: true },
          reason: null,
          ip_address: "192.0.2.5",
          user_agent: "AdminAgent/1.0",
          correlation_id: "corr-admin",
          created_at: createdAt,
        },
      ]);

      const logs = await legalDocumentAuditAdminService.export({
        action: "LEGAL_VERSION_PUBLISHED",
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.afterJson).toEqual({
        status: "PUBLISHED",
        reacceptance_required: true,
      });
    });

    it("searches audit logs by visible document type label", async () => {
      (prisma.legalDocumentAuditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.legalDocumentAuditLog.count as jest.Mock).mockResolvedValue(0);

      await legalDocumentAuditAdminService.list({
        page: 1,
        pageSize: 20,
        search: "Terms of Use",
      });

      const where = (prisma.legalDocumentAuditLog.findMany as jest.Mock).mock.calls.at(-1)?.[0]
        ?.where as { OR: Array<Record<string, unknown>> };
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { actor_name_snapshot: { contains: "Terms of Use", mode: "insensitive" } },
          { legal_document_id: { contains: "Terms of Use", mode: "insensitive" } },
          { document_type: { in: ["TERMS_OF_USE"] } },
        ])
      );
    });
  });

  describe("export evidence fields", () => {
    it("export acceptances includes OPEN and ACCEPT metadata", async () => {
      const row = {
        id: "acc1",
        legal_document_version_id: "ver1",
        legal_document_id: "ld1",
        document_type: "TERMS_OF_USE" as LegalDocumentType,
        version_number: 1,
        user_id: "u1",
        organization_id: "org1",
        organization_name_snapshot: "Acme Issuer",
        organization_type_snapshot: "COMPANY",
        audience_role: "ISSUER",
        status: "ACCEPTED",
        opened_at: new Date("2026-01-01T00:00:00.000Z"),
        accepted_at: new Date("2026-01-02T00:00:00.000Z"),
        opened_ip_address: "198.51.100.10",
        opened_user_agent: "OpenAgent/1.0",
        opened_device_info: "desktop",
        accepted_ip_address: "203.0.113.20",
        accepted_user_agent: "AcceptAgent/2.0",
        accepted_device_info: "mobile",
        document_hash: "abc",
        acknowledgement_text: LEGAL_DOCUMENT_CHECKBOX_WORDING.TERMS_OF_USE,
        user_email_snapshot: "owner@example.com",
        user_name_snapshot: "Owner User",
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        user: {
          user_id: "u1",
          email: "owner@example.com",
          first_name: "Owner",
          last_name: "User",
        },
        version: {
          id: "ver1",
          version: 1,
          status: "PUBLISHED",
          file_name: "terms.pdf",
          content_type: "application/pdf",
          file_size: 100,
          file_hash: "abc",
          s3_key: "legal-documents/terms/v1.pdf",
          legal_document: { id: "ld1", type: "TERMS_OF_USE", title: "Terms" },
        },
      };

      (prisma.legalDocumentAcceptance.findMany as jest.Mock).mockResolvedValue([row]);

      const exported = await legalDocumentAcceptanceAdminService.exportAcceptances({
        format: "json",
      });

      expect(exported[0]).toMatchObject({
        openedIpAddress: "198.51.100.10",
        acceptedIpAddress: "203.0.113.20",
        openedUserAgent: "OpenAgent/1.0",
        acceptedUserAgent: "AcceptAgent/2.0",
        organizationAccountType: "COMPANY",
        acknowledgementText: LEGAL_DOCUMENT_CHECKBOX_WORDING.TERMS_OF_USE,
      });
    });

    it("searches acceptances by organisation, document title, and document type", async () => {
      (prisma.legalDocumentAcceptance.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.legalDocumentAcceptance.count as jest.Mock).mockResolvedValue(0);
      (prisma.issuerOrganization.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.investorOrganization.findMany as jest.Mock).mockResolvedValue([]);

      await legalDocumentAcceptanceAdminService.listAcceptances({
        page: 1,
        pageSize: 20,
        sortBy: "accepted_at",
        sortOrder: "desc",
        search: "Terms of Use",
      });

      const where = (prisma.legalDocumentAcceptance.findMany as jest.Mock).mock.calls.at(-1)?.[0]
        ?.where as { OR: Array<Record<string, unknown>> };
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { organization_name_snapshot: { contains: "Terms of Use", mode: "insensitive" } },
          { document_type: { in: ["TERMS_OF_USE"] } },
          {
            version: {
              is: {
                legal_document: {
                  is: { title: { contains: "Terms of Use", mode: "insensitive" } },
                },
              },
            },
          },
        ])
      );
    });
  });
});
