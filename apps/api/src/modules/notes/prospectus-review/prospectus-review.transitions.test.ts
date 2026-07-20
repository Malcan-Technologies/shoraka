/**
 * SECTION: Prospectus workflow transitions (Draft → Approved → Published)
 */

import { NoteStatus, ProspectusReviewStatus } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { ProspectusReviewService } from "./prospectus-review.service";

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockTransaction = jest.fn();
const mockNoteFindUnique = jest.fn();
const mockAdminActionCreate = jest.fn();
const mockNoteEventCreate = jest.fn();
const mockPublicationCreate = jest.fn();
const mockBuildSnapshot = jest.fn();

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: { findUnique: (...args: unknown[]) => mockNoteFindUnique(...args) },
    noteProspectusReview: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    noteProspectusPublication: {
      create: (...args: unknown[]) => mockPublicationCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    noteAdminAction: { create: (...args: unknown[]) => mockAdminActionCreate(...args) },
    noteEvent: { create: (...args: unknown[]) => mockNoteEventCreate(...args) },
  },
}));

jest.mock("./prospectus-approved-snapshot", () => {
  const actual = jest.requireActual("./prospectus-approved-snapshot");
  return {
    ...actual,
    buildCompleteApprovedProspectusSnapshot: (...args: unknown[]) => mockBuildSnapshot(...args),
  };
});

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
  toAdminHistoricalNoteTable: jest.fn(() => ({
    headers: [],
    rows: [],
    emptyStateMessage: null,
  })),
}));
jest.mock("../prospectus/prospectus-page-one.html", () => ({
  buildProspectusPageOneHtml: jest.fn(() => "<p>p1</p>"),
}));
jest.mock("../prospectus/prospectus-page-two-prisma", () => ({
  loadProspectusPageTwoData: jest.fn(async () => ({})),
}));
jest.mock("../prospectus/prospectus-page-two-mapper", () => ({
  mapProspectusPageTwoDataToInput: jest.fn(() => ({})),
  buildProspectusPageTwo: jest.fn(() => ({
    issuerProfile: {
      industry: "Construction",
      companySize: "Medium",
      registeredCountry: "Registered in Malaysia",
      businessDescription: "Works",
    },
    invoicePaymaster: {
      invoiceAmount: "RM 625,000.00",
      invoiceDueDate: "31 December 2026",
      paymasterName: "Kementerian Kerja Raya",
      paymasterNature: "Government Ministry",
      deedOfAssignment: "Data not available",
      paymasterRating: "Data not available",
      confidenceGrading: "Data not available",
    },
  })),
}));
jest.mock("../prospectus/prospectus-issuer-profile", () => ({
  toAdminIssuerProfileRows: jest.fn(() => [
    { label: "Industry", value: "Construction" },
    { label: "Company Size", value: "Medium" },
    { label: "Registered Country", value: "Registered in Malaysia" },
    { label: "Business Description", value: "Works" },
  ]),
}));
jest.mock("../prospectus/prospectus-invoice-paymaster", () => ({
  toAdminInvoicePaymasterRows: jest.fn(() => [
    { label: "Invoice Amount", value: "RM 625,000.00" },
    { label: "Invoice Due Date", value: "31 December 2026" },
    { label: "Paymaster", value: "Kementerian Kerja Raya" },
    { label: "Nature of Paymaster", value: "Government Ministry" },
    { label: "Deed of Assignment (DOA)", value: "Data not available" },
    { label: "Paymaster Rating", value: "Data not available" },
    { label: "Confidence Grading", value: "Data not available" },
  ]),
}));
jest.mock("../prospectus/prospectus-page-two.html", () => ({
  buildProspectusPageTwoHtml: jest.fn(() => "<p>p2</p>"),
}));
jest.mock("../prospectus/prospectus-page-three-prisma", () => ({
  loadProspectusPageThreeData: jest.fn(async () => ({})),
}));
jest.mock("../prospectus/prospectus-page-three-mapper", () => ({
  mapProspectusPageThreeDataToInput: jest.fn(() => ({})),
  buildProspectusPageThree: jest.fn(() => ({})),
}));
jest.mock("../prospectus/prospectus-page-three.html", () => ({
  buildProspectusPageThreeHtml: jest.fn(() => "<p>p3</p>"),
}));
jest.mock("../prospectus/prospectus-issuer-track-record", () => ({
  toAdminIssuerTrackRecordRows: jest.fn(() => []),
}));

const actor = {
  userId: "admin-1",
  role: "ADMIN" as const,
  portal: "ADMIN" as const,
  ipAddress: "127.0.0.1",
  userAgent: "test",
  correlationId: "corr-1",
};

function completeDraft() {
  return buildCompleteProspectusReviewDraft();
}

function baseRow(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-19T10:00:00.000Z");
  return {
    id: "rev-1",
    note_id: "note-1",
    status: ProspectusReviewStatus.DRAFT,
    content_version: 1,
    option_catalogue_version: "2026.07.19.placeholder.v1",
    draft_content: completeDraft(),
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

describe("prospectus workflow transitions", () => {
  const service = new ProspectusReviewService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        noteProspectusReview: { update: mockUpdate },
        noteProspectusPublication: { create: mockPublicationCreate },
        noteAdminAction: { create: mockAdminActionCreate },
        noteEvent: { create: mockNoteEventCreate },
      })
    );
    mockAdminActionCreate.mockResolvedValue({});
    mockNoteEventCreate.mockResolvedValue({});
    mockPublicationCreate.mockResolvedValue({ id: "pub-1" });
    mockBuildSnapshot.mockResolvedValue({
      publication_id: "pub-1",
      content_version: 2,
      render_fingerprint: "fp-1",
      calculated_at: "2026-07-19T10:00:00.000Z",
      page_1: { issuer_track_record: {}, historical_notes: [] },
      page_2: {},
      publication_content: {},
      note_identity: {},
      html: { page1: "<p>p1</p>", page2: "<p>p2</p>", page3: "<p>p3</p>" },
    });
    mockNoteFindUnique.mockResolvedValue({
      status: NoteStatus.DRAFT,
      published_at: null,
      paymaster_snapshot: {},
      invoice_snapshot: {},
      profit_rate_percent: 12,
      maturity_date: new Date(),
      listing: { opens_at: new Date() },
    });
  });

  it("approves directly from DRAFT without submit", async () => {
    const row = baseRow();
    mockFindUnique.mockResolvedValue(row);
    mockUpdate.mockResolvedValue({
      ...row,
      status: ProspectusReviewStatus.APPROVED,
      content_version: 2,
      approved_publication_id: "pub-1",
      render_fingerprint: "fp-1",
    });

    const result = await service.approve("note-1", actor);
    expect(result.status).toBe("APPROVED");
    expect(mockPublicationCreate).toHaveBeenCalled();
    expect(service.submitForReview).toBeUndefined();
  });

  it("keeps APPROVED when saving identical draft content", async () => {
    const draft = completeDraft();
    const row = baseRow({
      status: ProspectusReviewStatus.APPROVED,
      draft_content: draft,
      approved_content: draft,
      approved_snapshot: { publication_id: "pub-1" },
      approved_publication_id: "pub-1",
      render_fingerprint: "fp-1",
    });
    mockFindUnique.mockResolvedValue(row);

    const result = await service.saveDraft(
      "note-1",
      { draftContent: draft, expectedUpdatedAt: row.updated_at.toISOString() },
      actor
    );
    expect(result.status).toBe("APPROVED");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("assertPublishAllowed rejects when not APPROVED", async () => {
    mockNoteFindUnique.mockResolvedValue({
      id: "note-1",
      created_at: new Date("2026-07-20T00:00:00.000Z"),
      prospectus_review: { id: "rev-1", status: ProspectusReviewStatus.DRAFT },
    });
    await expect(service.assertPublishAllowed("note-1")).rejects.toBeInstanceOf(AppError);
  });

  it("does not expose submit or reopen methods", () => {
    expect((service as { submitForReview?: unknown }).submitForReview).toBeUndefined();
    expect((service as { reopen?: unknown }).reopen).toBeUndefined();
  });
});
