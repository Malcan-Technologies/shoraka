import {
  ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE,
  type AuthorizedPartiesSnapshot,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { submitOfferAcceptanceBodySchema } from "./schemas";
import {
  assertApprovedIssuerRepresentativesCurrent,
  assertAuthorizedPartiesValid,
  assertGuarantorAuthorizedPartiesValid,
  assertIssuerAuthorizedPartiesValid,
  directorPoolFromPeople,
} from "./authorized-parties";

const ALI = {
  matchKey: "820508105871",
  name: "Ali Bin Abu",
  email: "ali@co.my",
  roles: ["DIRECTOR"],
};

const SITI = {
  matchKey: "900101015555",
  name: "Siti",
  email: "siti@co.my",
  roles: ["DIRECTOR"],
};

const SHAREHOLDER = {
  matchKey: "880202025555",
  name: "Only Shareholder",
  email: "share@co.my",
  roles: ["SHAREHOLDER"],
};

const issuerParty = (
  representatives: Array<{
    name: string;
    email: string;
    ic_number: string;
    capacity: "director" | "authorised_signatory";
    person_match_key?: string;
    applies_company_seal?: boolean;
  }>
) =>
  ({
    key: "issuer" as const,
    entity_kind: "ISSUER" as const,
    representatives,
  });

describe("directorPoolFromPeople", () => {
  it("keeps directors with email and drops shareholders", () => {
    const pool = directorPoolFromPeople([ALI, SITI, SHAREHOLDER]);
    expect(pool.map((entry) => entry.email)).toEqual(["ali@co.my", "siti@co.my"]);
    expect(pool[0]?.icNumber).toBe("820508105871");
  });

  it("uses the current Person Email for a new authorised-representative pool", () => {
    const pool = directorPoolFromPeople([{ ...ALI, email: "new-person@co.my" }]);
    expect(pool.map((entry) => entry.email)).toEqual(["new-person@co.my"]);
  });

  it("uses identityNumber when matchKey is a generated user key", () => {
    const pool = directorPoolFromPeople([
      {
        matchKey: "user:abc",
        identityNumber: "820508105871",
        name: "Normal Director",
        email: "sec.practitioner@proton.me",
        roles: ["DIRECTOR"],
      },
    ]);
    expect(pool).toEqual([
      {
        matchKey: "user:abc",
        name: "Normal Director",
        email: "sec.practitioner@proton.me",
        icNumber: "820508105871",
      },
    ]);
  });

  it("does not treat a generated user key as IC", () => {
    const pool = directorPoolFromPeople([
      {
        matchKey: "user:abc",
        identityNumber: null,
        name: "Normal Director",
        email: "sec.practitioner@proton.me",
        roles: ["DIRECTOR"],
      },
    ]);
    expect(pool[0]?.icNumber).toBe("");
  });
});

describe("assertApprovedIssuerRepresentativesCurrent", () => {
  const snapshot: AuthorizedPartiesSnapshot = {
    submitted_by_user_id: "user-1",
    submitted_at: "2026-09-17T00:00:00.000Z",
    parties: [
      issuerParty([
        {
          name: "Ali Bin Abu",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director",
          person_match_key: "820508105871",
        },
      ]),
    ],
  };

  it("accepts an approved representative whose Person Email is unchanged", () => {
    expect(() =>
      assertApprovedIssuerRepresentativesCurrent(snapshot, directorPoolFromPeople([ALI]))
    ).not.toThrow();
  });

  it("requires representative review when Person Email changed after approval", () => {
    expect(() =>
      assertApprovedIssuerRepresentativesCurrent(
        snapshot,
        directorPoolFromPeople([{ ...ALI, email: "new@co.my" }])
      )
    ).toThrow(
      expect.objectContaining({
        code: "AUTHORIZED_REPRESENTATIVE_PROFILE_CHANGED",
      })
    );
  });

  it("requires representative review when the approved person is no longer eligible", () => {
    expect(() => assertApprovedIssuerRepresentativesCurrent(snapshot, [])).toThrow(
      expect.objectContaining({
        code: "AUTHORIZED_REPRESENTATIVE_PROFILE_CHANGED",
      })
    );
  });

  it("revalidates a legacy snapshot without person_match_key by IC and email", () => {
    const legacySnapshot: AuthorizedPartiesSnapshot = {
      ...snapshot,
      parties: [
        issuerParty([
          {
            name: "Ali Bin Abu",
            email: "ali@co.my",
            ic_number: "820508105871",
            capacity: "director",
          },
        ]),
      ],
    };
    expect(() =>
      assertApprovedIssuerRepresentativesCurrent(legacySnapshot, directorPoolFromPeople([ALI]))
    ).not.toThrow();
    expect(() =>
      assertApprovedIssuerRepresentativesCurrent(
        legacySnapshot,
        directorPoolFromPeople([{ ...ALI, email: "new@co.my" }])
      )
    ).toThrow(
      expect.objectContaining({
        code: "AUTHORIZED_REPRESENTATIVE_PROFILE_CHANGED",
      })
    );
  });
});

describe("assertIssuerAuthorizedPartiesValid", () => {
  const pool = directorPoolFromPeople([ALI, SITI, SHAREHOLDER]);

  it("accepts a valid issuer director", () => {
    expect(() =>
      assertIssuerAuthorizedPartiesValid(
        [
          issuerParty([
            {
              name: "Ali Bin Abu",
              email: "ali@co.my",
              ic_number: "820508105871",
              capacity: "director",
              person_match_key: "820508105871",
            },
          ]),
        ],
        pool
      )
    ).not.toThrow();
  });

  it("rejects a missing issuer party", () => {
    try {
      assertIssuerAuthorizedPartiesValid([], pool);
      fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(400);
      expect((error as AppError).code).toBe("AUTHORIZED_PARTIES_INVALID");
    }
  });

  it("rejects an unknown director email", () => {
    try {
      assertIssuerAuthorizedPartiesValid(
        [
          issuerParty([
            {
              name: "Unknown",
              email: "unknown@co.my",
              ic_number: "820508105871",
              capacity: "director",
              person_match_key: "820508105871",
            },
          ]),
        ],
        pool
      );
      fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("AUTHORIZED_PARTIES_INVALID");
      expect((error as AppError).message).toMatch(/directors/);
    }
  });

  it("rejects a shareholder treated as a director", () => {
    try {
      assertIssuerAuthorizedPartiesValid(
        [
          issuerParty([
            {
              name: "Only Shareholder",
              email: "share@co.my",
              ic_number: "880202025555",
              capacity: "director",
              person_match_key: "880202025555",
            },
          ]),
        ],
        pool
      );
      fail("expected throw");
    } catch (error) {
      expect((error as AppError).code).toBe("AUTHORIZED_PARTIES_INVALID");
    }
  });

  it("rejects a match key and email that belong to different directors", () => {
    try {
      assertIssuerAuthorizedPartiesValid(
        [
          issuerParty([
            {
              name: "Ali Bin Abu",
              email: "siti@co.my",
              ic_number: "820508105871",
              capacity: "director",
              person_match_key: "820508105871",
            },
          ]),
        ],
        pool
      );
      fail("expected throw");
    } catch (error) {
      expect((error as AppError).code).toBe("AUTHORIZED_PARTIES_INVALID");
    }
  });

  it("stamps name email and IC from the director pool", () => {
    const parties = [
      issuerParty([
        {
          name: "Alias",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director",
          person_match_key: "820508105871",
        },
      ]),
    ];
    assertIssuerAuthorizedPartiesValid(parties, pool);
    expect(parties[0]?.representatives[0]).toMatchObject({
      name: "Ali Bin Abu",
      email: "ali@co.my",
      ic_number: "820508105871",
      person_match_key: "820508105871",
    });
  });

  it("does not require a seal applier by default", () => {
    expect(() =>
      assertIssuerAuthorizedPartiesValid(
        [
          issuerParty([
            {
              name: "Ali Bin Abu",
              email: "ali@co.my",
              ic_number: "820508105871",
              capacity: "director",
              person_match_key: "820508105871",
            },
          ]),
        ],
        pool
      )
    ).not.toThrow();
  });

  it("requires exactly one seal applier when requireSealApplier is true", () => {
    try {
      assertIssuerAuthorizedPartiesValid(
        [
          issuerParty([
            {
              name: "Ali Bin Abu",
              email: "ali@co.my",
              ic_number: "820508105871",
              capacity: "director",
              person_match_key: "820508105871",
            },
          ]),
        ],
        pool,
        { requireSealApplier: true }
      );
      fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("AUTHORIZED_PARTIES_INVALID");
      expect((error as AppError).message).toBe(ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE);
    }
  });

  it("accepts a single seal applier when requireSealApplier is true", () => {
    expect(() =>
      assertIssuerAuthorizedPartiesValid(
        [
          issuerParty([
            {
              name: "Ali Bin Abu",
              email: "ali@co.my",
              ic_number: "820508105871",
              capacity: "director",
              person_match_key: "820508105871",
              applies_company_seal: true,
            },
          ]),
        ],
        pool,
        { requireSealApplier: true }
      )
    ).not.toThrow();
  });
});

describe("assertAuthorizedPartiesValid", () => {
  const pool = directorPoolFromPeople([ALI]);

  it("keeps requireSealApplier off unless callers pass it", () => {
    expect(() =>
      assertAuthorizedPartiesValid(
        [
          issuerParty([
            {
              name: "Ali Bin Abu",
              email: "ali@co.my",
              ic_number: "820508105871",
              capacity: "director",
              person_match_key: "820508105871",
            },
          ]),
        ],
        pool,
        []
      )
    ).not.toThrow();
  });
});

const COMPANY = {
  id: "g_co",
  guarantor_type: "company" as const,
  name: null,
  email: "holdco@co.my",
  ic_number: null,
  business_name: "HoldCo Sdn Bhd",
};

const INDIVIDUAL = {
  id: "g_ind",
  guarantor_type: "individual" as const,
  name: "Ali Bin Abu",
  email: "ali@home.my",
  ic_number: "820508105871",
  business_name: null,
};

const corporateParty = (
  representatives: Array<{
    name: string;
    email: string;
    ic_number: string;
    capacity: "director" | "authorised_signatory";
  }>
) => ({
  key: "g_co",
  entity_kind: "CORPORATE_GUARANTOR" as const,
  application_guarantor_id: "g_co",
  representatives,
});

const individualParty = (overrides?: {
  name?: string;
  email?: string;
  ic_number?: string;
}) => ({
  key: "g_ind",
  entity_kind: "INDIVIDUAL_GUARANTOR" as const,
  application_guarantor_id: "g_ind",
  representatives: [
    {
      name: overrides?.name ?? "Alias",
      email: overrides?.email ?? "ali.personal@co.my",
      ic_number: overrides?.ic_number ?? "000000000000",
      capacity: "authorised_signatory" as const,
    },
  ],
});

const noraRep = {
  name: "Nora",
  email: "nora@holdco.my",
  ic_number: "880101015555",
  capacity: "authorised_signatory" as const,
};

function expectAuthorizedPartiesInvalid(run: () => void, message?: RegExp) {
  try {
    run();
    fail("expected throw");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("AUTHORIZED_PARTIES_INVALID");
    if (message) expect((error as AppError).message).toMatch(message);
  }
}

describe("assertGuarantorAuthorizedPartiesValid", () => {
  it("accepts mixed individual and company parties and stamps individual identity from the row", () => {
    const parties = [corporateParty([noraRep]), individualParty()];
    expect(() =>
      assertGuarantorAuthorizedPartiesValid(parties, [COMPANY, INDIVIDUAL])
    ).not.toThrow();
    expect(parties[1]?.representatives[0]).toMatchObject({
      name: "Ali Bin Abu",
      email: "ali.personal@co.my",
      ic_number: "820508105871",
    });
    expect(parties[0]?.representatives[0]).toMatchObject({
      name: "Nora",
      email: "nora@holdco.my",
      ic_number: "880101015555",
    });
  });

  it("keeps submitted individual identity when that guarantor list is flagged for change", () => {
    const parties = [individualParty({ name: "Ali Edited", ic_number: "901212101234" })];
    expect(() =>
      assertGuarantorAuthorizedPartiesValid(parties, [INDIVIDUAL], new Set([
        "authorized_representatives:guarantor:g_ind",
      ]))
    ).not.toThrow();
    expect(parties[0]?.representatives[0]).toMatchObject({
      name: "Ali Edited",
      email: "ali.personal@co.my",
      ic_number: "901212101234",
    });
  });

  it("rejects a flagged individual identity without a 12-digit IC", () => {
    expectAuthorizedPartiesInvalid(
      () =>
        assertGuarantorAuthorizedPartiesValid(
          [individualParty({ name: "Ali Edited", ic_number: "12" })],
          [INDIVIDUAL],
          new Set(["authorized_representatives:guarantor:g_ind"])
        ),
      /12-digit IC/
    );
  });

  it("rejects a missing company representative list", () => {
    expectAuthorizedPartiesInvalid(
      () =>
        assertGuarantorAuthorizedPartiesValid([individualParty()], [COMPANY, INDIVIDUAL]),
      /every guarantor/i
    );
  });

  it("rejects a company submitted as an individual", () => {
    expectAuthorizedPartiesInvalid(
      () =>
        assertGuarantorAuthorizedPartiesValid(
          [
            {
              key: "g_co",
              entity_kind: "INDIVIDUAL_GUARANTOR",
              application_guarantor_id: "g_co",
              representatives: [
                {
                  name: "HoldCo Sdn Bhd",
                  email: "holdco@co.my",
                  ic_number: "880101015555",
                  capacity: "authorised_signatory",
                },
              ],
            },
          ],
          [COMPANY]
        ),
      /cannot be submitted as individuals/
    );
  });

  it("rejects a company representative without an IC", () => {
    expectAuthorizedPartiesInvalid(
      () =>
        assertGuarantorAuthorizedPartiesValid(
          [
            corporateParty([
              { name: "Nora", email: "nora@holdco.my", ic_number: "", capacity: "director" },
            ]),
          ],
          [COMPANY]
        ),
      /12-digit IC number/
    );
  });

  it("rejects a company representative with a malformed IC", () => {
    expectAuthorizedPartiesInvalid(() =>
      assertGuarantorAuthorizedPartiesValid(
        [
          corporateParty([
            { name: "Nora", email: "nora@holdco.my", ic_number: "12", capacity: "director" },
          ]),
        ],
        [COMPANY]
      )
    );
  });

  it("rejects an unknown guarantor id", () => {
    expectAuthorizedPartiesInvalid(() =>
      assertGuarantorAuthorizedPartiesValid(
        [
          {
            ...corporateParty([noraRep]),
            key: "g_other",
            application_guarantor_id: "g_other",
          },
        ],
        [COMPANY]
      )
    );
  });

  it("stamps live Prisma id and client_guarantor_id when the client posted the form id", () => {
    const parties = [
      {
        key: "g-company-abc",
        entity_kind: "CORPORATE_GUARANTOR" as const,
        application_guarantor_id: "g-company-abc",
        representatives: [noraRep],
      },
    ];
    expect(() =>
      assertGuarantorAuthorizedPartiesValid(parties, [
        { ...COMPANY, id: "prisma_co", client_guarantor_id: "g-company-abc" },
      ])
    ).not.toThrow();
    expect(parties[0]?.application_guarantor_id).toBe("prisma_co");
    expect(parties[0]?.client_guarantor_id).toBe("g-company-abc");
    expect(parties[0]?.key).toBe("g-company-abc");
  });
});

describe("submitOfferAcceptanceBodySchema", () => {
  const issuerBody = {
    key: "issuer" as const,
    entity_kind: "ISSUER" as const,
    representatives: [
      {
        name: "Ali Bin Abu",
        email: "ali@co.my",
        ic_number: "820508105871",
        capacity: "director" as const,
        person_match_key: "820508105871",
      },
    ],
  };

  it("accepts issuer plus mixed guarantor parties", () => {
    const parsed = submitOfferAcceptanceBodySchema.parse({
      authorized_parties: {
        parties: [issuerBody, corporateParty([noraRep]), individualParty()],
      },
    });
    expect(parsed.authorized_parties.parties.map((party) => party.entity_kind)).toEqual([
      "ISSUER",
      "CORPORATE_GUARANTOR",
      "INDIVIDUAL_GUARANTOR",
    ]);
  });

  it("rejects a corporate representative without an IC", () => {
    const result = submitOfferAcceptanceBodySchema.safeParse({
      authorized_parties: {
        parties: [
          issuerBody,
          corporateParty([
            { name: "Nora", email: "nora@holdco.my", ic_number: "", capacity: "authorised_signatory" },
          ]),
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty parties array", () => {
    const result = submitOfferAcceptanceBodySchema.safeParse({
      authorized_parties: { parties: [] },
    });
    expect(result.success).toBe(false);
  });

  it("keeps applies_company_seal on the issuer representative", () => {
    const parsed = submitOfferAcceptanceBodySchema.parse({
      authorized_parties: {
        parties: [
          {
            ...issuerBody,
            representatives: [{ ...issuerBody.representatives[0]!, applies_company_seal: true }],
          },
        ],
      },
    });
    expect(parsed.authorized_parties.parties[0]?.representatives[0]?.applies_company_seal).toBe(
      true
    );
  });

  it("rejects duplicate party keys", () => {
    const result = submitOfferAcceptanceBodySchema.safeParse({
      authorized_parties: {
        parties: [issuerBody, corporateParty([noraRep]), { ...corporateParty([noraRep]) }],
      },
    });
    expect(result.success).toBe(false);
  });
});
