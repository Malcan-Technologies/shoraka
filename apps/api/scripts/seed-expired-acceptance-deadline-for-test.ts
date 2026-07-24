#!/usr/bin/env tsx
/**
 * Backdate acceptance or signing deadline on an OFFER_SENT offer for testing the expiry job.
 *
 * Usage:
 *   pnpm seed-expired-acceptance-deadline-for-test [contractId|invoiceId] [acceptance|signing]
 * - No args: finds first OFFER_SENT contract/invoice with offer_acceptance and backdates acceptance_expires_at
 * - Optional clock: acceptance (default) | signing
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { getOfferAcceptanceFromOfferDetails } from "@cashsouk/types";

const prisma = new PrismaClient();
const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString();

type Clock = "acceptance" | "signing";

function parseClock(raw: string | undefined): Clock {
  return raw === "signing" ? "signing" : "acceptance";
}

function mergeDeadline(
  offerDetails: Record<string, unknown>,
  clock: Clock
): Record<string, unknown> {
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails) ?? {
    status: "PENDING_ISSUER" as const,
  };
  const next =
    clock === "signing"
      ? {
          ...acceptance,
          status:
            acceptance.status === "APPROVED_FOR_SIGNING" ||
            acceptance.status === "SIGNING_IN_PROGRESS"
              ? acceptance.status
              : ("APPROVED_FOR_SIGNING" as const),
          signing_expires_at: ONE_HOUR_AGO,
        }
      : {
          ...acceptance,
          acceptance_expires_at: ONE_HOUR_AGO,
        };
  return { ...offerDetails, offer_acceptance: next };
}

async function backdateContract(id: string, clock: Clock) {
  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, status: true, offer_details: true },
  });
  if (!contract) return false;
  if (contract.status !== "OFFER_SENT") {
    console.error(`Contract ${id} status is ${contract.status}, not OFFER_SENT.`);
    process.exit(1);
  }
  const merged = mergeDeadline(
    (contract.offer_details as Record<string, unknown>) ?? {},
    clock
  );
  await prisma.contract.update({
    where: { id },
    data: { offer_details: merged as Prisma.InputJsonValue },
  });
  console.log(
    `Contract ${id}: set offer_acceptance.${clock === "signing" ? "signing_expires_at" : "acceptance_expires_at"} to ${ONE_HOUR_AGO}`
  );
  console.log("Run: pnpm run-acceptance-signing-expiry");
  console.log("Expect after job: status OFFER_EXPIRED with offer_details retained.");
  return true;
}

async function backdateInvoice(id: string, clock: Clock) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, status: true, offer_details: true },
  });
  if (!invoice) return false;
  if (invoice.status !== "OFFER_SENT") {
    console.error(`Invoice ${id} status is ${invoice.status}, not OFFER_SENT.`);
    process.exit(1);
  }
  const merged = mergeDeadline(
    (invoice.offer_details as Record<string, unknown>) ?? {},
    clock
  );
  await prisma.invoice.update({
    where: { id },
    data: { offer_details: merged as Prisma.InputJsonValue },
  });
  console.log(
    `Invoice ${id}: set offer_acceptance.${clock === "signing" ? "signing_expires_at" : "acceptance_expires_at"} to ${ONE_HOUR_AGO}`
  );
  console.log("Run: pnpm run-acceptance-signing-expiry");
  console.log("Expect after job: status OFFER_EXPIRED with offer_details retained.");
  return true;
}

async function main() {
  const [idArg, clockArg] = process.argv.slice(2);
  const clock = parseClock(clockArg);

  if (idArg) {
    if (await backdateContract(idArg, clock)) return;
    if (await backdateInvoice(idArg, clock)) return;
    console.error(`No contract or invoice found for id ${idArg}`);
    process.exit(1);
  }

  const contract = await prisma.contract.findFirst({
    where: {
      status: "OFFER_SENT",
      offer_details: { not: Prisma.DbNull },
    },
    select: { id: true, offer_details: true },
  });
  if (contract?.offer_details && getOfferAcceptanceFromOfferDetails(contract.offer_details)) {
    await backdateContract(contract.id, clock);
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      status: "OFFER_SENT",
      contract_id: null,
      offer_details: { not: Prisma.DbNull },
    },
    select: { id: true, offer_details: true },
  });
  if (invoice?.offer_details && getOfferAcceptanceFromOfferDetails(invoice.offer_details)) {
    await backdateInvoice(invoice.id, clock);
    return;
  }

  console.error("No OFFER_SENT contract/invoice with offer_acceptance found.");
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
