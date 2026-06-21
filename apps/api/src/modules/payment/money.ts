import { Prisma } from "@prisma/client";

/** Convert MYR (2 dp max) to Curlec integer sen at the API boundary. */
export function myrToSen(amountMyr: number | string | Prisma.Decimal): number {
  const numeric =
    amountMyr instanceof Prisma.Decimal ? amountMyr.toNumber() : Number(amountMyr);

  if (!Number.isFinite(numeric)) {
    throw new Error("Invalid MYR amount");
  }

  // Integer sen avoids float drift (e.g. 100.005 MYR → 10001 sen).
  return Math.round(numeric * 100);
}

/** Convert Curlec sen to MYR as a plain number (2 dp). */
export function senToMyr(amountSen: number): number {
  if (!Number.isInteger(amountSen)) {
    throw new Error("Sen amount must be an integer");
  }

  return amountSen / 100;
}

/** Convert Curlec sen to MYR for Postgres numeric(18,6) storage. */
export function senToMyrDecimal(amountSen: number): Prisma.Decimal {
  return new Prisma.Decimal(senToMyr(amountSen).toFixed(6));
}

/** Convert stored MYR to sen for outbound Curlec API calls. */
export function myrDecimalToSen(amountMyr: Prisma.Decimal): number {
  return myrToSen(amountMyr);
}
