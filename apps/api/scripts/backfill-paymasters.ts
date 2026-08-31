#!/usr/bin/env tsx
/**
 * Backfill Paymaster masters from Contract.customer_details JSON.
 * Groups only by exact 12-digit SSM. Never merges by name.
 * Existing masters are reused; identity is never overwritten.
 * Conflicting submitted identity is skipped (contract left unresolved).
 * Invalid SSM → leave unresolved. Does not mutate Note.paymaster_snapshot.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { parseSubmittedIdentity, submittedIdentityConflictsWithMaster } from "../src/modules/paymaster/identity";
import { buildPaymasterSnapshot, snapshotAsJson } from "../src/modules/paymaster/snapshot";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { paymaster_id: null, customer_details: { not: null } },
    select: {
      id: true,
      issuer_organization_id: true,
      application_id: true,
      customer_details: true,
    },
  });

  let linked = 0;
  let created = 0;
  let unresolved = 0;
  let identityConflicts = 0;

  for (const contract of contracts) {
    const submitted = parseSubmittedIdentity(contract.customer_details);
    if (!submitted) {
      unresolved += 1;
      continue;
    }

    const existing = await prisma.paymaster.findUnique({
      where: { registration_number: submitted.registrationNumber },
    });

    if (existing && submittedIdentityConflictsWithMaster(existing, submitted)) {
      identityConflicts += 1;
      unresolved += 1;
      continue;
    }

    if (dryRun) {
      if (existing) linked += 1;
      else created += 1;
      continue;
    }

    const paymaster =
      existing ??
      (await prisma.paymaster.create({
        data: {
          legal_name: submitted.legalName,
          registration_number: submitted.registrationNumber,
          registration_country: submitted.registrationCountry,
          entity_type: submitted.entityType,
          verification_status: "UNVERIFIED",
          source: "BACKFILL",
        },
      }));
    if (existing) linked += 1;
    else created += 1;

    const related =
      contract.customer_details &&
      typeof contract.customer_details === "object" &&
      !Array.isArray(contract.customer_details)
        ? Boolean((contract.customer_details as { is_related_party?: unknown }).is_related_party)
        : false;

    await prisma.issuerPaymasterLink.upsert({
      where: {
        issuer_organization_id_paymaster_id: {
          issuer_organization_id: contract.issuer_organization_id,
          paymaster_id: paymaster.id,
        },
      },
      create: {
        issuer_organization_id: contract.issuer_organization_id,
        paymaster_id: paymaster.id,
        is_related_party: related,
      },
      update: {
        last_used_at: new Date(),
      },
    });

    const snapshot = buildPaymasterSnapshot({
      paymaster,
      isRelatedParty: related,
    });
    const nextDetails = {
      ...((contract.customer_details as Record<string, unknown>) ?? {}),
      paymaster_id: paymaster.id,
    };
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        paymaster_id: paymaster.id,
        customer_details: nextDetails,
      },
    });
    void snapshotAsJson(snapshot);
  }

  console.log(
    JSON.stringify(
      { dryRun, scanned: contracts.length, created, linked, unresolved, identityConflicts },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
