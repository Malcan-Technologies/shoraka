import {
  buildBranchResetDescription,
  buildFinancingJourneySummary,
  CONTRACT_LIFETIME_EXCEEDED,
  dualLimitOverageCopy,
  FACILITY_CAPACITY_EXCEEDED,
  FACILITY_MUST_BE_BELOW_CONTRACT_VALUE,
  facilityChooserRemaining,
  facilityImpactCopy,
  filterWorkflowStepsForOrigination,
  isEditableReservedInvoiceStatus,
  isFacilityOnlyNewContract,
  isLegacyCombinedNewContract,
  resolveAdminContractApplicationKind,
  isRequestedFacilityAtOrAboveContractValue,
  isReservedCapacityInvoiceStatus,
  isSplitOriginationApplication,
  listFinancingGoalChoices,
  mapCapacityApiError,
  NO_APPROVED_FACILITY_COPY,
  preserveSplitOriginationMarker,
  previewDualLimits,
  REQUESTED_FACILITY_BELOW_CONTRACT_COPY,
  resolveInitialFinancingGoal,
  shouldOmitInvoiceDetails,
  withSplitOriginationMarker,
} from "./split-origination";

function getStepKey(stepId: string): string | null {
  return stepId.replace(/_\d+$/, "") || null;
}

const workflow = [
  { id: "financing_type_1" },
  { id: "financing_structure_1" },
  { id: "contract_details_1" },
  { id: "invoice_details_1" },
  { id: "declarations_1" },
];

describe("split origination discriminator", () => {
  it("treats only explicitly marked applications as split", () => {
    expect(isSplitOriginationApplication({ product_id: "p1", split_origination: true })).toBe(true);
    expect(isSplitOriginationApplication({ product_id: "p1" })).toBe(false);
    expect(isSplitOriginationApplication(null)).toBe(false);
  });

  it("preserves the marker when financing_type is rewritten", () => {
    expect(
      preserveSplitOriginationMarker({ product_id: "p2" }, { product_id: "p1", split_origination: true })
    ).toEqual({ product_id: "p2", split_origination: true });
    expect(preserveSplitOriginationMarker({ product_id: "p2" }, { product_id: "p1" })).toEqual({
      product_id: "p2",
    });
  });

  it("stamps the marker at create time", () => {
    expect(withSplitOriginationMarker({ product_id: "p1", product_code: "ARF" })).toEqual({
      product_id: "p1",
      product_code: "ARF",
      split_origination: true,
    });
  });
});

describe("facility-only vs legacy combined", () => {
  it("omits invoice details only for newly created new_contract apps", () => {
    expect(
      isFacilityOnlyNewContract({
        structureType: "new_contract",
        financingType: { split_origination: true },
      })
    ).toBe(true);
    expect(
      shouldOmitInvoiceDetails({
        structureType: "new_contract",
        financingType: { split_origination: true },
      })
    ).toBe(true);
    expect(
      isLegacyCombinedNewContract({
        structureType: "new_contract",
        financingType: { product_id: "p1" },
      })
    ).toBe(true);
    expect(
      shouldOmitInvoiceDetails({
        structureType: "new_contract",
        financingType: { product_id: "p1" },
      })
    ).toBe(false);
    expect(
      shouldOmitInvoiceDetails({
        structureType: "existing_contract",
        financingType: { split_origination: true },
      })
    ).toBe(false);
  });
});

describe("resolveAdminContractApplicationKind", () => {
  it("treats the originating application as the facility application", () => {
    expect(
      resolveAdminContractApplicationKind({
        applicationId: "app-facility",
        originatingApplicationId: "app-facility",
        structureType: "new_contract",
        financingType: { split_origination: true },
        invoiceCount: 0,
      })
    ).toBe("facility");
  });

  it("treats existing_contract and invoice_only as invoice draws", () => {
    expect(
      resolveAdminContractApplicationKind({
        applicationId: "app-draw",
        originatingApplicationId: "app-facility",
        structureType: "existing_contract",
        financingType: { split_origination: true },
        invoiceCount: 1,
      })
    ).toBe("invoice");
    expect(
      resolveAdminContractApplicationKind({
        applicationId: "app-one-off",
        structureType: "invoice_only",
        invoiceCount: 1,
      })
    ).toBe("invoice");
  });

  it("treats new_contract as facility even when invoices are attached (legacy combined)", () => {
    expect(
      resolveAdminContractApplicationKind({
        applicationId: "app-combined",
        structureType: "new_contract",
        financingType: { product_id: "p1" },
        invoiceCount: 2,
      })
    ).toBe("facility");
  });

  it("falls back to invoice count when structure is missing", () => {
    expect(
      resolveAdminContractApplicationKind({
        applicationId: "app-unknown",
        invoiceCount: 1,
      })
    ).toBe("invoice");
    expect(
      resolveAdminContractApplicationKind({
        applicationId: "app-unknown",
        invoiceCount: 0,
      })
    ).toBe("facility");
  });
});

describe("filterWorkflowStepsForOrigination", () => {
  it("filters invoice_details for split new_contract and contract_details for existing_contract", () => {
    const splitNew = filterWorkflowStepsForOrigination(workflow, {
      structureType: "new_contract",
      financingType: { split_origination: true },
      getStepKey,
      finalize: (steps) => steps,
    }).map((step) => step.id);
    expect(splitNew).toEqual([
      "financing_type_1",
      "financing_structure_1",
      "contract_details_1",
      "declarations_1",
    ]);

    const legacyNew = filterWorkflowStepsForOrigination(workflow, {
      structureType: "new_contract",
      financingType: { product_id: "p1" },
      getStepKey,
      finalize: (steps) => steps,
    }).map((step) => step.id);
    expect(legacyNew).toContain("invoice_details_1");

    const existing = filterWorkflowStepsForOrigination(workflow, {
      structureType: "existing_contract",
      financingType: { split_origination: true },
      getStepKey,
      finalize: (steps) => steps,
    }).map((step) => step.id);
    expect(existing).toEqual([
      "financing_type_1",
      "financing_structure_1",
      "invoice_details_1",
      "declarations_1",
    ]);
  });
});

describe("financing goal choices", () => {
  it("exposes three goal-based choices without internal labels", () => {
    const choices = listFinancingGoalChoices({ hasApprovedFacilities: true });
    expect(choices.map((choice) => choice.id)).toEqual([
      "new_contract",
      "existing_contract",
      "invoice_only",
    ]);
    expect(choices.every((choice) => !choice.title.includes("new_contract"))).toBe(true);
    expect(choices[0].title).toBe("Set up a new facility");
    expect(choices[1].title).toBe("Finance an invoice from an approved facility");
    expect(choices[2].title).toBe("Finance one invoice without a facility");
    expect(choices.every((choice) => !choice.disabled)).toBe(true);
  });

  it("keeps the approved-facility choice visible but disabled when none exist", () => {
    const choices = listFinancingGoalChoices({ hasApprovedFacilities: false });
    const existing = choices.find((choice) => choice.id === "existing_contract");
    expect(existing?.disabled).toBe(true);
    expect(existing?.disabledReason).toBe(NO_APPROVED_FACILITY_COPY);
    expect(choices.find((choice) => choice.id === "new_contract")?.disabled).toBe(false);
  });

  it("prefills the approved-facility journey from a facility entry point", () => {
    expect(
      resolveInitialFinancingGoal({
        prefillFacilityId: "con_approved",
      })
    ).toEqual({
      structureType: "existing_contract",
      facilityId: "con_approved",
      fromPrefill: true,
    });
  });

  it("prefers a saved structure over a leftover prefill", () => {
    expect(
      resolveInitialFinancingGoal({
        savedStructureType: "new_contract",
        prefillFacilityId: "con_approved",
      })
    ).toEqual({
      structureType: "new_contract",
      facilityId: "",
      fromPrefill: false,
    });
  });
});

describe("journey summary and branch reset", () => {
  it("explains the facility-only path and the later Finance an invoice action", () => {
    const summary = buildFinancingJourneySummary("new_contract");
    expect(summary?.title).toBe("Your journey");
    expect(summary?.now).toMatch(/Invoice details are not part of this step/i);
    expect(summary?.after).toMatch(/Finance an invoice/i);
  });

  it("summarizes existing-facility and standalone invoice journeys", () => {
    expect(buildFinancingJourneySummary("existing_contract")?.now).toMatch(/one invoice/i);
    expect(buildFinancingJourneySummary("invoice_only")?.now).toMatch(/without a facility|not setting up/i);
    expect(buildFinancingJourneySummary(null)).toBeNull();
  });

  it("names the draft facility and invoice information a branch reset removes", () => {
    expect(
      buildBranchResetDescription({
        fromType: "new_contract",
        hasInvoices: true,
        hasDraftFacility: true,
      })
    ).toMatch(/draft facility details and uploaded contract files/);
    expect(
      buildBranchResetDescription({
        fromType: "new_contract",
        hasInvoices: true,
        hasDraftFacility: true,
      })
    ).toMatch(/draft invoices and their uploaded files/);
    expect(
      buildBranchResetDescription({
        fromType: "existing_contract",
        hasInvoices: true,
        hasDraftFacility: false,
      })
    ).toMatch(/selected approved facility/);
  });
});

describe("requested facility vs contract face", () => {
  it("treats requested financing at or above contract value as invalid", () => {
    expect(isRequestedFacilityAtOrAboveContractValue(100, 100)).toBe(true);
    expect(isRequestedFacilityAtOrAboveContractValue(100.01, 100)).toBe(true);
    expect(isRequestedFacilityAtOrAboveContractValue(99.99, 100)).toBe(false);
    expect(REQUESTED_FACILITY_BELOW_CONTRACT_COPY).toMatch(/less than the contract value/i);
  });

  it("surfaces existing remaining values in the facility chooser without inventing them", () => {
    expect(
      facilityChooserRemaining({ availableFacility: 40_000, lifetimeRemaining: 120_000 })
    ).toEqual({ leftToDraw: 40_000, leftOnContract: 120_000 });
    expect(facilityChooserRemaining({})).toEqual({ leftToDraw: null, leftOnContract: null });
  });
});

describe("dual-limit preview and capacity copy", () => {
  it("treats pending add-back so reserved edits compare against remaining plus this reservation", () => {
    const preview = previewDualLimits({
      availableFacility: 10_000,
      lifetimeRemaining: 40_000,
      financingAmount: 45_000,
      invoiceFace: 80_000,
      addBackFinancing: 40_000,
      addBackFace: 50_000,
    });
    expect(preview.leftToDraw).toBe(50_000);
    expect(preview.leftOnContract).toBe(90_000);
    expect(preview.exceedsAny).toBe(false);
  });

  it("flags draft overage and says it can be saved but not submitted", () => {
    const preview = previewDualLimits({
      availableFacility: 10_000,
      lifetimeRemaining: 20_000,
      financingAmount: 12_000,
      invoiceFace: 25_000,
    });
    expect(preview.exceedsFacility).toBe(true);
    expect(preview.exceedsLifetime).toBe(true);
    expect(dualLimitOverageCopy(preview, "draft")).toMatch(/can save this draft/i);
    expect(dualLimitOverageCopy(preview, "draft")).toMatch(/cannot be submitted/i);
    expect(dualLimitOverageCopy(preview, "reserved")).toMatch(/cannot be saved/i);
  });

  it("maps capacity API error codes to issuer copy", () => {
    expect(mapCapacityApiError({ code: FACILITY_CAPACITY_EXCEEDED })).toMatch(/left to draw/i);
    expect(mapCapacityApiError({ error: { code: CONTRACT_LIFETIME_EXCEEDED } })).toMatch(
      /left on contract/i
    );
    expect(mapCapacityApiError({ code: FACILITY_MUST_BE_BELOW_CONTRACT_VALUE })).toMatch(
      /less than the contract value/i
    );
    expect(mapCapacityApiError({ code: "OTHER" })).toBeNull();
  });

  it("returns facility-only impact wording, including settled lifetime retention", () => {
    expect(facilityImpactCopy({ invoiceStatus: "DRAFT" }).statusWording).toMatch(/does not reserve/i);
    expect(facilityImpactCopy({ invoiceStatus: "SUBMITTED" }).statusWording).toMatch(/reserves credit/i);
    expect(
      facilityImpactCopy({ invoiceStatus: "APPROVED", noteStatus: "REPAID" }).settledLifetimeRetained
    ).toBe(true);
    expect(
      facilityImpactCopy({ invoiceStatus: "APPROVED", servicingStatus: "SETTLED" }).statusWording
    ).toMatch(/still use contract allocation/i);
    expect(facilityImpactCopy({ invoiceStatus: "REJECTED" }).released).toBe(true);
    expect(facilityImpactCopy({ noteStatus: "FAILED_FUNDING" }).released).toBe(true);
  });

  it("treats submitted, offered, and amendment invoices as reserved", () => {
    expect(isReservedCapacityInvoiceStatus("SUBMITTED")).toBe(true);
    expect(isReservedCapacityInvoiceStatus("OFFER_SENT")).toBe(true);
    expect(isReservedCapacityInvoiceStatus("AMENDMENT_REQUESTED")).toBe(true);
    expect(isEditableReservedInvoiceStatus("AMENDMENT_REQUESTED")).toBe(true);
    expect(isEditableReservedInvoiceStatus("SUBMITTED")).toBe(true);
    expect(isEditableReservedInvoiceStatus("OFFER_SENT")).toBe(false);
    expect(isReservedCapacityInvoiceStatus("DRAFT")).toBe(false);
  });
});
