import { Request } from "express";
import { Prisma } from "@prisma/client";
import { NoteApplicationRepository } from "./repository";
import type {
  CreateDraftApplicationInput,
  UpdateApplicationInput,
  SubmitApplicationInput,
  ApplicationStatus,
} from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { logger } from "../../lib/logger";
import { deleteS3Object } from "../../lib/s3/client";

export class NoteApplicationService {
  constructor(private repository: NoteApplicationRepository) {}

  /**
   * Create a new draft application
   */
  async createDraftApplication(
    req: Request,
    issuerOrganizationId: string,
    input: CreateDraftApplicationInput
  ) {
    const metadata = extractRequestMetadata(req);

    logger.info(
      { ...metadata, issuerOrganizationId, input },
      "Creating draft application"
    );

    const application = await this.repository.create({
      issuerOrganizationId,
    });

    logger.info(
      { ...metadata, applicationId: application.id },
      "Draft application created"
    );

    return application;
  }

  /**
   * Get application by ID
   */
  async getApplicationById(id: string) {
    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }
    return application;
  }

  /**
   * Extract productId from financing_type JSON
   */
  private getProductIdFromFinancingType(financingType: Prisma.JsonValue | null): string | null {
    if (!financingType) return null;
    try {
      const data = financingType as { productId?: string };
      return data.productId || null;
    } catch {
      return null;
    }
  }

  /**
   * Validate if a step can be accessed based on required data
   * Returns the last allowed step number
   */
  validateStepAccess(application: {
    status: ApplicationStatus;
    last_completed_step: number;
    financing_type: Prisma.JsonValue | null;
    financing_terms: Prisma.JsonValue | null;
    invoice_details: Prisma.JsonValue | null;
    company_info: Prisma.JsonValue | null;
    supporting_documents: Prisma.JsonValue | null;
    declaration: Prisma.JsonValue | null;
  }, requestedStep: number): { allowed: boolean; lastAllowedStep: number } {
    // If submitted or beyond, only allow viewing (no step param)
    if (application.status !== "DRAFT") {
      return { allowed: requestedStep === 0, lastAllowedStep: 0 };
    }

    const productId = this.getProductIdFromFinancingType(application.financing_type);

    // Step 1: Financing Type - always allowed
    if (requestedStep === 1) {
      return { allowed: true, lastAllowedStep: 1 };
    }

    // Step 2: Financing Terms - requires step 1 complete (productId in financing_type)
    if (requestedStep === 2) {
      const step1Complete = !!productId;
      return {
        allowed: step1Complete,
        lastAllowedStep: step1Complete ? 2 : 1,
      };
    }

    // Step 3: Invoice Details - requires step 2 complete
    if (requestedStep === 3) {
      const step1Complete = !!productId;
      const step2Complete = !!application.financing_terms;
      const lastAllowed = step1Complete && step2Complete ? 3 : step1Complete ? 2 : 1;
      return {
        allowed: step1Complete && step2Complete,
        lastAllowedStep: lastAllowed,
      };
    }

    // Step 4: Verify Company Info - requires step 3 complete
    if (requestedStep === 4) {
      const step1Complete = !!productId;
      const step2Complete = !!application.financing_terms;
      const step3Complete = !!application.invoice_details;
      const lastAllowed = step1Complete && step2Complete && step3Complete
        ? 4
        : step1Complete && step2Complete
          ? 3
          : step1Complete
            ? 2
            : 1;
      return {
        allowed: step1Complete && step2Complete && step3Complete,
        lastAllowedStep: lastAllowed,
      };
    }

    // Step 5: Supporting Documents - requires step 4 complete
    if (requestedStep === 5) {
      const step1Complete = !!productId;
      const step2Complete = !!application.financing_terms;
      const step3Complete = !!application.invoice_details;
      const step4Complete = !!application.company_info;
      const lastAllowed = step1Complete && step2Complete && step3Complete && step4Complete
        ? 5
        : step1Complete && step2Complete && step3Complete
          ? 4
          : step1Complete && step2Complete
            ? 3
            : step1Complete
              ? 2
              : 1;
      return {
        allowed: step1Complete && step2Complete && step3Complete && step4Complete,
        lastAllowedStep: lastAllowed,
      };
    }

    // Step 6: Declaration - requires step 5 complete
    if (requestedStep === 6) {
      const step1Complete = !!productId;
      const step2Complete = !!application.financing_terms;
      const step3Complete = !!application.invoice_details;
      const step4Complete = !!application.company_info;
      const step5Complete = !!application.supporting_documents;
      const lastAllowed = step1Complete && step2Complete && step3Complete && step4Complete && step5Complete
        ? 6
        : step1Complete && step2Complete && step3Complete && step4Complete
          ? 5
          : step1Complete && step2Complete && step3Complete
            ? 4
            : step1Complete && step2Complete
              ? 3
              : step1Complete
                ? 2
                : 1;
      return {
        allowed: step1Complete && step2Complete && step3Complete && step4Complete && step5Complete,
        lastAllowedStep: lastAllowed,
      };
    }

    // Step 7: Review & Submit - requires all previous steps complete
    if (requestedStep === 7) {
      const step1Complete = !!productId;
      const step2Complete = !!application.financing_terms;
      const step3Complete = !!application.invoice_details;
      const step4Complete = !!application.company_info;
      const step5Complete = !!application.supporting_documents;
      const step6Complete = !!application.declaration;
      const allComplete = step1Complete && step2Complete && step3Complete && step4Complete && step5Complete && step6Complete;
      return {
        allowed: allComplete,
        lastAllowedStep: allComplete ? 7 : step1Complete && step2Complete && step3Complete && step4Complete && step5Complete ? 6 : step1Complete && step2Complete && step3Complete && step4Complete ? 5 : step1Complete && step2Complete && step3Complete ? 4 : step1Complete && step2Complete ? 3 : step1Complete ? 2 : 1,
      };
    }

    return { allowed: false, lastAllowedStep: 1 };
  }

  /**
   * Update application (for saving step data)
   */
  async updateApplication(
    req: Request,
    id: string,
    input: UpdateApplicationInput
  ) {
    const metadata = extractRequestMetadata(req);

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    // Cannot update if already submitted
    if (existing.status !== "DRAFT") {
      throw new AppError(
        400,
        "APPLICATION_LOCKED",
        "Cannot update application that is not in DRAFT status"
      );
    }

    logger.info(
      { ...metadata, applicationId: id, input },
      "Updating application"
    );

    // Determine which step is being updated and what the last completed step should be
    let lastCompletedStep = existing.last_completed_step;
    let stepData: {
      financingType?: Prisma.InputJsonValue | null;
      financingTerms?: Prisma.InputJsonValue | null;
      invoiceDetails?: Prisma.InputJsonValue | null;
      companyInfo?: Prisma.InputJsonValue | null;
      supportingDocuments?: Prisma.InputJsonValue | null;
      declaration?: Prisma.InputJsonValue | null;
    } = {};

    // Helper function to delete S3 files from supporting documents
    const deleteSupportingDocumentsS3Files = async () => {
      if (!existing.supporting_documents) {
        logger.debug({ applicationId: id }, "No supporting documents to delete");
        return;
      }
      
      try {
        logger.info(
          { applicationId: id, supportingDocuments: JSON.stringify(existing.supporting_documents) },
          "Attempting to delete S3 files from supporting documents"
        );

        // Extract S3 keys from existing supporting documents
        // Structure: { categories: [{ name, documents: [{ title, file: { file_name, s3_key } }] }] }
        const existingDocs = existing.supporting_documents as {
          categories?: Array<{
            name: string;
            documents: Array<{
              title: string;
              file?: {
                file_name?: string;
                s3_key?: string;
                // Backward compatibility: also check old field names
                name?: string;
                s3Key?: string;
              };
            }>;
          }>;
        } | null;

        if (!existingDocs) {
          logger.warn({ applicationId: id }, "Supporting documents structure is invalid");
          return;
        }

        if (!existingDocs.categories || existingDocs.categories.length === 0) {
          logger.debug({ applicationId: id }, "No categories found in supporting documents");
          return;
        }

        const s3Keys: string[] = [];
        
        existingDocs.categories.forEach((category, catIndex) => {
          if (!category.documents) return;
          
          category.documents.forEach((doc, docIndex) => {
            // Support both s3_key (new) and s3Key (old) for backward compatibility
            const s3Key = doc.file?.s3_key || doc.file?.s3Key;
            if (s3Key) {
              s3Keys.push(s3Key);
              logger.debug(
                { applicationId: id, categoryIndex: catIndex, docIndex, s3Key },
                "Found S3 key to delete"
              );
            } else {
              logger.debug(
                { applicationId: id, categoryIndex: catIndex, docIndex, hasFile: !!doc.file },
                "Document has no s3_key"
              );
            }
          });
        });

        if (s3Keys.length === 0) {
          logger.warn({ applicationId: id }, "No S3 keys found in supporting documents");
          return;
        }

        logger.info(
          { applicationId: id, s3KeysCount: s3Keys.length, s3Keys },
          "Deleting application documents from S3"
        );

        // Delete all S3 files (best effort - don't fail if deletion fails)
        let successCount = 0;
        let failCount = 0;
        
        for (const s3Key of s3Keys) {
          try {
            await deleteS3Object(s3Key);
            successCount++;
            logger.info({ s3Key, applicationId: id }, "Successfully deleted application document from S3");
          } catch (error) {
            failCount++;
            logger.error(
              { s3Key, applicationId: id, error: error instanceof Error ? error.message : String(error) },
              "Failed to delete application document from S3"
            );
          }
        }

        logger.info(
          { applicationId: id, total: s3Keys.length, successCount, failCount },
          "Completed deletion of application documents from S3"
        );
      } catch (error) {
        // Log error but don't fail the update
        logger.error(
          { applicationId: id, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined },
          "Error deleting S3 files from supporting documents"
        );
      }
    };

    // If productId is provided, it's step 1 - store in financing_type
    // If product changed, delete all S3 files from supporting documents
    if (input.productId !== undefined) {
      // Check if product changed by comparing with existing productId
      const existingProductId = existing.financing_type 
        ? (existing.financing_type as { productId?: string })?.productId 
        : null;
      const productChanged = existingProductId !== null && existingProductId !== input.productId;
      
      // If product changed, delete S3 files before clearing data
      if (productChanged) {
        await deleteSupportingDocumentsS3Files();
      }
      
      stepData.financingType = { productId: input.productId };
      lastCompletedStep = Math.max(lastCompletedStep, 1);
    }

    // If data contains step-specific fields, update the corresponding columns
    if (input.data) {
      const data = input.data as Record<string, unknown>;
      
      if (data.financingTerms !== undefined) {
        stepData.financingTerms = data.financingTerms as Prisma.InputJsonValue;
        lastCompletedStep = Math.max(lastCompletedStep, 2);
      }
      if (data.invoiceDetails !== undefined) {
        stepData.invoiceDetails = data.invoiceDetails as Prisma.InputJsonValue;
        lastCompletedStep = Math.max(lastCompletedStep, 3);
      }
      if (data.companyInfo !== undefined) {
        stepData.companyInfo = data.companyInfo as Prisma.InputJsonValue;
        lastCompletedStep = Math.max(lastCompletedStep, 4);
      }
      if (data.supportingDocuments !== undefined) {
        // If clearing supporting documents (setting to null), delete S3 files first
        // Note: This might be redundant if product changed (already deleted above),
        // but we check to avoid double deletion - only delete if we haven't already
        if (data.supportingDocuments === null && existing.supporting_documents) {
          // Only delete if product didn't change (to avoid double deletion)
          // If product changed, deletion already happened above
          const productChanged = input.productId !== undefined && 
            existing.financing_type &&
            (existing.financing_type as { productId?: string })?.productId !== input.productId;
          
          if (!productChanged) {
            logger.info({ applicationId: id }, "Clearing supporting documents - deleting S3 files");
            await deleteSupportingDocumentsS3Files();
          } else {
            logger.debug({ applicationId: id }, "Skipping deletion - already deleted due to product change");
          }
        }
        
        stepData.supportingDocuments = data.supportingDocuments as Prisma.InputJsonValue;
        lastCompletedStep = Math.max(lastCompletedStep, 5);
      }
      if (data.declaration !== undefined) {
        stepData.declaration = data.declaration as Prisma.InputJsonValue;
        lastCompletedStep = Math.max(lastCompletedStep, 6);
      }
    }

    const application = await this.repository.update(id, {
      ...stepData,
      lastCompletedStep,
    });

    logger.info(
      { ...metadata, applicationId: application.id },
      "Application updated"
    );

    return application;
  }

  /**
   * Submit application (validate all required data)
   */
  async submitApplication(req: Request, id: string, input: SubmitApplicationInput) {
    const metadata = extractRequestMetadata(req);

    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    if (application.status !== "DRAFT") {
      throw new AppError(
        400,
        "APPLICATION_ALREADY_SUBMITTED",
        "Application has already been submitted"
      );
    }

    // Validate all required steps are complete
    const productId = this.getProductIdFromFinancingType(application.financing_type);
    if (!productId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Step 1 (Financing Type) is required"
      );
    }
    if (!application.financing_terms) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Step 2 (Financing Terms) is required"
      );
    }
    if (!application.invoice_details) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Step 3 (Invoice Details) is required"
      );
    }
    if (!application.company_info) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Step 4 (Verify Company Info) is required"
      );
    }
    if (!application.supporting_documents) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Step 5 (Supporting Documents) is required"
      );
    }
    if (!application.declaration) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Step 6 (Declaration) is required"
      );
    }

    logger.info(
      { ...metadata, applicationId: id },
      "Submitting application"
    );

    const updated = await this.repository.update(id, {
      status: "SUBMITTED",
      submittedAt: new Date(),
    });

    logger.info(
      { ...metadata, applicationId: updated.id },
      "Application submitted"
    );

    return updated;
  }
}
