/**
 * SECTION: Prospectus review GET must not move the optimistic-lock token
 * WHY: updated_at is the lock token for save and approve. A GET that rewrites an
 *      unchanged row makes "Save & Mark Ready" conflict with its own refetches.
 *
 * The review row lives in an in-memory store that behaves like the Postgres column:
 * jsonb key ordering and @updatedAt on every update. The approved snapshot module is
 * real, so the render fingerprint is the production one.
 */

import { NoteStatus, Prisma, ProspectusReviewStatus } from "@prisma/client";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { ProspectusReviewService } from "./prospectus-review.service";

const mockReviewFindUnique = jest.fn();
const mockReviewUpdate = jest.fn();
const mockTransaction = jest.fn();
const mockNoteFindUnique = jest.fn();
const mockApplicationFindUnique = jest.fn();
const mockCtosFindFirst = jest.fn();
const mockAdminActionCreate = jest.fn();
const mockNoteEventCreate = jest.fn();
const mockPublicationCreate = jest.fn();

const mockMarcAssessment = {
  creditGrade: "SME-3",
  creditScore: 70,
  probabilityOfDefault: 0.5,
  reportDate: "2026-06-30T00:00:00.000Z",
  reportFileName: "marc.pdf",
  reportS3Key: "marc-reports/issuer-1/marc.pdf",
  assessedAt: "2026-07-01T00:00:00.000Z",
};

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: {
      findUnique: (...args: unknown[]) => mockNoteFindUnique(...args),
      findMany: async () => [],
    },
    noteProspectusReview: {
      findUnique: (...args: unknown[]) => mockReviewFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockReviewFindUnique(...args),
      update: (...args: unknown[]) => mockReviewUpdate(...args),
    },
    noteProspectusPublication: {
      create: (...args: unknown[]) => mockPublicationCreate(...args),
    },
    notePaymentSchedule: { findMany: async () => [] },
    notePayment: { findMany: async () => [] },
    application: { findUnique: (...args: unknown[]) => mockApplicationFindUnique(...args) },
    ctosReport: { findFirst: (...args: unknown[]) => mockCtosFindFirst(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    noteAdminAction: { create: (...args: unknown[]) => mockAdminActionCreate(...args) },
    noteEvent: { create: (...args: unknown[]) => mockNoteEventCreate(...args) },
  },
}));

jest.mock("../../paymaster/service", () => ({
  getCurrentMarcAssessment: jest.fn(async () => mockMarcAssessment),
}));
jest.mock("../prospectus/prospectus-marc-snapshot", () => ({
  resolveMarcSnapshotForProspectus: jest.fn(async () => mockMarcAssessment),
}));

// Page rendering is not under test here.
jest.mock("../prospectus/prospectus-page-one-prisma", () => ({
  loadProspectusPageOneNote: jest.fn(async () => ({ id: "note-1" })),
}));
jest.mock("../prospectus/prospectus-page-one-mapper", () => ({
  mapProspectusPageOneDataToInput: jest.fn(async () => ({
    trackRecordMode: "live_unpublished_preview",
    page1TrackRecordSnapshot: null,
    publicationContent: undefined,
  })),
  buildProspectusPageOne: jest.fn(() => ({
    issuerTrackRecord: {},
    historicalNoteTable: { rows: [], emptyStateMessage: null },
  })),
}));
jest.mock("../prospectus/prospectus-historical-note-table", () => ({
  toAdminHistoricalNoteTable: jest.fn(() => ({ headers: [], rows: [], emptyStateMessage: null })),
}));
jest.mock("../prospectus/prospectus-page-one.html", () => ({
  buildProspectusPageOneHtml: jest.fn(() => "<p>p1</p>"),
}));
jest.mock("../prospectus/prospectus-page-two-prisma", () => ({
  loadProspectusPageTwoData: jest.fn(async () => ({})),
  loadProspectusPageTwoNote: jest.fn(async () => ({})),
}));
jest.mock("../prospectus/prospectus-page-two-mapper", () => ({
  mapProspectusPageTwoDataToInput: jest.fn(() => ({})),
  mapProspectusPageTwoApprovedInput: jest.fn(() => ({})),
  buildProspectusPageTwo: jest.fn(() => ({
    issuerProfile: { industry: "Construction" },
    invoicePaymaster: {},
    paymasterTrackRecord: {},
    financialComparisonMetrics: { years: [], rows: [] },
    financialComparisonSource: {
      years: [],
      opsWarning: null,
      missingSsmUnauditedYears: [],
      sourceFooter: "Source: Financial Statements",
    },
  })),
}));
jest.mock("../prospectus/prospectus-issuer-profile", () => ({
  toAdminIssuerProfileRows: jest.fn(() => []),
}));
jest.mock("../prospectus/prospectus-invoice-paymaster", () => ({
  toAdminInvoicePaymasterRows: jest.fn(() => []),
}));
jest.mock("../prospectus/prospectus-paymaster-track-record", () => ({
  toAdminPaymasterTrackRecordRows: jest.fn(() => []),
}));
jest.mock("../prospectus/prospectus-financial-comparison-metrics", () => {
  const actual = jest.requireActual("../prospectus/prospectus-financial-comparison-metrics");
  return {
    ...actual,
    toAdminFinancialComparisonTable: jest.fn(() => ({
      yearHeaders: [],
      rows: [],
      sourceFooter: "Source: Financial Statements",
    })),
  };
});
jest.mock("../prospectus/prospectus-page-two.html", () => ({
  buildProspectusPageTwoHtml: jest.fn(() => "<p>p2</p>"),
}));
jest.mock("../prospectus/prospectus-page-three-prisma", () => ({
  loadProspectusPageThreeData: jest.fn(async () => ({})),
}));
jest.mock("../prospectus/prospectus-page-three-mapper", () => ({
  mapProspectusPageThreeDataToInput: jest.fn(() => ({})),
  mapProspectusPageThreeApprovedInput: jest.fn(() => ({})),
  // Approve validates Page 3 officer rows against resolved income-statement years.
  buildProspectusPageThree: jest.fn(() => ({
    incomeStatement: {
      years: [{ year: 2022 }, { year: 2023 }, { year: 2024 }],
    },
  })),
}));
jest.mock("../prospectus/prospectus-page-three.html", () => ({
  buildProspectusPageThreeHtml: jest.fn(() => "<p>p3</p>"),
}));
jest.mock("../prospectus/prospectus-issuer-track-record", () => ({
  toAdminIssuerTrackRecordRows: jest.fn(() => []),
}));
jest.mock("../prospectus/prospectus-pdf", () => ({
  PROSPECTUS_PDF_STATUS_READY: "READY",
  generateAndStoreProspectusPdf: jest.fn(),
}));

const noteId = "note-1";

const actor = {
  userId: "admin-1",
  role: "ADMIN" as const,
  portal: "ADMIN" as const,
  ipAddress: "127.0.0.1",
  userAgent: "test",
  correlationId: "corr-1",
};

const otherAdmin = { ...actor, userId: "admin-2" };

/** Fixed values only: the render fingerprint is computed from this row. */
const note = {
  id: noteId,
  note_reference: "NR-1",
  title: "Demo Note",
  status: NoteStatus.DRAFT,
  published_at: null,
  created_at: new Date("2026-09-01T00:00:00.000Z"),
  issuer_organization_id: "issuer-1",
  source_application_id: "app-1",
  product_snapshot: { product_name: "Invoice Financing" },
  purpose_snapshot: {},
  issuer_snapshot: { name: "Issuer Sdn. Bhd." },
  paymaster_snapshot: {
    name: "Demo Paymaster Sdn. Bhd.",
    entity_type: "Private Limited Company (Sdn Bhd)",
  },
  invoice_snapshot: { offer_details: { risk_rating: "SME-3" } },
  contract_snapshot: {
    contract_details: { description: "civil engineering and infrastructure works" },
  },
  prospectus_snapshot: null,
  target_amount: 625000,
  funded_amount: 0,
  profit_rate_percent: 12,
  service_fee_rate_percent: 10,
  platform_fee_rate_percent: 2,
  maturity_date: new Date("2026-12-31T00:00:00.000Z"),
  listing: { opens_at: null, closes_at: null },
};

function ctosRow(year: number, turnover: number, currat: number) {
  return {
    financial_year: year,
    dates: { pldd: `${year}-12-31`, bsdd: null },
    account: { turnover, plnpat: turnover / 10, bscatot: turnover / 2, currat },
  };
}

const application = {
  issuer_organization_id: "issuer-1",
  submitted_at: new Date("2026-08-01T00:00:00.000Z"),
  financial_statements: {
    questionnaire: { financial_year_end: "2024-12-31" },
    unaudited_by_year: {},
  },
};

const ctosReport = {
  id: "ctos-1",
  fetched_at: new Date("2026-07-15T00:00:00.000Z"),
  financials_json: [ctosRow(2023, 10_500_000.5, 1.37), ctosRow(2024, 12_250_000.25, 1.8)],
};

const JSON_COLUMNS = new Set(["draft_content", "approved_content", "approved_snapshot"]);

/** Postgres jsonb: undefined dropped, object keys ordered by length, then bytewise. */
function asJsonb(value: unknown): unknown {
  const reorder = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;
    if (Array.isArray(input)) return input.map(reorder);
    const record = input as Record<string, unknown>;
    const keys = Object.keys(record).sort(
      (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)
    );
    return Object.fromEntries(keys.map((key) => [key, reorder(record[key])]));
  };
  return reorder(JSON.parse(JSON.stringify(value)));
}

type ReviewRow = Record<string, unknown> & {
  status: ProspectusReviewStatus;
  updated_at: Date;
  draft_content: unknown;
};

let row: ReviewRow;
let reviewUpdates: Array<Record<string, unknown>>;

function seedRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-09-30T10:00:00.000Z");
  row = {
    id: "rev-1",
    note_id: noteId,
    status: ProspectusReviewStatus.DRAFT,
    content_version: 1,
    option_catalogue_version: "test",
    draft_content: asJsonb(buildCompleteProspectusReviewDraft()),
    approved_content: null,
    approved_snapshot: null,
    approved_publication_id: null,
    render_fingerprint: null,
    created_by_user_id: "admin-1",
    updated_by_user_id: "admin-1",
    approved_by_user_id: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function applyReviewUpdate(args: {
  where: { updated_at?: Date };
  data: Record<string, unknown>;
}) {
  if (args.where.updated_at && args.where.updated_at.getTime() !== row.updated_at.getTime()) {
    throw new Error("Record to update not found");
  }
  const next: ReviewRow = { ...row };
  for (const [key, value] of Object.entries(args.data)) {
    if (value === undefined) continue;
    if (value === Prisma.DbNull) {
      next[key] = null;
    } else if (value && typeof value === "object" && "increment" in value) {
      next[key] = (next[key] as number) + (value as { increment: number }).increment;
    } else if (JSON_COLUMNS.has(key)) {
      next[key] = asJsonb(value);
    } else {
      next[key] = value;
    }
  }
  // @updatedAt: every update moves the lock token.
  next.updated_at = new Date(row.updated_at.getTime() + 1000);
  row = next;
  reviewUpdates.push(args.data);
  return structuredClone(row);
}

function auditActionTypes(): string[] {
  return mockAdminActionCreate.mock.calls.map(
    (call) => (call[0] as { data: { action_type: string } }).data.action_type
  );
}

function withPaddedHighlightTitle(content: unknown) {
  const padded = structuredClone(content) as {
    page1: { keyInvestorHighlights: Array<{ key: string; title: string }> };
  };
  const highlight = padded.page1.keyInvestorHighlights.find((h) => h.key !== "shariah");
  if (!highlight) throw new Error("fixture has no editable highlight");
  highlight.title = `  ${highlight.title}  `;
  return padded;
}

describe("prospectus review GET is read-only for unchanged content", () => {
  const service = new ProspectusReviewService();

  beforeEach(() => {
    jest.clearAllMocks();
    reviewUpdates = [];
    seedRow();
    mockReviewFindUnique.mockImplementation(async () => structuredClone(row));
    mockReviewUpdate.mockImplementation(async (args) => applyReviewUpdate(args));
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        noteProspectusReview: { update: mockReviewUpdate },
        noteProspectusPublication: { create: mockPublicationCreate },
        noteAdminAction: { create: mockAdminActionCreate },
        noteEvent: { create: mockNoteEventCreate },
      })
    );
    mockAdminActionCreate.mockResolvedValue({});
    mockNoteEventCreate.mockResolvedValue({});
    mockPublicationCreate.mockResolvedValue({ id: "pub-1" });
    mockNoteFindUnique.mockResolvedValue(note);
    mockApplicationFindUnique.mockResolvedValue(application);
    mockCtosFindFirst.mockResolvedValue(ctosReport);
  });

  it("does not write when the stored draft equals the normalized draft in a different key order", async () => {
    const first = await service.getOrCreateReview(noteId, actor);
    const normalized = first.review.draftContent;

    // Same content, but jsonb hands the keys back in a different order.
    expect(row.draft_content).toEqual(normalized);
    expect(JSON.stringify(row.draft_content)).not.toBe(JSON.stringify(normalized));

    reviewUpdates = [];
    const tokenBefore = row.updated_at.getTime();

    const second = await service.getOrCreateReview(noteId, actor);

    expect(reviewUpdates).toHaveLength(0);
    expect(row.updated_at.getTime()).toBe(tokenBefore);
    expect(second.review.updatedAt).toBe(first.review.updatedAt);
    expect(second.review.status).toBe("DRAFT");
  });

  it("never rewrites draft_content or moves updated_at for READY_FOR_PUBLISH", async () => {
    const loaded = await service.getOrCreateReview(noteId, actor);
    await service.approve(noteId, actor, undefined, loaded.review.updatedAt);
    expect(row.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);

    // A draft the normalizer would change if this were still DRAFT.
    const storedDraft = asJsonb(withPaddedHighlightTitle(row.draft_content));
    row = { ...row, draft_content: storedDraft };
    reviewUpdates = [];
    const tokenBefore = row.updated_at.getTime();

    const result = await service.getOrCreateReview(noteId, actor);

    expect(reviewUpdates).toHaveLength(0);
    expect(row.draft_content).toEqual(storedDraft);
    expect(row.updated_at.getTime()).toBe(tokenBefore);
    expect(row.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
    expect(result.review.status).toBe("READY_FOR_PUBLISH");
  });

  it("normalizes once when the draft really differs, then stays read-only", async () => {
    seedRow({
      draft_content: asJsonb(withPaddedHighlightTitle(buildCompleteProspectusReviewDraft())),
    });

    const first = await service.getOrCreateReview(noteId, actor);

    expect(reviewUpdates).toHaveLength(1);
    expect(Object.keys(reviewUpdates[0])).toEqual(["draft_content", "option_catalogue_version"]);
    expect(row.draft_content).toEqual(first.review.draftContent);

    const second = await service.getOrCreateReview(noteId, actor);

    expect(reviewUpdates).toHaveLength(1);
    expect(second.review.updatedAt).toBe(first.review.updatedAt);
  });

  it("save, two refetches, then approve with the saved version succeeds", async () => {
    const loaded = await service.getOrCreateReview(noteId, actor);
    const edited = structuredClone(loaded.review.draftContent);
    edited.page2.issuerProfile = { companySize: "Large" };

    const saved = await service.saveDraft(
      noteId,
      { draftContent: edited, expectedUpdatedAt: loaded.review.updatedAt },
      actor
    );
    expect(saved.updatedAt).not.toBe(loaded.review.updatedAt);

    // The save's onSuccess invalidations refetch the review twice before approve is sent.
    const refetchA = await service.getOrCreateReview(noteId, actor);
    const refetchB = await service.getOrCreateReview(noteId, actor);
    expect(refetchA.review.updatedAt).toBe(saved.updatedAt);
    expect(refetchB.review.updatedAt).toBe(saved.updatedAt);

    const approved = await service.approve(noteId, actor, undefined, saved.updatedAt);

    expect(approved.status).toBe("READY_FOR_PUBLISH");
    expect(row.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
    expect(mockPublicationCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps READY_FOR_PUBLISH across GETs with the real render fingerprint", async () => {
    const loaded = await service.getOrCreateReview(noteId, actor);
    const approved = await service.approve(noteId, actor, undefined, loaded.review.updatedAt);
    expect(row.render_fingerprint).toMatch(/^[0-9a-f]{64}$/);

    const first = await service.getOrCreateReview(noteId, actor);
    const second = await service.getOrCreateReview(noteId, actor);

    expect(first.review.status).toBe("READY_FOR_PUBLISH");
    expect(second.review.status).toBe("READY_FOR_PUBLISH");
    expect(second.review.updatedAt).toBe(approved.updatedAt);
    expect(row.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
    expect(auditActionTypes()).toEqual(["PROSPECTUS_REVIEW_APPROVE"]);
  });

  it("still rejects approve when another admin saved after the version was loaded", async () => {
    const loaded = await service.getOrCreateReview(noteId, actor);
    const edited = structuredClone(loaded.review.draftContent);
    edited.page2.issuerProfile = { companySize: "Large" };
    await service.saveDraft(
      noteId,
      { draftContent: edited, expectedUpdatedAt: loaded.review.updatedAt },
      otherAdmin
    );

    await expect(
      service.approve(noteId, actor, undefined, loaded.review.updatedAt)
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });

    expect(row.status).toBe(ProspectusReviewStatus.DRAFT);
    expect(mockPublicationCreate).not.toHaveBeenCalled();
  });
});
