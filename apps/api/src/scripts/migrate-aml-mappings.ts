/**
 * Migration script to populate aml_identity_mapping table from existing data
 * 
 * This script extracts KYC/KYB IDs from:
 * - corporate_entities JSON (directors, shareholders, business shareholders)
 * - director_aml_status JSON (existing AML statuses with kycId/kybId)
 * - director_kyc_status JSON (existing KYC statuses with kycId)
 * 
 * Usage:
 *   pnpm tsx apps/api/src/scripts/migrate-aml-mappings.ts
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { AmlIdentityRepository } from "../modules/regtank/aml-identity-repository";
import { logger } from "../lib/logger";

const amlIdentityRepository = new AmlIdentityRepository();

interface CorporateEntities {
  directors?: Array<{
    eodRequestId?: string;
    personalInfo?: {
      firstName?: string;
      lastName?: string;
      fullName?: string;
      email?: string;
    };
  }>;
  shareholders?: Array<{
    eodRequestId?: string;
    personalInfo?: {
      firstName?: string;
      lastName?: string;
      fullName?: string;
      email?: string;
    };
  }>;
  corporateShareholders?: Array<{
    requestId?: string;
    corporateOnboardingRequest?: {
      requestId?: string;
    };
    businessName?: string;
    name?: string;
    companyName?: string;
    kybId?: string;
    kybRequestDto?: {
      kybId?: string;
    };
  }>;
}

interface DirectorKycStatus {
  directors?: Array<{
    eodRequestId?: string;
    name?: string;
    email?: string;
    kycId?: string;
  }>;
}

interface DirectorAmlStatus {
  directors?: Array<{
    kycId?: string;
    name?: string;
    email?: string;
  }>;
  individualShareholders?: Array<{
    kycId?: string;
    name?: string;
    email?: string;
  }>;
  businessShareholders?: Array<{
    codRequestId?: string;
    kybId?: string;
    businessName?: string;
  }>;
}

async function migrateOrganization(
  organizationId: string,
  organizationType: "investor" | "issuer",
  corporateEntities: CorporateEntities | null,
  directorKycStatus: DirectorKycStatus | null,
  directorAmlStatus: DirectorAmlStatus | null,
  codRequestId: string | null
): Promise<number> {
  let migratedCount = 0;
  const mappings: Array<{
    organization_id: string;
    organization_type: "investor" | "issuer";
    entity_type: "director" | "individual_shareholder" | "business_shareholder";
    name?: string | null;
    email?: string | null;
    business_name?: string | null;
    cod_request_id?: string | null;
    eod_request_id?: string | null;
    kyc_id?: string | null;
    kyb_id?: string | null;
  }> = [];

  // Extract from director_aml_status (most reliable source for kycId/kybId)
  if (directorAmlStatus) {
    // Directors
    if (directorAmlStatus.directors) {
      for (const director of directorAmlStatus.directors) {
        if (director.kycId && director.name && director.email) {
          mappings.push({
            organization_id: organizationId,
            organization_type: organizationType,
            entity_type: "director",
            name: director.name,
            email: director.email,
            cod_request_id: codRequestId,
            kyc_id: director.kycId,
          });
        }
      }
    }

    // Individual shareholders
    if (directorAmlStatus.individualShareholders) {
      for (const shareholder of directorAmlStatus.individualShareholders) {
        if (shareholder.kycId && shareholder.name && shareholder.email) {
          mappings.push({
            organization_id: organizationId,
            organization_type: organizationType,
            entity_type: "individual_shareholder",
            name: shareholder.name,
            email: shareholder.email,
            cod_request_id: codRequestId,
            kyc_id: shareholder.kycId,
          });
        }
      }
    }

    // Business shareholders
    if (directorAmlStatus.businessShareholders) {
      for (const bizShareholder of directorAmlStatus.businessShareholders) {
        if (bizShareholder.kybId && bizShareholder.businessName) {
          mappings.push({
            organization_id: organizationId,
            organization_type: organizationType,
            entity_type: "business_shareholder",
            business_name: bizShareholder.businessName,
            cod_request_id: bizShareholder.codRequestId || codRequestId,
            kyb_id: bizShareholder.kybId,
          });
        }
      }
    }
  }

  // Extract from director_kyc_status (fallback for kycId)
  if (directorKycStatus && directorKycStatus.directors) {
    for (const director of directorKycStatus.directors) {
      if (director.kycId && director.name && director.email) {
        // Check if already added from director_aml_status
        const exists = mappings.find(
          (m) =>
            m.entity_type === "director" &&
            m.name === director.name &&
            m.email === director.email
        );

        if (!exists) {
          mappings.push({
            organization_id: organizationId,
            organization_type: organizationType,
            entity_type: "director",
            name: director.name,
            email: director.email,
            cod_request_id: codRequestId,
            eod_request_id: director.eodRequestId || undefined,
            kyc_id: director.kycId,
          });
        } else {
          // Update existing mapping with eodRequestId if missing
          const existing = mappings.find(
            (m) =>
              m.entity_type === "director" &&
              m.name === director.name &&
              m.email === director.email
          );
          if (existing && !existing.eod_request_id && director.eodRequestId) {
            existing.eod_request_id = director.eodRequestId;
          }
        }
      }
    }
  }

  // Extract from corporate_entities (for EOD requestIds and business shareholder COD requestIds)
  if (corporateEntities) {
    // Directors
    if (corporateEntities.directors) {
      for (const director of corporateEntities.directors) {
        const eodRequestId = director.eodRequestId;
        const personalInfo = director.personalInfo;
        const name =
          personalInfo?.fullName ||
          `${personalInfo?.firstName || ""} ${personalInfo?.lastName || ""}`.trim() ||
          null;
        const email = personalInfo?.email || null;

        if (name && email) {
          // Check if already added
          const exists = mappings.find(
            (m) =>
              m.entity_type === "director" &&
              m.name === name &&
              m.email === email
          );

          if (!exists) {
            mappings.push({
              organization_id: organizationId,
              organization_type: organizationType,
              entity_type: "director",
              name,
              email,
              cod_request_id: codRequestId,
              eod_request_id: eodRequestId || undefined,
            });
          } else {
            // Update existing mapping with eodRequestId if missing
            const existing = mappings.find(
              (m) =>
                m.entity_type === "director" &&
                m.name === name &&
                m.email === email
            );
            if (existing && !existing.eod_request_id && eodRequestId) {
              existing.eod_request_id = eodRequestId;
            }
          }
        }
      }
    }

    // Individual shareholders
    if (corporateEntities.shareholders) {
      for (const shareholder of corporateEntities.shareholders) {
        const eodRequestId = shareholder.eodRequestId;
        const personalInfo = shareholder.personalInfo;
        const name =
          personalInfo?.fullName ||
          `${personalInfo?.firstName || ""} ${personalInfo?.lastName || ""}`.trim() ||
          null;
        const email = personalInfo?.email || null;

        if (name && email) {
          // Check if already added
          const exists = mappings.find(
            (m) =>
              m.entity_type === "individual_shareholder" &&
              m.name === name &&
              m.email === email
          );

          if (!exists) {
            mappings.push({
              organization_id: organizationId,
              organization_type: organizationType,
              entity_type: "individual_shareholder",
              name,
              email,
              cod_request_id: codRequestId,
              eod_request_id: eodRequestId || undefined,
            });
          } else {
            // Update existing mapping with eodRequestId if missing
            const existing = mappings.find(
              (m) =>
                m.entity_type === "individual_shareholder" &&
                m.name === name &&
                m.email === email
            );
            if (existing && !existing.eod_request_id && eodRequestId) {
              existing.eod_request_id = eodRequestId;
            }
          }
        }
      }
    }

    // Business shareholders
    if (corporateEntities.corporateShareholders) {
      for (const bizShareholder of corporateEntities.corporateShareholders) {
        const codRequestId = bizShareholder.requestId ||
          bizShareholder.corporateOnboardingRequest?.requestId ||
          null;
        const businessName =
          bizShareholder.businessName ||
          bizShareholder.name ||
          bizShareholder.companyName ||
          null;
        const kybId =
          bizShareholder.kybId ||
          bizShareholder.kybRequestDto?.kybId ||
          null;

        if (businessName) {
          // Check if already added
          const exists = mappings.find(
            (m) =>
              m.entity_type === "business_shareholder" &&
              m.business_name === businessName
          );

          if (!exists) {
            mappings.push({
              organization_id: organizationId,
              organization_type: organizationType,
              entity_type: "business_shareholder",
              business_name: businessName,
              cod_request_id: codRequestId || codRequestId,
              kyb_id: kybId || undefined,
            });
          } else {
            // Update existing mapping with codRequestId or kybId if missing
            const existing = mappings.find(
              (m) =>
                m.entity_type === "business_shareholder" &&
                m.business_name === businessName
            );
            if (existing) {
              if (!existing.cod_request_id && codRequestId) {
                existing.cod_request_id = codRequestId;
              }
              if (!existing.kyb_id && kybId) {
                existing.kyb_id = kybId;
              }
            }
          }
        }
      }
    }
  }

  // Bulk upsert all mappings
  if (mappings.length > 0) {
    try {
      await amlIdentityRepository.bulkUpsert(mappings);
      migratedCount = mappings.length;
      logger.info(
        {
          organizationId,
          organizationType,
          codRequestId,
          mappingsCount: mappings.length,
        },
        `[Migration] Migrated ${mappings.length} AML identity mappings`
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          organizationId,
          organizationType,
        },
        "[Migration] Failed to migrate AML identity mappings"
      );
    }
  }

  return migratedCount;
}

async function main() {
  logger.info("[Migration] Starting AML identity mapping migration");

  try {
    // Get COD request IDs for all organizations
    const onboardings = await prisma.regTankOnboarding.findMany({
      where: {
        onboarding_type: "CORPORATE",
      },
      select: {
        request_id: true,
        investor_organization_id: true,
        issuer_organization_id: true,
        portal_type: true,
      },
    });

    // Create map of organization ID -> COD request ID
    const orgCodMap = new Map<string, { codRequestId: string; portalType: string }>();
    for (const onboarding of onboardings) {
      const orgId = onboarding.investor_organization_id || onboarding.issuer_organization_id;
      if (orgId) {
        orgCodMap.set(orgId, {
          codRequestId: onboarding.request_id,
          portalType: onboarding.portal_type,
        });
      }
    }

    // Process investor organizations
    const investorOrgs = await prisma.investorOrganization.findMany({
      where: {
        type: "COMPANY",
        OR: [
          { corporate_entities: { not: Prisma.JsonNull } },
          { director_kyc_status: { not: Prisma.JsonNull } },
          { director_aml_status: { not: Prisma.JsonNull } },
        ],
      },
      select: {
        id: true,
        corporate_entities: true,
        director_kyc_status: true,
        director_aml_status: true,
      },
    });

    logger.info(
      { count: investorOrgs.length },
      "[Migration] Found investor organizations to migrate"
    );

    let totalMigrated = 0;
    for (const org of investorOrgs) {
      const codInfo = orgCodMap.get(org.id);
      const migrated = await migrateOrganization(
        org.id,
        "investor",
        org.corporate_entities as CorporateEntities | null,
        org.director_kyc_status as DirectorKycStatus | null,
        org.director_aml_status as DirectorAmlStatus | null,
        codInfo?.codRequestId || null
      );
      totalMigrated += migrated;
    }

    // Process issuer organizations
    const issuerOrgs = await prisma.issuerOrganization.findMany({
      where: {
        type: "COMPANY",
        OR: [
          { corporate_entities: { not: Prisma.JsonNull } },
          { director_kyc_status: { not: Prisma.JsonNull } },
          { director_aml_status: { not: Prisma.JsonNull } },
        ],
      },
      select: {
        id: true,
        corporate_entities: true,
        director_kyc_status: true,
        director_aml_status: true,
      },
    });

    logger.info(
      { count: issuerOrgs.length },
      "[Migration] Found issuer organizations to migrate"
    );

    for (const org of issuerOrgs) {
      const codInfo = orgCodMap.get(org.id);
      const migrated = await migrateOrganization(
        org.id,
        "issuer",
        org.corporate_entities as CorporateEntities | null,
        org.director_kyc_status as DirectorKycStatus | null,
        org.director_aml_status as DirectorAmlStatus | null,
        codInfo?.codRequestId || null
      );
      totalMigrated += migrated;
    }

    logger.info(
      { totalMigrated },
      "[Migration] ✅ Migration completed successfully"
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "[Migration] ❌ Migration failed"
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
