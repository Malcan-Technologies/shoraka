/**
 * SECTION: Prospectus finalization on Note publish
 * WHY: Validate READY_FOR_PUBLISH -> publish-time PDF generation uses listing opens/closes.
 */

import { ProspectusReviewService } from "./prospectus-review.service";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import {
  toProspectusPublicationContent,
  type ProspectusReviewStoredContent,
} from "./prospectus-review-content";

import type { ProspectusApprovedSnapshot } from "./prospectus-approved-snapshot";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    note: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../prospectus/prospectus-pdf", () => ({
  generateAndStoreProspectusPdf: jest.fn(async () => ({
    storageBucket: "b",
    storageKey: "k",
    contentType: "application/pdf",
    sizeBytes: 1,
    sha256: "a".repeat(64),
    generatedAt: new Date("2026-07-19T00:00:00.000Z"),
    generationStatus: "READY",
    snapshotHash: "ignored-by-test",
    pageCount: 3,
  })),
}));

// Keep HTML/PDF rebuild deterministic and easy to assert.
jest.mock("../prospectus/prospectus-page-one.html", () => ({
  buildProspectusPageOneHtml: jest.fn((page: any) => {
    const d = page.datesPaymaster;
    return `PAGE1:${d?.listingDate ?? ""}|${d?.closingDate ?? ""}`;
  }),
}));

jest.mock("../prospectus/prospectus-page-one-mapper", () => ({
  mapProspectusPageOneDataToInput: jest.fn(async () => ({
    publicationContent: undefined,
    trackRecordMode: "frozen_publication_snapshot",
    page1TrackRecordSnapshot: {},
  })),
  buildProspectusPageOne: jest.fn(() => ({
    datesPaymaster: { listingDate: "LIST_DATE", closingDate: "CLOSE_DATE" },
  })),
}));

jest.mock("../prospectus/prospectus-page-two-mapper", () => ({
  mapProspectusPageTwoDataToInput: jest.fn(() => ({})),
  buildProspectusPageTwo: jest.fn(() => ({})),
}));

jest.mock("../prospectus/prospectus-page-two.html", () => ({
  buildProspectusPageTwoHtml: jest.fn(() => "<p>p2</p>"),
}));

jest.mock("../prospectus/prospectus-page-three-mapper", () => ({
  mapProspectusPageThreeDataToInput: jest.fn(() => ({})),
  buildProspectusPageThree: jest.fn(() => ({})),
}));

jest.mock("../prospectus/prospectus-page-three.html", () => ({
  buildProspectusPageThreeHtml: jest.fn(() => "<p>p3</p>"),
}));

jest.mock("../prospectus/prospectus-marc-appendix.html", () => ({
  buildProspectusPageFourHtml: jest.fn(() => "<p>p4</p>"),
  buildProspectusPageFiveHtml: jest.fn(() => "<p>p5</p>"),
}));

jest.mock("../prospectus/prospectus-page-two-prisma", () => ({
  loadProspectusPageTwoData: jest.fn(async () => ({})),
}));

jest.mock("../prospectus/prospectus-page-three-prisma", () => ({
  loadProspectusPageThreeData: jest.fn(async () => ({})),
}));

jest.mock("../prospectus/prospectus-page-one-prisma", () => ({
  loadProspectusPageOneNote: jest.fn(async () => ({ id: "note-1" })),
}));

describe("prospectus finalization for publish", () => {
  const service = new ProspectusReviewService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates a final PDF using listing opens_at/closes_at during publish", async () => {
    const { prisma } = await import("../../../lib/prisma");
    (prisma.note.findUnique as jest.Mock).mockResolvedValue({
      listing: { opens_at: new Date("2026-08-01T00:00:00.000Z"), closes_at: new Date("2026-08-15T00:00:00.000Z") },
    });

    const approvedSnapshot = {
      publication_content: {},
      render_fingerprint: "fp",
      note_identity: {},
      page_1: {},
      page_2: {},
      publication_id: "pub",
      content_version: 1,
      calculated_at: "2026-07-19T00:00:00.000Z",
      html: { page1: "", page2: "", page3: "" },
      // Remaining fields are not needed for this unit test.
    } as unknown as ProspectusApprovedSnapshot;

    const { generateAndStoreProspectusPdf } = await import("../prospectus/prospectus-pdf");

    const result = await service.generateFinalProspectusPdfForPublish({
      noteId: "note-1",
      actor: { userId: "a" },
      approvedSnapshot,
      publicationId: "pub-1",
      reviewId: "rev-1",
    });

    expect(generateAndStoreProspectusPdf).toHaveBeenCalled();
    const called = (generateAndStoreProspectusPdf as jest.Mock).mock.calls[0][0];
    expect(called.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.updatedSnapshot.html.page1).toContain("LIST_DATE");
    expect(result.updatedSnapshot.html.page1).toContain("CLOSE_DATE");
  });

  it("passes resolved publication content into Page 1 builder during publish (regression)", async () => {
    const draft: ProspectusReviewStoredContent = buildCompleteProspectusReviewDraft();
    const expectedResolved = toProspectusPublicationContent(draft);

    // The approved snapshot stores a frozen wrapper; publish-time finalization must
    // pass `resolvedPublicationContent` into the page builders (so `keyInvestorHighlights` exists).
    const approvedSnapshot = {
      publication_content: {
        resolvedPublicationContent: expectedResolved,
      },
      render_fingerprint: "fp",
      note_identity: {},
      page_1: {},
      page_2: {},
      publication_id: "pub",
      content_version: 1,
      calculated_at: new Date("2026-07-19T00:00:00.000Z").toISOString(),
      html: { page1: "", page2: "", page3: "" },
    } as unknown as ProspectusApprovedSnapshot;

    (await import("../../../lib/prisma")).prisma.note.findUnique = jest
      .fn()
      .mockResolvedValue({
        listing: {
          opens_at: new Date("2026-08-01T00:00:00.000Z"),
          closes_at: new Date("2026-08-15T00:00:00.000Z"),
        },
      });

    const { buildProspectusPageOne } = await import("../prospectus/prospectus-page-one-mapper");

    await service.generateFinalProspectusPdfForPublish({
      noteId: "note-1",
      actor: { userId: "a", correlationId: "corr" } as any,
      approvedSnapshot,
      publicationId: "pub-1",
      reviewId: "rev-1",
    });

    const passedPage1Input = (buildProspectusPageOne as jest.Mock).mock.calls[0][0];
    expect(passedPage1Input.publicationContent.keyInvestorHighlights).toBeDefined();
    expect(passedPage1Input.publicationContent.keyInvestorHighlights).toHaveLength(
      expectedResolved.keyInvestorHighlights.length
    );
    expect(passedPage1Input.publicationContent.keyInvestorHighlights).toEqual(
      expectedResolved.keyInvestorHighlights
    );
  });
});

