import {
  NoteInvestmentCertificateStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteStatus,
} from "@prisma/client";
import { ReceiptGenerationError } from "./types";

const mockPrisma: any = {
  note: { findUnique: jest.fn() },
  noteSettlement: { findFirst: jest.fn() },
  notePayment: { findMany: jest.fn() },
  issuerOrganization: { findUnique: jest.fn() },
  contract: { findUnique: jest.fn() },
  noteInvestmentCertificate: { findFirst: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("../investment-note-certificate/snapshot", () => ({
  parseCertificateSnapshot: (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const record = value as { investorSchedule?: { scheduleReference?: string } };
    return record.investorSchedule?.scheduleReference ? value : null;
  },
}));

const mockFreezeReceiptAuthorisation = jest.fn(async () => ({
  stampSource: "SHARED_CERTIFICATE_STAMP",
  companyStamp: null,
}));

jest.mock("../document-authorisation/config", () => ({
  freezeReceiptAuthorisation: (...args: unknown[]) => mockFreezeReceiptAuthorisation(...args),
}));

import {
  buildSettlementHibahReceiptSnapshot,
  reconcileHibahReceiptAmounts,
  reissueHibahReceiptSnapshotFromReady,
} from "./snapshot";

function money(value: number) {
  return { toNumber: () => value };
}

function baseNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    note_reference: "ARF-202608-A52",
    status: NoteStatus.REPAID,
    servicing_status: NoteServicingStatus.SETTLED,
    tenure_days: 90,
    issuer_organization_id: "iss-1",
    source_contract_id: "fac-1",
    issuer_snapshot: { name: "Helios Sdn Bhd", registration_number: "1234567-A" },
    paymaster_snapshot: { name: "Paymaster Co" },
    invoice_snapshot: { details: { number: "INV-9", value: 100_000 } },
    requested_amount: 100_000,
    maturity_date: new Date("2026-11-30T00:00:00.000Z"),
    ...overrides,
  };
}

function baseSettlement(overrides: Record<string, unknown> = {}) {
  return {
    id: "set-1",
    note_id: "note-1",
    status: NoteSettlementStatus.POSTED,
    display_reference: "SET-ARF-202608-A52",
    gross_receipt_amount: money(105_000),
    investor_principal: money(100_000),
    investor_profit_gross: money(3_000),
    tawidh_amount: money(200),
    gharamah_amount: money(50),
    issuer_residual_amount: money(1_750),
    unapplied_amount: money(0),
    service_fee_amount: money(900),
    excess_late_charge_amount: money(400),
    actual_settlement_date: new Date("2026-08-15T00:00:00.000Z"),
    posted_at: new Date("2026-08-20T00:00:00.000Z"),
    payment_id: null,
    preview_snapshot: { includedPaymentIds: ["pay-1"] },
    ...overrides,
  };
}

describe("reconcileHibahReceiptAmounts", () => {
  it("reconciles applied, hibah, and allocated totals", () => {
    const result = reconcileHibahReceiptAmounts({
      grossReceiptAmount: 105_000,
      investorPrincipal: 100_000,
      investorProfitGross: 3_000,
      tawidhAmount: 200,
      gharamahAmount: 50,
      unpaidContractualFees: 0,
      priorPaymentsCredits: 0,
      hibahAmount: 1_750,
      unallocatedBalance: 0,
    });
    expect(result.totalApplied).toBe(103_250);
    expect(result.totalAllocated).toBe(105_000);
  });

  it("rejects a residual that does not match frozen settlement arithmetic", () => {
    expect(() =>
      reconcileHibahReceiptAmounts({
        grossReceiptAmount: 105_000,
        investorPrincipal: 100_000,
        investorProfitGross: 3_000,
        tawidhAmount: 200,
        gharamahAmount: 50,
        unpaidContractualFees: 0,
        priorPaymentsCredits: 0,
        hibahAmount: 1,
        unallocatedBalance: 0,
      })
    ).toThrow(ReceiptGenerationError);
  });
});

describe("buildSettlementHibahReceiptSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.note.findUnique.mockResolvedValue(baseNote());
    mockPrisma.noteSettlement.findFirst.mockResolvedValue(baseSettlement());
    mockPrisma.notePayment.findMany.mockResolvedValue([
      {
        id: "pay-1",
        reference: "BANK-REF-1",
        receipt_date: new Date("2026-08-10T00:00:00.000Z"),
      },
    ]);
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({ display_reference: "ISS-1" });
    mockPrisma.contract.findUnique.mockResolvedValue({ display_reference: "FAC-1" });
    mockPrisma.noteInvestmentCertificate.findFirst.mockResolvedValue(null);
    mockFreezeReceiptAuthorisation.mockResolvedValue({
      stampSource: "SHARED_CERTIFICATE_STAMP",
      companyStamp: null,
    });
  });

  it("prints frozen settlement amounts and zeros unpaid fees / prior credits", async () => {
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.receiptNumber).toBe("SET-ARF-202608-A52");
    expect(snapshot.settlementReference).toBe("SET-ARF-202608-A52");
    expect(snapshot.grossReceiptAmount).toBe(105_000);
    expect(snapshot.investorPrincipal).toBe(100_000);
    expect(snapshot.investorProfitGross).toBe(3_000);
    expect(snapshot.unpaidContractualFees).toBe(0);
    expect(snapshot.tawidhAmount).toBe(200);
    expect(snapshot.gharamahAmount).toBe(50);
    expect(snapshot.priorPaymentsCredits).toBe(0);
    expect(snapshot.hibahAmount).toBe(1_750);
    expect(snapshot.totalApplied).toBe(103_250);
    expect(snapshot.totalAllocated).toBe(105_000);
    expect(snapshot.unallocatedBalance).toBe(0);
    expect(snapshot).not.toHaveProperty("serviceFeeAmount");
    expect(snapshot).not.toHaveProperty("excessLateChargeAmount");
  });

  it("still generates when Hibah is zero", async () => {
    mockPrisma.noteSettlement.findFirst.mockResolvedValue(
      baseSettlement({
        gross_receipt_amount: money(103_250),
        issuer_residual_amount: money(0),
      })
    );
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.hibahAmount).toBe(0);
    expect(snapshot.totalAllocated).toBe(103_250);
  });

  it("uses actual_settlement_date as cleared value date, not posted_at", async () => {
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.clearedValueDate).toBe("2026-08-15T00:00:00.000Z");
    expect(snapshot.paymentDate).toBe(snapshot.clearedValueDate);
    expect(snapshot.clearedValueDateSource).toBe("ACTUAL_SETTLEMENT_DATE");
    expect(snapshot.clearedValueDate).not.toBe("2026-08-20T00:00:00.000Z");
  });

  it("refuses a tenure note without actual_settlement_date", async () => {
    mockPrisma.noteSettlement.findFirst.mockResolvedValue(
      baseSettlement({ actual_settlement_date: null })
    );
    await expect(
      buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED")
    ).rejects.toMatchObject({ code: "INCOMPLETE_DATA" });
  });

  it("falls back to included payment receipt_date for legacy non-tenure notes", async () => {
    mockPrisma.note.findUnique.mockResolvedValue(baseNote({ tenure_days: null }));
    mockPrisma.noteSettlement.findFirst.mockResolvedValue(
      baseSettlement({ actual_settlement_date: null })
    );
    mockPrisma.notePayment.findMany.mockResolvedValue([
      {
        id: "pay-1",
        reference: "LEGACY-1",
        receipt_date: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: "pay-2",
        reference: "LEGACY-2",
        receipt_date: new Date("2026-07-09T00:00:00.000Z"),
      },
    ]);
    mockPrisma.noteSettlement.findFirst.mockResolvedValue(
      baseSettlement({
        actual_settlement_date: null,
        preview_snapshot: { includedPaymentIds: ["pay-1", "pay-2"] },
      })
    );
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.clearedValueDateSource).toBe("INCLUDED_PAYMENT_RECEIPT_DATE");
    expect(snapshot.clearedValueDate).toBe("2026-07-09T00:00:00.000Z");
    expect(snapshot.paymentReference).toBe("LEGACY-1 · LEGACY-2");
  });

  it("fails a legacy note when no defensible cleared date exists", async () => {
    mockPrisma.note.findUnique.mockResolvedValue(baseNote({ tenure_days: null }));
    mockPrisma.noteSettlement.findFirst.mockResolvedValue(
      baseSettlement({
        actual_settlement_date: null,
        preview_snapshot: { includedPaymentIds: [] },
        payment_id: null,
      })
    );
    mockPrisma.notePayment.findMany.mockResolvedValue([]);
    await expect(
      buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED")
    ).rejects.toMatchObject({ code: "INCOMPLETE_DATA" });
  });

  it("prints an em dash when included payments have no reference", async () => {
    mockPrisma.notePayment.findMany.mockResolvedValue([
      { id: "pay-1", reference: "  ", receipt_date: new Date("2026-08-10T00:00:00.000Z") },
    ]);
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.paymentReference).toBe("—");
  });

  it("copies READY certificate V01 schedule reference and ignores later versions", async () => {
    mockPrisma.noteInvestmentCertificate.findFirst.mockResolvedValue({
      version: "V01",
      snapshot: {
        investorSchedule: { scheduleReference: "IS-ARF-202608-A52-V01" },
      },
    });
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.investorScheduleReference).toBe("IS-ARF-202608-A52-V01");
    expect(mockPrisma.noteInvestmentCertificate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          version: "V01",
          status: NoteInvestmentCertificateStatus.READY,
        }),
      })
    );
  });

  it("derives IS-{note}-V01 when the certificate PDF is not READY", async () => {
    mockPrisma.noteInvestmentCertificate.findFirst.mockResolvedValue(null);
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.investorScheduleReference).toBe("IS-ARF-202608-A52-V01");
  });

  it("does not freeze the issuer organization CUID as Issuer ID", async () => {
    const issuerCuid = "cmknlimvf0003grp0hsbmc1dp";
    mockPrisma.note.findUnique.mockResolvedValue(baseNote({ issuer_organization_id: issuerCuid }));
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({ display_reference: null });
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.issuerReference).toBe("—");
    expect(snapshot.issuerReference).not.toBe(issuerCuid);
  });

  it("does not generate while the note is still ACTIVE awaiting trustee completion", async () => {
    mockPrisma.note.findUnique.mockResolvedValue(
      baseNote({ status: NoteStatus.ACTIVE, servicing_status: NoteServicingStatus.CURRENT })
    );
    await expect(
      buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED")
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
  });

  it("freezes the shared certificate stamp when that option is selected", async () => {
    mockFreezeReceiptAuthorisation.mockResolvedValue({
      stampSource: "SHARED_CERTIFICATE_STAMP",
      companyStamp: {
        s3Key: "stamps/cert.png",
        sha256: "cert",
        contentType: "image/png",
        fileName: "cert.png",
      },
    });
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.authorisation.stampSource).toBe("SHARED_CERTIFICATE_STAMP");
    expect(snapshot.authorisation.companyStamp?.s3Key).toBe("stamps/cert.png");
  });

  it("freezes the separate receipt stamp when that option is selected", async () => {
    mockFreezeReceiptAuthorisation.mockResolvedValue({
      stampSource: "SEPARATE_RECEIPT_STAMP",
      companyStamp: {
        s3Key: "stamps/receipt.png",
        sha256: "receipt",
        contentType: "image/png",
        fileName: "receipt.png",
      },
    });
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.authorisation.stampSource).toBe("SEPARATE_RECEIPT_STAMP");
    expect(snapshot.authorisation.companyStamp?.s3Key).toBe("stamps/receipt.png");
  });

  it("does not block generation when the selected stamp is missing", async () => {
    mockFreezeReceiptAuthorisation.mockResolvedValue({
      stampSource: "SHARED_CERTIFICATE_STAMP",
      companyStamp: null,
    });
    const snapshot = await buildSettlementHibahReceiptSnapshot("note-1", "SETTLEMENT_COMPLETED");
    expect(snapshot.authorisation.companyStamp).toBeNull();
    expect(snapshot.grossReceiptAmount).toBe(105_000);
  });
});

describe("reissueHibahReceiptSnapshotFromReady", () => {
  it("copies financial facts and only refreshes stamp authorisation plus version", () => {
    const previous = {
      receiptNumber: "SET-1",
      version: "V01",
      receiptDate: "2026-09-02T00:00:00.000Z",
      snapshotGeneratedAt: "2026-09-02T00:00:00.000Z",
      snapshotSha256: "v01-hash",
      source: "SETTLEMENT_COMPLETED",
      grossReceiptAmount: 105_000,
      investorPrincipal: 100_000,
      investorProfitGross: 3_000,
      tawidhAmount: 200,
      gharamahAmount: 50,
      hibahAmount: 1_750,
      paymentReference: "BANK-1",
      authorisation: {
        stampSource: "SHARED_CERTIFICATE_STAMP",
        companyStamp: { s3Key: "stamps/a.png", sha256: "a", contentType: "image/png", fileName: "a.png" },
      },
    } as any;
    const next = reissueHibahReceiptSnapshotFromReady(previous, {
      version: "V02",
      stampSource: "SEPARATE_RECEIPT_STAMP",
      companyStamp: {
        s3Key: "stamps/b.png",
        sha256: "b",
        contentType: "image/png",
        fileName: "b.png",
      },
      generatedAt: new Date("2026-09-03T00:00:00.000Z"),
    });
    expect(next.version).toBe("V02");
    expect(next.source).toBe("ADMIN_REISSUE");
    expect(next.receiptDate).toBe("2026-09-02T00:00:00.000Z");
    expect(next.grossReceiptAmount).toBe(105_000);
    expect(next.hibahAmount).toBe(1_750);
    expect(next.paymentReference).toBe("BANK-1");
    expect(next.authorisation.stampSource).toBe("SEPARATE_RECEIPT_STAMP");
    expect(next.authorisation.companyStamp?.s3Key).toBe("stamps/b.png");
    expect(next.snapshotSha256).not.toBe(previous.snapshotSha256);
  });
});
