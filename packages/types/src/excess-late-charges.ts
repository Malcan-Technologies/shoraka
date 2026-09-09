import { NOTE_MONEY_DECIMALS } from "./note-money";
import { roundNoteMoney } from "./note-expected-return";

export type ExcessLateChargesDto = {
  owed: number;
  paid: number;
  outstanding: number;
  noteReference: string;
};

export function resolveExcessLateChargeOutstanding(
  owed: number,
  paid: number,
  waived = 0
): number {
  return roundNoteMoney(Math.max(0, owed - paid - waived), NOTE_MONEY_DECIMALS);
}

export function mapExcessLateChargesDto(input: {
  status?: string | null;
  excessLateChargeAmount?: number | null;
  excessLateChargePaidAmount?: number | null;
  excessLateChargeWaivedAmount?: number | null;
  noteReference?: string | null;
}): ExcessLateChargesDto | null {
  if (input.status !== "POSTED") return null;
  const owed = roundNoteMoney(Math.max(0, input.excessLateChargeAmount ?? 0), NOTE_MONEY_DECIMALS);
  if (owed <= 0) return null;
  const paid = roundNoteMoney(
    Math.max(0, input.excessLateChargePaidAmount ?? 0),
    NOTE_MONEY_DECIMALS
  );
  const waived = roundNoteMoney(
    Math.max(0, input.excessLateChargeWaivedAmount ?? 0),
    NOTE_MONEY_DECIMALS
  );
  const outstanding = resolveExcessLateChargeOutstanding(owed, paid, waived);
  if (outstanding <= 0) return null;
  return {
    owed,
    paid,
    outstanding,
    noteReference: input.noteReference?.trim() || "",
  };
}
