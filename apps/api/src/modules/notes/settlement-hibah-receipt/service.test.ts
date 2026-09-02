import {
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteStatus,
  SettlementHibahReceiptStatus,
} from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import type { SettlementHibahReceiptSnapshot } from "./types";

const mockConvertHtmlToPdf = jest.fn();
const mockStoreReceiptPdf = jest.fn();
const mockGenerateReceiptPdfViewUrl = jest.fn();
const mockCreateNoteEventRow = jest.fn();
const mockBuildSnapshot = jest.fn();

const receiptStore: { rows: any[] } = { rows: [] };
const noteEvents: any[] = [];
let currentNote: any = null;
let postedSettlement: any = null;
let issuerAllowed = true;
const noteUpdate = jest.fn();
const settlementUpdate = jest.fn();
const walletCreate = jest.fn();

const mockPrisma: any = {
  note: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
      currentNote?.id === where.id ? currentNote : null
    ),
    update: noteUpdate,
  },
  noteSettlement: {
    findFirst: jest.fn(async ({ where }: any) => {
      if (postedSettlement?.note_id === where.note_id && postedSettlement.status === where.status) {
        return postedSettlement;
      }
      return null;
    }),
    update: settlementUpdate,
  },
  settlementHibahReceipt: {
    findUnique: jest.fn(async ({ where }: any) => {
      const key = where.settlement_id_version;
      if (!key) return null;
      return (
        receiptStore.rows.find(
          (row) => row.settlement_id === key.settlement_id && row.version === key.version
        ) ?? null
      );
    }),
    findMany: jest.fn(async ({ where }: any) =>
      receiptStore.rows.filter((row) => {
        if (where.version && row.version !== where.version) return false;
        if (where.OR) {
          return where.OR.some((clause: any) => row.status === clause.status);
        }
        return true;
      })
    ),
    create: jest.fn(async ({ data }: any) => {
      if (
        receiptStore.rows.some(
          (row) => row.settlement_id === data.settlement_id && row.version === data.version
        )
      ) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      const row = {
        id: `row-${receiptStore.rows.length + 1}`,
        pdf_s3_key: null,
        pdf_sha256: null,
        generated_at: null,
        generation_error: null,
        created_at: new Date(),
        updated_at: new Date(),
        ...data,
      };
      receiptStore.rows.push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = receiptStore.rows.find((item) => item.id === where.id);
      Object.assign(row, data);
      return row;
    }),
  },
  noteEvent: {
    findFirst: jest.fn(async () => noteEvents[0] ?? null),
  },
  issuerOrganization: {
    findFirst: jest.fn(async () => (issuerAllowed ? { id: "issuer-org" } : null)),
  },
  investorBalanceTransaction: {
    create: walletCreate,
  },
};

jest.mock("../../../lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("../../../lib/gotenberg/convert-html-to-pdf", () => ({
  convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
}));
jest.mock("./storage", () => ({
  RECEIPT_PDF_CONTENT_TYPE: "application/pdf",
  buildReceiptPdfObjectKey: jest.fn(
    ({ noteId, settlementId, version }: any) =>
      `settlement-hibah-receipts/test/${noteId}/${settlementId}/${version}.pdf`
  ),
  receiptPdfFileName: jest.fn((receiptNumber: string) => `${receiptNumber}.pdf`),
  generateReceiptPdfViewUrl: (...args: unknown[]) => mockGenerateReceiptPdfViewUrl(...args),
  sha256Hex: (buf: Buffer) => `sha-${buf.length}`,
  storeReceiptPdf: (...args: unknown[]) => mockStoreReceiptPdf(...args),
}));
jest.mock("./snapshot", () => ({
  buildSettlementHibahReceiptSnapshot: (...args: unknown[]) => mockBuildSnapshot(...args),
  parseHibahReceiptSnapshot: (value: unknown) =>
    value && typeof value === "object" && (value as { receiptNumber?: string }).receiptNumber
      ? value
      : null,
}));
jest.mock("./receipt-html", () => ({
  buildSettlementHibahReceiptHtml: jest.fn(
    (snapshot: SettlementHibahReceiptSnapshot) => `<html>${snapshot.receiptNumber}</html>`
  ),
}));
jest.mock("../../../lib/audit", () => ({
  AUDIT_PORTAL: { ADMIN: "ADMIN" },
  createNoteEventRow: (...args: unknown[]) => mockCreateNoteEventRow(...args),
  systemAuditContext: jest.fn(() => ({ actorType: "SYSTEM" })),
}));
jest.mock("../audit-fields", () => ({
  resolveNoteEventTarget: (_event: string, metadata: { settlementId?: string }) => ({
    targetType: "NOTE_SETTLEMENT",
    targetId: metadata.settlementId ?? "set-1",
  }),
}));

import {
  generateSettlementHibahReceipt,
  getAdminSettlementHibahReceipt,
  getIssuerSettlementHibahReceipt,
  retryAdminSettlementHibahReceipt,
} from "./service";

function sampleSnapshot(
  overrides: Partial<SettlementHibahReceiptSnapshot> = {}
): SettlementHibahReceiptSnapshot {
  return {
    templateId: "settlement-hibah-receipt-issuer-v1",
    templateVersion: "V01",
    snapshotGeneratedAt: "2026-09-02T00:00:00.000Z",
    snapshotSha256: "snap-hash",
    source: "SETTLEMENT_COMPLETED",
    receiptNumber: "SET-ARF-202608-A52",
    version: "V01",
    receiptDate: "2026-09-02T00:00:00.000Z",
    receiptDateDisplay: "02 Sep 2026",
    settlementId: "set-1",
    settlementReference: "SET-ARF-202608-A52",
    noteId: "note-1",
    noteReference: "ARF-202608-A52",
    facilityReference: null,
    issuerReference: "ISS-1",
    issuerLegalName: "Helios",
    issuerCompanyNumber: "123",
    paymasterName: "Paymaster",
    invoiceNumber: "INV-1",
    invoiceFaceValue: 100_000,
    maturityDate: null,
    maturityDateDisplay: "—",
    clearedValueDate: "2026-08-15T00:00:00.000Z",
    clearedValueDateDisplay: "15 Aug 2026",
    clearedValueDateSource: "ACTUAL_SETTLEMENT_DATE",
    paymentDate: "2026-08-15T00:00:00.000Z",
    paymentDateDisplay: "15 Aug 2026",
    paymentReference: "BANK-1",
    settlementStatus: "Fully settled",
    grossReceiptAmount: 100_000,
    investorPrincipal: 90_000,
    investorProfitGross: 8_000,
    unpaidContractualFees: 0,
    tawidhAmount: 0,
    gharamahAmount: 0,
    priorPaymentsCredits: 0,
    totalApplied: 98_000,
    hibahAmount: 2_000,
    totalAllocated: 100_000,
    unallocatedBalance: 0,
    investorScheduleReference: "IS-ARF-202608-A52-V01",
    hibahGrantor: "Participating Investors/Noteholders",
    hibahRecipient: "Helios",
    actingThrough: "Shoraka Suyula Platform Sdn Bhd as duly authorised agent for investor, issuer and platform operator",
    shariahStructure: "Bai' Al-Dayn Bi Al-Sila'",
    confirmationCopy: "Confirmation.",
    ...overrides,
  };
}

describe("generateSettlementHibahReceipt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    receiptStore.rows = [];
    noteEvents.length = 0;
    issuerAllowed = true;
    currentNote = {
      id: "note-1",
      status: NoteStatus.REPAID,
      servicing_status: NoteServicingStatus.SETTLED,
      issuer_organization_id: "issuer-org",
    };
    postedSettlement = {
      id: "set-1",
      note_id: "note-1",
      status: NoteSettlementStatus.POSTED,
      display_reference: "SET-ARF-202608-A52",
    };
    mockConvertHtmlToPdf.mockResolvedValue(Buffer.from("%PDF-hibah"));
    mockStoreReceiptPdf.mockResolvedValue(undefined);
    mockGenerateReceiptPdfViewUrl.mockResolvedValue({
      viewUrl: "https://s3/view",
      expiresIn: 600,
    });
    mockCreateNoteEventRow.mockImplementation(async (_db: unknown, params: any) => {
      noteEvents.push({ metadata: params.metadata, targetId: params.targetId });
    });
    mockBuildSnapshot.mockResolvedValue(sampleSnapshot());
  });

  it("does not generate when the note is still ACTIVE after posting", async () => {
    currentNote.status = NoteStatus.ACTIVE;
    currentNote.servicing_status = NoteServicingStatus.CURRENT;
    await generateSettlementHibahReceipt({
      noteId: "note-1",
      source: "SETTLEMENT_COMPLETED",
    });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(receiptStore.rows).toHaveLength(0);
    expect(noteUpdate).not.toHaveBeenCalled();
    expect(settlementUpdate).not.toHaveBeenCalled();
  });

  it("generates V01, stores SHA-256, and writes one audit event", async () => {
    await generateSettlementHibahReceipt({
      noteId: "note-1",
      source: "SETTLEMENT_COMPLETED",
    });
    expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1);
    expect(mockStoreReceiptPdf).toHaveBeenCalledTimes(1);
    expect(receiptStore.rows).toHaveLength(1);
    expect(receiptStore.rows[0].status).toBe(SettlementHibahReceiptStatus.READY);
    expect(receiptStore.rows[0].pdf_sha256).toBe("sha-10");
    expect(receiptStore.rows[0].pdf_s3_key).toContain("V01.pdf");
    expect(mockCreateNoteEventRow).toHaveBeenCalledTimes(1);
    expect(mockCreateNoteEventRow.mock.calls[0][1].eventType).toBe(
      "SETTLEMENT_HIBAH_RECEIPT_GENERATED"
    );
    expect(mockCreateNoteEventRow.mock.calls[0][1].targetId).toBe("set-1");
    expect(mockCreateNoteEventRow.mock.calls[0][1].metadata.settlementReference).toBe(
      "SET-ARF-202608-A52"
    );
    expect(noteUpdate).not.toHaveBeenCalled();
    expect(settlementUpdate).not.toHaveBeenCalled();
    expect(walletCreate).not.toHaveBeenCalled();
  });

  it("is a no-op once V01 is READY", async () => {
    await generateSettlementHibahReceipt({
      noteId: "note-1",
      source: "SETTLEMENT_COMPLETED",
    });
    mockConvertHtmlToPdf.mockClear();
    mockBuildSnapshot.mockClear();
    mockCreateNoteEventRow.mockClear();
    await generateSettlementHibahReceipt({
      noteId: "note-1",
      source: "ADMIN_RETRY",
    });
    expect(mockConvertHtmlToPdf).not.toHaveBeenCalled();
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(mockCreateNoteEventRow).not.toHaveBeenCalled();
  });

  it("does not alter settlement when Gotenberg fails", async () => {
    mockConvertHtmlToPdf.mockRejectedValue(new Error("gotenberg down"));
    await generateSettlementHibahReceipt({
      noteId: "note-1",
      source: "SETTLEMENT_COMPLETED",
    });
    expect(receiptStore.rows[0].status).toBe(SettlementHibahReceiptStatus.FAILED);
    expect(receiptStore.rows[0].generation_error).toContain("gotenberg down");
    expect(noteUpdate).not.toHaveBeenCalled();
    expect(settlementUpdate).not.toHaveBeenCalled();
    expect(walletCreate).not.toHaveBeenCalled();
    expect(currentNote.status).toBe(NoteStatus.REPAID);
    expect(currentNote.servicing_status).toBe(NoteServicingStatus.SETTLED);
  });

  it("does not alter settlement when S3 fails", async () => {
    mockStoreReceiptPdf.mockRejectedValue(new Error("s3 down"));
    await generateSettlementHibahReceipt({
      noteId: "note-1",
      source: "SETTLEMENT_COMPLETED",
    });
    expect(receiptStore.rows[0].status).toBe(SettlementHibahReceiptStatus.FAILED);
    expect(noteUpdate).not.toHaveBeenCalled();
    expect(settlementUpdate).not.toHaveBeenCalled();
  });

  it("retries FAILED V01 with the frozen snapshot", async () => {
    const frozen = sampleSnapshot({ hibahAmount: 12.34, snapshotSha256: "frozen-hash" });
    receiptStore.rows.push({
      id: "row-1",
      note_id: "note-1",
      settlement_id: "set-1",
      receipt_number: "SET-ARF-202608-A52",
      version: "V01",
      status: SettlementHibahReceiptStatus.FAILED,
      snapshot: frozen,
      pdf_s3_key: null,
      pdf_sha256: null,
      generated_at: null,
      generation_error: "previous failure",
    });
    mockBuildSnapshot.mockResolvedValue(sampleSnapshot({ hibahAmount: 99, snapshotSha256: "new" }));
    await retryAdminSettlementHibahReceipt("note-1", { userId: "admin-1", role: "ADMIN" });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1);
    expect(receiptStore.rows[0].status).toBe(SettlementHibahReceiptStatus.READY);
    expect(receiptStore.rows[0].snapshot.hibahAmount).toBe(12.34);
    expect(receiptStore.rows[0].snapshot.snapshotSha256).toBe("frozen-hash");
  });

  it("rejects admin retry unless the row is FAILED", async () => {
    await generateSettlementHibahReceipt({
      noteId: "note-1",
      source: "SETTLEMENT_COMPLETED",
    });
    await expect(
      retryAdminSettlementHibahReceipt("note-1", { userId: "admin-1" })
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("receipt visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    receiptStore.rows = [];
    issuerAllowed = true;
    currentNote = {
      id: "note-1",
      status: NoteStatus.REPAID,
      servicing_status: NoteServicingStatus.SETTLED,
      issuer_organization_id: "issuer-org",
    };
    postedSettlement = {
      id: "set-1",
      note_id: "note-1",
      status: NoteSettlementStatus.POSTED,
      display_reference: "SET-ARF-202608-A52",
    };
    mockGenerateReceiptPdfViewUrl.mockResolvedValue({
      viewUrl: "https://s3/view",
      expiresIn: 600,
    });
    receiptStore.rows.push({
      id: "row-1",
      note_id: "note-1",
      settlement_id: "set-1",
      receipt_number: "SET-ARF-202608-A52",
      version: "V01",
      status: SettlementHibahReceiptStatus.FAILED,
      snapshot: sampleSnapshot(),
      pdf_s3_key: null,
      pdf_sha256: null,
      generated_at: null,
      generation_error: "gotenberg down",
    });
  });

  it("lets admin view generation errors and retry", async () => {
    const payload = await getAdminSettlementHibahReceipt("note-1");
    expect(payload.status).toBe("FAILED");
    expect(payload.generationError).toBe("gotenberg down");
    expect(payload.canRetry).toBe(true);
  });

  it("lets the owning issuer view without technical errors", async () => {
    const payload = await getIssuerSettlementHibahReceipt("note-1", "issuer-user");
    expect(payload.status).toBe("FAILED");
    expect(payload.generationError).toBeNull();
    expect(payload.canRetry).toBe(false);
  });

  it("forbids another issuer", async () => {
    issuerAllowed = false;
    await expect(getIssuerSettlementHibahReceipt("note-1", "other-user")).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
