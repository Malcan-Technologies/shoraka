import {
  attachFacilityFeeAvailableToReserve,
  loadFacilityFeeAvailableByInvoiceId,
  mapFacilityFeeAvailableToReserveByInvoiceId,
  remainingByContractIdFromContracts,
  reservationInvoicesFromContracts,
} from "./facility-fee-available-to-reserve";

const v1Schedule = (amount: number) => ({
  fee_schedule_version: 1,
  facility_fee_collect_amount: amount,
  additional_fees: [],
});

describe("mapFacilityFeeAvailableToReserveByInvoiceId", () => {
  it("subtracts still-collectible sibling v1 reservations from gross remaining", () => {
    const available = mapFacilityFeeAvailableToReserveByInvoiceId({
      targetInvoices: [
        { id: "inv-new", contractId: "contract-1" },
        { id: "inv-a", contractId: "contract-1" },
      ],
      remainingByContractId: { "contract-1": 1_000 },
      reservationInvoices: [
        {
          id: "inv-a",
          contractId: "contract-1",
          status: "OFFER_SENT",
          offerDetails: v1Schedule(800),
        },
        { id: "inv-new", contractId: "contract-1", status: "SUBMITTED", offerDetails: null },
      ],
      notes: [],
    });
    expect(available.get("inv-new")).toBe(200);
    expect(available.get("inv-a")).toBe(1_000);
  });

  it("excludes the current invoice so resend can replace its own reservation", () => {
    const available = mapFacilityFeeAvailableToReserveByInvoiceId({
      targetInvoices: [
        { id: "inv-current", contractId: "contract-1" },
        { id: "inv-other", contractId: "contract-1" },
      ],
      remainingByContractId: { "contract-1": 1_000 },
      reservationInvoices: [
        {
          id: "inv-current",
          contractId: "contract-1",
          status: "OFFER_SENT",
          offerDetails: v1Schedule(800),
        },
        {
          id: "inv-other",
          contractId: "contract-1",
          status: "OFFER_SENT",
          offerDetails: v1Schedule(100),
        },
      ],
      notes: [],
    });
    expect(available.get("inv-current")).toBe(900);
    expect(available.get("inv-other")).toBe(200);
  });

  it("treats live uncharged notes as reservations and charged notes as already in remaining", () => {
    const available = mapFacilityFeeAvailableToReserveByInvoiceId({
      targetInvoices: [{ id: "inv-new", contractId: "contract-1" }],
      remainingByContractId: { "contract-1": 400 },
      reservationInvoices: [
        {
          id: "inv-live",
          contractId: "contract-1",
          status: "APPROVED",
          offerDetails: v1Schedule(300),
        },
        {
          id: "inv-charged",
          contractId: "contract-1",
          status: "APPROVED",
          offerDetails: v1Schedule(200),
        },
        { id: "inv-new", contractId: "contract-1", status: "SUBMITTED" },
      ],
      notes: [
        {
          sourceInvoiceId: "inv-live",
          sourceContractId: "contract-1",
          status: "PUBLISHED",
          fundingStatus: "OPEN",
        },
        {
          sourceInvoiceId: "inv-charged",
          sourceContractId: "contract-1",
          status: "FUNDING",
          fundingStatus: "FUNDED",
        },
      ],
    });
    expect(available.get("inv-new")).toBe(100);
  });

  it("returns null when the invoice is not facility-linked", () => {
    const available = mapFacilityFeeAvailableToReserveByInvoiceId({
      targetInvoices: [{ id: "inv-standalone", contractId: null }],
      remainingByContractId: { "contract-1": 1_000 },
      reservationInvoices: [],
      notes: [],
    });
    expect(available.get("inv-standalone")).toBeNull();
  });

  it("does not inherit application.contract_id onto an unlinked invoice", () => {
    const available = mapFacilityFeeAvailableToReserveByInvoiceId({
      targetInvoices: [{ id: "inv-unlinked", contractId: null }],
      remainingByContractId: { "contract-1": 1_000 },
      reservationInvoices: [
        {
          id: "inv-sibling",
          contractId: "contract-1",
          status: "OFFER_SENT",
          offerDetails: v1Schedule(800),
        },
      ],
      notes: [],
    });
    expect(available.get("inv-unlinked")).toBeNull();
  });
});

describe("contract helpers", () => {
  it("derives remaining and reservation invoices from loaded contracts", () => {
    const contracts = [
      {
        id: "contract-1",
        contractDetails: { facility_fee_total_amount: 1_000, facility_fee_paid_amount: 200 },
        invoices: [
          { id: "inv-a", status: "OFFER_SENT", offerDetails: v1Schedule(100) },
        ],
      },
    ];
    expect(remainingByContractIdFromContracts(contracts).get("contract-1")).toBe(800);
    expect(reservationInvoicesFromContracts(contracts)).toEqual([
      {
        id: "inv-a",
        status: "OFFER_SENT",
        offerDetails: v1Schedule(100),
        contractId: "contract-1",
      },
    ]);
  });

  it("attaches the computed available amount onto application invoices", () => {
    const invoices = [
      { id: "inv-a", contract_id: "contract-1", status: "SUBMITTED" },
      { id: "inv-b", contract_id: null, status: "SUBMITTED" },
    ];
    const attached = attachFacilityFeeAvailableToReserve(
      invoices,
      new Map([
        ["inv-a", 250],
        ["inv-b", null],
      ])
    );
    expect(attached[0]?.facilityFeeAvailableToReserve).toBe(250);
    expect(attached[1]?.facilityFeeAvailableToReserve).toBeNull();
  });
});

describe("loadFacilityFeeAvailableByInvoiceId", () => {
  it("loads remaining and sibling reservations even when application.contract_id is unset", async () => {
    const db = {
      contract: {
        findMany: jest.fn(async () => [
          {
            id: "contract-1",
            contract_details: { facility_fee_total_amount: 1_000, facility_fee_paid_amount: 0 },
            invoices: [
              { id: "inv-a", status: "OFFER_SENT", offer_details: v1Schedule(800) },
              { id: "inv-b", status: "SUBMITTED", offer_details: null },
            ],
          },
        ]),
      },
      note: {
        findMany: jest.fn(async () => []),
      },
    };
    const available = await loadFacilityFeeAvailableByInvoiceId(
      db as never,
      [
        { id: "inv-a", contract_id: "contract-1" },
        { id: "inv-b", contract_id: "contract-1" },
      ],
      null
    );
    expect(available.get("inv-a")).toBe(1_000);
    expect(available.get("inv-b")).toBe(200);
    expect(db.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["contract-1"] } } })
    );
  });

  it("returns null for every invoice when no facility is linked", async () => {
    const db = {
      contract: { findMany: jest.fn() },
      note: { findMany: jest.fn() },
    };
    const available = await loadFacilityFeeAvailableByInvoiceId(
      db as never,
      [{ id: "inv-standalone", contract_id: null }],
      null
    );
    expect(available.get("inv-standalone")).toBeNull();
    expect(db.contract.findMany).not.toHaveBeenCalled();
  });
});
