import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import {
  addUtcCalendarDays,
  isTenureBackedNote,
  validateDisbursementValueDate,
} from "@cashsouk/types";

export type TenureActivationFields = {
  activatedAt: Date;
  disbursementValueDate: Date | null;
  maturityDate: Date | null;
  updateMaturity: boolean;
};

export function resolveTenureActivationFields(input: {
  tenureDays: number | null | undefined;
  disbursementValueDate?: string | null;
  now?: Date;
}): TenureActivationFields {
  const now = input.now ?? new Date();
  if (!isTenureBackedNote(input.tenureDays)) {
    return {
      activatedAt: now,
      disbursementValueDate: null,
      maturityDate: null,
      updateMaturity: false,
    };
  }

  const parsed = validateDisbursementValueDate(input.disbursementValueDate, now);
  if (!parsed.ok) {
    throw new AppError(400, "DISBURSEMENT_VALUE_DATE_INVALID", parsed.message);
  }

  return {
    activatedAt: parsed.date,
    disbursementValueDate: parsed.date,
    maturityDate: addUtcCalendarDays(parsed.date, input.tenureDays!),
    updateMaturity: true,
  };
}

export function noteActivationUpdateData(fields: TenureActivationFields) {
  return {
    activated_at: fields.activatedAt,
    ...(fields.updateMaturity
      ? {
          disbursement_value_date: fields.disbursementValueDate,
          maturity_date: fields.maturityDate,
        }
      : {}),
  };
}

export async function syncPaymentScheduleDueDate(
  tx: Prisma.TransactionClient,
  noteId: string,
  dueDate: Date
) {
  const updated = await tx.notePaymentSchedule.updateMany({
    where: { note_id: noteId, sequence: 1 },
    data: { due_date: dueDate },
  });
  if (updated.count > 0) return;

  const note = await tx.note.findUniqueOrThrow({
    where: { id: noteId },
    select: { target_amount: true, profit_rate_percent: true },
  });
  const expectedProfit = note.profit_rate_percent
    ? note.target_amount.mul(note.profit_rate_percent).div(100)
    : new Prisma.Decimal(0);
  await tx.notePaymentSchedule.create({
    data: {
      note_id: noteId,
      sequence: 1,
      due_date: dueDate,
      expected_principal: note.target_amount,
      expected_profit: expectedProfit,
      expected_total: note.target_amount.add(expectedProfit),
    },
  });
}
