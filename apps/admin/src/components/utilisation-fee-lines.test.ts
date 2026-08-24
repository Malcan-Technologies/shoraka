import {
  additionalFeeKindLabel,
  CONVERT_TO_CURRENT_FEE_SCHEDULE_LABEL,
  convertGrandfatherOfferToCurrentV1,
  emptyAdditionalFeeLine,
  FACILITY_FEE_AVAILABLE_FOR_OFFER_LABEL,
  FACILITY_FEE_COLLECT_REQUIRED_MESSAGE,
  remainingFacilityFeeAfterCollect,
  GRANDFATHER_OFFER_FEE_CONFIRMATION,
  INVOICE_OFFER_CONFIRM_INVOICE_MISSING_MESSAGE,
  INVOICE_OFFER_CONFIRM_REFRESH_FAILED_MESSAGE,
  INVOICE_OFFER_CONFIRM_REFRESHING_MESSAGE,
  facilityFeeCollectExceedsAvailableMessage,
  invoiceOfferFacilityFeeCollectEnabled,
  invoiceOfferConfirmSubmitBlocked,
  invoiceOfferConfirmUiBlocked,
  invoiceOfferFeeFingerprint,
  parseInvoiceOfferFeeEditorState,
  resolveInvoiceOfferConfirmGuard,
  resolveInvoiceOfferConfirmRefreshStart,
  resolveInvoiceOfferConfirmUiMessage,
  parseOfferFeeSchedule,
  resolveDrawdownFeeRateForSend,
  resolveInvoiceOfferFacilityFeeRemaining,
  resyncInvoiceFeeEditorBook,
  summariseUtilisationFees,
  toSendInvoiceOfferFeeFields,
  utilisationFeeScheduleIssues,
  utilisationFeeSendBlockedReason,
} from "./utilisation-fee-lines";

describe("parseOfferFeeSchedule", () => {
  it("leaves collect unset when the offer has no fee schedule", () => {
    expect(parseOfferFeeSchedule({ offered_amount: 10_000 })).toEqual({
      facilityFeeCollectAmount: null,
      additionalFees: [],
    });
  });

  it("reads collect amount and extra lines from a frozen offer", () => {
    expect(
      parseOfferFeeSchedule({
        fee_schedule_version: 1,
        facility_fee_collect_amount: 800,
        additional_fees: [{ name: "Legal", kind: "amount", value: 50 }],
      })
    ).toEqual({
      facilityFeeCollectAmount: 800,
      additionalFees: [{ name: "Legal", kind: "amount", value: 50 }],
    });
  });
});

describe("invoice offer fee editor mode", () => {
  it("treats a brand-new offer as current v1 and a sent unversioned offer as grandfather", () => {
    expect(parseInvoiceOfferFeeEditorState(null)).toEqual({
      mode: "v1",
      schedule: { facilityFeeCollectAmount: null, additionalFees: [] },
    });
    expect(
      parseInvoiceOfferFeeEditorState({
        offered_amount: 40_000,
        sent_at: "2026-01-01T00:00:00.000Z",
        version: 1,
      })
    ).toEqual({
      mode: "grandfather",
      schedule: { facilityFeeCollectAmount: null, additionalFees: [] },
    });
    expect(
      parseInvoiceOfferFeeEditorState({
        fee_schedule_version: 1,
        facility_fee_collect_amount: 25,
        additional_fees: [],
        offered_amount: 40_000,
      })
    ).toEqual({
      mode: "v1",
      schedule: { facilityFeeCollectAmount: 25, additionalFees: [] },
    });
  });

  it("converts grandfather to an empty current v1 schedule without inferring a progressive amount", () => {
    expect(convertGrandfatherOfferToCurrentV1()).toEqual({
      mode: "v1",
      schedule: { facilityFeeCollectAmount: null, additionalFees: [] },
    });
    expect(CONVERT_TO_CURRENT_FEE_SCHEDULE_LABEL).toBe("Use current fee schedule");
  });

  it("posts preserve_grandfather for untouched grandfather and v1 including RM0 after conversion", () => {
    expect(
      toSendInvoiceOfferFeeFields({
        mode: "grandfather",
        schedule: { facilityFeeCollectAmount: 0, additionalFees: [] },
      })
    ).toEqual({
      feeScheduleMode: "preserve_grandfather",
      facilityFeeCollectAmount: 0,
      additionalFees: [],
    });
    expect(
      toSendInvoiceOfferFeeFields({
        mode: "v1",
        schedule: { facilityFeeCollectAmount: null, additionalFees: [] },
      })
    ).toEqual({
      feeScheduleMode: "v1",
      facilityFeeCollectAmount: 0,
      additionalFees: [],
    });
    expect(GRANDFATHER_OFFER_FEE_CONFIRMATION).toMatch(/grandfather progressive/i);
  });
});

describe("invoice fee editor bookkeeping", () => {
  it("resyncs when the server fee fingerprint changes and keeps edits when it does not", () => {
    const grandfather = {
      id: "inv-1",
      offer_details: { offered_amount: 40_000, sent_at: "2026-01-01", version: 1 },
    };
    const initial = resyncInvoiceFeeEditorBook({ states: {}, fingerprints: {} }, [grandfather]);
    expect(initial.states["inv-1"]?.mode).toBe("grandfather");
    const edited = {
      ...initial,
      states: {
        "inv-1": convertGrandfatherOfferToCurrentV1(),
      },
    };
    const sameFingerprint = resyncInvoiceFeeEditorBook(edited, [
      { ...grandfather, offer_details: { ...grandfather.offer_details, risk_rating: "A" } },
    ]);
    expect(sameFingerprint.states["inv-1"]?.mode).toBe("v1");
    expect(invoiceOfferFeeFingerprint(grandfather.offer_details)).toBe(
      invoiceOfferFeeFingerprint({ ...grandfather.offer_details, risk_rating: "A" })
    );

    const afterSend = resyncInvoiceFeeEditorBook(sameFingerprint, [
      {
        id: "inv-1",
        offer_details: {
          fee_schedule_version: 1,
          facility_fee_collect_amount: 0,
          additional_fees: [],
        },
      },
    ]);
    expect(afterSend.states["inv-1"]?.mode).toBe("v1");
    expect(afterSend.fingerprints["inv-1"]).not.toBe(sameFingerprint.fingerprints["inv-1"]);

    const cleaned = resyncInvoiceFeeEditorBook(afterSend, []);
    expect(cleaned.states).toEqual({});
    expect(cleaned.fingerprints).toEqual({});
  });
});

describe("resolveDrawdownFeeRateForSend", () => {
  it("uses the draft the send handler would post, including empty and invalid drafts", () => {
    expect(
      resolveDrawdownFeeRateForSend({ committedPercent: 1, draft: undefined, capPercent: 5 })
    ).toBe(1);
    expect(resolveDrawdownFeeRateForSend({ committedPercent: 1, draft: "2.5", capPercent: 5 })).toBe(
      2.5
    );
    expect(resolveDrawdownFeeRateForSend({ committedPercent: 1, draft: "", capPercent: 5 })).toBe(0);
    expect(resolveDrawdownFeeRateForSend({ committedPercent: 1, draft: "9", capPercent: 5 })).toBe(5);
    expect(resolveDrawdownFeeRateForSend({ committedPercent: 1, draft: ".", capPercent: 5 })).toBe(1);
  });

  it("blocks send against the draft rate that would be submitted", () => {
    const schedule = { facilityFeeCollectAmount: 50, additionalFees: [] };
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 100,
        platformFeeRatePercent: 0,
        schedule,
        collectEnabled: true,
      })
    ).toBeNull();
    const draftRate = resolveDrawdownFeeRateForSend({
      committedPercent: 0,
      draft: "40",
      capPercent: 100,
    });
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 100,
        platformFeeRatePercent: draftRate,
        schedule,
        collectEnabled: true,
      })
    ).toMatch(/80%/);
  });
});

describe("additionalFeeKindLabel", () => {
  it("labels fixed and percent kinds", () => {
    expect(additionalFeeKindLabel("amount")).toBe("Fixed amount (RM)");
    expect(additionalFeeKindLabel("percent_of_funded")).toBe("% of funds raised");
  });
});

describe("emptyAdditionalFeeLine", () => {
  it("starts a blank named line that still needs a name", () => {
    expect(emptyAdditionalFeeLine()).toEqual({ name: "", kind: "amount", value: 0 });
  });
});

describe("summariseUtilisationFees", () => {
  it("shows drawdown, facility, and extra lines at full funding and 80% minimum", () => {
    const totals = summariseUtilisationFees({
      offeredAmount: 10_000,
      platformFeeRatePercent: 2,
      schedule: {
        facilityFeeCollectAmount: 100,
        additionalFees: [
          { name: "Legal", kind: "amount", value: 50 },
          { name: "Admin", kind: "percent_of_funded", value: 1 },
        ],
      },
    });
    expect(totals.minimumPercent).toBe(80);
    expect(totals.full.drawdownFee).toBe(200);
    expect(totals.full.facilityFee).toBe(100);
    expect(totals.full.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([50, 100]);
    expect(totals.full.totalFees).toBe(450);
    expect(totals.full.net).toBe(9_550);
    expect(totals.minimum.drawdownFee).toBe(160);
    expect(totals.minimum.facilityFee).toBe(100);
    expect(totals.minimum.additionalFeeCharges.map((line) => line.chargedAmount)).toEqual([50, 80]);
    expect(totals.exceedsAtFull).toBe(false);
    expect(totals.exceedsAtMinimum).toBe(false);
  });

  it("shows entered collect in totals even when above available, while the remaining blocker still fires", () => {
    const schedule = {
      facilityFeeCollectAmount: 90,
      additionalFees: [] as [],
    };
    const totals = summariseUtilisationFees({
      offeredAmount: 100,
      platformFeeRatePercent: 0,
      schedule,
      facilityFeeRemaining: 40,
    });
    expect(totals.full.facilityFee).toBe(90);
    expect(totals.minimum.facilityFee).toBe(90);
    expect(totals.full.totalFees).toBe(90);
    expect(totals.full.net).toBe(10);
    expect(totals.exceedsAtFull).toBe(false);
    expect(totals.exceedsAtMinimum).toBe(true);
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 100,
        platformFeeRatePercent: 0,
        schedule,
        facilityFeeRemaining: 40,
        collectEnabled: true,
      })
    ).toBe(facilityFeeCollectExceedsAvailableMessage(40));
  });
});

describe("utilisationFeeScheduleIssues", () => {
  it("rejects collection above remaining and unnamed extra lines", () => {
    const issues = utilisationFeeScheduleIssues({
      schedule: {
        facilityFeeCollectAmount: 50,
        additionalFees: [{ name: "  ", kind: "amount", value: 10 }],
      },
      facilityFeeRemaining: 25,
      collectEnabled: true,
    });
    expect(issues.map((issue) => issue.path)).toEqual([
      "facilityFeeCollectAmount",
      "additionalFees.0.name",
    ]);
  });

  it("blocks facility collection when the invoice is not linked to a facility", () => {
    const issues = utilisationFeeScheduleIssues({
      schedule: { facilityFeeCollectAmount: 10, additionalFees: [] },
      collectEnabled: false,
    });
    expect(issues[0]?.message).toMatch(/facility-linked invoice/i);
  });
});

describe("utilisationFeeSendBlockedReason", () => {
  it("returns null for a valid schedule that fits full and 80% funding", () => {
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 10_000,
        platformFeeRatePercent: 1,
        schedule: { facilityFeeCollectAmount: 100, additionalFees: [] },
        facilityFeeRemaining: 500,
        collectEnabled: true,
      })
    ).toBeNull();
  });

  it("blocks send when fees exceed the 80% minimum", () => {
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 100,
        platformFeeRatePercent: 0,
        schedule: { facilityFeeCollectAmount: 90, additionalFees: [] },
        collectEnabled: true,
      })
    ).toMatch(/80%/);
  });

  it("blocks collection above sibling-reserved remaining but allows a resend of the current offer", () => {
    const siblingRemaining = resolveInvoiceOfferFacilityFeeRemaining({
      facilityFeeAvailableToReserve: 200,
    });
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 10_000,
        platformFeeRatePercent: 0,
        schedule: { facilityFeeCollectAmount: 201, additionalFees: [] },
        facilityFeeRemaining: siblingRemaining,
        collectEnabled: invoiceOfferFacilityFeeCollectEnabled({
          facilityFeeAvailableToReserve: 200,
        }),
      })
    ).toMatch(/200\.00/);
    const resendRemaining = resolveInvoiceOfferFacilityFeeRemaining({
      facilityFeeAvailableToReserve: 900,
    });
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 10_000,
        platformFeeRatePercent: 0,
        schedule: { facilityFeeCollectAmount: 800, additionalFees: [] },
        facilityFeeRemaining: resendRemaining,
        collectEnabled: true,
      })
    ).toBeNull();
  });
});

describe("invoice offer remaining from API", () => {
  it("uses the per-invoice available-to-reserve field, not gross remaining", () => {
    expect(
      resolveInvoiceOfferFacilityFeeRemaining({ facilityFeeAvailableToReserve: 200 })
    ).toBe(200);
    expect(invoiceOfferFacilityFeeCollectEnabled({ facilityFeeAvailableToReserve: 0 })).toBe(
      true
    );
    expect(invoiceOfferFacilityFeeCollectEnabled({ facilityFeeAvailableToReserve: null })).toBe(
      false
    );
    expect(FACILITY_FEE_AVAILABLE_FOR_OFFER_LABEL).toBe("Available for this offer");
    expect(facilityFeeCollectExceedsAvailableMessage(200)).toMatch(/available for this offer of 200\.00/);
  });
});

describe("facility fee collect entry", () => {
  it("blocks send until an amount is entered when fee is still available", () => {
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 10_000,
        platformFeeRatePercent: 1,
        schedule: { facilityFeeCollectAmount: null, additionalFees: [] },
        facilityFeeRemaining: 5_000,
        collectEnabled: true,
      })
    ).toBe(FACILITY_FEE_COLLECT_REQUIRED_MESSAGE);
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 10_000,
        platformFeeRatePercent: 1,
        schedule: { facilityFeeCollectAmount: 0, additionalFees: [] },
        facilityFeeRemaining: 5_000,
        collectEnabled: true,
      })
    ).toBeNull();
  });

  it("does not require an entry when nothing is left to collect", () => {
    expect(
      utilisationFeeSendBlockedReason({
        offeredAmount: 10_000,
        platformFeeRatePercent: 1,
        schedule: { facilityFeeCollectAmount: null, additionalFees: [] },
        facilityFeeRemaining: 0,
        collectEnabled: true,
      })
    ).toBeNull();
  });

  it("names the leftover for later drawdowns without changing the entered collect", () => {
    expect(remainingFacilityFeeAfterCollect(5_000, 1_000)).toBe(4_000);
    expect(remainingFacilityFeeAfterCollect(5_000, 5_000)).toBe(0);
    expect(remainingFacilityFeeAfterCollect(5_000, null)).toBeNull();
  });
});

describe("invoice offer confirm-time fee guard", () => {
  const offerDetails = {
    fee_schedule_version: 1,
    facility_fee_collect_amount: 0,
    additional_fees: [] as const,
  };
  const confirm = {
    offeredAmount: 10_000,
    platformFeeRatePercent: 1,
    feeScheduleMode: "v1" as const,
    facilityFeeCollectAmount: 800,
    additionalFees: [] as [],
    offerFingerprint: invoiceOfferFeeFingerprint(offerDetails),
  };

  it("blocks confirm after a refetch/sibling reservation lowers available-to-reserve", () => {
    const opened = resolveInvoiceOfferConfirmGuard({
      confirm,
      invoice: { offer_details: offerDetails, facilityFeeAvailableToReserve: 1_000 },
    });
    expect(opened.feeBlockedReason).toBeNull();
    expect(opened.collectEnabled).toBe(true);
    expect(opened.fingerprintStale).toBe(false);
    expect(invoiceOfferConfirmSubmitBlocked(opened)).toBe(false);

    const afterSibling = resolveInvoiceOfferConfirmGuard({
      confirm,
      invoice: { offer_details: offerDetails, facilityFeeAvailableToReserve: 200 },
    });
    expect(afterSibling.facilityFeeRemaining).toBe(200);
    expect(afterSibling.feeBlockedReason).toMatch(/200\.00/);
    expect(afterSibling.fingerprintStale).toBe(false);
    expect(invoiceOfferConfirmSubmitBlocked(afterSibling)).toBe(true);
  });

  it("prevents mutation when the frozen snapshot is invalid against live remaining", () => {
    const invalid = resolveInvoiceOfferConfirmGuard({
      confirm,
      invoice: { offer_details: offerDetails, facilityFeeAvailableToReserve: 100 },
    });
    expect(invoiceOfferConfirmSubmitBlocked(invalid)).toBe(true);
  });

  it("invalidates confirm when the server fee fingerprint changes after open", () => {
    const afterFingerprint = resolveInvoiceOfferConfirmGuard({
      confirm,
      invoice: {
        offer_details: {
          fee_schedule_version: 1,
          facility_fee_collect_amount: 50,
          additional_fees: [],
        },
        facilityFeeAvailableToReserve: 1_000,
      },
    });
    expect(afterFingerprint.fingerprintStale).toBe(true);
    expect(invoiceOfferConfirmSubmitBlocked(afterFingerprint)).toBe(true);
  });

  it("blocks confirm while refresh is pending or failed, then uses live remaining", () => {
    const opened = resolveInvoiceOfferConfirmGuard({
      confirm,
      invoice: { offer_details: offerDetails, facilityFeeAvailableToReserve: 1_000 },
    });
    expect(
      invoiceOfferConfirmUiBlocked({ refreshStatus: "idle", guard: opened })
    ).toBe(true);
    expect(
      invoiceOfferConfirmUiBlocked({ refreshStatus: "pending", guard: opened })
    ).toBe(true);
    expect(
      resolveInvoiceOfferConfirmUiMessage({ refreshStatus: "pending", guard: opened })
    ).toBe(INVOICE_OFFER_CONFIRM_REFRESHING_MESSAGE);
    expect(
      invoiceOfferConfirmUiBlocked({ refreshStatus: "failed", guard: opened })
    ).toBe(true);
    expect(
      resolveInvoiceOfferConfirmUiMessage({ refreshStatus: "failed", guard: opened })
    ).toBe(INVOICE_OFFER_CONFIRM_REFRESH_FAILED_MESSAGE);
    expect(
      invoiceOfferConfirmUiBlocked({ refreshStatus: "ready", guard: opened })
    ).toBe(false);

    const afterDrop = resolveInvoiceOfferConfirmGuard({
      confirm,
      invoice: { offer_details: offerDetails, facilityFeeAvailableToReserve: 200 },
    });
    expect(
      invoiceOfferConfirmUiBlocked({ refreshStatus: "ready", guard: afterDrop })
    ).toBe(true);
    expect(
      resolveInvoiceOfferConfirmUiMessage({ refreshStatus: "ready", guard: afterDrop })
    ).toBe(facilityFeeCollectExceedsAvailableMessage(200));
  });

  it("treats a missing application id as a failed refresh, not ready", () => {
    const opened = resolveInvoiceOfferConfirmGuard({
      confirm,
      invoice: { offer_details: offerDetails, facilityFeeAvailableToReserve: 1_000 },
    });
    expect(resolveInvoiceOfferConfirmRefreshStart(undefined)).toBe("failed");
    expect(resolveInvoiceOfferConfirmRefreshStart("")).toBe("failed");
    expect(resolveInvoiceOfferConfirmRefreshStart("app_1")).toBe("pending");
    expect(
      invoiceOfferConfirmUiBlocked({
        refreshStatus: resolveInvoiceOfferConfirmRefreshStart(undefined),
        guard: opened,
      })
    ).toBe(true);
    expect(
      resolveInvoiceOfferConfirmUiMessage({
        refreshStatus: "failed",
        guard: opened,
      })
    ).toBe(INVOICE_OFFER_CONFIRM_REFRESH_FAILED_MESSAGE);
  });

  it("blocks confirm when the invoice disappears after refresh", () => {
    const missing = resolveInvoiceOfferConfirmGuard({ confirm });
    expect(missing.invoiceMissing).toBe(true);
    expect(missing.collectEnabled).toBe(false);
    expect(missing.feeBlockedReason).toBe(INVOICE_OFFER_CONFIRM_INVOICE_MISSING_MESSAGE);
    expect(invoiceOfferConfirmSubmitBlocked(missing)).toBe(true);
  });
});
