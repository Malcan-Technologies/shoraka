import { prisma } from "../../lib/prisma";
import { AmlIdentityMapping } from "@prisma/client";
import { logger } from "../../lib/logger";

export type AmlIdentityMappingInput = {
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
  last_synced_at?: Date | null;
};

export class AmlIdentityRepository {
  /**
   * Create or update a mapping entry
   * Finds existing record by organization_id + entity_type + email (for individuals) or business_name (for businesses)
   */
  async upsertMapping(data: AmlIdentityMappingInput): Promise<AmlIdentityMapping> {
    // Find existing record
    const existing = await this.findByOrganizationAndEntity(
      data.organization_id,
      data.entity_type,
      data.email,
      data.business_name
    );

    if (existing) {
      // Update existing record
      return await prisma.amlIdentityMapping.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          email: data.email,
          business_name: data.business_name,
          cod_request_id: data.cod_request_id ?? existing.cod_request_id,
          eod_request_id: data.eod_request_id ?? existing.eod_request_id,
          kyc_id: data.kyc_id ?? existing.kyc_id,
          kyb_id: data.kyb_id ?? existing.kyb_id,
          last_synced_at: data.last_synced_at ?? existing.last_synced_at,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new record
      return await prisma.amlIdentityMapping.create({
        data: {
          organization_id: data.organization_id,
          organization_type: data.organization_type,
          entity_type: data.entity_type,
          name: data.name,
          email: data.email,
          business_name: data.business_name,
          cod_request_id: data.cod_request_id,
          eod_request_id: data.eod_request_id,
          kyc_id: data.kyc_id,
          kyb_id: data.kyb_id,
          last_synced_at: data.last_synced_at,
        },
      });
    }
  }

  /**
   * Find all mappings for an organization
   */
  async findByOrganization(organizationId: string): Promise<AmlIdentityMapping[]> {
    return prisma.amlIdentityMapping.findMany({
      where: { organization_id: organizationId },
      orderBy: [
        { entity_type: "asc" },
        { name: "asc" },
      ],
    });
  }

  /**
   * Find mapping by KYC ID
   */
  async findByKycId(kycId: string): Promise<AmlIdentityMapping | null> {
    return prisma.amlIdentityMapping.findFirst({
      where: { kyc_id: kycId },
    });
  }

  /**
   * Find mapping by KYB ID
   */
  async findByKybId(kybId: string): Promise<AmlIdentityMapping | null> {
    return prisma.amlIdentityMapping.findFirst({
      where: { kyb_id: kybId },
    });
  }

  /**
   * Find mapping by COD request ID
   */
  async findByCodRequestId(codRequestId: string): Promise<AmlIdentityMapping[]> {
    return prisma.amlIdentityMapping.findMany({
      where: { cod_request_id: codRequestId },
    });
  }

  /**
   * Find mapping by EOD request ID
   */
  async findByEodRequestId(eodRequestId: string): Promise<AmlIdentityMapping | null> {
    return prisma.amlIdentityMapping.findFirst({
      where: { eod_request_id: eodRequestId },
    });
  }

  /**
   * Find duplicates across roles by name and email
   */
  async findByNameAndEmail(
    organizationId: string,
    name: string,
    email: string
  ): Promise<AmlIdentityMapping[]> {
    return prisma.amlIdentityMapping.findMany({
      where: {
        organization_id: organizationId,
        name: name,
        email: email,
      },
    });
  }

  /**
   * Find mapping by organization, entity type, and identifying fields
   */
  async findByOrganizationAndEntity(
    organizationId: string,
    entityType: "director" | "individual_shareholder" | "business_shareholder",
    email?: string | null,
    businessName?: string | null
  ): Promise<AmlIdentityMapping | null> {
    if (entityType === "business_shareholder") {
      return prisma.amlIdentityMapping.findFirst({
        where: {
          organization_id: organizationId,
          entity_type: entityType,
          business_name: businessName || "",
        },
      });
    } else {
      return prisma.amlIdentityMapping.findFirst({
        where: {
          organization_id: organizationId,
          entity_type: entityType,
          email: email || "",
        },
      });
    }
  }

  /**
   * Batch insert/update mappings
   */
  async bulkUpsert(mappings: AmlIdentityMappingInput[]): Promise<AmlIdentityMapping[]> {
    const results: AmlIdentityMapping[] = [];

    for (const mapping of mappings) {
      try {
        const result = await this.upsertMapping(mapping);
        results.push(result);
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            organization_id: mapping.organization_id,
            entity_type: mapping.entity_type,
          },
          "[AML Identity Repository] Failed to upsert mapping in bulk operation"
        );
        // Continue with other mappings even if one fails
      }
    }

    return results;
  }

  /**
   * Sync mappings from corporate_entities JSON
   * Helper for initial migration
   */
  async syncMappingsFromCorporateEntities(
    organizationId: string,
    organizationType: "investor" | "issuer",
    corporateEntities: {
      directors?: Array<Record<string, unknown>>;
      shareholders?: Array<Record<string, unknown>>;
      corporateShareholders?: Array<Record<string, unknown>>;
    }
  ): Promise<AmlIdentityMapping[]> {
    const mappings: AmlIdentityMappingInput[] = [];

    // Extract directors
    if (corporateEntities.directors) {
      for (const director of corporateEntities.directors) {
        const eodRequestId = (director as any).corporateIndividualRequest?.requestId || 
                            (director as any).eodRequestId || 
                            (director as any).requestId;
        const kycId = (director as any).kycId || 
                     (director as any).kycRequestInfo?.kycId;
        const name = (director as any).name || 
                    `${(director as any).firstName || ""} ${(director as any).lastName || ""}`.trim();
        const email = (director as any).email;

        mappings.push({
          organization_id: organizationId,
          organization_type: organizationType,
          entity_type: "director",
          name: name || null,
          email: email || null,
          eod_request_id: eodRequestId || null,
          kyc_id: kycId || null,
        });
      }
    }

    // Extract individual shareholders
    if (corporateEntities.shareholders) {
      for (const shareholder of corporateEntities.shareholders) {
        const eodRequestId = (shareholder as any).corporateIndividualRequest?.requestId || 
                            (shareholder as any).eodRequestId || 
                            (shareholder as any).requestId;
        const kycId = (shareholder as any).kycId || 
                     (shareholder as any).kycRequestInfo?.kycId;
        const name = (shareholder as any).name || 
                    `${(shareholder as any).firstName || ""} ${(shareholder as any).lastName || ""}`.trim();
        const email = (shareholder as any).email;

        mappings.push({
          organization_id: organizationId,
          organization_type: organizationType,
          entity_type: "individual_shareholder",
          name: name || null,
          email: email || null,
          eod_request_id: eodRequestId || null,
          kyc_id: kycId || null,
        });
      }
    }

    // Extract business shareholders
    if (corporateEntities.corporateShareholders) {
      for (const shareholder of corporateEntities.corporateShareholders) {
        const codRequestId = (shareholder as any).corporateOnboardingRequest?.requestId || 
                            (shareholder as any).requestId || 
                            (shareholder as any).codRequestId;
        const kybId = (shareholder as any).kybId || 
                     (shareholder as any).kybRequestDto?.kybId;
        const businessName = (shareholder as any).businessName || 
                            (shareholder as any).name || 
                            (shareholder as any).companyName;

        mappings.push({
          organization_id: organizationId,
          organization_type: organizationType,
          entity_type: "business_shareholder",
          business_name: businessName || null,
          cod_request_id: codRequestId || null,
          kyb_id: kybId || null,
        });
      }
    }

    return this.bulkUpsert(mappings);
  }

  /**
   * Update KYC ID for a mapping and copy to duplicates
   */
  async updateKycIdAndCopyToDuplicates(
    organizationId: string,
    kycId: string,
    name: string,
    email: string
  ): Promise<AmlIdentityMapping[]> {
    // Find all mappings with matching name and email
    const duplicates = await this.findByNameAndEmail(organizationId, name, email);

    // Update all duplicates with the same kycId
    const updated: AmlIdentityMapping[] = [];
    for (const duplicate of duplicates) {
      const updatedMapping = await prisma.amlIdentityMapping.update({
        where: { id: duplicate.id },
        data: {
          kyc_id: kycId,
          updated_at: new Date(),
        },
      });
      updated.push(updatedMapping);
    }

    return updated;
  }

  /**
   * Update KYB ID for a mapping
   */
  async updateKybId(
    organizationId: string,
    entityType: "business_shareholder",
    businessName: string,
    kybId: string
  ): Promise<AmlIdentityMapping | null> {
    const existing = await this.findByOrganizationAndEntity(
      organizationId,
      entityType,
      null,
      businessName
    );

    if (!existing) {
      return null;
    }

    return prisma.amlIdentityMapping.update({
      where: { id: existing.id },
      data: {
        kyb_id: kybId,
        updated_at: new Date(),
      },
    });
  }
}
