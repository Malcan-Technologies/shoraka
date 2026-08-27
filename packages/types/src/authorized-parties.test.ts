import { offerAcceptanceFreezesAuthorizedParties, parseOfferAcceptanceDetails } from "./offer-acceptance";
import {
  authorizedPartyListFingerprint,
  authorizedPartyReadOnlyBlocks,
  findSubmittedPartyForSnapshotParty,
  authorizedRepresentativeReviewItemId,
  collectAuthorizedRepresentativeReviewKeys,
  getIssuerAuthorizedParty,
  groupAuthorizedPartyReadOnlyBlocks,
  guarantorBindingsFromSnapshot,
  issuerDirectorBindingsFromSnapshot,
  loCorporateAuthorizedNamesByParty,
  loIssuerAuthorizedNames,
  matchAuthorizedPartiesToGuarantors,
  parseAuthorizedPartiesSnapshot,
  postedBindingsMatchApprovedSnapshot,
  snapshotSignerBindings,
  resolveLiveApplicationGuarantorId,
  serializeAuthorizedPartiesSnapshot,
  stampAuthorizedPartiesSnapshot,
  summarizeAuthorizedParties,
  type AuthorizedPartiesSnapshot,
} from "./authorized-parties";

const ISSUER_SNAPSHOT: AuthorizedPartiesSnapshot = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER",
      representatives: [
        {
          name: "Ali Bin Abu",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director",
          person_match_key: "820508105871",
        },
      ],
    },
  ],
};

const MIXED_SNAPSHOT: AuthorizedPartiesSnapshot = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    ISSUER_SNAPSHOT.parties[0]!,
    {
      key: "g_co",
      entity_kind: "CORPORATE_GUARANTOR",
      application_guarantor_id: "g_co",
      representatives: [
        {
          name: "Nora",
          email: "nora@holdco.my",
          ic_number: "880101015555",
          capacity: "authorised_signatory",
        },
        {
          name: "Farid",
          email: "farid@holdco.my",
          ic_number: "770202025555",
          capacity: "director",
        },
      ],
    },
    {
      key: "g_ind",
      entity_kind: "INDIVIDUAL_GUARANTOR",
      application_guarantor_id: "g_ind",
      representatives: [
        {
          name: "Ali Bin Abu",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "authorised_signatory",
        },
      ],
    },
  ],
};

describe("parseAuthorizedPartiesSnapshot", () => {
  it("parses a valid issuer snapshot", () => {
    expect(parseAuthorizedPartiesSnapshot(ISSUER_SNAPSHOT)).toEqual(ISSUER_SNAPSHOT);
  });

  it("parses mixed issuer and guarantor parties", () => {
    expect(parseAuthorizedPartiesSnapshot(MIXED_SNAPSHOT)).toEqual(MIXED_SNAPSHOT);
  });

  it("ignores unknown party kinds and keeps issuer", () => {
    const parsed = parseAuthorizedPartiesSnapshot({
      submitted_by_user_id: "user_1",
      submitted_at: "2026-08-21T00:00:00.000Z",
      parties: [
        ISSUER_SNAPSHOT.parties[0],
        {
          key: "trustee",
          entity_kind: "TRUSTEE",
          representatives: [{ name: "X", email: "x@co.my", ic_number: "820508105871", capacity: "director" }],
        },
      ],
    });
    expect(parsed?.parties).toHaveLength(1);
    expect(parsed?.parties[0]?.entity_kind).toBe("ISSUER");
  });

  it("does not treat a guarantor with key issuer as the issuer party", () => {
    const parsed = parseAuthorizedPartiesSnapshot({
      submitted_by_user_id: "user_1",
      submitted_at: "2026-08-21T00:00:00.000Z",
      parties: [
        {
          key: "issuer",
          entity_kind: "CORPORATE_GUARANTOR",
          application_guarantor_id: "g1",
          representatives: [
            { name: "X", email: "x@co.my", ic_number: "820508105871", capacity: "director" },
          ],
        },
      ],
    });
    expect(parsed?.parties).toHaveLength(1);
    expect(parsed?.parties[0]).toMatchObject({
      entity_kind: "CORPORATE_GUARANTOR",
      application_guarantor_id: "g1",
    });
  });

  it("returns null when submitted_by_user_id is missing", () => {
    expect(
      parseAuthorizedPartiesSnapshot({
        submitted_at: "2026-08-21T00:00:00.000Z",
        parties: ISSUER_SNAPSHOT.parties,
      })
    ).toBeNull();
  });

  it("normalizes email and IC on parse", () => {
    const parsed = parseAuthorizedPartiesSnapshot({
      submitted_by_user_id: "user_1",
      submitted_at: "2026-08-21T00:00:00.000Z",
      parties: [
        {
          key: "issuer",
          entity_kind: "ISSUER",
          representatives: [
            {
              name: "Ali",
              email: "  Ali@Co.MY ",
              ic_number: "820508-10-5871",
              capacity: "director",
              person_match_key: "820508105871",
            },
          ],
        },
      ],
    });
    expect(parsed?.parties[0]?.representatives[0]).toMatchObject({
      email: "ali@co.my",
      ic_number: "820508105871",
    });
    expect(parsed?.parties[0]).toMatchObject({
      entity_kind: "ISSUER",
    });
  });

  it("drops leftover signing_rule and will_sign fields from older snapshots", () => {
    const parsed = parseAuthorizedPartiesSnapshot({
      submitted_by_user_id: "user_1",
      submitted_at: "2026-08-21T00:00:00.000Z",
      parties: [
        {
          key: "issuer",
          entity_kind: "ISSUER",
          signing_rule: "ANY_N",
          mandate_n: 2,
          representatives: [
            {
              name: "Ali",
              email: "ali@co.my",
              ic_number: "820508105871",
              capacity: "director",
              person_match_key: "820508105871",
              will_sign: false,
            },
          ],
        },
      ],
    });
    expect(parsed?.parties[0]).toEqual({
      key: "issuer",
      entity_kind: "ISSUER",
      representatives: [
        {
          name: "Ali",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director",
          person_match_key: "820508105871",
        },
      ],
    });
  });
});

describe("serializeAuthorizedPartiesSnapshot", () => {
  it("round-trips a snapshot", () => {
    const serialized = serializeAuthorizedPartiesSnapshot(ISSUER_SNAPSHOT);
    expect(parseAuthorizedPartiesSnapshot(serialized)).toEqual(ISSUER_SNAPSHOT);
  });
});

describe("stampAuthorizedPartiesSnapshot", () => {
  it("stamps submit metadata", () => {
    const stamped = stampAuthorizedPartiesSnapshot({
      parties: ISSUER_SNAPSHOT.parties,
      submittedByUserId: "user_9",
      submittedAt: "2026-08-21T12:00:00.000Z",
    });
    expect(stamped.submitted_by_user_id).toBe("user_9");
    expect(stamped.submitted_at).toBe("2026-08-21T12:00:00.000Z");
    expect(getIssuerAuthorizedParty(stamped)?.representatives).toHaveLength(1);
  });
});

describe("summarizeAuthorizedParties", () => {
  it("returns a compact party summary", () => {
    expect(summarizeAuthorizedParties(ISSUER_SNAPSHOT)).toEqual({
      submitted_by_user_id: "user_1",
      parties: [
        {
          key: "issuer",
          entity_kind: "ISSUER",
          representative_count: 1,
          names: ["Ali Bin Abu"],
        },
      ],
    });
  });
});

describe("parseOfferAcceptanceDetails authorized_parties", () => {
  it("keeps the snapshot on the acceptance blob", () => {
    const parsed = parseOfferAcceptanceDetails({
      status: "PENDING_ADMIN_REVIEW",
      authorized_parties: ISSUER_SNAPSHOT,
    });
    expect(parsed?.authorized_parties).toEqual(ISSUER_SNAPSHOT);
  });
});

describe("issuerDirectorBindingsFromSnapshot", () => {
  it("maps issuer representatives onto the director role", () => {
    expect(issuerDirectorBindingsFromSnapshot(ISSUER_SNAPSHOT, "issuer_director")).toEqual([
      {
        role_key: "issuer_director",
        name: "Ali Bin Abu",
        email: "ali@co.my",
        ic_number: "820508105871",
      },
    ]);
  });

  it("returns empty when there is no issuer party", () => {
    expect(issuerDirectorBindingsFromSnapshot(null, "issuer_director")).toEqual([]);
  });
});

describe("guarantorBindingsFromSnapshot", () => {
  it("maps each corporate rep and the individual onto guarantor bindings", () => {
    expect(guarantorBindingsFromSnapshot(MIXED_SNAPSHOT, "guarantor")).toEqual([
      {
        role_key: "guarantor",
        name: "Nora",
        email: "nora@holdco.my",
        ic_number: "880101015555",
        application_guarantor_id: "g_co",
      },
      {
        role_key: "guarantor",
        name: "Farid",
        email: "farid@holdco.my",
        ic_number: "770202025555",
        application_guarantor_id: "g_co",
      },
      {
        role_key: "guarantor",
        name: "Ali Bin Abu",
        email: "ali@co.my",
        ic_number: "820508105871",
        application_guarantor_id: "g_ind",
      },
    ]);
  });

  it("returns empty when there is no snapshot", () => {
    expect(guarantorBindingsFromSnapshot(null, "guarantor")).toEqual([]);
  });
});

describe("LO names", () => {
  it("joins all declared issuer names and lists every corporate party's signatories", () => {
    expect(loIssuerAuthorizedNames(MIXED_SNAPSHOT)).toBe("Ali Bin Abu");
    expect(loCorporateAuthorizedNamesByParty(MIXED_SNAPSHOT)).toEqual([
      {
        partyKey: "g_co",
        applicationGuarantorId: "g_co",
        names: ["Nora", "Farid"],
      },
    ]);
    expect(loCorporateAuthorizedNamesByParty(null)).toEqual([]);
  });
});

describe("authorizedPartyReadOnlyBlocks", () => {
  it("returns one block per entity and groups them by party type", () => {
    const blocks = authorizedPartyReadOnlyBlocks(MIXED_SNAPSHOT, [
      { id: "g_ind", name: "Ali Bin Abu", business_name: null },
      { id: "g_co", name: null, business_name: "HoldCo Sdn Bhd" },
    ]);
    expect(blocks.map((block) => block.title)).toEqual([
      "Issuer company",
      "Ali Bin Abu",
      "HoldCo Sdn Bhd",
    ]);
    expect(blocks[2]?.representatives).toHaveLength(2);
    expect(blocks[2]?.representatives.map((rep) => rep.name)).toEqual(["Nora", "Farid"]);
    expect(blocks[2]?.representatives.map((rep) => rep.ic_number)).toEqual([
      "880101015555",
      "770202025555",
    ]);
    expect(blocks.map((block) => block.review_item_id)).toEqual([
      "authorized_representatives:issuer",
      "authorized_representatives:guarantor:g_ind",
      "authorized_representatives:guarantor:g_co",
    ]);
    expect(groupAuthorizedPartyReadOnlyBlocks(blocks).map((group) => group.title)).toEqual([
      "Issuer company",
      "Corporate guarantors",
      "Individual guarantors",
    ]);
  });

  it("resolves company names when snapshot ids no longer match live Prisma rows", () => {
    const blocks = authorizedPartyReadOnlyBlocks(MIXED_SNAPSHOT, [
      {
        id: "new_ind",
        client_guarantor_id: "g_ind",
        guarantor_type: "individual",
        name: "Ali Bin Abu",
        business_name: null,
      },
      {
        id: "new_co",
        client_guarantor_id: "g_co",
        guarantor_type: "company",
        name: null,
        business_name: "HoldCo Sdn Bhd",
      },
    ]);
    expect(blocks.find((block) => block.entity_kind === "CORPORATE_GUARANTOR")?.title).toBe(
      "HoldCo Sdn Bhd"
    );
    expect(blocks.find((block) => block.entity_kind === "INDIVIDUAL_GUARANTOR")?.title).toBe(
      "Ali Bin Abu"
    );
  });

  it("does not pair leftover parties of the same kind when ids do not match", () => {
    const stale: AuthorizedPartiesSnapshot = {
      ...MIXED_SNAPSHOT,
      parties: MIXED_SNAPSHOT.parties.map((party) =>
        party.entity_kind === "ISSUER"
          ? party
          : {
              ...party,
              application_guarantor_id: `old_${party.application_guarantor_id}`,
              client_guarantor_id: `old_${party.application_guarantor_id}`,
            }
      ),
    };
    const matches = matchAuthorizedPartiesToGuarantors(stale.parties, [
      {
        id: "new_ind",
        client_guarantor_id: "g-individual-ahmad",
        guarantor_type: "individual",
        name: "Ali Bin Abu",
      },
      {
        id: "new_co",
        client_guarantor_id: "g-company-abc",
        guarantor_type: "company",
        business_name: "ABC Holdings Sdn Bhd",
      },
    ]);
    expect(matches.size).toBe(0);
    const blocks = authorizedPartyReadOnlyBlocks(stale, [
      {
        id: "new_ind",
        client_guarantor_id: "g-individual-ahmad",
        guarantor_type: "individual",
        name: "Ali Bin Abu",
      },
      {
        id: "new_co",
        client_guarantor_id: "g-company-abc",
        guarantor_type: "company",
        business_name: "ABC Holdings Sdn Bhd",
      },
    ]);
    expect(blocks.find((block) => block.entity_kind === "CORPORATE_GUARANTOR")?.title).toBe(
      "Company guarantor"
    );
  });

  it("pairs a submitted party onto a snapshot party after Prisma ids are rewritten", () => {
    const snapshotParty = {
      ...MIXED_SNAPSHOT.parties[1]!,
      client_guarantor_id: "g-company-abc",
    };
    const submitted = {
      ...snapshotParty,
      key: "new_co",
      application_guarantor_id: "new_co",
      client_guarantor_id: "g-company-abc",
    };
    const matched = findSubmittedPartyForSnapshotParty(
      snapshotParty,
      [MIXED_SNAPSHOT.parties[0]!, snapshotParty],
      [MIXED_SNAPSHOT.parties[0]!, submitted],
      [
        {
          id: "new_co",
          client_guarantor_id: "g-company-abc",
          guarantor_type: "company",
          business_name: "HoldCo Sdn Bhd",
        },
        {
          id: "new_ind",
          client_guarantor_id: "g-individual-ali",
          guarantor_type: "individual",
          name: "Ali Bin Abu",
        },
      ]
    );
    expect(matched?.application_guarantor_id).toBe("new_co");
    expect(authorizedPartyListFingerprint(snapshotParty)).toBe(
      authorizedPartyListFingerprint(submitted)
    );
  });
});

describe("authorized representative review keys", () => {
  it("maps issuer and guarantor parties to review item ids", () => {
    expect(collectAuthorizedRepresentativeReviewKeys(MIXED_SNAPSHOT)).toEqual([
      "authorized_representatives:issuer",
      "authorized_representatives:guarantor:g_co",
      "authorized_representatives:guarantor:g_ind",
    ]);
    expect(authorizedRepresentativeReviewItemId(MIXED_SNAPSHOT.parties[0]!)).toBe(
      "authorized_representatives:issuer"
    );
  });

  it("treats representative order as irrelevant for fingerprints", () => {
    const original = MIXED_SNAPSHOT.parties[1]!;
    if (original.entity_kind !== "CORPORATE_GUARANTOR") throw new Error("expected corporate");
    const reversed = {
      ...original,
      representatives: [...original.representatives].reverse(),
    };
    expect(authorizedPartyListFingerprint(original)).toBe(authorizedPartyListFingerprint(reversed));
  });

  it("resolves posted client_guarantor_id onto the live Prisma row", () => {
    expect(
      resolveLiveApplicationGuarantorId("g-company-abc", [
        { id: "new_co", client_guarantor_id: "g-company-abc" },
      ])
    ).toBe("new_co");
    expect(
      resolveLiveApplicationGuarantorId("new_co", [
        { id: "new_co", client_guarantor_id: "g-company-abc" },
      ])
    ).toBe("new_co");
    expect(resolveLiveApplicationGuarantorId("missing", [{ id: "new_co" }])).toBeNull();
  });
});

describe("postedBindingsMatchApprovedSnapshot", () => {
  const roles = [
    { key: "issuer_director", source_hint: "issuer_director" },
    { key: "guarantor", source_hint: "guarantor" },
    { key: "witness", source_hint: null },
  ];

  it("accepts posted bindings that match the snapshot (ignoring extra roles and guarantor IC)", () => {
    expect(
      postedBindingsMatchApprovedSnapshot({
        snapshot: MIXED_SNAPSHOT,
        roles,
        posted: [
          {
            role_key: "issuer_director",
            name: "Ali Bin Abu",
            email: "ali@co.my",
            ic_number: "820508105871",
          },
          {
            role_key: "guarantor",
            name: "Nora",
            email: "nora@holdco.my",
            ic_number: null,
            application_guarantor_id: "g_co",
          },
          {
            role_key: "guarantor",
            name: "Farid",
            email: "farid@holdco.my",
            ic_number: null,
            application_guarantor_id: "g_co",
          },
          {
            role_key: "guarantor",
            name: "Ali Bin Abu",
            email: "ali@co.my",
            ic_number: null,
            application_guarantor_id: "g_ind",
          },
          {
            role_key: "witness",
            name: "Other",
            email: "other@co.my",
            ic_number: null,
          },
        ],
      })
    ).toBe(true);
  });

  it("rejects a different issuer email", () => {
    expect(
      postedBindingsMatchApprovedSnapshot({
        snapshot: MIXED_SNAPSHOT,
        roles,
        posted: [
          {
            role_key: "issuer_director",
            name: "Ali Bin Abu",
            email: "other@co.my",
            ic_number: "820508105871",
          },
          {
            role_key: "guarantor",
            name: "Nora",
            email: "nora@holdco.my",
            ic_number: null,
            application_guarantor_id: "g_co",
          },
          {
            role_key: "guarantor",
            name: "Farid",
            email: "farid@holdco.my",
            ic_number: null,
            application_guarantor_id: "g_co",
          },
          {
            role_key: "guarantor",
            name: "Ali Bin Abu",
            email: "ali@co.my",
            ic_number: null,
            application_guarantor_id: "g_ind",
          },
        ],
      })
    ).toBe(false);
  });

  it("rejects extra or missing snapshot people", () => {
    expect(
      postedBindingsMatchApprovedSnapshot({
        snapshot: MIXED_SNAPSHOT,
        roles,
        posted: [
          {
            role_key: "issuer_director",
            name: "Ali Bin Abu",
            email: "ali@co.my",
            ic_number: "820508105871",
          },
        ],
      })
    ).toBe(false);
  });
});

describe("snapshotSignerBindings", () => {
  const roles = [
    { key: "issuer_director", source_hint: "issuer_director" },
    { key: "guarantor", source_hint: "guarantor" },
    { key: "witness", source_hint: null },
  ];

  it("maps approved issuer directors and guarantors, ignoring extra template roles", () => {
    const bindings = snapshotSignerBindings(MIXED_SNAPSHOT, roles);
    expect(bindings.map((binding) => binding.role_key)).toEqual([
      "issuer_director",
      "guarantor",
      "guarantor",
      "guarantor",
    ]);
    expect(bindings[0]).toMatchObject({
      role_key: "issuer_director",
      name: "Ali Bin Abu",
      email: "ali@co.my",
      ic_number: "820508105871",
    });
    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role_key: "guarantor",
          name: "Nora",
          email: "nora@holdco.my",
          application_guarantor_id: "g_co",
        }),
        expect.objectContaining({
          role_key: "guarantor",
          name: "Farid",
          application_guarantor_id: "g_co",
        }),
        expect.objectContaining({
          role_key: "guarantor",
          name: "Ali Bin Abu",
          application_guarantor_id: "g_ind",
        }),
      ])
    );
  });

  it("returns an empty list when the snapshot is missing", () => {
    expect(snapshotSignerBindings(null, roles)).toEqual([]);
  });
});

describe("offerAcceptanceFreezesAuthorizedParties", () => {
  it("freezes people after admin approval through completion", () => {
    expect(offerAcceptanceFreezesAuthorizedParties("APPROVED_FOR_SIGNING")).toBe(true);
    expect(offerAcceptanceFreezesAuthorizedParties("SIGNING_IN_PROGRESS")).toBe(true);
    expect(offerAcceptanceFreezesAuthorizedParties("COMPLETED")).toBe(true);
  });

  it("does not freeze during Step 1 or admin review", () => {
    expect(offerAcceptanceFreezesAuthorizedParties("PENDING_ISSUER")).toBe(false);
    expect(offerAcceptanceFreezesAuthorizedParties("PENDING_ADMIN_REVIEW")).toBe(false);
    expect(offerAcceptanceFreezesAuthorizedParties("CHANGES_REQUESTED")).toBe(false);
    expect(offerAcceptanceFreezesAuthorizedParties(null)).toBe(false);
  });
});
