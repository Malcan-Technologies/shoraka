import { createProductBodySchema, updateProductBodySchema } from "./products/schemas";
import { sendContractOfferSchema } from "./admin/schemas";
import { updateNoteDraftSchema } from "./notes/schemas";

function expectPass(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  const parsed = schema.safeParse(value);
  expect(parsed.success).toBe(true);
}

function expectFail(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  const parsed = schema.safeParse(value);
  expect(parsed.success).toBe(false);
}

describe("Zod fee/rate validation (service fee + facility fee)", () => {
  describe("Product schemas (service_fee_rate_percent + default_facility_fee_rate_percent)", () => {
    const createBase = {
      workflow: [{ config: { category: "CONTRACT_FINANCING" } }],
      offer_expiry_days: null,
      marketplace_listing_duration_days: null,
    };

    it("service_fee_rate_percent accepts 0, 12.5, 14.99, 15", () => {
      for (const rate of [0, 12.5, 14.99, 15]) {
        expectPass(createProductBodySchema, { ...createBase, service_fee_rate_percent: rate });
      }
      for (const rate of [0, 12.5, 14.99, 15]) {
        expectPass(updateProductBodySchema, { service_fee_rate_percent: rate });
      }
    });

    it("service_fee_rate_percent rejects -1, 15.01, 15.001, abc", () => {
      for (const rate of [-1, 15.01, 15.001]) {
        expectFail(createProductBodySchema, { ...createBase, service_fee_rate_percent: rate });
      }
      for (const rate of [-1, 15.01, 15.001]) {
        expectFail(updateProductBodySchema, { service_fee_rate_percent: rate });
      }
      expectFail(createProductBodySchema, { ...createBase, service_fee_rate_percent: "abc" });
      expectFail(updateProductBodySchema, { service_fee_rate_percent: "abc" });
    });

    it("default_facility_fee_rate_percent accepts 0, 0.25, 0.5, 1", () => {
      for (const rate of [0, 0.25, 0.5, 1]) {
        expectPass(createProductBodySchema, { ...createBase, default_facility_fee_rate_percent: rate });
      }
      for (const rate of [0, 0.25, 0.5, 1]) {
        expectPass(updateProductBodySchema, { default_facility_fee_rate_percent: rate });
      }
    });

    it("default_facility_fee_rate_percent rejects -1, 1.01, 1.001, 10, 100", () => {
      for (const rate of [-1, 1.01, 1.001, 10, 100]) {
        expectFail(createProductBodySchema, { ...createBase, default_facility_fee_rate_percent: rate });
      }
      for (const rate of [-1, 1.01, 1.001, 10, 100]) {
        expectFail(updateProductBodySchema, { default_facility_fee_rate_percent: rate });
      }
    });
  });

  describe("Admin sendContractOfferSchema (facilityFeeRatePercent)", () => {
    it("facilityFeeRatePercent accepts 0, 0.25, 0.5, 1, null", () => {
      for (const rate of [0, 0.25, 0.5, 1]) {
        expectPass(sendContractOfferSchema, { offeredFacility: 100, facilityFeeRatePercent: rate });
      }
      expectPass(sendContractOfferSchema, { offeredFacility: 100, facilityFeeRatePercent: null });
    });

    it("facilityFeeRatePercent rejects -1, 1.01, 1.001, 10, 100", () => {
      for (const rate of [-1, 1.01, 1.001, 10, 100]) {
        expectFail(sendContractOfferSchema, { offeredFacility: 100, facilityFeeRatePercent: rate });
      }
    });
  });

  describe("Note draft schema (serviceFeeRatePercent)", () => {
    it("serviceFeeRatePercent accepts 0, 12.5, 14.99, 15", () => {
      for (const rate of [0, 12.5, 14.99, 15]) {
        expectPass(updateNoteDraftSchema, { serviceFeeRatePercent: rate });
      }
    });

    it("serviceFeeRatePercent rejects -1, 15.01, 15.001", () => {
      for (const rate of [-1, 15.01, 15.001]) {
        expectFail(updateNoteDraftSchema, { serviceFeeRatePercent: rate });
      }
    });
  });
});

