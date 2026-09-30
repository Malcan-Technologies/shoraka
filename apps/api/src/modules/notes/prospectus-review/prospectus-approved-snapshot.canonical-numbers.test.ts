/**
 * SECTION: canonicalizeJsonNumbers — deterministic numbers for hashed + stored JSON
 * WHY: Approved page_1 / page_2 are hashed and then persisted in a Prisma Json column that
 * rounds 17-significant-digit numbers; the canonical form must survive that round trip unchanged.
 */

import {
  canonicalizeJsonNumbers,
  hashProspectusFingerprint,
} from "./prospectus-approved-snapshot";

function significantDigits(n: number): number {
  const [mantissa] = Math.abs(n).toExponential().split("e");
  return mantissa!.replace(".", "").length;
}

/** Prisma Json writes keep at most 16 significant digits (observed behaviour). */
function simulatePrismaJsonWrite(n: number): number {
  return Number(n.toPrecision(16));
}

describe("canonicalizeJsonNumbers", () => {
  it.each([
    [22.641509433962266, 22.6415094339623],
    [2.0454545454545454, 2.04545454545455],
    [0.1 + 0.2, 0.3],
    [100 / 3, 33.3333333333333],
    [-100 / 3, -33.3333333333333],
  ])("limits 17-digit fraction %p to 15 significant digits", (input, expected) => {
    expect(significantDigits(input)).toBe(17);
    const out = canonicalizeJsonNumbers(input);
    expect(out).toBe(expected);
    expect(significantDigits(out)).toBeLessThanOrEqual(15);
    expect(simulatePrismaJsonWrite(out)).toBe(out);
  });

  it.each([1.5, 0.3, 22.64, -7.25, 1e-7, 123456.789])(
    "leaves already-short decimal %p unchanged",
    (input) => {
      expect(canonicalizeJsonNumbers(input)).toBe(input);
    }
  );

  it("keeps zero and negative zero as safe integers", () => {
    expect(canonicalizeJsonNumbers(0)).toBe(0);
    expect(Object.is(canonicalizeJsonNumbers(-0), -0)).toBe(true);
  });

  it.each([1, -1, 42, 1_200_000, -5_300_000, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER])(
    "leaves safe integer %p unchanged",
    (input) => {
      expect(canonicalizeJsonNumbers(input)).toBe(input);
    }
  );

  it("limits integers beyond MAX_SAFE_INTEGER to 15 significant digits", () => {
    const above = Number.MAX_SAFE_INTEGER + 2;
    expect(Number.isSafeInteger(above)).toBe(false);
    expect(canonicalizeJsonNumbers(above)).toBe(9007199254740990);
    expect(canonicalizeJsonNumbers(-above)).toBe(-9007199254740990);
    expect(canonicalizeJsonNumbers(1e21)).toBe(1e21);
    expect(canonicalizeJsonNumbers(123456789012345680000)).toBe(123456789012346000000);
  });

  it("leaves non-finite numbers unchanged", () => {
    expect(canonicalizeJsonNumbers(Number.NaN)).toBeNaN();
    expect(canonicalizeJsonNumbers(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  it("leaves strings (including numeric-looking ones), booleans and null unchanged", () => {
    expect(canonicalizeJsonNumbers("22.641509433962266")).toBe("22.641509433962266");
    expect(canonicalizeJsonNumbers("abc")).toBe("abc");
    expect(canonicalizeJsonNumbers(true)).toBe(true);
    expect(canonicalizeJsonNumbers(false)).toBe(false);
    expect(canonicalizeJsonNumbers(null)).toBeNull();
  });

  it("recurses through arrays and nested objects without mutating the input", () => {
    const input = {
      label: "FY2026",
      flag: true,
      missing: null,
      ratios: [22.641509433962266, 2.0454545454545454, 7, "0.1"],
      nested: { deep: { value: 100 / 3, count: 3 }, list: [{ pct: 0.1 + 0.2 }] },
    };
    const before = JSON.stringify(input);
    const out = canonicalizeJsonNumbers(input);

    expect(out).toEqual({
      label: "FY2026",
      flag: true,
      missing: null,
      ratios: [22.6415094339623, 2.04545454545455, 7, "0.1"],
      nested: { deep: { value: 33.3333333333333, count: 3 }, list: [{ pct: 0.3 }] },
    });
    expect(JSON.stringify(input)).toBe(before);
    expect(out).not.toBe(input);
    expect(out.ratios).not.toBe(input.ratios);
    expect(out.nested.deep).not.toBe(input.nested.deep);
  });

  it("passes non-plain objects (Date) through by reference", () => {
    const at = new Date("2026-09-30T00:00:00.000Z");
    const out = canonicalizeJsonNumbers({ at, list: [at] });
    expect(out.at).toBe(at);
    expect(out.list[0]).toBe(at);
  });

  it("is idempotent", () => {
    const input = {
      a: [22.641509433962266, 2.0454545454545454, 0.1 + 0.2, 100 / 3, Number.MAX_SAFE_INTEGER + 2],
      b: { c: -0, d: "x", e: 1.5 },
    };
    const once = canonicalizeJsonNumbers(input);
    expect(canonicalizeJsonNumbers(once)).toEqual(once);
  });

  it("hashes the same before and after a simulated Prisma Json write", () => {
    const once = canonicalizeJsonNumbers({
      raw_financials: { return_on_equity: 22.641509433962266, currat: 2.0454545454545454 },
    });
    const stored = {
      raw_financials: {
        return_on_equity: simulatePrismaJsonWrite(once.raw_financials.return_on_equity),
        currat: simulatePrismaJsonWrite(once.raw_financials.currat),
      },
    };
    expect(hashProspectusFingerprint(stored)).toBe(hashProspectusFingerprint(once));
  });
});
