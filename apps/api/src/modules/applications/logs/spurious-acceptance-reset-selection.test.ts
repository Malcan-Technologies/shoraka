import {
  SIBLING_ITEM_WINDOW_MS,
  isAcceptanceHubScopeKey,
  selectSpuriousAcceptanceResets,
  type SiblingItemLog,
  type SpuriousResetCandidate,
} from "./spurious-acceptance-reset-selection";

const APP_ID = "app-1";
const ADMIN_ID = "admin-1";
const RESET_AT = new Date("2026-03-10T10:00:10.000Z");
const ACCEPTED_AT = new Date("2026-03-01T09:00:00.000Z");

const candidate: SpuriousResetCandidate = {
  id: "log-reset-1",
  application_id: APP_ID,
  user_id: ADMIN_ID,
  created_at: RESET_AT,
};

function siblingAt(offsetMs: number, overrides: Partial<SiblingItemLog> = {}): SiblingItemLog {
  return {
    application_id: APP_ID,
    user_id: ADMIN_ID,
    created_at: new Date(RESET_AT.getTime() + offsetMs),
    scopeKey: "supporting_documents:0:bank_statement",
    ...overrides,
  };
}

type SelectionInput = Parameters<typeof selectSpuriousAcceptanceResets>[0];

function baseInput(overrides: Partial<SelectionInput> = {}): SelectionInput {
  return {
    candidates: [candidate],
    firstOfferAcceptedAt: new Map([[APP_ID, ACCEPTED_AT]]),
    offerAcceptedNow: new Map([[APP_ID, true]]),
    siblingItemLogs: [siblingAt(-200)],
    ...overrides,
  };
}

function selectedIds(input: SelectionInput): string[] {
  return selectSpuriousAcceptanceResets(input).map((row) => row.id);
}

describe("selectSpuriousAcceptanceResets", () => {
  it("selects a reset when all four conditions hold", () => {
    expect(selectedIds(baseInput())).toEqual([candidate.id]);
  });

  it("excludes a reset logged before the first offer acceptance", () => {
    const acceptedLater = new Date(RESET_AT.getTime() + 60_000);
    const input = baseInput({ firstOfferAcceptedAt: new Map([[APP_ID, acceptedLater]]) });
    expect(selectedIds(input)).toEqual([]);
  });

  it("excludes a reset logged at the exact acceptance instant", () => {
    const input = baseInput({ firstOfferAcceptedAt: new Map([[APP_ID, new Date(RESET_AT)]]) });
    expect(selectedIds(input)).toEqual([]);
  });

  it("excludes a reset when the offer is no longer accepted", () => {
    const input = baseInput({ offerAcceptedNow: new Map([[APP_ID, false]]) });
    expect(selectedIds(input)).toEqual([]);
  });

  it("excludes a reset with no sibling item log", () => {
    expect(selectedIds(baseInput({ siblingItemLogs: [] }))).toEqual([]);
  });

  it.each(["acceptance_documents:0:x", "authorized_representatives:issuer"])(
    "excludes a reset whose only sibling is the acceptance-hub item %s",
    (scopeKey) => {
      const input = baseInput({ siblingItemLogs: [siblingAt(-200, { scopeKey })] });
      expect(selectedIds(input)).toEqual([]);
    }
  );

  it("excludes a reset whose sibling has no string scope key", () => {
    const input = baseInput({ siblingItemLogs: [siblingAt(-200, { scopeKey: null })] });
    expect(selectedIds(input)).toEqual([]);
  });

  it("excludes a reset whose sibling was logged by a different user", () => {
    const input = baseInput({ siblingItemLogs: [siblingAt(-200, { user_id: "admin-2" })] });
    expect(selectedIds(input)).toEqual([]);
  });

  it("excludes a reset whose sibling belongs to a different application", () => {
    const input = baseInput({ siblingItemLogs: [siblingAt(-200, { application_id: "app-2" })] });
    expect(selectedIds(input)).toEqual([]);
  });

  it("excludes a reset whose sibling was logged 6 s earlier", () => {
    expect(selectedIds(baseInput({ siblingItemLogs: [siblingAt(-6000)] }))).toEqual([]);
  });

  it("selects a reset whose sibling was logged exactly 5 s earlier", () => {
    const input = baseInput({ siblingItemLogs: [siblingAt(-SIBLING_ITEM_WINDOW_MS)] });
    expect(SIBLING_ITEM_WINDOW_MS).toBe(5000);
    expect(selectedIds(input)).toEqual([candidate.id]);
  });

  it("selects a reset whose sibling was logged at the same instant", () => {
    expect(selectedIds(baseInput({ siblingItemLogs: [siblingAt(0)] }))).toEqual([candidate.id]);
  });

  it("excludes a reset whose sibling was logged after it", () => {
    expect(selectedIds(baseInput({ siblingItemLogs: [siblingAt(1)] }))).toEqual([]);
  });

  it("excludes a candidate with no acceptance record at all", () => {
    const input = baseInput({ firstOfferAcceptedAt: new Map(), offerAcceptedNow: new Map() });
    expect(selectedIds(input)).toEqual([]);
  });

  it("excludes a candidate with no current offer status entry", () => {
    expect(selectedIds(baseInput({ offerAcceptedNow: new Map() }))).toEqual([]);
  });

  it("preserves candidate order", () => {
    const later: SpuriousResetCandidate = {
      ...candidate,
      id: "log-reset-2",
      created_at: new Date(RESET_AT.getTime() + 60_000),
    };
    const input = baseInput({
      candidates: [candidate, later],
      siblingItemLogs: [siblingAt(-200), siblingAt(60_000 - 100)],
    });
    expect(selectedIds(input)).toEqual([candidate.id, later.id]);
  });
});

describe("isAcceptanceHubScopeKey", () => {
  it.each([
    ["acceptance_documents:0:x", true],
    ["authorized_representatives:issuer", true],
    ["acceptance_documents", false],
    ["supporting_documents:0:bank_statement", false],
    [null, false],
  ])("returns %p -> %p", (scopeKey, expected) => {
    expect(isAcceptanceHubScopeKey(scopeKey)).toBe(expected);
  });
});
