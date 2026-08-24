import { NOTE_MONEY_DECIMALS } from "./note-money";
import { roundNoteMoney } from "./note-expected-return";

export type ExcessLateChargesDto = {
  owed: number;
  paid: number;
  outstanding: number;
  noteReference: string;
};

export function resolveExcessLateChargeOutstanding(owed: number, paid: number): number {
  return roundNoteMoney(Math.max(0, owed - paid), NOTE_MONEY_DECIMALS);
}

export function mapExcessLateChargesDto(input: {
  status?: string | null;
  excessLateChargeAmount?: number | null;
  excessLateChargePaidAmount?: number | null;
  noteReference?: string | null;
}): ExcessLateChargesDto | null {
  if (input.status !== "POSTED") return null;
  const owed = roundNoteMoney(Math.max(0, input.excessLateChargeAmount ?? 0), NOTE_MONEY_DECIMALS);
  if (owed <= 0) return null;
  const paid = roundNoteMoney(
    Math.max(0, input.excessLateChargePaidAmount ?? 0),
    NOTE_MONEY_DECIMALS
  );
  return {
    owed,
    paid,
    outstanding: resolveExcessLateChargeOutstanding(owed, paid),
    noteReference: input.noteReference?.trim() || "",
  };
}
