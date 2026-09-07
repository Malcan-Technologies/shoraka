import {
  isScIntegerWithoutDecimal,
  normalizeScNric,
  normalizeScRegistrationNumber,
  omitRecordId,
  pickKnownKeys,
  restrictScIdentityInput,
  restrictScPostcodeInput,
  toOperatorShareCapitalPatch,
} from "./comrep-normalization";

describe("SC ComRep identifier formatting (Part B §2.3–2.4)", () => {
  it("strips dash, space, and special characters from ROC/BRN", () => {
    expect(normalizeScRegistrationNumber("1234567-A")).toBe("1234567A");
    expect(normalizeScRegistrationNumber("LLP 1234567-LGN")).toBe("LLP1234567LGN");
    expect(normalizeScRegistrationNumber("  ")).toBeNull();
  });

  it("strips dash, space, and special characters from NRIC", () => {
    expect(normalizeScNric("800101-01-1234")).toBe("800101011234");
    expect(normalizeScNric("800101 01 1234")).toBe("800101011234");
  });

  it("accepts integer-without-decimal values and rejects decimals", () => {
    expect(isScIntegerWithoutDecimal("50")).toBe(true);
    expect(isScIntegerWithoutDecimal(50)).toBe(true);
    expect(isScIntegerWithoutDecimal("")).toBe(true);
    expect(isScIntegerWithoutDecimal("50.0")).toBe(false);
    expect(isScIntegerWithoutDecimal("12.5")).toBe(false);
  });

  it("omits id from a DTO payload without loosening other keys", () => {
    expect(omitRecordId({ id: "cap_1", ordinaryUnits: "50", extra: true })).toEqual({
      ordinaryUnits: "50",
      extra: true,
    });
  });

  it("shapes share-capital patches without id", () => {
    const patch = toOperatorShareCapitalPatch({
      id: "cap_1",
      ordinaryUnits: "50",
      ordinaryAmount: "50",
      unknown: "no",
    });
    expect(patch).toEqual({ ordinaryUnits: "50", ordinaryAmount: "50" });
    expect("id" in patch).toBe(false);
    expect("unknown" in patch).toBe(false);
  });

  it("does not send the LLP block when saving Sdn Bhd share capital", () => {
    const patch = toOperatorShareCapitalPatch(
      {
        id: "cap_1",
        ordinaryUnits: "50",
        totalPaidUpCapital: "50",
        llpMembersCapitalUnits: "10",
        totalLlp: "10",
      },
      "SDN_BHD"
    );
    expect(patch).toEqual({ ordinaryUnits: "50", totalPaidUpCapital: "50" });
    expect("totalLlp" in patch).toBe(false);
    expect("llpMembersCapitalUnits" in patch).toBe(false);
  });

  it("does not send the Sdn Bhd block when saving LLP share capital", () => {
    const patch = toOperatorShareCapitalPatch(
      {
        id: "cap_1",
        ordinaryUnits: "50",
        totalPaidUpCapital: "50",
        llpMembersCapitalUnits: "10",
        totalLlp: "10",
      },
      "LLP"
    );
    expect(patch).toEqual({ llpMembersCapitalUnits: "10", totalLlp: "10" });
    expect("ordinaryUnits" in patch).toBe(false);
    expect("totalPaidUpCapital" in patch).toBe(false);
  });

  it("picks known keys only, strips id, and converts empty strings to null", () => {
    const body = pickKnownKeys(
      { id: "row_1", name: "Ahmad", unknown: true, salutation: "" },
      ["name", "salutation", "identityNumber"]
    );
    expect(body).toEqual({ name: "Ahmad", salutation: null });
    expect("id" in body).toBe(false);
    expect("unknown" in body).toBe(false);
  });
});

describe("secondary-onboarding identity and postcode input restrictions", () => {
  it("CASE A: ROC/BRN follows ComRep alphanumeric rules, not a 12-digit-only SSM lookup", () => {
    expect(normalizeScRegistrationNumber("202501447890")).toBe("202501447890");
    expect(normalizeScRegistrationNumber("1234567A")).toBe("1234567A");
    expect(restrictScIdentityInput("ROC", "2025-01447890")).toBe("202501447890");
    expect(restrictScIdentityInput("ROC", "202501447890999")).toBe("202501447890999");
  });

  it("CASE B: NRIC strips dashes/spaces and still allows letters; passport is not stripped", () => {
    expect(restrictScIdentityInput("NRIC", "950829-08-3430")).toBe("950829083430");
    expect(restrictScIdentityInput("NRIC", "950829083430")).toBe("950829083430");
    expect(restrictScIdentityInput("NRIC", "800101A")).toBe("800101A");
    expect(restrictScIdentityInput("PASSPORT", "AB-12 34")).toBe("AB-12 34");
  });

  it("CASE C / H: Malaysian postcodes are digits-only; Outside Malaysia stays free text", () => {
    expect(restrictScPostcodeInput("Selangor", "47800")).toBe("47800");
    expect(restrictScPostcodeInput("Selangor", "47800a")).toBe("47800");
    expect(restrictScPostcodeInput("Selangor", "478001")).toBe("478001");
    expect(restrictScPostcodeInput("Outside Malaysia", "SW1A 1AA")).toBe("SW1A 1AA");
  });
});
