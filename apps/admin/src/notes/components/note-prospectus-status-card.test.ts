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
    sourceContractDisplayReference: null,
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
    investorCount: 0,
    maturityDate: null,
    listingClosesAt: null,
    activatedAt: null,
    publishedAt: null,
    fundingClosedAt: null,
    repaidAt: null,
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
    expect(model.workspaceLabel).toBe("Review Prospectus");
    expect(model.viewAvailable).toBe(false);
    expect(model.emphasize).toBe(true);
    expect(model.badgeTone).toBe("neutral");
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
    expect(model.badgeTone).toBe("neutral");
    expect(model.actionVariant).toBe("default");
  });

  it("Approved uses neutral card, green success badge, Edit Prospectus and View", () => {
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
    expect(model.workspaceLabel).toBe("Edit Prospectus");
    expect(model.viewAvailable).toBe(true);
    expect(model.emphasize).toBe(false);
    expect(model.badgeTone).toBe("success");
    expect(model.actionVariant).toBe("outline");
    expect(WORKFLOW_STATUS_BADGE.success.badgeClass).toMatch(/success/);
  });

  it("Published uses neutral card, green success badge, View PDF, and Open Review", () => {
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
    expect(model.workspaceLabel).toBe("Open Review");
    expect(model.viewAvailable).toBe(true);
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
    expect(model.workspaceLabel).toBe("Edit Prospectus");
    expect(model.workspaceLabel).not.toBe("Publish Note");
  });

  it("shows Draft after unpublish so the prospectus must be re-approved", () => {
    const model = resolveProspectusStatusCard(
      baseNote({
        status: NoteStatus.DRAFT,
        listingStatus: NoteListingStatus.UNPUBLISHED,
        publishedAt: new Date().toISOString(),
        prospectus: {
          status: "PUBLISHED",
          displayStatus: "Draft",
          contentVersion: 5,
          lastSavedAt: null,
          approvedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        },
      })
    );
    expect(model.phase).toBe("draft");
    expect(model.badgeLabel).toBe("Draft");
    expect(model.workspaceLabel).toBe("Review Prospectus");
    expect(model.viewAvailable).toBe(false);
    expect(model.emphasize).toBe(true);
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
  const lifecycleActionsSource = fs.readFileSync(
    path.join(__dirname, "../utils/note-lifecycle-actions.ts"),
    "utf8"
  );

  it("no longer renders the old Publication Checklist labels", () => {
    expect(lifecycleSource).not.toContain("Publication checklist");
    expect(lifecycleSource).not.toContain("Note details ready");
    expect(lifecycleSource).not.toContain("Listing window configurable at publish");
    expect(lifecycleSource).toContain("getNoteLifecycleStageCompletedAt");
    expect(lifecycleSource).toContain("NOTE_LIFECYCLE_STAGES");
    expect(lifecycleSource).not.toContain("buildNoteLifecycleActionPlan");
    expect(pageSource).not.toContain("Publication checklist");
    expect(pageSource).not.toContain("Note details ready");
    expect(pageSource).not.toContain("Listing window configurable at publish");
  });

  it("wires NoteProspectusStatusCard without a second publish action", () => {
    expect(pageSource).toContain("NoteProspectusStatusCard");
    expect(pageSource).toContain("onOpenWorkspace");
    expect(pageSource).toContain("onViewProspectus");
    expect(pageSource).not.toContain("onPublishNote");
    expect(cardSource).not.toContain("Publish Note");
    expect(cardSource).not.toContain("onPublishNote");
    // Marketplace publish stays on the campaign action plan, never the prospectus card.
    expect(lifecycleActionsSource).toContain("Publish to Marketplace");
    const campaignSource = fs.readFileSync(
      path.join(__dirname, "note-campaign-actions.tsx"),
      "utf8"
    );
    expect(campaignSource).toContain("buildNoteLifecycleActionPlan");
    expect(campaignSource).toContain("note-featured-toggle");
    expect(campaignSource).toContain("isNoteFeatureEligible");
    expect(campaignSource).toContain("buildInvestorCampaignUrl");
    expect(campaignSource).toContain("View live campaign");
    expect(campaignSource).not.toContain("rounded-xl border px-4 py-3");
  });

  it("maps card emphasis and button variant from status model; Approved and Published get success badge tone", () => {
    expect(cardSource).toContain("ADMIN_ACTION_SURFACE_CLASS");
    expect(cardSource).toContain("ExclamationTriangleIcon");
    expect(cardSource).toContain("workflowToneToStatusToken(model.badgeTone)");
    expect(cardSource).toContain("variant={model.actionVariant}");
    expect(cardSource).toContain("onOpenWorkspace");
    expect(cardSource).toContain("onViewProspectus");
    expect(cardSource).toContain("model.workspaceLabel");
    expect(cardSource).toContain("<CardTitle>Prospectus</CardTitle>");
    expect(cardSource).toContain("items-center justify-between");
    expect(cardSource).not.toContain("CardContent");
    expect(cardSource).not.toContain("{model.heading}");

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
    expect(draft.badgeTone).toBe("neutral");
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
