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
  preserveFilledOrgIdentityFields,
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

  it("preserves identityConflict when CTOS observation is merged", () => {
    const previous = {
      shareholdingPercentage: 38,
      identityConflict: {
        status: "BLOCKED",
        canonicalIdentity: "900101101234",
        otherPartyId: "obs-1",
        otherPartyKey: "900101101234",
        otherMembershipStatus: "EXTERNAL_OBSERVED",
        source: "REGTANK_QUERY",
        at: "2026-09-10T00:00:00.000Z",
      },
    };
    const merged = mergeObservationResolutions(previous, { shareholdingPercentage: 40, name: "ALI" });
    expect(merged.identityConflict).toEqual(previous.identityConflict);
    expect(merged.shareholdingPercentage).toBe(40);
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

  it("seeds contactPerson from RegTank PIC when CashSouk contact is empty", () => {
    const merged = preserveFilledCodMasterFacts(
      { personInCharge: null, contactPerson: null },
      {
        personInCharge: {
          name: "Aisha",
          position: "Director",
          email: "aisha@acme.test",
          contactNumber: "+60111111111",
        },
        contactPerson: {
          name: "Aisha",
          position: "Director",
          email: "aisha@acme.test",
          contact: "+60111111111",
        },
      }
    ) as {
      personInCharge: { email: string };
      contactPerson: { email: string; contact: string };
    };
    expect(merged.personInCharge.email).toBe("aisha@acme.test");
    expect(merged.contactPerson.email).toBe("aisha@acme.test");
    expect(merged.contactPerson.contact).toBe("+60111111111");
  });

  it("does not overwrite a filled CashSouk contactPerson on later COD refresh", () => {
    const merged = preserveFilledCodMasterFacts(
      {
        personInCharge: {
          name: "Aisha",
          email: "aisha@acme.test",
          contactNumber: "+60111111111",
        },
        contactPerson: {
          name: "Kau Khai Kit",
          position: "CFO",
          email: "khai.kit@company.com",
          contact: "+60122222222",
        },
      },
      {
        personInCharge: {
          name: "New PIC",
          email: "new.pic@regtank.test",
          contactNumber: "+60133333333",
        },
        contactPerson: {
          name: "New PIC",
          email: "new.pic@regtank.test",
          contact: "+60133333333",
        },
      }
    ) as {
      personInCharge: { email: string; name: string };
      contactPerson: { email: string; name: string; contact: string };
    };
    expect(merged.personInCharge.email).toBe("new.pic@regtank.test");
    expect(merged.personInCharge.name).toBe("New PIC");
    expect(merged.contactPerson.email).toBe("khai.kit@company.com");
    expect(merged.contactPerson.name).toBe("Kau Khai Kit");
    expect(merged.contactPerson.contact).toBe("+60122222222");
  });

  it("does not delete filled contactPerson when incoming PIC is missing", () => {
    const merged = preserveFilledCodMasterFacts(
      {
        contactPerson: { name: "Kit", email: "kit@acme.test", contact: "+60123456789" },
      },
      { personInCharge: null, contactPerson: null }
    ) as { contactPerson: { email: string } };
    expect(merged.contactPerson.email).toBe("kit@acme.test");
  });
});

describe("preserveFilledOrgIdentityFields", () => {
  it("keeps filled CashSouk identity values when a later RegTank extract differs", () => {
    const merged = preserveFilledOrgIdentityFields(
      {
        first_name: "Aisha",
        last_name: "Tan",
        nationality: "MY",
        gender: "FEMALE",
        document_number: "900101101234",
        phone_number: "+60111111111",
      },
      {
        first_name: "A",
        last_name: "T",
        nationality: "SG",
        gender: "MALE",
        document_number: "900101101999",
        phone_number: "+60122222222",
        kyc_id: "kyc-new",
      }
    );
    expect(merged.first_name).toBe("Aisha");
    expect(merged.last_name).toBe("Tan");
    expect(merged.nationality).toBe("MY");
    expect(merged.gender).toBe("FEMALE");
    expect(merged.document_number).toBe("900101101234");
    expect(merged.phone_number).toBe("+60111111111");
    expect(merged.kyc_id).toBe("kyc-new");
  });

  it("fills empty identity fields from RegTank", () => {
    const merged = preserveFilledOrgIdentityFields(
      { first_name: null, last_name: "", nationality: null },
      { first_name: "Aisha", last_name: "Tan", nationality: "MY" }
    );
    expect(merged.first_name).toBe("Aisha");
    expect(merged.last_name).toBe("Tan");
    expect(merged.nationality).toBe("MY");
  });
});
