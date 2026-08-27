#!/usr/bin/env tsx
/**
 * Backfill Paymaster masters from Contract.customer_details JSON.
 * Groups only by exact 12-digit SSM. Never merges by name.
 * Conflicting country/entity type/name → link existing + flag mismatch.
 * Invalid SSM → leave unresolved. Does not mutate Note.paymaster_snapshot.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { describePaymasterMismatch, parseSubmittedIdentity } from "../src/modules/paymaster/identity";
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
  let mismatches = 0;

  for (const contract of contracts) {
    const submitted = parseSubmittedIdentity(contract.customer_details);
    if (!submitted) {
      unresolved += 1;
      continue;
    }

    const existing = await prisma.paymaster.findUnique({
      where: { registration_number: submitted.registrationNumber },
    });

    if (dryRun) {
      if (existing) linked += 1;
      else created += 1;
      if (existing && describePaymasterMismatch(existing, submitted)) mismatches += 1;
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
          source: "BACKFILL",
        },
      }));
    if (existing) linked += 1;
    else created += 1;

    const mismatch = describePaymasterMismatch(paymaster, submitted);
    if (mismatch) {
      mismatches += 1;
      await prisma.paymasterMismatch.create({
        data: {
          paymaster_id: paymaster.id,
          application_id: contract.application_id,
          contract_id: contract.id,
          submitted_legal_name: submitted.legalName,
          submitted_entity_type: submitted.entityType,
          submitted_country: submitted.registrationCountry,
          existing_legal_name: paymaster.legal_name,
          existing_entity_type: paymaster.entity_type,
          existing_country: paymaster.registration_country,
          status: "PENDING",
        },
      });
      await prisma.paymaster.update({
        where: { id: paymaster.id },
        data: { mismatch_pending: true },
      });
    }

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
        is_related_party: related,
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
      { dryRun, scanned: contracts.length, created, linked, unresolved, mismatches },
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
