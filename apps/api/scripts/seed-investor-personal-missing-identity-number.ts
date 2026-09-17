#!/usr/bin/env tsx
/**
 * Seeds exactly one Personal Investor org in a "missing identityNumber" state for testing.
 *
 * Desired state:
 * - type: PERSONAL
 * - onboarding_status: COMPLETED
 * - document_type: DRIVER_LICENSE
 * - document_number: null
 * - completeness-required fields populated so only identityNumber is missing
 * - profile_field_sources:
 *   - identityPrefix source = REGTANK (optional provenance)
 *   - identityNumber source is NOT REGTANK when document_number is null
 *
 * This script is safe to re-run (upserts by fixed org id).
 * Blocked in production.
 */
import { OrganizationType, PrismaClient, UserRole } from "@prisma/client";
import { userFacingCompleteness } from "@cashsouk/types";
import { computeOrgProfileCompleteness } from "../src/modules/organization-profile/service";
import { logger } from "../src/lib/logger";
import { generateUniqueUserId } from "../src/lib/user-id-generator";
import { ADMIN_PEOPLE_DEMO_EMAIL } from "../src/modules/admin/admin-people-demo-data";

const prisma = new PrismaClient();

const ORG_ID = "seed_missing_identity_driver_license_personal";
const DISPLAY_REFERENCE = "seed_missing_identity_driver_license_personal";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? ADMIN_PEOPLE_DEMO_EMAIL.lina;

const fixedNow = new Date("2026-09-17T00:00:00.000Z");

function profileFieldSources(): Record<string, unknown> {
  // IdentityPrefix completeness is derived from document_type in backend,
  // but locking/editability decisions may depend on profile_field_sources.source.
  // We explicitly avoid stamping identityNumber as REGTANK when document_number is null.
  return {
    identityPrefix: { source: "REGTANK", updatedAt: fixedNow.toISOString() },
  };
}

async function ensureInvestorUser(email: string): Promise<{ user_id: string; created: boolean }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const roles = new Set(existing.roles);
    roles.add(UserRole.INVESTOR);
    await prisma.user.update({
      where: { user_id: existing.user_id },
      data: {
        roles: Array.from(roles),
      },
    });
    return { user_id: existing.user_id, created: false };
  }

  const user_id = await generateUniqueUserId();
  await prisma.user.create({
    data: {
      user_id,
      email,
      cognito_sub: `seed_missing_identity_${email.replace(/[^a-z0-9]/gi, "_")}`,
      cognito_username: email,
      roles: [UserRole.INVESTOR],
      first_name: "Seed",
      last_name: "Investor",
      investor_account: [],
      issuer_account: [],
    },
  });
  return { user_id, created: true };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seeding blocked in production.");
  }

  logger.info("🌱 Seeding Personal Investor: missing identityNumber (DRIVER_LICENSE / null doc_number)...");

  const { user_id: owner_user_id, created: userCreated } = await ensureInvestorUser(OWNER_EMAIL);

  await prisma.investorOrganization.upsert({
    where: { id: ORG_ID },
    create: {
      id: ORG_ID,
      owner_user_id,
      type: OrganizationType.PERSONAL,
      name: "Seed Personal Investor",
      display_reference: DISPLAY_REFERENCE,
      onboarding_status: "COMPLETED",
      onboarded_at: fixedNow,

      first_name: "Seed",
      middle_name: null,
      last_name: "Investor",

      nationality: "MY",
      country: "MY",
      id_issuing_country: "MY",
      gender: "MALE",
      phone_number: "+60123456789",
      address: "12, Example Street, Kuala Lumpur",
      date_of_birth: new Date("1990-01-01T00:00:00.000Z"),

      document_type: "DRIVER_LICENSE",
      document_number: null,

      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      deposit_received: false,

      is_sophisticated_investor: false,
      sc_investor_category: "RETAIL",

      residential_address: {
        line1: "8, Jalan Contoh",
        line2: null,
        city: "Kuala Lumpur",
        postalCode: "55100",
        state: "Wilayah Persekutuan",
        country: "MY",
      },

      profile_field_sources: profileFieldSources() as any,

      // Keep optional blobs null for minimal seed.
      bank_account_details: null,
      wealth_declaration: null,
      compliance_declaration: null,
      document_info: null,
      liveness_check_info: null,
      kyc_response: null,
      created_at: fixedNow,
      updated_at: fixedNow,
    },
    update: {
      owner_user_id,
      name: "Seed Personal Investor",
      display_reference: DISPLAY_REFERENCE,
      onboarding_status: "COMPLETED",
      onboarded_at: fixedNow,

      first_name: "Seed",
      middle_name: null,
      last_name: "Investor",

      nationality: "MY",
      country: "MY",
      id_issuing_country: "MY",
      gender: "MALE",
      phone_number: "+60123456789",
      address: "12, Example Street, Kuala Lumpur",
      date_of_birth: new Date("1990-01-01T00:00:00.000Z"),

      document_type: "DRIVER_LICENSE",
      document_number: null,

      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      deposit_received: false,

      is_sophisticated_investor: false,
      sc_investor_category: "RETAIL",

      residential_address: {
        line1: "8, Jalan Contoh",
        line2: null,
        city: "Kuala Lumpur",
        postalCode: "55100",
        state: "Wilayah Persekutuan",
        country: "MY",
      },

      profile_field_sources: profileFieldSources() as any,

      bank_account_details: null,
      wealth_declaration: null,
      compliance_declaration: null,
      document_info: null,
      liveness_check_info: null,
      kyc_response: null,
      updated_at: fixedNow,
    },
  });

  const seeded = await prisma.investorOrganization.findUnique({ where: { id: ORG_ID } });
  if (!seeded) throw new Error("Seed failed: org not found after upsert.");

  // Verify completeness matches the expectation (same logic as /profile-completeness endpoint).
  const completeness = await computeOrgProfileCompleteness("investor", ORG_ID);
  const user = userFacingCompleteness(completeness);

  const identityMissing = user.missing.filter((m) => m.field === "identityNumber");
  const otherMissing = user.missing.filter((m) => m.field !== "identityNumber");

  if (user.percent !== 90 || identityMissing.length !== 1 || otherMissing.length !== 0) {
    throw new Error(
      [
        "Seed verification failed.",
        `Expected: percent=90, only identityNumber missing (count=1).`,
        `Actual: percent=${user.percent}, missingFields=[${user.missing.map((m) => m.field).join(", ")}]`,
      ].join("\n")
    );
  }

  logger.info("✅ Seed verified: only identityNumber missing.");

  // Print requested outputs
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    org_id: seeded.id,
    owner_user_email: OWNER_EMAIL,
    owner_user_created: userCreated,
    owner_user_id,
    seeded_db_fields: {
      id: seeded.id,
      type: seeded.type,
      onboarding_status: seeded.onboarding_status,
      document_type: seeded.document_type,
      document_number: seeded.document_number,
      date_of_birth: seeded.date_of_birth,
      gender: seeded.gender,
      nationality: seeded.nationality,
      residential_address: seeded.residential_address,
      sc_investor_category: seeded.sc_investor_category,
      is_sophisticated_investor: seeded.is_sophisticated_investor,
      phone_number: seeded.phone_number,
      address: seeded.address,
      profile_field_sources: seeded.profile_field_sources,
    },
    profile_completeness: {
      percent: user.percent,
      remaining: user.missing.length,
      missing_fields: user.missing.map((m) => m.field),
    },
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

