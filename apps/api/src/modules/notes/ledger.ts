import { NoteLedgerDirection, Prisma } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

async function getLedgerAccountId(tx: Prisma.TransactionClient, code: string): Promise<string> {
  const account = await tx.noteLedgerAccount.findUnique({ where: { code } });
  if (!account) {
    throw new AppError(500, "LEDGER_ACCOUNT_MISSING", `Missing ledger account ${code}`);
  }
  return account.id;
}

export type PostLedgerEntryInput = {
  accountCode: string;
  direction: NoteLedgerDirection;
  amount: number;
  description: string;
  idempotencyKey: string;
  gatewayPaymentId?: string;
  noteId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function postLedgerEntry(
  tx: Prisma.TransactionClient,
  input: PostLedgerEntryInput
) {
  const existing = await tx.noteLedgerEntry.findUnique({
    where: { idempotency_key: input.idempotencyKey },
  });
  if (existing) return existing;

  const accountId = await getLedgerAccountId(tx, input.accountCode);

  try {
    return await tx.noteLedgerEntry.create({
      data: {
        account_id: accountId,
        direction: input.direction,
        amount: money(input.amount),
        description: input.description,
        idempotency_key: input.idempotencyKey,
        gateway_payment_id: input.gatewayPaymentId,
        note_id: input.noteId,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await tx.noteLedgerEntry.findUnique({
        where: { idempotency_key: input.idempotencyKey },
      });
      if (duplicate) return duplicate;
    }
    throw error;
  }
}
