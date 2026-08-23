import {
  LEGAL_DOCUMENT_CHECKBOX_WORDING,
  type LegalDocumentType,
} from "@cashsouk/types";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: { findFirst: jest.fn(), findMany: jest.fn() },
    investorOrganization: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
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
  generatePresignedUploadUrl: jest.fn(),
  generateLegalDocumentKey: jest.fn(() => "legal-documents/test/v1.pdf"),
  getFileExtension: jest.fn(() => "pdf"),
  validatePdfUpload: jest.fn(() => ({ valid: true })),
  deleteS3Object: jest.fn(),
  copyS3Object: jest.fn(),
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
import { auditContextForActor } from "./audit/context";
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

function adminContext() {
  return auditContextForActor(adminReq, "admin1");
}

function auditCreateData() {
  return (prisma.legalAdminAuditLog.create as jest.Mock).mock.calls.map(
    ([arg]: [{ data: Record<string, unknown> }]) => arg.data
  );
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
    (prisma.legalAdminAuditLog.create as jest.Mock).mockResolvedValue({ id: "audit1" });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(prisma));
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
    it("create document writes audit row in the same transaction", async () => {
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
        adminContext()
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.legalAdminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "LEGAL_DOCUMENT_CREATED",
            actor_type: "ADMIN",
            actor_user_id: "admin1",
            source: "API",
            portal: "ADMIN",
            organization_id: null,
            organization_kind: null,
            target_type: "LEGAL_DOCUMENT",
            target_id: "ld-new",
            metadata: expect.objectContaining({
              documentType: "TERMS_OF_USE",
              requiredForOnboarding: true,
              publicVisibility: false,
              actorName: "Owner User",
              actorEmail: "owner@example.com",
            }),
          }),
        })
      );
    });

    it("update requiredForOnboarding captures camelCase before/after", async () => {
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
        adminContext()
      );

      expect(prisma.legalAdminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event_type: "LEGAL_DOCUMENT_UPDATED",
            metadata: expect.objectContaining({
              changedFields: ["requiredForOnboarding"],
              before: { requiredForOnboarding: true },
              after: { requiredForOnboarding: false },
            }),
          }),
        })
      );
    });

    it("no-op update writes no audit row", async () => {
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

      await legalDocumentService.updateDefinition(
        "ld1",
        { requiredForOnboarding: true },
        adminContext()
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.legalAdminAuditLog.create).not.toHaveBeenCalled();
    });

    it("audit insert failure rejects the mutation", async () => {
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
      (prisma.legalAdminAuditLog.create as jest.Mock).mockRejectedValue(new Error("audit failed"));

      await expect(
        legalDocumentService.createDefinition(
          {
            type: "TERMS_OF_USE",
            title: "Terms",
            audience: "BOTH",
            requiredForOnboarding: true,
            publicVisibility: false,
            showInAccount: false,
          },
          adminContext()
        )
      ).rejects.toThrow("audit failed");
    });

    it("publish captures reacceptance flag and auto-archives previous version", async () => {
      jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
        publishedVersion({ id: "ver2", status: "DRAFT", version: 2 }) as never
      );
      jest.spyOn(legalDocumentRepository, "findAllPublishedByDocumentId").mockResolvedValue([
        {
          id: "ver1",
          version: 1,
          file_hash: "old-hash",
          file_name: "old.pdf",
          content_type: "application/pdf",
          file_size: 100,
        },
      ]);
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
        adminContext()
      );

      const rows = auditCreateData();
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          event_type: "LEGAL_DOCUMENT_VERSION_PUBLISHED",
          legal_document_version_id: "ver2",
          correlation_id: "corr-admin",
          metadata: expect.objectContaining({
            reacceptanceRequired: true,
            newStatus: "PUBLISHED",
            previousStatus: "DRAFT",
          }),
        })
      );
      expect(rows[1]).toEqual(
        expect.objectContaining({
          event_type: "LEGAL_DOCUMENT_VERSION_ARCHIVED",
          legal_document_version_id: "ver1",
          correlation_id: "corr-admin",
          metadata: expect.objectContaining({
            reasonCode: "AUTO_ARCHIVED_ON_PUBLISH",
            previousStatus: "PUBLISHED",
            newStatus: "ARCHIVED",
          }),
        })
      );
    });

    it("refuses to restore a previously published archived version", async () => {
      jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
        publishedVersion({
          id: "ver1",
          version: 1,
          status: "ARCHIVED",
          published_at: new Date("2026-08-01"),
          archived_at: new Date("2026-08-02"),
          archived_by: "admin1",
          file_hash: "hash123",
        }) as never
      );
      (prisma.legalAdminAuditLog.create as jest.Mock).mockClear();

      await expect(
        legalDocumentService.restoreVersion("ver1", "admin1", adminContext())
      ).rejects.toMatchObject({ code: "VERSION_IMMUTABLE" });
      expect(auditCreateData()).toHaveLength(0);
    });

    it("create-from-version writes LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION", async () => {
      jest.spyOn(legalDocumentRepository, "findVersionById").mockResolvedValue(
        publishedVersion({
          id: "ver1",
          version: 1,
          status: "ARCHIVED",
          published_at: new Date("2026-08-01"),
          archived_at: new Date("2026-08-02"),
          archived_by: "admin1",
          file_hash: "hash123",
          file_name: "v1.pdf",
        }) as never
      );
      jest.spyOn(legalDocumentRepository, "findDraftByDocumentId").mockResolvedValue(null);
      jest.spyOn(legalDocumentRepository, "getLatestVersionNumber").mockResolvedValue(2);
      jest.spyOn(legalDocumentRepository, "createVersion").mockResolvedValue(
        publishedVersion({
          id: "ver3",
          version: 3,
          status: "DRAFT",
          published_at: null,
          published_by: null,
          archived_at: null,
          archived_by: null,
          file_hash: "hash123",
          file_name: "v1.pdf",
        }) as never
      );
      (prisma.legalAdminAuditLog.create as jest.Mock).mockClear();

      await legalDocumentService.createDraftFromVersion(
        "ver1",
        "admin1",
        adminContext()
      );

      const rows = auditCreateData();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          event_type: "LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION",
          legal_document_version_id: "ver3",
          metadata: expect.objectContaining({
            sourceVersionId: "ver1",
            sourceVersionNumber: 1,
            newVersionId: "ver3",
            newVersionNumber: 3,
            fileHash: "hash123",
            fileName: "v1.pdf",
            status: "DRAFT",
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
      (prisma.legalAdminAuditLog.create as jest.Mock).mockClear();

      await legalDocumentService.restoreVersion("ver1", "admin1", adminContext());

      const rows = auditCreateData();
      expect(rows.filter((row) => row.event_type === "LEGAL_DOCUMENT_VERSION_ARCHIVED")).toHaveLength(
        0
      );
      expect(rows[0]).toEqual(
        expect.objectContaining({
          event_type: "LEGAL_DOCUMENT_VERSION_RESTORED",
          metadata: expect.objectContaining({
            restoredAs: "DRAFT",
            previousStatus: "ARCHIVED",
            newStatus: "DRAFT",
          }),
        })
      );
    });

    it("lists audit logs for admin export", async () => {
      const occurredAt = new Date("2026-08-01T00:00:00.000Z");
      (prisma.legalAdminAuditLog.findMany as jest.Mock).mockResolvedValue([
        {
          id: "log1",
          legal_document_id: "ld1",
          legal_document_version_id: "ver2",
          event_type: "LEGAL_DOCUMENT_VERSION_PUBLISHED",
          occurred_at: occurredAt,
          created_at: occurredAt,
          actor_type: "ADMIN",
          actor_user_id: "admin1",
          organization_id: null,
          organization_kind: null,
          target_type: "LEGAL_DOCUMENT_VERSION",
          target_id: "ver2",
          source: "API",
          portal: "ADMIN",
          ip_address: "192.0.2.5",
          user_agent: "AdminAgent/1.0",
          correlation_id: "corr-admin",
          idempotency_key: null,
          metadata: {
            actorName: "Admin User",
            actorEmail: "admin@example.com",
            documentType: "TERMS_OF_USE",
            newStatus: "PUBLISHED",
            reacceptanceRequired: true,
          },
        },
      ]);

      const logs = await legalDocumentAuditAdminService.export({
        action: "LEGAL_DOCUMENT_VERSION_PUBLISHED",
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.eventType).toBe("LEGAL_DOCUMENT_VERSION_PUBLISHED");
      expect(logs[0]?.actor.displayName).toBe("Admin User");
      expect(logs[0]?.metadata).toEqual(
        expect.objectContaining({
          newStatus: "PUBLISHED",
          reacceptanceRequired: true,
        })
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
  });
});
