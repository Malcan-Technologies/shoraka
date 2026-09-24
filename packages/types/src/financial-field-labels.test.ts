import {
  APPLICATION_CORE_MONEY_KEYS,
  APPLICATION_CORE_MONEY_REQUIRED_KEYS,
  APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS,
} from "./financial-field-labels";

describe("Financial field label requiredness", () => {
  it("marks all non-equity raw money fields as required (frontend marker source-of-truth)", () => {
    const expected = [...APPLICATION_CORE_MONEY_KEYS, ...APPLICATION_EXTRA_ISSUER_RAW_MONEY_KEYS].sort();
    const actual = [...APPLICATION_CORE_MONEY_REQUIRED_KEYS].sort();
    expect(actual).toEqual(expected);
  });
});

