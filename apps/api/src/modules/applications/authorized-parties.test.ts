import { AppError } from "../../lib/http/error-handler";
import { submitOfferAcceptanceBodySchema } from "./schemas";
import {
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
    person_match_key: string;
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

  it("rejects a company representative without a 12-digit IC", () => {
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

  it("rejects an empty parties array", () => {
    const result = submitOfferAcceptanceBodySchema.safeParse({
      authorized_parties: { parties: [] },
    });
    expect(result.success).toBe(false);
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
