import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";
import { nextIssuerRepMatchKeys } from "./build-issuer-envelope-bindings";

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
