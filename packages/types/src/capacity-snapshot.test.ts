import {
  CAPACITY_SNAPSHOT_VERSION,
  CAPACITY_SNAPSHOT_VERSION_KEY,
  conservativeMigrationWindowLifetimeRemaining,
  conservativeMigrationWindowLifetimeUsed,
  hasCompletedCapacitySnapshot,
  invoiceStatusCountsTowardLifetime,
} from "./capacity-snapshot";

describe("hasCompletedCapacitySnapshot", () => {
  it("requires an integer version at or above the current snapshot version", () => {
    expect(hasCompletedCapacitySnapshot(null)).toBe(false);
    expect(hasCompletedCapacitySnapshot({ pending_facility: 0 })).toBe(false);
    expect(hasCompletedCapacitySnapshot({ [CAPACITY_SNAPSHOT_VERSION_KEY]: 0 })).toBe(false);
    expect(hasCompletedCapacitySnapshot({ [CAPACITY_SNAPSHOT_VERSION_KEY]: 1.5 })).toBe(false);
    expect(
      hasCompletedCapacitySnapshot({ [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION })
    ).toBe(true);
  });
});

describe("invoiceStatusCountsTowardLifetime", () => {
  it.each(["SUBMITTED", "AMENDMENT_REQUESTED", "OFFER_SENT", "APPROVED", "approved"] as const)(
    "counts %s",
    (status) => {
      expect(invoiceStatusCountsTowardLifetime(status)).toBe(true);
    }
  );

  it.each(["DRAFT", "REJECTED", "WITHDRAWN", "OFFER_EXPIRED", "UNKNOWN", "", undefined] as const)(
    "excludes %s",
    (status) => {
      expect(invoiceStatusCountsTowardLifetime(status)).toBe(false);
    }
  );
});

describe("conservativeMigrationWindowLifetimeUsed", () => {
  it("sums counted invoice faces and ignores release statuses and non-positive faces", () => {
    expect(
      conservativeMigrationWindowLifetimeUsed([
        { status: "SUBMITTED", faceValue: 80_000 },
        { status: "AMENDMENT_REQUESTED", faceValue: 20_000 },
        { status: "OFFER_SENT", faceValue: 10_000 },
        { status: "APPROVED", faceValue: 5_000 },
        { status: "DRAFT", faceValue: 50_000 },
        { status: "REJECTED", faceValue: 40_000 },
        { status: "WITHDRAWN", faceValue: 30_000 },
        { status: "OFFER_EXPIRED", faceValue: 25_000 },
        { status: "SUBMITTED", faceValue: 0 },
        { status: "SUBMITTED", faceValue: null },
      ])
    ).toBe(115_000);
  });

  it("preserves negative remaining when used exceeds the contract face", () => {
    expect(conservativeMigrationWindowLifetimeRemaining(100_000, 140_000)).toBe(-40_000);
  });
});
