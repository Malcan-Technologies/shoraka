import {
  NoteFundingStatus,
  NoteInvestmentCertificateAudience,
  NoteInvestmentCertificateStatus,
  NoteInvestmentStatus,
  NoteStatus,
} from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import type { InvestmentNoteCertificateSnapshot } from "./types";

const mockConvertDocxToPdf = jest.fn();
const mockConvertHtmlToPdf = jest.fn();
const mockRenderDocx = jest.fn();
const mockStoreCertificatePdf = jest.fn();
const mockGenerateCertificatePdfViewUrl = jest.fn();
const mockCreateNoteEventRow = jest.fn();
const mockBuildSnapshot = jest.fn();
const mockFreezeCertificateAuthorisation = jest.fn();
const mockLoadFrozenStampImage = jest.fn();
const mockReissueCertificateSnapshot = jest.fn();

const certificateStore: Record<string, any[]> = { rows: [] };
const noteEvents: any[] = [];
let currentNote: any = null;
const investments: any[] = [];

const mockPrisma: any = {
  note: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
      currentNote?.id === where.id ? currentNote : null
    ),
  },
  noteInvestmentCertificate: {
    findMany: jest.fn(async ({ where }: any) =>
      certificateStore.rows.filter(
        (row) => row.note_id === where.note_id && row.version === (where.version ?? row.version)
      )
    ),
    findUnique: jest.fn(async ({ where }: any) => {
      const key = where.note_id_version_audience_scope_key;
      if (!key) return null;
      return (
        certificateStore.rows.find(
          (row) =>
            row.note_id === key.note_id &&
            row.version === key.version &&
            row.audience_scope_key === key.audience_scope_key
        ) ?? null
      );
    }),
    findFirst: jest.fn(),
    create: jest.fn(async ({ data }: any) => {
      if (
        certificateStore.rows.some(
          (row) =>
            row.note_id === data.note_id &&
            row.version === data.version &&
            row.audience_scope_key === data.audience_scope_key
        )
      ) {
        const err = Object.assign(new Error("unique"), { code: "P2002" });
        throw err;
      }
      const row = {
        id: `row-${certificateStore.rows.length + 1}`,
        pdf_s3_key: null,
        pdf_sha256: null,
        generated_at: null,
        generation_error: null,
        created_at: new Date(),
        updated_at: new Date(),
        ...data,
      };
      certificateStore.rows.push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = certificateStore.rows.find((item) => item.id === where.id);
      Object.assign(row, data);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const row of certificateStore.rows) {
        if (where?.note_id && row.note_id !== where.note_id) continue;
        if (where?.version && row.version !== where.version) continue;
        if (where?.is_current === true && row.is_current !== true) continue;
        if (where?.is_current === false && row.is_current !== false) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    }),
  },
  noteInvestment: {
    findUnique: jest.fn(async ({ where }: any) =>
      investments.find((row) => row.id === where.id) ?? null
    ),
  },
  noteEvent: {
    findFirst: jest.fn(async () => noteEvents[0] ?? null),
  },
  issuerOrganization: {
    findFirst: jest.fn(async ({ where }: any) =>
      where.id === "issuer-org" ? { id: "issuer-org" } : null
    ),
  },
  investorOrganization: {
    findFirst: jest.fn(async ({ where }: any) => ({ id: where.id })),
  },
};

jest.mock("../../../lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("../../../lib/gotenberg/convert-docx-to-pdf", () => ({
  convertDocxToPdf: (...args: unknown[]) => mockConvertDocxToPdf(...args),
}));
jest.mock("../../../lib/gotenberg/convert-html-to-pdf", () => ({
  convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
}));
jest.mock("./render-certificate-docx", () => ({
  renderInvestmentNoteCertificateDocx: (...args: unknown[]) => mockRenderDocx(...args),
}));
jest.mock("./storage", () => ({
  CERTIFICATE_PDF_CONTENT_TYPE: "application/pdf",
  buildCertificatePdfObjectKey: jest.fn(
    ({ audience, investorOrganizationId, version }: any) =>
      `investment-note-certificates/test/note-1/${version}/${audience.toLowerCase()}${
        investorOrganizationId ? `/${investorOrganizationId}` : ""
      }.pdf`
  ),
  certificatePdfFileName: jest.fn(() => "cert.pdf"),
  generateCertificatePdfViewUrl: (...args: unknown[]) => mockGenerateCertificatePdfViewUrl(...args),
  sha256Hex: (buf: Buffer) => `sha-${buf.length}`,
  storeCertificatePdf: (...args: unknown[]) => mockStoreCertificatePdf(...args),
}));
jest.mock("./snapshot", () => ({
  buildInvestmentNoteCertificateSnapshot: (...args: unknown[]) => mockBuildSnapshot(...args),
  parseCertificateSnapshot: (value: unknown) =>
    value && typeof value === "object" && (value as any).certificate ? value : null,
  reissueCertificateSnapshotFromReady: (...args: unknown[]) =>
    mockReissueCertificateSnapshot(...args),
}));
jest.mock("../document-authorisation/config", () => ({
  freezeCertificateAuthorisation: (...args: unknown[]) =>
    mockFreezeCertificateAuthorisation(...args),
  loadFrozenStampImage: (...args: unknown[]) => mockLoadFrozenStampImage(...args),
}));
jest.mock("../../../lib/audit", () => ({
  AUDIT_PORTAL: { ADMIN: "ADMIN" },
  createNoteEventRow: (...args: unknown[]) => mockCreateNoteEventRow(...args),
  systemAuditContext: jest.fn(() => ({ actorType: "SYSTEM" })),
}));
jest.mock("../audit-fields", () => ({
  resolveNoteEventTarget: () => ({ targetType: "NOTE", targetId: "note-1" }),
}));

import {
  generateAdminInvestmentNoteCertificate,
  generateInvestmentNoteCertificates,
  getAdminInvestmentNoteCertificate,
  getInvestorInvestmentNoteCertificate,
  getIssuerInvestmentNoteCertificate,
  publishAdminInvestmentNoteCertificate,
  reissueAdminInvestmentNoteCertificate,
  retryAdminInvestmentNoteCertificate,
  retryFailedInvestmentNoteCertificates,
} from "./service";

function sampleSnapshot(
  overrides: Partial<InvestmentNoteCertificateSnapshot> = {}
): InvestmentNoteCertificateSnapshot {
  return {
    templateId: "islamic-investment-note-certificate-v1",
    templateVersion: "V01",
    snapshotGeneratedAt: "2026-09-02T00:00:00.000Z",
    snapshotSha256: "snap-hash",
    certificate: {
      certificateNumber: "IINC-NOTE-1",
      version: "V01",
      certificateDate: "2026-09-02T00:00:00.000Z",
      certificateDateDisplay: "02 Sep 2026",
    },
    note: {
      noteId: "note-1",
      noteReference: "NOTE-1",
      campaignReference: "NOTE-1",
      issuerReference: "ISS-1",
      businessSector: "—",
      issuerLegalName: "Helios",
      companyRegistrationNumber: "123",
      campaignStatus: "Successfully funded",
      fundingCloseDate: null,
      fundingCloseDateDisplay: "—",
      targetAmount: 100,
      fundedAmount: 80,
      principalAmount: 80,
      currency: "Malaysian Ringgit (RM)",
      profitRatePercent: 12,
      contractedProfit: 2,
      contractedProfitCapped: false,
      totalAmountPayable: 82,
      repaymentProfile: "Bullet Payment at Maturity",
      issueDate: null,
      issueDateDisplay: "—",
      disbursementValueDate: null,
      disbursementValueDateDisplay: "—",
      tenureDays: 90,
      maturityDate: null,
      maturityDateDisplay: "—",
      shariahStructure: "Bai' Al-Dayn Bi Al-Sila'",
      riskRating: "SME-4",
      underlyingInvoice: "INV",
      paymaster: "PM",
      financingPurpose: "WC",
      securitySupport: "—",
    },
    investorSchedule: {
      scheduleReference: "IS-NOTE-1-V01",
      version: "V01",
      status: "Approved / Final",
      issueDate: null,
      issueDateDisplay: "—",
      effectiveDate: null,
      effectiveDateDisplay: "—",
      fundedPrincipal: 80,
    },
    investors: [
      {
        investorOrganizationId: "org-a",
        investorReference: "IVT-A",
        investorName: "Alice",
        principal: 50,
        sharePercent: 62.5,
        expectedGrossProfit: 1.25,
        totalPayable: 51.25,
      },
      {
        investorOrganizationId: "org-b",
        investorReference: "IVT-B",
        investorName: "Bob",
        principal: 30,
        sharePercent: 37.5,
        expectedGrossProfit: 0.75,
        totalPayable: 30.75,
      },
    ],
    authorisation: {
      authorisedSignatoryName: "Ahmad",
      companyStamp: {
        s3Key: "stamps/a.png",
        sha256: "stamp-a",
        contentType: "image/png",
        fileName: "a.png",
      },
    },
    ...overrides,
  };
}

describe("generateInvestmentNoteCertificates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    certificateStore.rows = [];
    noteEvents.length = 0;
    investments.length = 0;
    currentNote = {
      id: "note-1",
      note_reference: "NOTE-1",
      funding_status: NoteFundingStatus.FUNDED,
      status: NoteStatus.ACTIVE,
      disbursement_value_date: new Date("2026-09-01"),
      issuer_organization_id: "issuer-org",
    };
    mockRenderDocx.mockImplementation(
      (_snapshot: unknown, input: { audience: string; investorOrganizationId?: string | null }) =>
        Buffer.from(`PK-docx-${input.audience}:${input.investorOrganizationId ?? ""}`)
    );
    mockConvertDocxToPdf.mockResolvedValue(Buffer.from("%PDF-cert"));
    mockConvertHtmlToPdf.mockRejectedValue(new Error("Chromium must not be used for certificates"));
    mockStoreCertificatePdf.mockResolvedValue(undefined);
    mockGenerateCertificatePdfViewUrl.mockResolvedValue({
      viewUrl: "https://s3/view",
      expiresIn: 600,
    });
    mockCreateNoteEventRow.mockImplementation(async (_db: unknown, params: any) => {
      noteEvents.push({ metadata: params.metadata });
    });
    mockBuildSnapshot.mockResolvedValue(sampleSnapshot());
    mockLoadFrozenStampImage.mockResolvedValue(null);
    mockFreezeCertificateAuthorisation.mockResolvedValue({
      authorisedSignatoryName: "Sarah",
      companyStamp: {
        s3Key: "stamps/b.png",
        sha256: "stamp-b",
        contentType: "image/png",
        fileName: "b.png",
      },
    });
    mockReissueCertificateSnapshot.mockImplementation((previous: any, input: any) => ({
      ...previous,
      snapshotGeneratedAt: "2026-09-03T00:00:00.000Z",
      snapshotSha256: `reissue-${input.version}`,
      certificate: { ...previous.certificate, version: input.version },
      authorisation: {
        authorisedSignatoryName: input.authorisedSignatoryName,
        companyStamp: input.companyStamp,
      },
    }));
  });

  it("does not generate when funding_status is not FUNDED", async () => {
    currentNote.funding_status = NoteFundingStatus.NOT_OPEN;
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(certificateStore.rows).toHaveLength(0);
  });

  it("creates admin, issuer and investor PDFs after FUNDED disbursement", async () => {
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
      actor: { userId: "admin-1", role: "ADMIN", portal: "ADMIN" },
    });
    expect(mockConvertDocxToPdf).toHaveBeenCalledTimes(4);
    expect(mockConvertHtmlToPdf).not.toHaveBeenCalled();
    expect(mockRenderDocx.mock.calls[0][1]).toMatchObject({ audience: "ADMIN" });
    expect(mockConvertDocxToPdf.mock.calls[0][1]).toEqual({
      fileName: "investment-note-certificate.docx",
    });
    expect(
      mockStoreCertificatePdf.mock.calls.some(
        (call: unknown[]) =>
          (call[0] as { key: string }).key ===
          "investment-note-certificates/test/note-1/V01/admin.pdf"
      )
    ).toBe(true);
    expect(certificateStore.rows.every((row) => row.status === "READY")).toBe(true);
    expect(mockCreateNoteEventRow).toHaveBeenCalledTimes(1);
    expect(mockCreateNoteEventRow.mock.calls[0][1].eventType).toBe(
      "INVESTMENT_NOTE_CERTIFICATE_GENERATED"
    );
  });

  it("is idempotent for READY V01 and does not duplicate the audit event", async () => {
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    mockBuildSnapshot.mockClear();
    mockConvertDocxToPdf.mockClear();
    mockRenderDocx.mockClear();
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(mockConvertDocxToPdf).not.toHaveBeenCalled();
    expect(mockRenderDocx).not.toHaveBeenCalled();
    expect(mockConvertHtmlToPdf).not.toHaveBeenCalled();
    expect(mockCreateNoteEventRow).toHaveBeenCalledTimes(1);
    expect(certificateStore.rows).toHaveLength(4);
  });

  it("retries FAILED using the persisted snapshot and does not rebuild from live data", async () => {
    mockConvertDocxToPdf.mockRejectedValueOnce(new Error("gotenberg down"));
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    expect(
      certificateStore.rows.some((row) => row.status === NoteInvestmentCertificateStatus.FAILED)
    ).toBe(true);
    expect(certificateStore.rows.every((row) => row.version === "V01")).toBe(true);
    mockBuildSnapshot.mockClear();
    mockConvertDocxToPdf.mockResolvedValue(Buffer.from("%PDF-cert"));
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "ADMIN_RETRY",
    });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(certificateStore.rows.every((row) => row.status === "READY")).toBe(true);
    expect(certificateStore.rows.every((row) => row.version === "V01")).toBe(true);
  });

  it("does not allow admin retry of READY certificates", async () => {
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    await expect(
      retryAdminInvestmentNoteCertificate("note-1", { userId: "admin-1" })
    ).rejects.toMatchObject({ code: "CERTIFICATE_RETRY_NOT_ALLOWED" });
  });

  it("Gotenberg failure marks FAILED without throwing to the caller", async () => {
    mockConvertDocxToPdf.mockRejectedValue(new Error("gotenberg down"));
    await expect(
      generateInvestmentNoteCertificates({
        noteId: "note-1",
        source: "DISBURSEMENT_COMPLETED",
      })
    ).resolves.toBeUndefined();
    expect(
      certificateStore.rows.every((row) => row.status === NoteInvestmentCertificateStatus.FAILED)
    ).toBe(true);
    expect(mockCreateNoteEventRow).not.toHaveBeenCalled();
  });
});

describe("audience download authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    certificateStore.rows = [];
    noteEvents.length = 0;
    currentNote = {
      id: "note-1",
      note_reference: "NOTE-1",
      funding_status: NoteFundingStatus.FUNDED,
      status: NoteStatus.ACTIVE,
      disbursement_value_date: new Date("2026-09-01"),
      issuer_organization_id: "issuer-org",
    };
    mockRenderDocx.mockImplementation(
      (_snapshot: unknown, input: { audience: string; investorOrganizationId?: string | null }) =>
        Buffer.from(`PK-docx-${input.audience}:${input.investorOrganizationId ?? ""}`)
    );
    mockConvertDocxToPdf.mockResolvedValue(Buffer.from("%PDF-cert"));
    mockConvertHtmlToPdf.mockRejectedValue(new Error("Chromium must not be used for certificates"));
    mockStoreCertificatePdf.mockResolvedValue(undefined);
    mockGenerateCertificatePdfViewUrl.mockResolvedValue({
      viewUrl: "https://s3/view",
      expiresIn: 600,
    });
    mockBuildSnapshot.mockResolvedValue(sampleSnapshot());
    mockLoadFrozenStampImage.mockResolvedValue(null);
    mockCreateNoteEventRow.mockImplementation(async (_db: unknown, params: any) => {
      noteEvents.push({ metadata: params.metadata, eventType: params.eventType });
    });
  });

  it("investor A cannot retrieve investor B PDF", async () => {
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    investments.push({
      id: "inv-b",
      note_id: "note-1",
      investor_organization_id: "org-b",
    });
    mockPrisma.investorOrganization.findFirst.mockResolvedValueOnce(null);
    await expect(getInvestorInvestmentNoteCertificate("inv-b", "user-a")).rejects.toBeInstanceOf(
      AppError
    );
  });

  it("admin status reports READY after generation", async () => {
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    const payload = await getAdminInvestmentNoteCertificate("note-1");
    expect(payload.status).toBe("READY");
    expect(payload.certificateNumber).toBe("IINC-NOTE-1");
    expect(payload.canRetry).toBe(false);
    expect(payload.viewUrl).toBe("https://s3/view");
    expect(payload.downloadUrl).toBe("https://s3/view");
    expect(mockGenerateCertificatePdfViewUrl).toHaveBeenCalledWith(
      expect.objectContaining({ disposition: "attachment" })
    );
    expect(payload.canRegenerate).toBe(true);
    expect(payload.isCurrent).toBe(true);
    expect(payload.version).toBe("V01");
    expect(payload.reviewVersion).toBeNull();
  });

  it("lets admin generate V01 when eligible and no document exists", async () => {
    const empty = await getAdminInvestmentNoteCertificate("note-1");
    expect(empty.status).toBe("NONE");
    expect(empty.canGenerate).toBe(true);
    const payload = await generateAdminInvestmentNoteCertificate("note-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(payload.status).toBe("READY");
    expect(payload.version).toBe("V01");
    expect(payload.isCurrent).toBe(true);
    expect(payload.canGenerate).toBe(false);
    expect(payload.canRegenerate).toBe(true);
    expect(mockCreateNoteEventRow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "INVESTMENT_NOTE_CERTIFICATE_GENERATED",
        metadata: expect.objectContaining({ source: "ADMIN_GENERATE", version: "V01" }),
      })
    );
  });

  it("does not allow Generate when the note is not yet issued", async () => {
    currentNote.status = NoteStatus.PUBLISHED;
    currentNote.disbursement_value_date = null;
    await expect(
      generateAdminInvestmentNoteCertificate("note-1", { userId: "admin-1" })
    ).rejects.toMatchObject({ code: "CERTIFICATE_GENERATE_NOT_ALLOWED" });
    expect(certificateStore.rows).toHaveLength(0);
  });

  it("does not create a document from the retry cron when none exists", async () => {
    await retryFailedInvestmentNoteCertificates(mockPrisma);
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(certificateStore.rows).toHaveLength(0);
  });
});

describe("certificate regenerate / reissue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    certificateStore.rows = [];
    noteEvents.length = 0;
    investments.length = 0;
    currentNote = {
      id: "note-1",
      note_reference: "NOTE-1",
      funding_status: NoteFundingStatus.FUNDED,
      status: NoteStatus.ACTIVE,
      disbursement_value_date: new Date("2026-09-01"),
      issuer_organization_id: "issuer-org",
    };
    mockRenderDocx.mockImplementation(
      (_snapshot: unknown, input: { audience: string; investorOrganizationId?: string | null }) =>
        Buffer.from(`PK-docx-${input.audience}:${input.investorOrganizationId ?? ""}`)
    );
    mockConvertDocxToPdf.mockResolvedValue(Buffer.from("%PDF-cert"));
    mockStoreCertificatePdf.mockResolvedValue(undefined);
    mockGenerateCertificatePdfViewUrl.mockResolvedValue({
      viewUrl: "https://s3/view",
      expiresIn: 600,
    });
    mockCreateNoteEventRow.mockImplementation(async (_db: unknown, params: any) => {
      noteEvents.push({ metadata: params.metadata, eventType: params.eventType });
    });
    mockBuildSnapshot.mockResolvedValue(sampleSnapshot());
    mockLoadFrozenStampImage.mockResolvedValue(null);
    mockFreezeCertificateAuthorisation.mockResolvedValue({
      authorisedSignatoryName: "Sarah",
      companyStamp: {
        s3Key: "stamps/b.png",
        sha256: "stamp-b",
        contentType: "image/png",
        fileName: "b.png",
      },
    });
    mockReissueCertificateSnapshot.mockImplementation((previous: any, input: any) => ({
      ...previous,
      snapshotGeneratedAt: "2026-09-03T00:00:00.000Z",
      snapshotSha256: `reissue-${input.version}`,
      certificate: { ...previous.certificate, version: input.version },
      authorisation: {
        authorisedSignatoryName: input.authorisedSignatoryName,
        companyStamp: input.companyStamp,
      },
    }));
  });

  it("first generation uses the frozen snapshot signatory and stamp", async () => {
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    expect(mockLoadFrozenStampImage).toHaveBeenCalledWith(
      expect.objectContaining({ s3Key: "stamps/a.png" })
    );
    expect(
      certificateStore.rows.every(
        (row) => row.snapshot.authorisation.authorisedSignatoryName === "Ahmad"
      )
    ).toBe(true);
  });

  it("retries FAILED using the original snapshot after settings change", async () => {
    mockConvertDocxToPdf.mockRejectedValueOnce(new Error("gotenberg down"));
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    mockBuildSnapshot.mockClear();
    mockFreezeCertificateAuthorisation.mockResolvedValue({
      authorisedSignatoryName: "Sarah",
      companyStamp: { s3Key: "stamps/b.png", sha256: "b", contentType: "image/png", fileName: "b.png" },
    });
    mockConvertDocxToPdf.mockResolvedValue(Buffer.from("%PDF-cert"));
    await retryAdminInvestmentNoteCertificate("note-1", { userId: "admin-1", role: "ADMIN" });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(mockFreezeCertificateAuthorisation).not.toHaveBeenCalled();
    expect(mockLoadFrozenStampImage).toHaveBeenCalledWith(
      expect.objectContaining({ s3Key: "stamps/a.png" })
    );
    expect(certificateStore.rows.every((row) => row.version === "V01")).toBe(true);
    expect(
      certificateStore.rows.every(
        (row) => row.snapshot.authorisation.authorisedSignatoryName === "Ahmad"
      )
    ).toBe(true);
  });

  it("creates V02 from READY V01 without overwriting V01 financial facts", async () => {
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    mockCreateNoteEventRow.mockClear();
    const payload = await reissueAdminInvestmentNoteCertificate("note-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    const v01 = certificateStore.rows.filter((row) => row.version === "V01");
    const v02 = certificateStore.rows.filter((row) => row.version === "V02");
    expect(v01).toHaveLength(4);
    expect(v02).toHaveLength(4);
    expect(v01.every((row) => row.status === "READY")).toBe(true);
    expect(v01.every((row) => row.snapshot.authorisation.authorisedSignatoryName === "Ahmad")).toBe(
      true
    );
    expect(v02.every((row) => row.snapshot.authorisation.authorisedSignatoryName === "Sarah")).toBe(
      true
    );
    expect(v02.every((row) => row.snapshot.authorisation.companyStamp?.s3Key === "stamps/b.png")).toBe(
      true
    );
    expect(v02.every((row) => row.snapshot.note.fundedAmount === 80)).toBe(true);
    expect(v02.every((row) => row.snapshot.note.contractedProfit === 2)).toBe(true);
    expect(payload.version).toBe("V01");
    expect(payload.isCurrent).toBe(true);
    expect(payload.canRegenerate).toBe(true);
    expect(payload.reviewVersion?.version).toBe("V02");
    expect(payload.reviewVersion?.status).toBe("READY");
    expect(payload.reviewVersion?.canPublish).toBe(true);
    expect(v01.every((row) => row.is_current === true)).toBe(true);
    expect(v02.every((row) => row.is_current === false)).toBe(true);
    expect(mockCreateNoteEventRow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "INVESTMENT_NOTE_CERTIFICATE_REISSUED",
        metadata: expect.objectContaining({
          previousVersion: "V01",
          newVersion: "V02",
          source: "ADMIN_REISSUE",
        }),
      })
    );
  });

  it("creates V03 on the next regenerate without publishing it to the issuer", async () => {
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    await reissueAdminInvestmentNoteCertificate("note-1", { userId: "admin-1", role: "ADMIN" });
    mockFreezeCertificateAuthorisation.mockResolvedValue({
      authorisedSignatoryName: "Sarah",
      companyStamp: { s3Key: "stamps/c.png", sha256: "c", contentType: "image/png", fileName: "c.png" },
    });
    await reissueAdminInvestmentNoteCertificate("note-1", { userId: "admin-1", role: "ADMIN" });
    expect(certificateStore.rows.some((row) => row.version === "V03")).toBe(true);
    const issuer = await getIssuerInvestmentNoteCertificate("note-1", "issuer-user");
    expect(issuer.version).toBe("V01");
    expect(issuer.canRegenerate).toBe(false);
    expect(issuer.canRetry).toBe(false);
  });

  it("publishes the regenerated version and keeps V01 as history", async () => {
    investments.push({
      id: "inv-1",
      note_id: "note-1",
      investor_organization_id: "org-a",
    });
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    await reissueAdminInvestmentNoteCertificate("note-1", { userId: "admin-1", role: "ADMIN" });
    mockCreateNoteEventRow.mockClear();
    const published = await publishAdminInvestmentNoteCertificate("note-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(published.version).toBe("V02");
    expect(published.isCurrent).toBe(true);
    expect(published.reviewVersion).toBeNull();
    expect(certificateStore.rows.filter((row) => row.version === "V01").every((row) => row.is_current === false)).toBe(
      true
    );
    expect(certificateStore.rows.filter((row) => row.version === "V02").every((row) => row.is_current === true)).toBe(
      true
    );
    const issuer = await getIssuerInvestmentNoteCertificate("note-1", "issuer-user");
    expect(issuer.version).toBe("V02");
    const investor = await getInvestorInvestmentNoteCertificate("inv-1", "user-a");
    expect(investor.version).toBe("V02");
    expect(mockCreateNoteEventRow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "INVESTMENT_NOTE_CERTIFICATE_PUBLISHED",
        metadata: expect.objectContaining({
          version: "V02",
          previousVersion: "V01",
          source: "ADMIN_PUBLISH",
        }),
      })
    );
  });

  it("does not allow reissue unless the latest version is READY", async () => {
    mockConvertDocxToPdf.mockRejectedValue(new Error("gotenberg down"));
    await generateInvestmentNoteCertificates({
      noteId: "note-1",
      source: "DISBURSEMENT_COMPLETED",
    });
    await expect(
      reissueAdminInvestmentNoteCertificate("note-1", { userId: "admin-1" })
    ).rejects.toMatchObject({ code: "CERTIFICATE_REISSUE_NOT_ALLOWED" });
    expect(certificateStore.rows.every((row) => row.version === "V01")).toBe(true);
  });
});

describe("audience enum presence", () => {
  it("uses dedicated audience values", () => {
    expect(NoteInvestmentCertificateAudience.ADMIN).toBe("ADMIN");
    expect(NoteInvestmentCertificateAudience.ISSUER).toBe("ISSUER");
    expect(NoteInvestmentCertificateAudience.INVESTOR).toBe("INVESTOR");
    expect(NoteInvestmentStatus.CONFIRMED).toBe("CONFIRMED");
  });
});
