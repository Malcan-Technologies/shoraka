jest.mock("@cashsouk/config", () => {
  const resolvers = jest.requireActual<
    typeof import("../../../../../../packages/config/src/offer-resolvers")
  >("../../../../../../packages/config/src/offer-resolvers");
  return {
    ...resolvers,
    formatCurrency: (value: number) => `RM ${value}`,
    useOrganization: jest.fn(() => ({ activeOrganization: null })),
    getStatusPresentationByBadgeKey: () => ({ color: "bg-mock", label: "Mock" }),
    getStatusColorAndLabel: () => ({ color: "bg-mock", label: "Mock" }),
    resolveIssuerInvoiceStatusBadgeKey: (status: string | undefined) =>
      String(status ?? "draft").toLowerCase(),
  };
});

jest.mock("@/hooks/use-applications", () => ({
  useOrganizationApplications: jest.fn(() => ({ data: [], isLoading: false, error: null })),
}));

jest.mock("@/lib/facility-fee-display", () => ({
  numberOrNull: (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null,
}));

import { prepareApplication, type ApiApplication } from "./use-applications-data";

function invoiceOnlyApi(overrides: Partial<ApiApplication> = {}): ApiApplication {
  return {
    id: "app_invoice_only",
    displayReference: "APP-INV-1",
    status: "SUBMITTED",
    financing_structure: { structure_type: "invoice_only" },
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-02T00:00:00.000Z",
    submitted_at: "2026-08-01T12:00:00.000Z",
    contract_id: "holder_ctr",
    contract: {
      id: "holder_ctr",
      display_reference: "CON-HOLDER",
      status: "APPROVED",
      contract_details: {
        title: "Should not show as facility",
        contract_value: 500_000,
        financing: 400_000,
        approved_facility: 400_000,
        facility_fee_rate_percent: 1,
      },
      customer_details: {
        customer_name: "Paymaster Co",
      },
      offer_details: { offered_facility: 350_000, expires_at: "2026-09-01T00:00:00.000Z" },
      facilityFeeUpfrontAmount: 4_000,
      facilityFeeUpfrontOutstanding: 4_000,
    },
    invoices: [
      {
        id: "inv_1",
        display_reference: "INV-1",
        contract_id: null,
        status: "SUBMITTED",
        details: { invoice_number: "INV-1001", value: 80_000, financing: 60_000 },
      },
    ],
    ...overrides,
  };
}

describe("prepareApplication invoice_only holder", () => {
  it("nulls holder facility fields while keeping customer from customer_details", () => {
    const leakedHolder = invoiceOnlyApi();
    leakedHolder.invoices = leakedHolder.invoices?.map((invoice) => ({
      ...invoice,
      contract_id: "holder_ctr",
    }));
    const app = prepareApplication(leakedHolder);

    expect(app.type).toBe("Invoice financing");
    expect(app.customer).toBe("Paymaster Co");
    expect(app.contractId).toBeNull();
    expect(app.contractStatus).toBeNull();
    expect(app.invoices[0]?.contractId).toBeNull();
    expect(app.contractTitle).toBeNull();
    expect(app.contractDisplayReference).toBeNull();
    expect(app.contractValue).toBeNull();
    expect(app.facilityApplied).toBeNull();
    expect(app.offeredFacilityAmount).toBeNull();
    expect(app.approvedFacilityAmount).toBeNull();
    expect(app.approvedFacility).toBe("N/A");
    expect(app.facilityFeeRatePercent).toBeNull();
    expect(app.facilityFeeCapAmount).toBeNull();
    expect(app.facilityFeePaidAmount).toBeNull();
    expect(app.facilityFeeUpfrontAmount).toBeNull();
    expect(app.facilityFeeUpfrontOutstanding).toBeNull();
    expect(app.signedContractOfferLetterAvailable).toBe(false);
    expect(app.facilityInForceNoInvoices).toBe(false);
  });

  it("keeps invoice offer review eligible even when the holder is APPROVED", () => {
    const app = prepareApplication(
      invoiceOnlyApi({
        status: "INVOICES_SENT",
        invoices: [
          {
            id: "inv_offer",
            contract_id: null,
            status: "OFFER_SENT",
            offer_details: {
              offered_amount: 55_000,
              offered_profit_rate: 8,
              platform_fee_rate_percent: 1,
            },
            details: { invoice_number: "INV-2001", value: 70_000, financing: 55_000 },
          },
        ],
      })
    );

    expect(app.contractStatus).toBeNull();
    expect(app.cardStatus.showReviewOffer).toBe(true);
    expect(app.cardStatus.badgeKey).toBe("offer_sent");
    expect(app.invoices[0]?.canReviewOffer).toBe(true);
    expect(app.invoices[0]?.contractId).toBeNull();
  });

  it("does not treat a holder OFFER_SENT as a facility offer", () => {
    const app = prepareApplication(
      invoiceOnlyApi({
        contract: {
          id: "holder_ctr",
          status: "OFFER_SENT",
          customer_details: { customer_name: "Paymaster Co" },
          contract_details: { title: "Holder" },
          offer_details: { offered_facility: 100_000 },
        },
        invoices: [
          {
            id: "inv_1",
            status: "SUBMITTED",
            contract_id: null,
            details: { invoice_number: "INV-1001" },
          },
        ],
      })
    );

    expect(app.contractStatus).toBeNull();
    expect(app.cardStatus.showReviewOffer).toBe(false);
    expect(app.cardStatus.badgeKey).toBe("submitted");
  });

  it("does not label completed invoice_only as Facility approved", () => {
    const app = prepareApplication(
      invoiceOnlyApi({
        status: "COMPLETED",
        invoices: [
          {
            id: "inv_1",
            status: "WITHDRAWN",
            contract_id: null,
            details: { invoice_number: "INV-1001" },
          },
        ],
      })
    );

    expect(app.facilityInForceNoInvoices).toBe(false);
    expect(app.cardStatus.displayLabel).not.toMatch(/facility approved/i);
  });

  it("keeps real facility fields for new_contract applications", () => {
    const app = prepareApplication({
      id: "app_facility",
      status: "COMPLETED",
      financing_structure: { structure_type: "new_contract" },
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-02T00:00:00.000Z",
      contract_id: "ctr_real",
      contract: {
        id: "ctr_real",
        display_reference: "CON-REAL",
        status: "APPROVED",
        contract_details: {
          title: "Supply agreement",
          contract_value: 500_000,
          financing: 400_000,
          approved_facility: 400_000,
        },
        customer_details: { customer_name: "Acme Sdn Bhd" },
      },
      invoices: [],
    });

    expect(app.type).toBe("Facility financing");
    expect(app.contractId).toBe("ctr_real");
    expect(app.contractStatus).toBe("APPROVED");
    expect(app.contractTitle).toBe("Supply agreement");
    expect(app.customer).toBe("Acme Sdn Bhd");
    expect(app.facilityApplied).toBe(400_000);
    expect(app.approvedFacilityAmount).toBe(400_000);
  });
});
