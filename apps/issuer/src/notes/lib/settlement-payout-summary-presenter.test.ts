import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NoteSettlementStatus,
  SettlementTrusteeInstructionStatus,
  type NoteSettlementPoolSummary,
} from "@cashsouk/types";
import {
  ISSUER_SETTLEMENT_PAYOUT_INTRO,
  issuerSettlementAllocationLines,
  issuerSettlementProfitAccrualPeriod,
} from "./settlement-payout-summary-presenter";

function postedSummary(
  overrides: Partial<NoteSettlementPoolSummary> = {}
): NoteSettlementPoolSummary {
  return {
    settlementId: "set-1",
    displayReference: "SET-1",
    status: NoteSettlementStatus.POSTED,
    grossReceiptAmount: 30_000,
    investorPoolAmount: 22_000,
    operatingAccountAmount: 0,
    totalTawidhAmount: 0,
    tawidhInvestorSharePercent: 0,
    tawidhInvestorAmount: 0,
    tawidhAccountAmount: 0,
    gharamahAccountAmount: 0,
    issuerResidualAmount: 8_000,
    unappliedAmount: 0,
    profitStartDate: "2026-09-08T00:00:00.000Z",
    profitMaturityDate: "2026-09-08T00:00:00.000Z",
    profitDays: 0,
    annualProfitRatePercent: 0,
    postedAt: "2026-09-08T00:00:00.000Z",
    settlementTrusteeStatus: SettlementTrusteeInstructionStatus.COMPLETED,
    settlementTrusteeCreatedAt: "2026-09-08T00:00:00.000Z",
    settlementTrusteeLetterGeneratedAt: null,
    settlementTrusteeSubmittedAt: null,
    settlementTrusteeCompletedAt: "2026-09-09T03:40:00.000Z",
    settlementTrusteeEmailSentAt: null,
    ...overrides,
  };
}

describe("issuer settlement payout allocation copy", () => {
  it("presents waterfall buckets in issuer-friendly terms", () => {
    const lines = issuerSettlementAllocationLines(postedSummary());
    expect(ISSUER_SETTLEMENT_PAYOUT_INTRO).toBe("How this repayment was allocated.");
    expect(lines.map((line) => [line.label, line.value, line.description])).toEqual([
      ["Total received", 30_000, "Total repayment recorded for this note."],
      [
        "Investors",
        22_000,
        "Principal, net profit, and any investor Ta'widh compensation.",
      ],
      ["Service fee", 0, "Service fee retained by the platform."],
      ["Ta'widh", 0, "Total Ta'widh charged / allocated."],
      ["Gharamah", 0, "Approved charity / penalty allocation."],
      [
        "Issuer residual",
        8_000,
        "Remaining amount refundable to the issuer after settlement allocation.",
      ],
    ]);
    expect(lines.some((line) => /repayment pool|operating account/i.test(line.description))).toBe(
      false
    );
  });

  it("keeps investor Ta'widh inside Investors and does not double-count it on Ta'widh", () => {
    const lines = issuerSettlementAllocationLines(
      postedSummary({
        investorPoolAmount: 22_050,
        tawidhInvestorAmount: 50,
        tawidhAccountAmount: 100,
        totalTawidhAmount: 150,
      })
    );
    expect(lines.find((line) => line.key === "investors")?.value).toBe(22_050);
    expect(lines.find((line) => line.key === "tawidh")).toEqual({
      key: "tawidh",
      label: "Ta'widh",
      value: 100,
      description:
        "Ta'widh allocated from this settlement. Any investor share is included in Investors.",
    });
  });

  it("shows profit accrual separately from residual", () => {
    expect(issuerSettlementProfitAccrualPeriod(postedSummary())).toBe(
      "8 Sep 2026 – 8 Sep 2026 (0 days)"
    );
    expect(issuerSettlementProfitAccrualPeriod(postedSummary({ profitStartDate: null }))).toBeNull();
  });
});

describe("issuer note detail settlement payout summary wiring", () => {
  const page = readFileSync(join(__dirname, "../../app/notes/[id]/page.tsx"), "utf8");

  it("explains allocation without a residual payout lifecycle", () => {
    expect(page).toContain("issuerSettlementAllocationLines");
    expect(page).toContain("issuerSettlementProfitAccrualPeriod");
    expect(page).toContain("Settlement & Hibah Receipt");
    expect(page).not.toContain("issuerResidualPayoutForPostedSettlement");
    expect(page).not.toContain("Awaiting disbursement");
    expect(page).not.toContain("is the residual refund after investor allocation");
    expect(page).not.toContain("Repayment Pool");
    expect(page).not.toContain("Operating Account");
  });

  it("keeps the financing list allocation summary aligned with note detail", () => {
    const card = readFileSync(
      join(__dirname, "../../components/financing/note-card.tsx"),
      "utf8"
    );
    expect(card).toContain("issuerSettlementAllocationLines");
    expect(card).not.toContain("issuerSettlementPayoutSummaryFromResidualStatus");
    expect(card).not.toContain("Posted allocation below");
  });
});
