import fs from "node:fs";
import path from "node:path";
import {
  NoteFundingStatus,
  NoteInvestmentStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  type NoteDetail,
} from "@cashsouk/types";
import {
  findNoteDisbursementWithdrawal,
  isNoteDetailTabId,
  noteDetailTabStatusToken,
  noteLatePaymentTabStatusToken,
  noteProspectusNeedsReview,
  resolveNoteActivityTabToken,
  resolveNoteDetailNextAction,
  resolveNoteDisbursementTabStatus,
  resolveNoteInvestorsTabToken,
  resolveNoteLedgerTabToken,
  resolveNoteOverviewTabStatus,
  resolveNoteServicingTabStatus,
} from "./note-detail-next-action";
import { hasNoteLifecycleAdminAction } from "./note-lifecycle-actions";
import { resolveNoteSourceLinkage } from "./note-source-linkage";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function baseNote(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    id: "note-1",
    noteReference: "NOTE-001",
    title: "Demo note",
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

const approvedProspectus: NoteDetail["prospectus"] = {
  status: "APPROVED",
  displayStatus: "Approved",
  contentVersion: 1,
  lastSavedAt: null,
  approvedAt: new Date().toISOString(),
  publishedAt: null,
};

const publishedProspectus: NoteDetail["prospectus"] = {
  status: "PUBLISHED",
  displayStatus: "Published",
  contentVersion: 1,
  lastSavedAt: null,
  approvedAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
};

function issuerDisbursement(status: string): NoteDetail["withdrawals"][number] {
  return {
    id: "wd-1",
    withdrawalType: "ISSUER_DISBURSEMENT",
    status,
  } as unknown as NoteDetail["withdrawals"][number];
}

/** Funded note that has cleared disbursement and started servicing. */
function servicingNote(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return baseNote({
    status: NoteStatus.ACTIVE,
    listingStatus: NoteListingStatus.PUBLISHED,
    fundingStatus: NoteFundingStatus.FUNDED,
    servicingStatus: NoteServicingStatus.CURRENT,
    publishedAt: new Date().toISOString(),
    prospectus: publishedProspectus,
    withdrawals: [issuerDisbursement("COMPLETED")],
    fundedAmount: 100000,
    fundingPercent: 100,
    ...overrides,
  });
}

describe("resolveNoteDetailNextAction priority", () => {
  it("1. sends a draft prospectus to the review page", () => {
    const action = resolveNoteDetailNextAction(baseNote());
    expect(action.tabId).toBe("overview");
    expect(action.tone).toBe("action");
    expect(action.title).toBe("Prospectus approval required");
    expect(action.ctaLabel).toBe("Review prospectus");
    expect(action.href).toBe("/notes/note-1/prospectus");
  });

  it("1. sends an available lifecycle action to Overview", () => {
    const action = resolveNoteDetailNextAction(
      baseNote({ prospectus: approvedProspectus })
    );
    expect(action.tabId).toBe("overview");
    expect(action.tone).toBe("action");
    expect(action.title).toContain("Publish to Marketplace");
  });

  it("2. prefers Disbursement once funding is closed and the payout is incomplete", () => {
    const action = resolveNoteDetailNextAction(
      baseNote({
        status: NoteStatus.FUNDING,
        listingStatus: NoteListingStatus.PUBLISHED,
        fundingStatus: NoteFundingStatus.FUNDED,
        publishedAt: new Date().toISOString(),
        prospectus: publishedProspectus,
        withdrawals: [issuerDisbursement("DRAFT")],
        fundedAmount: 100000,
        fundingPercent: 100,
      })
    );
    expect(action.tabId).toBe("disbursement");
    expect(action.tone).toBe("action");
  });

  it("2. does not raise a yellow banner while disbursement waits on the trustee", () => {
    const note = baseNote({
      status: NoteStatus.FUNDING,
      listingStatus: NoteListingStatus.PUBLISHED,
      fundingStatus: NoteFundingStatus.FUNDED,
      publishedAt: new Date().toISOString(),
      prospectus: publishedProspectus,
      withdrawals: [issuerDisbursement("SUBMITTED_TO_TRUSTEE")],
      fundedAmount: 100000,
      fundingPercent: 100,
    });
    expect(resolveNoteDisbursementTabStatus(note)).toBe("in-progress");
    const action = resolveNoteDetailNextAction(note);
    expect(action.tone).toBe("neutral");
    expect(action.tabId).not.toBe("disbursement");
  });

  it("2. does not point at Disbursement once the payout is COMPLETED", () => {
    const action = resolveNoteDetailNextAction(servicingNote());
    expect(action.tabId).not.toBe("disbursement");
  });

  it("3. prefers Late Payment over Servicing when the note is in arrears", () => {
    const note = servicingNote({
      servicingStatus: NoteServicingStatus.ARREARS,
      // Past the 7-day grace period but inside the 14-day arrears threshold.
      maturityDate: daysFromNow(-15),
    });
    // Servicing would also flag arrears, so this asserts the priority order.
    expect(resolveNoteServicingTabStatus(note)).toBe("needs-action");

    const action = resolveNoteDetailNextAction(note);
    expect(action.tabId).toBe("late-payment");
    expect(action.title).toBe("Note is in arrears");
  });

  it("3. flags default eligibility on Late Payment", () => {
    const action = resolveNoteDetailNextAction(
      servicingNote({
        servicingStatus: NoteServicingStatus.ARREARS,
        maturityDate: daysFromNow(-120),
      })
    );
    expect(action.tabId).toBe("late-payment");
    expect(action.title).toBe("Note is eligible for default");
  });

  it("3. leaves a note inside its grace period out of Late Payment", () => {
    const action = resolveNoteDetailNextAction(
      servicingNote({ maturityDate: daysFromNow(-2) })
    );
    expect(action.tabId).not.toBe("late-payment");
  });

  it("4. does not raise a yellow banner while servicing waits on repayment", () => {
    const note = servicingNote({ maturityDate: daysFromNow(10) });
    expect(resolveNoteServicingTabStatus(note)).toBe("in-progress");
    expect(resolveNoteDetailNextAction(note).tone).toBe("neutral");
  });

  it("4. falls back to Servicing for pending receipts", () => {
    const note = servicingNote({
      maturityDate: daysFromNow(10),
      payments: [{ id: "pay-1", status: "PENDING", receiptAmount: 1000 }] as never,
    });
    const action = resolveNoteDetailNextAction(note);
    expect(action.tabId).toBe("servicing");
    expect(action.tone).toBe("action");
  });

  it("4. falls back to Servicing for an unposted settlement", () => {
    const note = servicingNote({
      maturityDate: daysFromNow(10),
      settlements: [{ id: "set-1", status: "PREVIEW" }] as never,
    });
    expect(resolveNoteDetailNextAction(note).tabId).toBe("servicing");
  });

  it("does not treat Fail Funding as a yellow next action while published", () => {
    const note = baseNote({
      status: NoteStatus.PUBLISHED,
      listingStatus: NoteListingStatus.PUBLISHED,
      fundingStatus: NoteFundingStatus.OPEN,
      publishedAt: new Date().toISOString(),
      prospectus: publishedProspectus,
      fundingPercent: 10,
      fundedAmount: 10000,
      investments: [{ id: "inv-1" }] as never,
    });
    const action = resolveNoteDetailNextAction(note);
    expect(hasNoteLifecycleAdminAction(note)).toBe(false);
    expect(action.tone).toBe("neutral");
    expect(action.title).not.toContain("Fail Funding");
    expect(resolveNoteOverviewTabStatus(note)).toBe("in-progress");
  });

  it("1. surfaces Close Funding once the minimum is met", () => {
    const action = resolveNoteDetailNextAction(
      baseNote({
        status: NoteStatus.PUBLISHED,
        listingStatus: NoteListingStatus.PUBLISHED,
        fundingStatus: NoteFundingStatus.OPEN,
        publishedAt: new Date().toISOString(),
        prospectus: publishedProspectus,
        fundingPercent: 95,
        fundedAmount: 95000,
        investments: [{ id: "inv-1" }] as never,
      })
    );
    expect(action.tabId).toBe("overview");
    expect(action.tone).toBe("action");
    expect(action.title).toContain("Close Funding");
  });

  it("5. returns neutral for a fully settled note", () => {
    const action = resolveNoteDetailNextAction(
      servicingNote({
        status: NoteStatus.REPAID,
        servicingStatus: NoteServicingStatus.SETTLED,
        maturityDate: daysFromNow(-5),
      })
    );
    expect(action.tone).toBe("neutral");
    expect(action.tabId).toBe("overview");
  });
});

describe("note detail tab identity and dots", () => {
  it("accepts only the known tab ids", () => {
    expect(isNoteDetailTabId("overview")).toBe(true);
    expect(isNoteDetailTabId("disbursement")).toBe(true);
    expect(isNoteDetailTabId("servicing")).toBe(true);
    expect(isNoteDetailTabId("late-payment")).toBe(true);
    expect(isNoteDetailTabId("investors")).toBe(true);
    expect(isNoteDetailTabId("ledger")).toBe(true);
    expect(isNoteDetailTabId("activity")).toBe(true);
    expect(isNoteDetailTabId("servicing-settlement")).toBe(false);
    expect(isNoteDetailTabId("")).toBe(false);
  });

  it("uses yellow for admin action, blue for waiting, and green for done", () => {
    expect(noteDetailTabStatusToken("needs-action")).toBe("action");
    expect(noteDetailTabStatusToken("in-progress")).toBe("submitted");
    expect(noteDetailTabStatusToken("done")).toBe("success");
    expect(noteDetailTabStatusToken("not-started")).toBe("neutral");
    expect(noteDetailTabStatusToken("view-only")).toBe("neutral");
  });

  it("maps late payment phases onto admin status tokens", () => {
    expect(noteLatePaymentTabStatusToken("not-available")).toBe("neutral");
    expect(noteLatePaymentTabStatusToken("not-needed")).toBe("success");
    expect(noteLatePaymentTabStatusToken("in-grace")).toBe("action");
    expect(noteLatePaymentTabStatusToken("arrears")).toBe("action");
    expect(noteLatePaymentTabStatusToken("default-eligible")).toBe("action");
    expect(noteLatePaymentTabStatusToken("defaulted")).toBe("rejected");
  });

  it("marks Overview as needing action only while the lifecycle waits on admin", () => {
    expect(noteProspectusNeedsReview(baseNote())).toBe(true);
    expect(resolveNoteOverviewTabStatus(baseNote())).toBe("in-progress");
    expect(
      resolveNoteOverviewTabStatus(baseNote({ prospectus: approvedProspectus }))
    ).toBe("needs-action");
    expect(resolveNoteOverviewTabStatus(servicingNote())).toBe("in-progress");
    expect(hasNoteLifecycleAdminAction(baseNote({ prospectus: approvedProspectus }))).toBe(true);
    expect(
      hasNoteLifecycleAdminAction(
        baseNote({
          status: NoteStatus.PUBLISHED,
          listingStatus: NoteListingStatus.PUBLISHED,
          fundingStatus: NoteFundingStatus.OPEN,
          prospectus: publishedProspectus,
          fundingPercent: 10,
        })
      )
    ).toBe(false);
  });

  it("derives the disbursement dot from the issuer payout instruction", () => {
    expect(resolveNoteDisbursementTabStatus(baseNote())).toBe("not-started");
    expect(
      resolveNoteDisbursementTabStatus(baseNote({ withdrawals: [issuerDisbursement("DRAFT")] }))
    ).toBe("needs-action");
    expect(
      resolveNoteDisbursementTabStatus(
        baseNote({ withdrawals: [issuerDisbursement("SUBMITTED_TO_TRUSTEE")] })
      )
    ).toBe("in-progress");
    expect(
      resolveNoteDisbursementTabStatus(baseNote({ withdrawals: [issuerDisbursement("COMPLETED")] }))
    ).toBe("done");
  });

  it("derives the servicing dot from admin vs issuer work", () => {
    expect(resolveNoteServicingTabStatus(baseNote())).toBe("not-started");
    expect(
      resolveNoteServicingTabStatus(servicingNote({ maturityDate: daysFromNow(10) }))
    ).toBe("in-progress");
    expect(
      resolveNoteServicingTabStatus(
        servicingNote({
          maturityDate: daysFromNow(10),
          payments: [{ id: "pay-1", status: "PENDING", receiptAmount: 1000 }] as never,
        })
      )
    ).toBe("needs-action");
    expect(
      resolveNoteServicingTabStatus(
        servicingNote({
          status: NoteStatus.REPAID,
          servicingStatus: NoteServicingStatus.SETTLED,
        })
      )
    ).toBe("done");
  });

  it("ignores cancelled issuer-disbursement instructions for status and action", () => {
    const cancelledOnly = baseNote({ withdrawals: [issuerDisbursement("CANCELLED")] });
    expect(findNoteDisbursementWithdrawal(cancelledOnly)).toBeNull();
    expect(resolveNoteDisbursementTabStatus(cancelledOnly)).toBe("not-started");

    const cancelledThenDraft = baseNote({
      withdrawals: [
        issuerDisbursement("CANCELLED"),
        { ...issuerDisbursement("DRAFT"), id: "wd-2" },
      ],
    });
    expect(findNoteDisbursementWithdrawal(cancelledThenDraft)?.id).toBe("wd-2");
    expect(resolveNoteDisbursementTabStatus(cancelledThenDraft)).toBe("needs-action");

    const fundedWithCancelled = baseNote({
      status: NoteStatus.FUNDING,
      listingStatus: NoteListingStatus.PUBLISHED,
      fundingStatus: NoteFundingStatus.FUNDED,
      publishedAt: new Date().toISOString(),
      prospectus: publishedProspectus,
      withdrawals: [issuerDisbursement("CANCELLED")],
      fundedAmount: 100000,
      fundingPercent: 100,
    });
    expect(resolveNoteDisbursementTabStatus(fundedWithCancelled)).toBe("not-started");
    expect(resolveNoteDetailNextAction(fundedWithCancelled).tabId).toBe("disbursement");
  });

  it("dots Investors from commitment state and Ledger from lifecycle", () => {
    expect(resolveNoteInvestorsTabToken(baseNote())).toBe("neutral");
    expect(
      resolveNoteInvestorsTabToken(
        baseNote({
          status: NoteStatus.PUBLISHED,
          fundingStatus: NoteFundingStatus.OPEN,
          prospectus: publishedProspectus,
        })
      )
    ).toBe("submitted");
    expect(
      resolveNoteInvestorsTabToken(
        servicingNote({
          investments: [
            { id: "inv-1", status: NoteInvestmentStatus.COMMITTED },
            { id: "inv-2", status: NoteInvestmentStatus.CONFIRMED },
          ] as never,
        })
      )
    ).toBe("submitted");
    expect(
      resolveNoteInvestorsTabToken(
        servicingNote({
          investments: [{ id: "inv-1", status: NoteInvestmentStatus.CONFIRMED }] as never,
        })
      )
    ).toBe("active");
    expect(resolveNoteLedgerTabToken(baseNote())).toBe("neutral");
    expect(resolveNoteLedgerTabToken(servicingNote())).toBe("active");
    expect(
      resolveNoteLedgerTabToken(
        servicingNote({
          status: NoteStatus.REPAID,
          servicingStatus: NoteServicingStatus.SETTLED,
        })
      )
    ).toBe("success");
    expect(
      resolveNoteLedgerTabToken(
        servicingNote({
          status: NoteStatus.ARREARS,
          servicingStatus: NoteServicingStatus.ARREARS,
        })
      )
    ).toBe("rejected");
    expect(resolveNoteActivityTabToken(baseNote())).toBe("neutral");
    expect(
      resolveNoteActivityTabToken(baseNote({ events: [{ id: "evt-1" }] as never }))
    ).toBe("submitted");
    expect(
      resolveNoteActivityTabToken(
        servicingNote({
          status: NoteStatus.REPAID,
          servicingStatus: NoteServicingStatus.SETTLED,
          events: [{ id: "evt-1" }] as never,
        })
      )
    ).toBe("success");
  });
});

describe("standalone vs contract-linked notes", () => {
  it("labels a note without a source contract as standalone", () => {
    const linkage = resolveNoteSourceLinkage({ sourceContractId: null });
    expect(linkage.isStandalone).toBe(true);
    expect(linkage.typeLabel).toBe("Standalone note");
    expect(linkage.contractId).toBeNull();
    expect(linkage.contractHref).toBeNull();
  });

  it("treats a blank contract id as standalone", () => {
    expect(resolveNoteSourceLinkage({ sourceContractId: "   " }).isStandalone).toBe(true);
  });

  it("links a contract-funded note to its contract", () => {
    const linkage = resolveNoteSourceLinkage({ sourceContractId: "contract 7/A" });
    expect(linkage.isStandalone).toBe(false);
    expect(linkage.typeLabel).toBe("Under contract");
    expect(linkage.contractId).toBe("contract 7/A");
    expect(linkage.contractHref).toBe("/contracts/contract%207%2FA");
  });

  it("hides the source rail Contract row only when standalone", () => {
    const panelSource = fs.readFileSync(
      path.join(__dirname, "../components/source-application-panel.tsx"),
      "utf8"
    );
    expect(panelSource).toContain("resolveNoteSourceLinkage");
    expect(panelSource).toContain("linkage.isStandalone ? null : (");
    expect(panelSource).toContain('label="Contract ID"');
    expect(panelSource).toContain("Quick Links");
    expect(panelSource).not.toContain("Source Application");
  });

  it("keeps the type chip and drops the duplicated metric and workflow cards on the detail page", () => {
    const pageSource = fs.readFileSync(
      path.join(__dirname, "../../app/notes/[id]/page.tsx"),
      "utf8"
    );
    expect(pageSource).toContain("resolveNoteSourceLinkage");
    expect(pageSource).toContain("linkage.typeLabel");
    expect(pageSource).toContain("linkage.contractHref");
    expect(pageSource).toContain('status="neutral"');
    expect(pageSource).toContain("AdminMetricProgress");
    expect(pageSource).toContain("getNoteCommercialTermRows");
    expect(pageSource).toContain("@/notes/utils/note-commercial-terms");
    expect(pageSource).toContain('setActiveTab("investors")');
    expect(pageSource).toContain("note.investments.length");
    expect(pageSource).toContain("isNoteActiveLoan");
    expect(pageSource).toContain("Settlement amount");
    expect(pageSource).toContain("Payment due");
    expect(pageSource).toContain('label: "Investors"');
    expect(pageSource).toContain("getNotePaymentDueDate");
    expect(pageSource).toContain("formatPaymentDueHint");
    expect(pageSource).toContain("isNoteSettlementPosted");
    expect(pageSource).toContain("maturityCountdownClass(paymentDueDays");
    expect(pageSource).not.toContain("getNoteFundingStatusLabel");
    expect(pageSource).not.toContain("showDetail");
    expect(pageSource).not.toContain("expandLabel");
    expect(pageSource).not.toContain("expandableContent");
    expect(pageSource).not.toContain("extraLabel");
    expect(pageSource).not.toContain("NoteTermsPanel");
    expect(pageSource).not.toContain('title="Commercial terms"');
    expect(pageSource).not.toContain('status="submitted"');
    expect(pageSource).not.toContain("Invoice Amount");
    expect(pageSource).not.toContain("Invoice amount");
    expect(pageSource).not.toContain("Risk Rating");
    expect(pageSource).not.toContain("Paymaster");
    expect(pageSource).not.toContain("Workflow Status");
    expect(pageSource).toContain("resolveNoteInvestorsTabToken");
    expect(pageSource).toContain("resolveNoteLedgerTabToken");
    expect(pageSource).toContain("resolveNoteActivityTabToken");
    expect(pageSource).toContain('id: "activity"');
    expect(pageSource).toContain("layout=\"rail\"");
    expect(pageSource).toContain("ctaLabel={nextAction.ctaLabel}");
    expect(pageSource).toContain("icon={MapIcon}");
    expect(pageSource).toContain("icon={BanknotesIcon}");
    expect(pageSource).not.toContain("ExclamationTriangleIcon");
    expect(pageSource).not.toContain('title="Investors"');
    expect(pageSource).not.toContain('title="Ledger"');
    expect(pageSource).not.toContain('title="Activity"');
  });

  it("replaces completed workflow titles instead of stacking an uppercase caption", () => {
    const payout = fs.readFileSync(
      path.join(__dirname, "../components/issuer-payout-card.tsx"),
      "utf8"
    );
    const settlement = fs.readFileSync(
      path.join(__dirname, "../components/settlement-panel.tsx"),
      "utf8"
    );
    expect(payout).toContain("WorkflowStepTitle");
    expect(payout).toContain("payoutComplete ? null : (");
    expect(settlement).toContain("WorkflowStepTitle");
    expect(settlement).toContain("serviceFeeTrusteeWorkflowComplete ? null : (");
    expect(settlement).toContain('completeLabel="Late fees complete"');
    expect(settlement).toContain('completeLabel="Default complete"');
    expect(settlement).toContain("PaymentReceiptIdentity");
    expect(settlement).toContain("formatLedgerBucketLabel");
    expect(settlement).toContain("paymentReceiptStatusLabel");
    expect(settlement).not.toContain("receivedIntoAccountCode}");
  });
});

describe("?tab= synchronisation contract", () => {
  const hookSource = fs.readFileSync(
    path.join(__dirname, "../../components/admin-detail/use-admin-detail-tab-state.ts"),
    "utf8"
  );

  it("reads the tab param without useSearchParams so no Suspense boundary is required", () => {
    const navigationImport =
      hookSource.match(/import \{[^}]*\} from "next\/navigation";/)?.[0] ?? "";
    expect(navigationImport).toContain("useRouter");
    expect(navigationImport).not.toContain("useSearchParams");
    expect(hookSource).toContain("new URLSearchParams(window.location.search)");
  });

  it("replaces the URL without scrolling and keeps unrelated params", () => {
    expect(hookSource).toContain("router.replace");
    expect(hookSource).toContain("scroll: false");
    expect(hookSource).toContain("params.set(paramName, activeTab)");
  });

  it("only adopts the computed tab while nothing is selected, so a user choice persists", () => {
    expect(hookSource).toContain("if (activeTab != null || computedTab == null) return;");
  });

  it("auto-selects the resolver tab on the notes page", () => {
    const pageSource = fs.readFileSync(
      path.join(__dirname, "../../app/notes/[id]/page.tsx"),
      "utf8"
    );
    expect(pageSource).toContain("useAdminDetailTabState<NoteDetailTabId>");
    expect(pageSource).toContain("isValidTab: isNoteDetailTabId");
    expect(pageSource).toContain("computedTab: nextAction?.tabId ?? null");
  });

  it("resets the selected tab when the pathname changes to another record", () => {
    expect(hookSource).toContain("if (tabPath !== pathname)");
    expect(hookSource).toContain("setTabPath(pathname)");
  });

  it("keeps one SettlementPanel mounted so servicing form state survives tab switches without duplicate dialogs", () => {
    const pageSource = fs.readFileSync(
      path.join(__dirname, "../../app/notes/[id]/page.tsx"),
      "utf8"
    );
    expect(pageSource).toContain("<SettlementPanel");
    expect(pageSource.match(/<SettlementPanel/g)?.length).toBe(1);
    expect(pageSource).toContain('section={resolvedTab === "late-payment" ? "late-payment" : "settlement"}');
    expect(pageSource).toContain('<AdminDetailTabPanel value="investors" preserveMount>');
    expect(pageSource).toContain('<AdminDetailTabPanel value="ledger" preserveMount>');
    expect(pageSource).not.toContain('<AdminDetailTabPanel value="servicing" preserveMount>');
    expect(pageSource).not.toContain('<AdminDetailTabPanel value="late-payment" preserveMount>');
  });
});
