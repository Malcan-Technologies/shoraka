import {
  areGuarantorPartiesReady,
  buildAuthorizedPartiesSubmitPayload,
  emptyGuarantorPartyDrafts,
  EMPTY_CORPORATE_REP,
  nextGuarantorPartyDrafts,
} from "./guarantor-authorized-parties";
import type { ApplicationGuarantorRow } from "./build-issuer-envelope-bindings";

const directors = [
  {
    matchKey: "820508105871",
    name: "Ali Bin Abu",
    email: "ali@co.my",
    ic_number: "820508105871",
  },
];

const company: ApplicationGuarantorRow = {
  id: "g_co",
  guarantor_type: "company",
  business_name: "HoldCo Sdn Bhd",
  email: "holdco@co.my",
};

const individual: ApplicationGuarantorRow = {
  id: "g_ind",
  guarantor_type: "individual",
  name: "Ali Bin Abu",
  email: "ali@home.my",
  ic_number: "820508105871",
};

const nora = {
  name: "Nora",
  email: "nora@holdco.my",
  ic_number: "880101015555",
  capacity: "authorised_signatory" as const,
};

describe("nextGuarantorPartyDrafts", () => {
  it("defaults corporate to one empty row and individual to the application email", () => {
    expect(
      nextGuarantorPartyDrafts({
        snapshot: null,
        guarantors: [company, individual],
        current: emptyGuarantorPartyDrafts(),
        dirty: false,
      })
    ).toEqual({
      corporateRepsById: { g_co: [{ ...EMPTY_CORPORATE_REP }] },
      individualEmailsById: { g_ind: "ali@home.my" },
    });
  });

  it("replaces defaults with a snapshot that arrives later", () => {
    expect(
      nextGuarantorPartyDrafts({
        snapshot: {
          submitted_by_user_id: "user_1",
          submitted_at: "2026-08-21T00:00:00.000Z",
          parties: [
            {
              key: "g_co",
              entity_kind: "CORPORATE_GUARANTOR",
              application_guarantor_id: "g_co",
              representatives: [nora],
            },
            {
              key: "g_ind",
              entity_kind: "INDIVIDUAL_GUARANTOR",
              application_guarantor_id: "g_ind",
              representatives: [
                {
                  name: "Ali Bin Abu",
                  email: "ali.personal@co.my",
                  ic_number: "820508105871",
                  capacity: "authorised_signatory",
                },
              ],
            },
          ],
        },
        guarantors: [company, individual],
        current: {
          corporateRepsById: { g_co: [{ ...EMPTY_CORPORATE_REP }] },
          individualEmailsById: { g_ind: "ali@home.my" },
        },
        dirty: false,
      })
    ).toMatchObject({
      corporateRepsById: { g_co: [{ name: "Nora", email: "nora@holdco.my" }] },
      individualEmailsById: { g_ind: "ali.personal@co.my" },
    });
  });

  it("hydrates corporate reps when snapshot ids are stale Prisma rows", () => {
    const liveCompany: ApplicationGuarantorRow = {
      ...company,
      id: "new_co",
      client_guarantor_id: "g-company-abc",
    };
    expect(
      nextGuarantorPartyDrafts({
        snapshot: {
          submitted_by_user_id: "user_1",
          submitted_at: "2026-08-21T00:00:00.000Z",
          parties: [
            {
              key: "old_co",
              entity_kind: "CORPORATE_GUARANTOR",
              application_guarantor_id: "old_prisma_co",
              client_guarantor_id: "g-company-abc",
              representatives: [nora],
            },
          ],
        },
        guarantors: [liveCompany],
        current: {
          corporateRepsById: { new_co: [{ ...EMPTY_CORPORATE_REP }] },
          individualEmailsById: {},
        },
        dirty: false,
      })
    ).toMatchObject({
      corporateRepsById: { new_co: [{ name: "Nora", email: "nora@holdco.my" }] },
    });
  });

  it("keeps a user edit when a snapshot arrives", () => {
    expect(
      nextGuarantorPartyDrafts({
        snapshot: {
          submitted_by_user_id: "user_1",
          submitted_at: "2026-08-21T00:00:00.000Z",
          parties: [
            {
              key: "g_co",
              entity_kind: "CORPORATE_GUARANTOR",
              application_guarantor_id: "g_co",
              representatives: [nora],
            },
          ],
        },
        guarantors: [company],
        current: {
          corporateRepsById: {
            g_co: [{ name: "Edited", email: "e@x.my" }],
          },
          individualEmailsById: {},
        },
        dirty: true,
      })
    ).toBeNull();
  });
});

describe("areGuarantorPartiesReady", () => {
  it("requires a complete corporate name and email, and a valid individual email plus IC", () => {
    expect(
      areGuarantorPartiesReady([company, individual], {
        corporateRepsById: {
          g_co: [{ name: "Nora", email: "nora@holdco.my" }],
        },
        individualEmailsById: { g_ind: "ali@home.my" },
      })
    ).toBe(true);
    expect(
      areGuarantorPartiesReady([company], {
        corporateRepsById: { g_co: [{ ...EMPTY_CORPORATE_REP }] },
        individualEmailsById: {},
      })
    ).toBe(false);
  });
});

describe("buildAuthorizedPartiesSubmitPayload", () => {
  it("appends corporate and individual parties after the issuer", () => {
    const payload = buildAuthorizedPartiesSubmitPayload({
      directors,
      selectedMatchKeys: ["820508105871"],
      guarantors: [company, individual],
      drafts: {
        corporateRepsById: { g_co: [nora] },
        individualEmailsById: { g_ind: "ali.personal@co.my" },
      },
    });
    expect(payload.parties.map((party) => party.entity_kind)).toEqual([
      "ISSUER",
      "CORPORATE_GUARANTOR",
      "INDIVIDUAL_GUARANTOR",
    ]);
    expect(payload.parties[1]).toMatchObject({
      application_guarantor_id: "g_co",
      representatives: [
        { name: "Nora", email: "nora@holdco.my", ic_number: "", capacity: "authorised_signatory" },
      ],
    });
    expect(payload.parties[2]).toMatchObject({
      application_guarantor_id: "g_ind",
      representatives: [
        {
          name: "Ali Bin Abu",
          email: "ali.personal@co.my",
          ic_number: "820508105871",
          capacity: "authorised_signatory",
        },
      ],
    });
  });
});
