import {
  NoteFundingStatus,
  NoteInvestmentCertificateAudience,
  NoteInvestmentCertificateStatus,
  NoteInvestmentStatus,
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
    updateMany: jest.fn(async ({ data }: any) => {
      for (const row of certificateStore.rows) {
        if (row.status !== NoteInvestmentCertificateStatus.READY) Object.assign(row, data);
      }
      return { count: certificateStore.rows.length };
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
    ({ audience, investorOrganizationId }: any) =>
      `investment-note-certificates/test/note-1/V01/${audience.toLowerCase()}${
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
  generateInvestmentNoteCertificates,
  getAdminInvestmentNoteCertificate,
  getInvestorInvestmentNoteCertificate,
  retryAdminInvestmentNoteCertificate,
} from "./service";

function sampleSnapshot(): InvestmentNoteCertificateSnapshot {
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
