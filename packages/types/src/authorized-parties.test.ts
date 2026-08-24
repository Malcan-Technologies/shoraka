import { parseOfferAcceptanceDetails } from "./offer-acceptance";
import {
  authorizedPartyReadOnlyBlocks,
  getIssuerAuthorizedParty,
  guarantorBindingsFromSnapshot,
  issuerDirectorBindingsFromSnapshot,
  parseAuthorizedPartiesSnapshot,
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

describe("authorizedPartyReadOnlyBlocks", () => {
  it("returns one block per entity using guarantor names for titles", () => {
    const blocks = authorizedPartyReadOnlyBlocks(MIXED_SNAPSHOT, [
      { id: "g_ind", name: "Ali Bin Abu", business_name: null },
      { id: "g_co", name: null, business_name: "HoldCo Sdn Bhd" },
    ]);
    expect(blocks.map((block) => block.title)).toEqual([
      "Issuer representatives",
      "Ali Bin Abu",
      "HoldCo Sdn Bhd",
    ]);
    expect(blocks[2]?.representatives).toHaveLength(2);
    expect(blocks[2]?.representatives.map((rep) => rep.name)).toEqual(["Nora", "Farid"]);
  });
});
