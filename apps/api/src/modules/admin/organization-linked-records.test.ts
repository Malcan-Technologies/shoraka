import { AppError } from "../../lib/http/error-handler";
import {
  contractValueFromDetails,
  productIdFromFinancingType,
  requestedAmountFromApplication,
  resolveLinkedRecordType,
} from "./organization-linked-records";

describe("resolveLinkedRecordType", () => {
  it("defaults issuer to applications and rejects investments", () => {
    expect(resolveLinkedRecordType("issuer", undefined)).toBe("applications");
    expect(resolveLinkedRecordType("issuer", "notes")).toBe("notes");
    expect(() => resolveLinkedRecordType("issuer", "investments")).toThrow(AppError);
  });

  it("defaults investor to investments and rejects issuer types", () => {
    expect(resolveLinkedRecordType("investor", undefined)).toBe("investments");
    expect(resolveLinkedRecordType("investor", "investments")).toBe("investments");
    expect(() => resolveLinkedRecordType("investor", "applications")).toThrow(AppError);
    expect(() => resolveLinkedRecordType("investor", "contracts")).toThrow(AppError);
    expect(() => resolveLinkedRecordType("investor", "notes")).toThrow(AppError);
  });
});

describe("requestedAmountFromApplication", () => {
  it("sums invoice value times financing ratio", () => {
    const amount = requestedAmountFromApplication({
      invoices: [
        { details: { value: 1000, financing_ratio_percent: 80 } },
        { details: { value: 500, financing_ratio_percent: 80 } },
      ],
      contract: null,
    });
    expect(amount).toBe(1200);
  });

  it("falls back to contract value when there are no invoices", () => {
    expect(
      requestedAmountFromApplication({
        invoices: [],
        contract: { contract_details: { approved_facility: 25000 } },
      })
    ).toBe(25000);
  });
});

describe("productIdFromFinancingType", () => {
  it("reads a non-empty product_id", () => {
    expect(productIdFromFinancingType({ product_id: " invoice-financing " })).toBe("invoice-financing");
    expect(productIdFromFinancingType({ product_id: "" })).toBeNull();
    expect(productIdFromFinancingType(null)).toBeNull();
  });
});

describe("contractValueFromDetails", () => {
  it("prefers value then approved_facility", () => {
    expect(contractValueFromDetails({ value: 10, approved_facility: 20 })).toBe(10);
    expect(contractValueFromDetails({ approved_facility: 20 })).toBe(20);
    expect(contractValueFromDetails({})).toBeNull();
  });
});
