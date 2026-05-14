import { NoteSettlementStatus, Prisma, WithdrawalStatus, WithdrawalType } from "@prisma/client";
import { resolveIssuerResidualPayoutListStatus } from "./mapper";

type WithdrawalRecord =
  Prisma.WithdrawalInstructionGetPayload<Prisma.WithdrawalInstructionDefaultArgs>;

const d = (n: string) => new Prisma.Decimal(n);

describe("resolveIssuerResidualPayoutListStatus", () => {
  const settlementBase = {
    note_id: "note-1",
    payment_id: null,
    settlement_type: "STANDARD" as const,
    gross_receipt_amount: d("0"),
    investor_principal: d("0"),
    investor_profit_gross: d("0"),
    service_fee_amount: d("0"),
    investor_profit_net: d("0"),
    tawidh_amount: d("0"),
    gharamah_amount: d("0"),
    issuer_residual_amount: d("100"),
    unapplied_amount: d("0"),
    preview_snapshot: {},
    approved_by_user_id: null,
    approved_at: null,
    posted_at: null as Date | null,
    idempotency_key: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  type SettlementRow = typeof settlementBase & { id: string; status: NoteSettlementStatus };

  const minimalNote = (settlements: SettlementRow[]) =>
    ({
      id: "note-1",
      settlements,
    }) as Parameters<typeof resolveIssuerResidualPayoutListStatus>[0];

  it("returns undefined when only an APPROVED settlement exists (no POSTED yet)", () => {
    const note = minimalNote([
      {
        ...settlementBase,
        id: "set-1",
        status: NoteSettlementStatus.APPROVED,
      },
    ]);
    expect(resolveIssuerResidualPayoutListStatus(note, [])).toBeUndefined();
  });

  it("derives awaiting after settlement is POSTED with positive residual and no withdrawal", () => {
    const note = minimalNote([
      {
        ...settlementBase,
        id: "set-1",
        status: NoteSettlementStatus.POSTED,
        posted_at: new Date(),
      },
    ]);
    expect(resolveIssuerResidualPayoutListStatus(note, [])).toEqual({ kind: "awaiting" });
  });

  it("matches withdrawal to POSTED settlement id", () => {
    const note = minimalNote([
      {
        ...settlementBase,
        id: "set-posted",
        status: NoteSettlementStatus.POSTED,
        posted_at: new Date(),
      },
    ]);
    const withdrawals: WithdrawalRecord[] = [
      {
        id: "w1",
        note_id: "note-1",
        settlement_id: "set-posted",
        investor_organization_id: null,
        issuer_organization_id: null,
        requested_by_user_id: "user-1",
        submitted_by_user_id: null,
        status: WithdrawalStatus.DRAFT,
        withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN,
        amount: d("100"),
        currency: "MYR",
        beneficiary_snapshot: {},
        letter_s3_key: null,
        generated_at: null,
        submitted_to_trustee_at: null,
        completed_at: null,
        metadata: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    expect(resolveIssuerResidualPayoutListStatus(note, withdrawals)).toEqual({
      kind: "pending",
      withTrustee: false,
    });
  });
});
