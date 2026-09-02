import { Prisma } from "@prisma/client";
import {
  computePartyMismatches,
  fillEmptyMaster,
  mergeEmptyAddress,
  mergeObservationResolutions,
  mergeProvidedAddressKeys,
  OBSERVATION_RESOLVED_KEY,
  parseDateInput,
  preserveFilledCodMasterFacts,
} from "./serialize";

describe("fillEmptyMaster / mergeEmptyAddress", () => {
  it("fills only empty address subfields", () => {
    const merged = mergeEmptyAddress({
      master: { line1: "1 Jalan A", state: null, postalCode: null },
      incoming: { line1: "SHOULD NOT OVERWRITE", state: "Selangor", postalCode: "40000" },
      sources: {},
      fieldPrefix: "address",
      source: "USER",
    });
    expect(merged.value).toEqual({
      line1: "1 Jalan A",
      line2: null,
      city: null,
      postalCode: "40000",
      state: "Selangor",
      country: null,
    });
    expect(merged.wrote).toBe(true);
  });

  it("admin partial address patch keeps existing line1", () => {
    const merged = mergeProvidedAddressKeys(
      { line1: "1 Jalan A", state: "Johor", postalCode: "80000" },
      { state: "Selangor", postalCode: "40000" }
    );
    expect(merged?.line1).toBe("1 Jalan A");
    expect(merged?.state).toBe("Selangor");
    expect(merged?.postalCode).toBe("40000");
  });

  it("does not overwrite a filled scalar", () => {
    const result = fillEmptyMaster({
      master: "36",
      incoming: "38",
      sources: {},
      field: "shareholdingPercentage",
      source: "CTOS",
    });
    expect(result.value).toBe("36");
    expect(result.wrote).toBe(false);
  });
});

describe("CTOS date parsing", () => {
  it("treats CTOS appoint strings as DD-MM-YYYY", () => {
    const parsed = parseDateInput("01-12-2001");
    expect(parsed?.toISOString().slice(0, 10)).toBe("2001-12-01");
  });
});

describe("computePartyMismatches", () => {
  const baseMaster = {
    name: "Ali",
    identityNumber: "800101011234",
    entityType: "INDIVIDUAL",
    isDirector: false,
    isShareholder: true,
    shareholdingPercentage: new Prisma.Decimal("36.000000"),
    appointmentDate: new Date("2001-12-01T00:00:00.000Z"),
    resignationDate: null as Date | null,
  };

  it("A: same percentage is not a mismatch", () => {
    const mismatches = computePartyMismatches({
      master: baseMaster,
      observation: { shareholdingPercentage: 36, name: "Ali" },
      sources: {},
    });
    expect(mismatches.find((m) => m.field === "shareholdingPercentage")).toBeUndefined();
  });

  it("B: changed percentage is a mismatch until Keep current", () => {
    const observation = { shareholdingPercentage: 38, name: "Ali" };
    const open = computePartyMismatches({
      master: baseMaster,
      observation,
      sources: {},
    });
    expect(open.find((m) => m.field === "shareholdingPercentage")?.externalValue).toBe(38);

    const kept = computePartyMismatches({
      master: baseMaster,
      observation: {
        ...observation,
        [OBSERVATION_RESOLVED_KEY]: {
          shareholdingPercentage: { action: "KEEP", externalValue: 38 },
        },
      },
      sources: {},
    });
    expect(kept.find((m) => m.field === "shareholdingPercentage")).toBeUndefined();
  });

  it("does not treat DD-MM-YYYY appoint as a false mismatch", () => {
    const mismatches = computePartyMismatches({
      master: baseMaster,
      observation: { appointmentDate: "01-12-2001", name: "Ali" },
      sources: {},
    });
    expect(mismatches.find((m) => m.field === "appointmentDate")).toBeUndefined();
  });

  it("does not treat hyphenated NRIC as a different identity", () => {
    const mismatches = computePartyMismatches({
      master: { ...baseMaster, identityNumber: "900101101234" },
      observation: { identityNumber: "900101-10-1234", name: "Ali" },
      sources: {},
    });
    expect(mismatches.find((m) => m.field === "identityNumber")).toBeUndefined();
  });
});

describe("mergeObservationResolutions", () => {
  it("keeps Keep-current when CTOS value is unchanged and drops it when CTOS changes again", () => {
    const previous = {
      shareholdingPercentage: 38,
      [OBSERVATION_RESOLVED_KEY]: {
        shareholdingPercentage: { action: "KEEP", externalValue: 38 },
      },
    };
    const same = mergeObservationResolutions(previous, { shareholdingPercentage: 38 });
    expect(same[OBSERVATION_RESOLVED_KEY]).toEqual({
      shareholdingPercentage: { action: "KEEP", externalValue: 38 },
    });
    const changed = mergeObservationResolutions(previous, { shareholdingPercentage: 40 });
    expect(changed[OBSERVATION_RESOLVED_KEY]).toBeUndefined();
  });
});

describe("preserveFilledCodMasterFacts", () => {
  it("keeps user-filled address state when a later COD payload omits it", () => {
    const merged = preserveFilledCodMasterFacts(
      {
        addresses: {
          registered: { line1: "1 Jalan A", state: "Selangor", postalCode: "40000" },
        },
        aboutYourBusiness: { whatDoesCompanyDo: "Invoice financing" },
      },
      {
        addresses: {
          registered: { line1: "1 Jalan A" },
        },
        aboutYourBusiness: { whatDoesCompanyDo: "" },
        directors: [{ name: "New KYC row" }],
      }
    ) as {
      addresses: { registered: { line1: string; state: string; postalCode: string } };
      aboutYourBusiness: { whatDoesCompanyDo: string };
      directors: unknown[];
    };
    expect(merged.addresses.registered.state).toBe("Selangor");
    expect(merged.addresses.registered.postalCode).toBe("40000");
    expect(merged.aboutYourBusiness.whatDoesCompanyDo).toBe("Invoice financing");
    expect(merged.directors).toHaveLength(1);
  });
});
