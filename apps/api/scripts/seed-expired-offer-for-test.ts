#!/usr/bin/env tsx
/**
 * Backdate an offer's expires_at to the past for testing the offer-expiry job.
 * Updates the first OFFER_SENT contract or invoice to have expires_at = 1 hour ago.
 *
 * Usage: pnpm seed-expired-offer-for-test [contractId|invoiceId]
 * - No args: finds first OFFER_SENT contract or invoice and backdates it
 * - contractId: backdates that contract (must be OFFER_SENT)
 * - invoiceId: backdates that invoice (must be OFFER_SENT)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
const EXPIRED_OFFER = {
  expires_at: ONE_HOUR_AGO.toISOString(),
  offered_facility: 100000,
  offered_profit_rate_percent: 10,
};

async function main() {
  const [idArg] = process.argv.slice(2);

  if (idArg) {
    const contract = await prisma.contract.findUnique({
      where: { id: idArg },
      select: { id: true, status: true, offer_details: true },
    });
    if (contract) {
      if (contract.status !== "OFFER_SENT") {
        console.error(`Contract ${idArg} status is ${contract.status}, not OFFER_SENT. Cannot backdate.`);
        process.exit(1);
      }
      const merged = {
        ...((contract.offer_details as Record<string, unknown>) ?? {}),
        ...EXPIRED_OFFER,
      };
      await prisma.contract.update({
        where: { id: idArg },
        data: { offer_details: merged as Prisma.InputJsonValue },
      });
      console.log(`Contract ${idArg}: set offer_details.expires_at to ${ONE_HOUR_AGO.toISOString()}`);
      console.log("Run: pnpm run-offer-expiry");
      return;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: idArg },
      select: { id: true, status: true, offer_details: true },
    });
    if (invoice) {
      if (invoice.status !== "OFFER_SENT") {
        console.error(`Invoice ${idArg} status is ${invoice.status}, not OFFER_SENT. Cannot backdate.`);
        process.exit(1);
      }
      const merged = {
        ...((invoice.offer_details as Record<string, unknown>) ?? {}),
        ...EXPIRED_OFFER,
      };
      await prisma.invoice.update({
        where: { id: idArg },
        data: { offer_details: merged as Prisma.InputJsonValue },
      });
      console.log(`Invoice ${idArg}: set offer_details.expires_at to ${ONE_HOUR_AGO.toISOString()}`);
      console.log("Run: pnpm run-offer-expiry");
      return;
    }

    console.error(`No contract or invoice found with id: ${idArg}`);
    process.exit(1);
  }

  const contract = await prisma.contract.findFirst({
    where: { status: "OFFER_SENT" },
    select: { id: true },
  });
  if (contract) {
    const current = await prisma.contract.findUnique({
      where: { id: contract.id },
      select: { offer_details: true },
    });
    const merged = {
      ...((current?.offer_details as Record<string, unknown>) ?? {}),
      ...EXPIRED_OFFER,
    };
    await prisma.contract.update({
      where: { id: contract.id },
      data: { offer_details: merged as Prisma.InputJsonValue },
    });
    console.log(`Contract ${contract.id}: set offer_details.expires_at to ${ONE_HOUR_AGO.toISOString()}`);
    console.log("Run: pnpm run-offer-expiry");
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: { status: "OFFER_SENT" },
    select: { id: true },
  });
  if (invoice) {
    const current = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      select: { offer_details: true },
    });
    const merged = {
      ...((current?.offer_details as Record<string, unknown>) ?? {}),
      ...EXPIRED_OFFER,
    };
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { offer_details: merged as Prisma.InputJsonValue },
    });
    console.log(`Invoice ${invoice.id}: set offer_details.expires_at to ${ONE_HOUR_AGO.toISOString()}`);
    console.log("Run: pnpm run-offer-expiry");
    return;
  }

  console.log("No OFFER_SENT contract or invoice with offer_details found.");
  console.log("Create an application, send contract/invoice offers via admin UI, then run this script.");
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
