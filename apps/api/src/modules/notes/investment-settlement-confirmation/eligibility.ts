import { NoteInvestmentStatus, NoteSettlementStatus } from "@prisma/client";
import { NOTE_MONEY_TOLERANCE } from "@cashsouk/types";

export function isPostedSettlementStatus(status: NoteSettlementStatus | string): boolean {
  return status === NoteSettlementStatus.POSTED;
}

export function isSettledInvestmentStatus(status: NoteInvestmentStatus | string): boolean {
  return status === NoteInvestmentStatus.SETTLED;
}

export function isMaterialTawidh(amount: number): boolean {
  return amount > NOTE_MONEY_TOLERANCE;
}

export function isMaterialPayout(amount: number): boolean {
  return amount > NOTE_MONEY_TOLERANCE;
}
