import {
  buildIndividualGuarantorIdentityPatch,
  clearGuarantorAmlScreeningMetadata,
  flaggedIndividualGuarantorParties,
  identityFromIndividualGuarantorParty,
  patchIndividualGuarantorSourceData,
  prismaDataForIndividualGuarantorIdentityPatch,
} from "./individual-guarantor-identity";
import type { AuthorizedParty } from "@cashsouk/types";

const NEXT = {
  name: "Ali Edited",
  email: "ali.edited@home.my",
  ic_number: "901212101234",
};

describe("patchIndividualGuarantorSourceData", () => {
  it("writes snake_case identity and keeps icNumber in sync when present", () => {
    expect(
      patchIndividualGuarantorSourceData(
        {
          name: "Ali Bin Abu",
          email: "ali@home.my",
          ic_number: "820508105871",
          icNumber: "820508105871",
          nationality: "MY",
          relationship: "director",
        },
        NEXT
      )
    ).toEqual({
      name: "Ali Edited",
      email: "ali.edited@home.my",
      ic_number: "901212101234",
      icNumber: "901212101234",
      nationality: "MY",
      relationship: "director",
    });
  });
});

describe("clearGuarantorAmlScreeningMetadata", () => {
  it("drops aml_screening and keeps other metadata", () => {
    expect(
      clearGuarantorAmlScreeningMetadata({
        aml_screening: { requestId: "req_1" },
        onboarding_request_id: "onb_1",
      })
    ).toEqual({ onboarding_request_id: "onb_1" });
  });
});

describe("buildIndividualGuarantorIdentityPatch", () => {
  const current = {
    name: "Ali Bin Abu",
    email: "ali@home.my",
    ic_number: "820508105871",
    source_data: { name: "Ali Bin Abu", ic_number: "820508105871", email: "ali@home.my" },
    metadata: { aml_screening: { requestId: "req_1" }, extra: true },
  };

  it("resets AML when name or IC changes", () => {
    const patch = buildIndividualGuarantorIdentityPatch({ current, next: NEXT });
    expect(patch.resetAml).toBe(true);
    expect(patch.metadata).toEqual({ extra: true });
    expect(prismaDataForIndividualGuarantorIdentityPatch(patch)).toMatchObject({
      name: "Ali Edited",
      email: "ali.edited@home.my",
      ic_number: "901212101234",
      aml_status: "Pending",
      aml_message_status: "PENDING",
      last_triggered_at: null,
      last_synced_at: null,
    });
  });

  it("does not reset AML on an email-only change", () => {
    const patch = buildIndividualGuarantorIdentityPatch({
      current,
      next: { name: "Ali Bin Abu", email: "new@home.my", ic_number: "820508105871" },
    });
    expect(patch.resetAml).toBe(false);
    expect(patch.email).toBe("new@home.my");
    expect(prismaDataForIndividualGuarantorIdentityPatch(patch).aml_status).toBeUndefined();
  });
});

describe("flaggedIndividualGuarantorParties", () => {
  const individual: AuthorizedParty = {
    key: "g_ind",
    entity_kind: "INDIVIDUAL_GUARANTOR",
    application_guarantor_id: "g_ind",
    representatives: [
      {
        name: "Ali Edited",
        email: "ali.edited@home.my",
        ic_number: "901212101234",
        capacity: "authorised_signatory",
      },
    ],
  };

  it("returns only flagged individual parties and reads their submitted identity", () => {
    const flagged = flaggedIndividualGuarantorParties(
      [individual],
      new Set(["authorized_representatives:guarantor:g_ind"])
    );
    expect(flagged).toHaveLength(1);
    expect(identityFromIndividualGuarantorParty(flagged[0]!)).toEqual(NEXT);
    expect(
      flaggedIndividualGuarantorParties(
        [individual],
        new Set(["authorized_representatives:issuer"])
      )
    ).toEqual([]);
  });
});
