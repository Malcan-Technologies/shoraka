import fs from "node:fs";
import path from "node:path";
import {
  NoteFundingStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  type NoteDetail,
} from "@cashsouk/types";
import {
  WORKFLOW_CARD,
  WORKFLOW_STATUS_BADGE,
} from "@/notes/utils/workflow-status-tokens";
import { resolveProspectusStatusCard } from "./note-prospectus-status-card.model";

function baseNote(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    id: "note-1",
    noteReference: "DEMO-PROSPECTUS-001",
    title: "Demo",
    productCategory: null,
    productName: null,
    issuerIndustry: null,
    sourceApplicationId: "app-1",
    sourceContractId: null,
    sourceInvoiceId: null,
    issuerOrganizationId: "org-1",
    issuerName: null,
    paymasterName: null,
    riskRating: null,
    status: NoteStatus.DRAFT,
    listingStatus: NoteListingStatus.DRAFT,
    fundingStatus: NoteFundingStatus.NOT_OPEN,
    servicingStatus: NoteServicingStatus.NOT_STARTED,
    isFeatured: false,
    featuredRank: null,
    featuredFrom: null,
    featuredUntil: null,
    featuredActive: false,
    maturityDate: null,
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: null,
    settlementSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requestedAmount: 100000,
    invoiceAmount: 100000,
    settlementAmount: 100000,
    targetAmount: 100000,
    fundedAmount: 0,
    fundingPercent: 0,
    minimumFundingPercent: 80,
    profitRatePercent: 10,
    platformFeeRatePercent: 1.5,
    serviceFeeRatePercent: 15,
    productSnapshot: null,
    purposeSnapshot: null,
    prospectusSnapshot: null,
    issuerSnapshot: {},
    paymasterSnapshot: null,
    contractSnapshot: null,
    invoiceSnapshot: null,
    serviceFeeCustomerScope: null,
    gracePeriodDays: 7,
    arrearsThresholdDays: 14,
    tawidhRateCapPercent: 1,
    gharamahRateCapPercent: 9,
    defaultMarkedAt: null,
    defaultReason: null,
    listing: null,
    investments: [],
    paymentSchedules: [],
    payments: [],
    settlements: [],
    withdrawals: [],
    events: [],
    prospectus: {
      status: "DRAFT",
      displayStatus: "Draft",
      contentVersion: 1,
      lastSavedAt: null,
      approvedAt: null,
      publishedAt: null,
    },
    ...overrides,
  };
}

describe("resolveProspectusStatusCard", () => {
  it("Draft / approval-required uses red emphasis, original outline badge, and primary Review button", () => {
    const model = resolveProspectusStatusCard(baseNote());
    expect(model.phase).toBe("draft");
    expect(model.heading).toBe("Prospectus approval required");
    expect(model.description).toMatch(/Review and approve the prospectus/i);
    expect(model.badgeLabel).toBe("Draft");
    expect(model.primaryLabel).toBe("Review Prospectus");
    expect(model.secondaryLabel).toBeNull();
    expect(model.emphasize).toBe(true);
    expect(model.badgeTone).toBeNull();
    expect(model.actionVariant).toBe("default");
  });

  it("READY_FOR_REVIEW still treats Prospectus as approval-required (red card, original Draft badge)", () => {
    const model = resolveProspectusStatusCard(
      baseNote({
        prospectus: {
          // Legacy raw status; API normalizes to DRAFT but card must still emphasize.
          status: "READY_FOR_REVIEW" as "DRAFT" | "APPROVED" | "PUBLISHED",
          displayStatus: "Draft",
          contentVersion: 1,
          lastSavedAt: null,
          approvedAt: null,
          publishedAt: null,
        },
      })
    );
    expect(model.phase).toBe("draft");
    expect(model.emphasize).toBe(true);
    expect(model.badgeTone).toBeNull();
    expect(model.actionVariant).toBe("default");
  });

  it("Approved uses neutral card, green success badge, outline Review button", () => {
    const model = resolveProspectusStatusCard(
      baseNote({
        prospectus: {
          status: "APPROVED",
          displayStatus: "Approved",
          contentVersion: 1,
          lastSavedAt: null,
          approvedAt: new Date().toISOString(),
          publishedAt: null,
        },
      })
    );
    expect(model.phase).toBe("approved");
    expect(model.heading).toBe("Ready to publish");
    expect(model.description).toMatch(/eligible for publication/i);
    expect(model.badgeLabel).toBe("Approved");
    expect(model.primaryLabel).toBe("Review Prospectus");
    expect(model.secondaryLabel).toBeNull();
    expect(model.emphasize).toBe(false);
    expect(model.badgeTone).toBe("success");
    expect(model.actionVariant).toBe("outline");
    expect(WORKFLOW_STATUS_BADGE.success.badgeClass).toMatch(/success/);
  });

  it("Published uses neutral card, green success badge, and outline View Prospectus button", () => {
    const model = resolveProspectusStatusCard(
      baseNote({
        status: NoteStatus.PUBLISHED,
        publishedAt: new Date().toISOString(),
        listingStatus: NoteListingStatus.PUBLISHED,
        fundingStatus: NoteFundingStatus.OPEN,
        prospectus: {
          status: "PUBLISHED",
          displayStatus: "Published",
          contentVersion: 1,
          lastSavedAt: null,
          approvedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        },
      })
    );
    expect(model.phase).toBe("published");
    expect(model.heading).toBe("Published");
    expect(model.description).toMatch(/visible to investors/i);
    expect(model.badgeLabel).toBe("Published");
    expect(model.primaryLabel).toBe("View Prospectus");
    expect(model.secondaryLabel).toBeNull();
    expect(model.emphasize).toBe(false);
    expect(model.badgeTone).toBe("success");
    expect(model.actionVariant).toBe("outline");
  });

  it("does not auto-publish after approval", () => {
    const model = resolveProspectusStatusCard(
      baseNote({
        prospectus: {
          status: "APPROVED",
          displayStatus: "Approved",
          contentVersion: 1,
          lastSavedAt: null,
          approvedAt: new Date().toISOString(),
          publishedAt: null,
        },
      })
    );
    expect(model.phase).toBe("approved");
    expect(model.primaryLabel).toBe("Review Prospectus");
    expect(model.primaryLabel).not.toBe("Publish Note");
  });
});

describe("Admin Note Detail prospectus UI cleanup", () => {
  const lifecycleSource = fs.readFileSync(
    path.join(__dirname, "note-lifecycle-card.tsx"),
    "utf8"
  );
  const pageSource = fs.readFileSync(
    path.join(__dirname, "../../app/notes/[id]/page.tsx"),
    "utf8"
  );
  const cardSource = fs.readFileSync(
    path.join(__dirname, "note-prospectus-status-card.tsx"),
    "utf8"
  );

  it("no longer renders the old Publication Checklist labels", () => {
    expect(lifecycleSource).not.toContain("Publication checklist");
    expect(lifecycleSource).not.toContain("Note details ready");
    expect(lifecycleSource).not.toContain("Listing window configurable at publish");
    expect(pageSource).not.toContain("Publication checklist");
    expect(pageSource).not.toContain("Note details ready");
    expect(pageSource).not.toContain("Listing window configurable at publish");
  });

  it("wires NoteProspectusStatusCard without a second publish action", () => {
    expect(pageSource).toContain("NoteProspectusStatusCard");
    expect(pageSource).toContain("onReviewProspectus");
    expect(pageSource).not.toContain("onPublishNote");
    expect(cardSource).not.toContain("Publish Note");
    expect(cardSource).not.toContain("onPublishNote");
    expect(lifecycleSource).toContain("Publish to Marketplace");
  });

  it("maps card emphasis and button variant from status model; Approved and Published get success badge tone", () => {
    expect(cardSource).toContain("WORKFLOW_CARD.activeSection");
    expect(cardSource).toContain("model.badgeTone ? workflowBadgeClassName(model.badgeTone)");
    expect(cardSource).toContain("variant={model.actionVariant}");
    expect(WORKFLOW_CARD.activeSection).toMatch(/border-primary|bg-primary/);

    const approved = resolveProspectusStatusCard(
      baseNote({
        prospectus: {
          status: "APPROVED",
          displayStatus: "Approved",
          contentVersion: 1,
          lastSavedAt: null,
          approvedAt: new Date().toISOString(),
          publishedAt: null,
        },
      })
    );
    const published = resolveProspectusStatusCard(
      baseNote({
        status: NoteStatus.PUBLISHED,
        publishedAt: new Date().toISOString(),
        prospectus: {
          status: "PUBLISHED",
          displayStatus: "Published",
          contentVersion: 1,
          lastSavedAt: null,
          approvedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        },
      })
    );
    const draft = resolveProspectusStatusCard(baseNote());
    expect(approved.badgeTone).toBe("success");
    expect(published.badgeTone).toBe("success");
    expect(draft.badgeTone).toBeNull();
  });
});

describe("backend publication gate remains in API (unchanged by this UI work)", () => {
  it("keeps Prospectus approval required error copy in Note publish path", () => {
    const publishService = fs.readFileSync(
      path.join(__dirname, "../../../../api/src/modules/notes/service.ts"),
      "utf8"
    );
    expect(publishService).toContain("Approve the Prospectus before publishing this Note.");
    expect(publishService).toContain("getApprovedSnapshotForPublish");
    expect(publishService).toContain("structuredClone(approvedSnapshot)");
  });
});
