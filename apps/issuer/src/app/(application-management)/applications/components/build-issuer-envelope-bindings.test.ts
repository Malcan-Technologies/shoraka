import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";
import {
  buildIssuerAuthorizedPartiesSubmitPayload,
  nextIssuerRepMatchKeys,
  nextIssuerSealApplierMatchKey,
} from "./build-issuer-envelope-bindings";

const SAMPLE_IC = "820508105871";
const SITI_IC = "900101015555";

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

describe("buildIssuerAuthorizedPartiesSubmitPayload", () => {
  it("sets applies_company_seal on exactly one selected director", () => {
    const payload = buildIssuerAuthorizedPartiesSubmitPayload(
      directors,
      [SAMPLE_IC, SITI_IC],
      SITI_IC
    );
    const reps = payload.parties[0]?.representatives ?? [];
    expect(reps.map((rep) => rep.applies_company_seal)).toEqual([undefined, true]);
    expect(reps.filter((rep) => rep.applies_company_seal === true)).toHaveLength(1);
  });

  it("omits applies_company_seal when no applier is selected", () => {
    const payload = buildIssuerAuthorizedPartiesSubmitPayload(directors, [SAMPLE_IC]);
    expect(payload.parties[0]?.representatives[0]?.applies_company_seal).toBeUndefined();
  });
});

describe("nextIssuerSealApplierMatchKey", () => {
  it("does not auto-select an applier when the snapshot has none", () => {
    expect(
      nextIssuerSealApplierMatchKey({
        snapshot: null,
        directors,
        selectedMatchKeys: [SITI_IC],
        currentKey: null,
        dirty: false,
      })
    ).toBeNull();
  });

  it("uses the snapshot applier when that director is still selected", () => {
    const withSeal: AuthorizedPartiesSnapshot = {
      ...snapshot,
      parties: [
        {
          ...snapshot.parties[0]!,
          representatives: [
            { ...snapshot.parties[0]!.representatives[0]!, applies_company_seal: true },
          ],
        },
      ],
    };
    expect(
      nextIssuerSealApplierMatchKey({
        snapshot: withSeal,
        directors,
        selectedMatchKeys: [SAMPLE_IC, SITI_IC],
        currentKey: SAMPLE_IC,
        dirty: false,
      })
    ).toBe(SITI_IC);
  });

  it("clears the applier when that director is removed from the selection", () => {
    expect(
      nextIssuerSealApplierMatchKey({
        snapshot: null,
        directors,
        selectedMatchKeys: [SAMPLE_IC],
        currentKey: SITI_IC,
        dirty: true,
      })
    ).toBeNull();
  });

  it("keeps a user-chosen applier while that director stays selected", () => {
    expect(
      nextIssuerSealApplierMatchKey({
        snapshot: null,
        directors,
        selectedMatchKeys: [SAMPLE_IC, SITI_IC],
        currentKey: SITI_IC,
        dirty: true,
      })
    ).toBe(SITI_IC);
  });
});

