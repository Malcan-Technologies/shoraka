import {
  InvestmentSettlementConfirmationStatus,
  NoteSettlementStatus,
} from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import {
  INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
  INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
} from "@cashsouk/types";
import type { InvestmentSettlementConfirmationSnapshot } from "./types";

const mockConvertHtmlToPdf = jest.fn();
const mockStorePdf = jest.fn();
const mockGenerateViewUrl = jest.fn();
const mockCreateNoteEventRow = jest.fn();
const mockBuildSnapshot = jest.fn();

const confirmationStore: { rows: any[] } = { rows: [] };
const noteEvents: any[] = [];
let postedSettlement: any = null;
let currentNote: any = { id: "note-1" };
let investorAllowed = true;
const noteUpdate = jest.fn();
const settlementUpdate = jest.fn();
const walletUpdate = jest.fn();

function uniqueWhere(where: any) {
  const key = where?.settlement_id_investor_organization_id_version;
  if (!key) return null;
  return confirmationStore.rows.find(
    (row) =>
      row.settlement_id === key.settlement_id &&
      row.investor_organization_id === key.investor_organization_id &&
      row.version === key.version
  );
}

const mockPrisma: any = {
  note: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
      currentNote?.id === where.id ? currentNote : null
    ),
    update: noteUpdate,
  },
  noteSettlement: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
      postedSettlement?.id === where.id ? postedSettlement : null
    ),
    findFirst: jest.fn(async ({ where }: any) => {
      if (
        postedSettlement &&
        postedSettlement.note_id === where.note_id &&
        postedSettlement.status === where.status
      ) {
        return postedSettlement;
      }
      return null;
    }),
    update: settlementUpdate,
  },
  investmentSettlementConfirmation: {
    findUnique: jest.fn(async ({ where }: any) => uniqueWhere(where) ?? null),
    findMany: jest.fn(async ({ where }: any) => {
      return confirmationStore.rows.filter((row) => {
        if (where.settlement_id && row.settlement_id !== where.settlement_id) return false;
        if (where.version && row.version !== where.version) return false;
        if (where.investor_organization_id?.in) {
          return where.investor_organization_id.in.includes(row.investor_organization_id);
        }
        if (where.status?.not) return row.status !== where.status.not;
        if (where.OR) {
          return where.OR.some((clause: any) => row.status === clause.status);
        }
        return true;
      });
    }),
    count: jest.fn(async ({ where }: any) => {
      return confirmationStore.rows.filter((row) => {
        if (row.settlement_id !== where.settlement_id) return false;
        if (where.version && row.version !== where.version) return false;
        if (where.status?.not) return row.status !== where.status.not;
        return true;
      }).length;
    }),
    create: jest.fn(async ({ data }: any) => {
      const row = {
        id: `row-${confirmationStore.rows.length + 1}`,
        pdf_s3_key: null,
        pdf_sha256: null,
        generated_at: null,
        generation_error: null,
        ...data,
      };
      confirmationStore.rows.push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = confirmationStore.rows.find((item) => item.id === where.id);
      Object.assign(row, data);
      return row;
    }),
  },
  noteEvent: {
    findMany: jest.fn(async () => noteEvents),
  },
  noteInvestment: {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      if (where.id === "inv-foreign") {
        return { id: "inv-foreign", note_id: "note-1", investor_organization_id: "org-b" };
      }
      if (where.id === "inv-missing") return null;
      return { id: where.id, note_id: "note-1", investor_organization_id: "org-a" };
    }),
  },
  investorOrganization: {
    findFirst: jest.fn(async ({ where }: { where: { id: string } }) => {
      if (!investorAllowed) return null;
      if (where.id === "org-a") return { id: "org-a" };
      return null;
    }),
  },
  investorBalance: {
    update: walletUpdate,
  },
};

jest.mock("../../../lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("../../../lib/gotenberg/convert-html-to-pdf", () => ({
  convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
  HtmlToPdfError: class HtmlToPdfError extends Error {},
}));
jest.mock("./storage", () => ({
  CONFIRMATION_PDF_CONTENT_TYPE: "application/pdf",
  buildConfirmationPdfObjectKey: jest.fn(
    ({ noteId, settlementId, investorOrganizationId, version }: any) =>
      `investment-settlement-confirmations/test/${noteId}/${settlementId}/${investorOrganizationId}/${version}.pdf`
  ),
  confirmationPdfFileName: jest.fn(
    ({ noteReference, investorReference }: any) =>
      `investment-settlement-confirmation-${noteReference}-${investorReference}.pdf`
  ),
  generateConfirmationPdfViewUrl: (...args: unknown[]) => mockGenerateViewUrl(...args),
  sha256Hex: (buf: Buffer) => `sha-${buf.length}`,
  storeConfirmationPdf: (...args: unknown[]) => mockStorePdf(...args),
}));
jest.mock("./snapshot", () => {
  const actual = jest.requireActual("./snapshot");
  return {
    ...actual,
    buildInvestmentSettlementConfirmationSnapshot: (...args: unknown[]) => mockBuildSnapshot(...args),
  };
});
jest.mock("./confirmation-html", () => ({
  buildInvestmentSettlementConfirmationHtml: jest.fn(
    (snapshot: InvestmentSettlementConfirmationSnapshot) => `<html>${snapshot.noteReference}</html>`
  ),
}));
jest.mock("../../../lib/audit", () => ({
  AUDIT_PORTAL: { ADMIN: "ADMIN" },
  createNoteEventRow: (...args: unknown[]) => mockCreateNoteEventRow(...args),
  systemAuditContext: (input: unknown) => input,
}));
jest.mock("../audit-fields", () => ({
  resolveNoteEventTarget: (_event: string, metadata: { settlementId?: string }) => ({
    targetType: "NOTE_SETTLEMENT",
    targetId: metadata.settlementId ?? "set-1",
  }),
}));

import {
  generateInvestmentSettlementConfirmations,
  getAdminInvestmentSettlementConfirmations,
  getInvestorInvestmentSettlementConfirmation,
  retryAdminInvestmentSettlementConfirmation,
} from "./service";

function sampleSnapshot(
  overrides: Partial<InvestmentSettlementConfirmationSnapshot> = {}
): InvestmentSettlementConfirmationSnapshot {
  return {
    templateId: "investment-settlement-confirmation-investor-v1",
    templateVersion: "V01",
    snapshotGeneratedAt: "2026-09-02T00:00:00.000Z",
    snapshotSha256: "snap-hash",
    source: "SETTLEMENT_POSTED",
    version: "V01",
    noteId: "note-1",
    noteReference: "ARF-202608-A52",
    settlementId: "set-1",
    settlementReference: "SET-ARF-202608-A52",
    investorOrganizationId: "org-a",
    investorReference: "IVT-A",
    investmentIds: ["inv-1"],
    issuerReference: "ISS-1",
    settlementDate: "2026-08-20T00:00:00.000Z",
    settlementDateDisplay: "20 August 2026",
    settlementDateSource: "ACTUAL_SETTLEMENT_DATE",
    principalReturned: 10000,
    grossProfitEarned: 1000,
    serviceFeeRatePercent: 15,
    serviceFeeLabel: "Service fee (15% of profit)",
    serviceFeeAmount: 150,
    netProfitCredited: 850,
    tawidhCompensation: 0,
    showTawidh: false,
    totalCreditedToWallet: 10850,
    walletTransactionIds: ["tx-1"],
    statusLabel: "Settled",
    introCopy: INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
    processingNotice: INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
    ...overrides,
  };
}

const previewSnapshot = {
  allocations: [
    {
      investmentId: "inv-1",
      investorOrganizationId: "org-a",
      principal: 10000,
      profitNet: 850,
      tawidhInvestorShare: 0,
    },
  ],
};

describe("generateInvestmentSettlementConfirmations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    confirmationStore.rows = [];
    noteEvents.length = 0;
    investorAllowed = true;
    currentNote = { id: "note-1" };
    postedSettlement = {
      id: "set-1",
      note_id: "note-1",
      status: NoteSettlementStatus.POSTED,
      display_reference: "SET-ARF-202608-A52",
      preview_snapshot: previewSnapshot,
    };
    mockConvertHtmlToPdf.mockResolvedValue(Buffer.from("%PDF-conf"));
    mockStorePdf.mockResolvedValue(undefined);
    mockGenerateViewUrl.mockResolvedValue({ viewUrl: "https://s3/view", expiresIn: 600 });
    mockCreateNoteEventRow.mockImplementation(async (_db: unknown, params: any) => {
      noteEvents.push({ metadata: params.metadata, targetId: params.targetId });
    });
    mockBuildSnapshot.mockImplementation(async ({ investorOrganizationId }: any) =>
      sampleSnapshot({ investorOrganizationId })
    );
  });

  it("does not generate for PREVIEW or APPROVED settlements", async () => {
    postedSettlement.status = NoteSettlementStatus.APPROVED;
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "SETTLEMENT_POSTED",
    });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(confirmationStore.rows).toHaveLength(0);
  });

  it("generates one V01 per investor org, stores SHA-256, and writes one audit event", async () => {
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "SETTLEMENT_POSTED",
    });
    expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1);
    expect(confirmationStore.rows).toHaveLength(1);
    expect(confirmationStore.rows[0].status).toBe(InvestmentSettlementConfirmationStatus.READY);
    expect(confirmationStore.rows[0].investor_organization_id).toBe("org-a");
    expect(confirmationStore.rows[0].pdf_sha256).toBe("sha-9");
    expect(mockCreateNoteEventRow).toHaveBeenCalledTimes(1);
    expect(mockCreateNoteEventRow.mock.calls[0][1].eventType).toBe(
      "INVESTMENT_SETTLEMENT_CONFIRMATION_GENERATED"
    );
    expect(mockCreateNoteEventRow.mock.calls[0][1].metadata.confirmationCount).toBe(1);
    expect(noteUpdate).not.toHaveBeenCalled();
    expect(settlementUpdate).not.toHaveBeenCalled();
    expect(walletUpdate).not.toHaveBeenCalled();
  });

  it("aggregates two investment rows into one confirmation for the same org", async () => {
    postedSettlement.preview_snapshot = {
      allocations: [
        {
          investmentId: "inv-1",
          investorOrganizationId: "org-a",
          principal: 4000,
          profitNet: 200,
          tawidhInvestorShare: 0,
        },
        {
          investmentId: "inv-2",
          investorOrganizationId: "org-a",
          principal: 6000,
          profitNet: 300,
          tawidhInvestorShare: 0,
        },
      ],
    };
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "SETTLEMENT_POSTED",
    });
    expect(mockBuildSnapshot).toHaveBeenCalledTimes(1);
    expect(mockBuildSnapshot.mock.calls[0][0].investorOrganizationId).toBe("org-a");
    expect(confirmationStore.rows).toHaveLength(1);
  });

  it("creates one confirmation per investor organization", async () => {
    postedSettlement.preview_snapshot = {
      allocations: [
        {
          investmentId: "inv-1",
          investorOrganizationId: "org-a",
          principal: 5000,
          profitNet: 100,
          tawidhInvestorShare: 0,
        },
        {
          investmentId: "inv-2",
          investorOrganizationId: "org-b",
          principal: 5000,
          profitNet: 100,
          tawidhInvestorShare: 0,
        },
      ],
    };
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "SETTLEMENT_POSTED",
    });
    expect(confirmationStore.rows).toHaveLength(2);
    expect(mockCreateNoteEventRow).toHaveBeenCalledTimes(1);
    expect(mockCreateNoteEventRow.mock.calls[0][1].metadata.confirmationCount).toBe(2);
  });

  it("does not write the audit event until every expected confirmation is READY", async () => {
    postedSettlement.preview_snapshot = {
      allocations: [
        {
          investmentId: "inv-1",
          investorOrganizationId: "org-a",
          principal: 5000,
          profitNet: 100,
          tawidhInvestorShare: 0,
        },
        {
          investmentId: "inv-2",
          investorOrganizationId: "org-b",
          principal: 5000,
          profitNet: 100,
          tawidhInvestorShare: 0,
        },
      ],
    };
    mockConvertHtmlToPdf
      .mockResolvedValueOnce(Buffer.from("%PDF-a"))
      .mockRejectedValueOnce(new Error("gotenberg down"));
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "SETTLEMENT_POSTED",
    });
    expect(mockCreateNoteEventRow).not.toHaveBeenCalled();
    expect(
      confirmationStore.rows.some((row) => row.status === InvestmentSettlementConfirmationStatus.FAILED)
    ).toBe(true);
  });

  it("is a no-op once V01 is READY", async () => {
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "SETTLEMENT_POSTED",
    });
    mockConvertHtmlToPdf.mockClear();
    mockBuildSnapshot.mockClear();
    mockCreateNoteEventRow.mockClear();
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "ADMIN_RETRY",
    });
    expect(mockConvertHtmlToPdf).not.toHaveBeenCalled();
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
  });

  it("does not alter settlement or wallets when Gotenberg fails", async () => {
    mockConvertHtmlToPdf.mockRejectedValue(new Error("gotenberg down"));
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "SETTLEMENT_POSTED",
    });
    expect(confirmationStore.rows[0].status).toBe(InvestmentSettlementConfirmationStatus.FAILED);
    expect(noteUpdate).not.toHaveBeenCalled();
    expect(settlementUpdate).not.toHaveBeenCalled();
    expect(walletUpdate).not.toHaveBeenCalled();
  });

  it("retries FAILED V01 with the frozen snapshot", async () => {
    const frozen = sampleSnapshot({ principalReturned: 12.34, snapshotSha256: "frozen-hash" });
    confirmationStore.rows.push({
      id: "row-1",
      note_id: "note-1",
      settlement_id: "set-1",
      investor_organization_id: "org-a",
      version: "V01",
      status: InvestmentSettlementConfirmationStatus.FAILED,
      snapshot: frozen,
      pdf_s3_key: null,
      pdf_sha256: null,
      generated_at: null,
      generation_error: "previous failure",
    });
    mockBuildSnapshot.mockResolvedValue(sampleSnapshot({ principalReturned: 99, snapshotSha256: "new" }));
    await retryAdminInvestmentSettlementConfirmation("note-1", "org-a", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(mockBuildSnapshot).not.toHaveBeenCalled();
    expect(confirmationStore.rows[0].status).toBe(InvestmentSettlementConfirmationStatus.READY);
    expect(confirmationStore.rows[0].snapshot.principalReturned).toBe(12.34);
  });

  it("rejects admin retry unless the row is FAILED", async () => {
    await generateInvestmentSettlementConfirmations({
      settlementId: "set-1",
      source: "SETTLEMENT_POSTED",
    });
    await expect(
      retryAdminInvestmentSettlementConfirmation("note-1", "org-a", { userId: "admin-1" })
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("confirmation visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    confirmationStore.rows = [];
    investorAllowed = true;
    currentNote = { id: "note-1" };
    postedSettlement = {
      id: "set-1",
      note_id: "note-1",
      status: NoteSettlementStatus.POSTED,
      display_reference: "SET-ARF-202608-A52",
      preview_snapshot: previewSnapshot,
    };
    mockGenerateViewUrl.mockResolvedValue({ viewUrl: "https://s3/view", expiresIn: 600 });
    confirmationStore.rows.push({
      id: "row-1",
      note_id: "note-1",
      settlement_id: "set-1",
      investor_organization_id: "org-a",
      version: "V01",
      status: InvestmentSettlementConfirmationStatus.FAILED,
      snapshot: sampleSnapshot(),
      pdf_s3_key: null,
      pdf_sha256: null,
      generated_at: null,
      generation_error: "gotenberg down",
    });
  });

  it("lets admin inspect FAILED rows and retry", async () => {
    const payload = await getAdminInvestmentSettlementConfirmations("note-1");
    expect(payload.failedCount).toBe(1);
    expect(payload.confirmations[0]?.generationError).toBe("gotenberg down");
    expect(payload.confirmations[0]?.canRetry).toBe(true);
  });

  it("lets the owning investor read their aggregated confirmation without errors", async () => {
    const payload = await getInvestorInvestmentSettlementConfirmation("inv-1", "investor-user");
    expect(payload.status).toBe("FAILED");
    expect(payload.generationError).toBeNull();
    expect(payload.canRetry).toBe(false);
    expect(payload.noteReference).toBe("ARF-202608-A52");
  });

  it("forbids another investor organization", async () => {
    investorAllowed = false;
    await expect(
      getInvestorInvestmentSettlementConfirmation("inv-1", "other-user")
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("forbids using another org's investment id even on the same note", async () => {
    await expect(
      getInvestorInvestmentSettlementConfirmation("inv-foreign", "investor-user")
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
