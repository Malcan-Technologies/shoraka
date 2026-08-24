import type { AuthorizedPartiesSnapshot, SigningTemplateConfig } from "@cashsouk/types";
import {
  buildIssuerEnvelopeBindings,
  nextIssuerRepMatchKeys,
} from "./build-issuer-envelope-bindings";

const SAMPLE_IC = "820508105871";
const SITI_IC = "900101015555";

const TEMPLATE: SigningTemplateConfig = {
  enabled: true,
  roles: [
    {
      key: "issuer_director",
      label: "Borrower Director",
      source_hint: "issuer_director",
      routing_order: 0,
      kyc_required: true,
      min_count: 1,
      max_count: 2,
    },
    {
      key: "guarantor",
      label: "Guarantor",
      source_hint: "guarantor",
      routing_order: 1,
      kyc_required: true,
      min_count: 1,
      max_count: null,
    },
  ],
  documents: [],
};

const organization = {
  people: [
    {
      matchKey: SAMPLE_IC,
      name: "Ali Bin Abu",
      email: "ali@co.my",
      roles: ["DIRECTOR"],
    },
    {
      matchKey: SITI_IC,
      name: "Siti",
      email: "siti@co.my",
      roles: ["DIRECTOR"],
    },
  ],
};

const snapshot: AuthorizedPartiesSnapshot = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER",
      representatives: [
        {
          name: "Siti",
          email: "siti@co.my",
          ic_number: SITI_IC,
          capacity: "director",
          person_match_key: SITI_IC,
        },
      ],
    },
  ],
};

describe("buildIssuerEnvelopeBindings", () => {
  it("prefills the first N directors when there is no snapshot", () => {
    const bindings = buildIssuerEnvelopeBindings(TEMPLATE, organization, []);
    const directors = bindings.filter((binding) => binding.role_key === "issuer_director");
    expect(directors).toEqual([
      {
        role_key: "issuer_director",
        name: "Ali Bin Abu",
        email: "ali@co.my",
        ic_number: SAMPLE_IC,
      },
    ]);
  });

  it("uses the snapshot issuer directors instead of first N", () => {
    const bindings = buildIssuerEnvelopeBindings(TEMPLATE, organization, [], snapshot);
    const directors = bindings.filter((binding) => binding.role_key === "issuer_director");
    expect(directors).toEqual([
      {
        role_key: "issuer_director",
        name: "Siti",
        email: "siti@co.my",
        ic_number: SITI_IC,
      },
    ]);
  });

  it("prefills two guarantor bindings from two corporate representatives", () => {
    const mixed: AuthorizedPartiesSnapshot = {
      ...snapshot,
      parties: [
        ...snapshot.parties,
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
      ],
    };
    const bindings = buildIssuerEnvelopeBindings(
      TEMPLATE,
      organization,
      [
        {
          id: "g_co",
          guarantor_type: "company",
          business_name: "HoldCo Sdn Bhd",
          email: "holdco@co.my",
        },
      ],
      mixed
    );
    const guarantors = bindings.filter((binding) => binding.role_key === "guarantor");
    expect(guarantors.map((binding) => binding.name)).toEqual(["Nora", "Farid"]);
    expect(guarantors.every((binding) => binding.application_guarantor_id === "g_co")).toBe(true);
    expect(guarantors.some((binding) => binding.name === "HoldCo Sdn Bhd")).toBe(false);
  });

  it("does not use a company business_name as the signer name without a snapshot", () => {
    const bindings = buildIssuerEnvelopeBindings(TEMPLATE, organization, [
      {
        id: "g_co",
        guarantor_type: "company",
        business_name: "HoldCo Sdn Bhd",
        email: "holdco@co.my",
      },
    ]);
    const guarantors = bindings.filter((binding) => binding.role_key === "guarantor");
    expect(guarantors).toEqual([
      {
        role_key: "guarantor",
        name: "",
        email: "holdco@co.my",
        ic_number: null,
        application_guarantor_id: "g_co",
      },
    ]);
  });

  it("keeps separate issuer and guarantor bindings when the same person holds both roles", () => {
    const mixed: AuthorizedPartiesSnapshot = {
      ...snapshot,
      parties: [
        {
          key: "issuer",
          entity_kind: "ISSUER",
          representatives: [
            {
              name: "Ali Bin Abu",
              email: "ali@co.my",
              ic_number: SAMPLE_IC,
              capacity: "director",
              person_match_key: SAMPLE_IC,
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
              ic_number: SAMPLE_IC,
              capacity: "authorised_signatory",
            },
          ],
        },
      ],
    };
    const bindings = buildIssuerEnvelopeBindings(
      TEMPLATE,
      organization,
      [
        {
          id: "g_ind",
          guarantor_type: "individual",
          name: "Ali Bin Abu",
          email: "ali@co.my",
          ic_number: SAMPLE_IC,
        },
      ],
      mixed
    );
    expect(bindings.filter((binding) => binding.role_key === "issuer_director")).toHaveLength(1);
    expect(bindings.filter((binding) => binding.role_key === "guarantor")).toHaveLength(1);
    expect(bindings).toHaveLength(2);
  });
});

const directors = [
  { matchKey: SAMPLE_IC, name: "Ali Bin Abu", email: "ali@co.my", ic_number: SAMPLE_IC },
  { matchKey: SITI_IC, name: "Siti", email: "siti@co.my", ic_number: SITI_IC },
];

describe("nextIssuerRepMatchKeys", () => {
  it("defaults to the first director before a snapshot exists", () => {
    expect(
      nextIssuerRepMatchKeys({
        snapshot: null,
        directors,
        currentKeys: [],
        initialized: false,
        dirty: false,
      })
    ).toEqual([SAMPLE_IC]);
  });

  it("replaces the default with a snapshot that arrives later", () => {
    expect(
      nextIssuerRepMatchKeys({
        snapshot,
        directors,
        currentKeys: [SAMPLE_IC],
        initialized: true,
        dirty: false,
      })
    ).toEqual([SITI_IC]);
  });

  it("keeps a user edit when a snapshot arrives", () => {
    expect(
      nextIssuerRepMatchKeys({
        snapshot,
        directors,
        currentKeys: [SAMPLE_IC],
        initialized: true,
        dirty: true,
      })
    ).toBeNull();
  });

  it("does not reset to the first director after init when there is no snapshot", () => {
    expect(
      nextIssuerRepMatchKeys({
        snapshot: null,
        directors,
        currentKeys: [SAMPLE_IC],
        initialized: true,
        dirty: false,
      })
    ).toBeNull();
  });
});
