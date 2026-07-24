#!/usr/bin/env tsx
/**
 * Position an OFFER_SENT acceptance clock so the hourly expiry job should fire a reminder.
 *
 * Sets acceptance_expires_at = now + days_before_expiry (default 1 day), clears
 * deadline_reminders_sent for that key so the next job run sends the reminder.
 *
 * Usage:
 *   pnpm seed-reminder-window-acceptance-deadline-for-test [contractId|invoiceId] [daysBefore=1]
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  addDaysIso,
  deadlineReminderKey,
  getOfferAcceptanceFromOfferDetails,
} from "@cashsouk/types";

const prisma = new PrismaClient();

function mergeReminderWindow(
  offerDetails: Record<string, unknown>,
  daysBefore: number
): { merged: Record<string, unknown>; expiresAt: string; reminderKey: string } {
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails) ?? {
    status: "PENDING_ISSUER" as const,
  };
  // Fire window opened ~1 minute ago so the next job run sends the reminder.
  const expiresAt = addDaysIso(new Date(Date.now() - 60_000), daysBefore);
  const reminderKey = deadlineReminderKey("acceptance", daysBefore);
  const sent = { ...(acceptance.deadline_reminders_sent ?? {}) };
  delete sent[reminderKey];
  return {
    merged: {
      ...offerDetails,
      offer_acceptance: {
        ...acceptance,
        status: acceptance.status === "PENDING_ISSUER" ? acceptance.status : "PENDING_ISSUER",
        acceptance_expires_at: expiresAt,
        deadline_reminders_sent: sent,
      },
    },
    expiresAt,
    reminderKey,
  };
}

async function seedContract(id: string, daysBefore: number) {
  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, status: true, offer_details: true },
  });
  if (!contract) return false;
  if (contract.status !== "OFFER_SENT") {
    console.error(`Contract ${id} status is ${contract.status}, not OFFER_SENT.`);
    process.exit(1);
  }
  const { merged, expiresAt, reminderKey } = mergeReminderWindow(
    (contract.offer_details as Record<string, unknown>) ?? {},
    daysBefore
  );
  await prisma.contract.update({
    where: { id },
    data: { offer_details: merged as Prisma.InputJsonValue },
  });
  console.log(
    `Contract ${id}: acceptance_expires_at=${expiresAt} (cleared reminder ${reminderKey})`
  );
  console.log("Run: pnpm run-acceptance-signing-expiry");
  return true;
}

async function seedInvoice(id: string, daysBefore: number) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, status: true, offer_details: true },
  });
  if (!invoice) return false;
  if (invoice.status !== "OFFER_SENT") {
    console.error(`Invoice ${id} status is ${invoice.status}, not OFFER_SENT.`);
    process.exit(1);
  }
  const { merged, expiresAt, reminderKey } = mergeReminderWindow(
    (invoice.offer_details as Record<string, unknown>) ?? {},
    daysBefore
  );
  await prisma.invoice.update({
    where: { id },
    data: { offer_details: merged as Prisma.InputJsonValue },
  });
  console.log(
    `Invoice ${id}: acceptance_expires_at=${expiresAt} (cleared reminder ${reminderKey})`
  );
  console.log("Run: pnpm run-acceptance-signing-expiry");
  return true;
}

async function main() {
  const [idArg, daysArg] = process.argv.slice(2);
  const daysBefore = Math.max(0, Number.parseInt(daysArg ?? "1", 10) || 1);

  if (idArg) {
    if (await seedContract(idArg, daysBefore)) return;
    if (await seedInvoice(idArg, daysBefore)) return;
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
    await seedContract(contract.id, daysBefore);
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
    await seedInvoice(invoice.id, daysBefore);
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
