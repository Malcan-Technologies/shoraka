import { NoteLedgerAccountType, type NoteLedgerBucketBalance } from "@cashsouk/types";
import {
  buildLedgerBucketOverview,
  formatLedgerBucketLabel,
  formatLedgerShare,
  ledgerBarWidthPercent,
} from "./ledger-bucket-display";

function bucket(
  accountCode: NoteLedgerAccountType,
  balance: number,
  extras: Partial<NoteLedgerBucketBalance> = {}
): NoteLedgerBucketBalance {
  return {
    accountCode,
    accountName: accountCode,
    accountType: accountCode,
    currency: "MYR",
    debitTotal: 0,
    creditTotal: balance,
    balance,
    entryCount: 1,
    lastPostedAt: null,
    ...extras,
  };
}

describe("buildLedgerBucketOverview", () => {
  it("fills missing buckets and groups balances by role", () => {
    const overview = buildLedgerBucketOverview([
      bucket(NoteLedgerAccountType.INVESTOR_POOL, 80),
      bucket(NoteLedgerAccountType.REPAYMENT_POOL, 20),
      bucket(NoteLedgerAccountType.OPERATING_ACCOUNT, 10),
      bucket(NoteLedgerAccountType.ISSUER_PAYABLE, 10),
    ]);

    expect(overview.items).toHaveLength(6);
    expect(overview.groups.map((group) => group.id)).toEqual(["custody", "income", "payable"]);
    expect(overview.groups[1]?.fillClass).toBe("bg-[hsl(163_88%_40%)] dark:bg-status-success-text");
    expect(overview.groups[1]?.surfaceClass).toBe("bg-[hsl(152_76%_97%)] dark:bg-status-success-bg");
    expect(overview.groups[0]?.balance).toBe(100);
    expect(overview.groups[0]?.itemHeldTotal).toBe(100);
    expect(overview.groups[1]?.balance).toBe(10);
    expect(overview.groups[2]?.balance).toBe(10);
    expect(overview.heldTotal).toBe(120);
    expect(overview.netBalance).toBe(120);
  });

  it("keeps negative balances in the group total but out of the composition bar", () => {
    const overview = buildLedgerBucketOverview([
      bucket(NoteLedgerAccountType.INVESTOR_POOL, 100),
      bucket(NoteLedgerAccountType.OPERATING_ACCOUNT, -20),
    ]);

    const income = overview.groups.find((group) => group.id === "income");
    expect(income?.balance).toBe(-20);
    expect(income?.held).toBe(0);
    expect(income?.itemHeldTotal).toBe(0);
    expect(overview.heldTotal).toBe(100);
    expect(overview.netBalance).toBe(80);
  });
});

describe("ledgerBarWidthPercent", () => {
  it("returns the share of the group and clamps empty values", () => {
    expect(ledgerBarWidthPercent(80, 100)).toBe(80);
    expect(ledgerBarWidthPercent(0, 100)).toBe(0);
    expect(ledgerBarWidthPercent(20, 0)).toBe(0);
    expect(ledgerBarWidthPercent(-5, 100)).toBe(0);
  });
});

describe("formatLedgerBucketLabel", () => {
  it("uses the shared bucket names and title-cases unknown codes", () => {
    expect(formatLedgerBucketLabel(NoteLedgerAccountType.REPAYMENT_POOL)).toBe("Repayment Pool");
    expect(formatLedgerBucketLabel(NoteLedgerAccountType.INVESTOR_POOL)).toBe("Investor Pool");
    expect(formatLedgerBucketLabel("OPERATING_ACCOUNT")).toBe("Operating");
    expect(formatLedgerBucketLabel("CUSTOM_SUSPENSE")).toBe("Custom Suspense");
    expect(formatLedgerBucketLabel("")).toBe("Unknown account");
  });
});

describe("formatLedgerShare", () => {
  it("rounds ordinary shares and hides empty slices", () => {
    expect(formatLedgerShare(100, 120)).toBe("83%");
    expect(formatLedgerShare(0, 120)).toBe("0%");
    expect(formatLedgerShare(10, 0)).toBe("0%");
  });

  it("labels tiny positive slices instead of rounding them to zero", () => {
    expect(formatLedgerShare(0.4, 100)).toBe("<1%");
  });
});
