import { ApplicationRepository } from "./repository";
import { ProductRepository } from "../products/repository";
import { CreateApplicationInput, UpdateApplicationStepInput } from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import { Application, Prisma } from "@prisma/client";
import {
  generateApplicationDocumentKey,
  generateApplicationDocumentKeyWithVersion,
  parseApplicationDocumentKey,
  generatePresignedUploadUrl,
  getFileExtension,
  deleteS3Object,
} from "../../lib/s3/client";
import { logger } from "../../lib/logger";

export class ApplicationService {
  private repository: ApplicationRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.repository = new ApplicationRepository();
    this.productRepository = new ProductRepository();
  }

  /**
   * Map step index to database field name
   */
  private getFieldNameForStep(index: number): keyof Application | null {
    const stepFields: (keyof Application)[] = [
      "financing_type",
      "invoice_details",
      "buyer_details",
      "verify_company_info",
      "supporting_documents",
      "declarations",
      "review_submit",
    ];
    return stepFields[index] || null;
  }

  /**
   * Create a new application
   */
  async createApplication(input: CreateApplicationInput): Promise<Application> {
    // 1. Fetch product to get latest version
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    // 2. Create application with product version and product_id in financing_type
    return this.repository.create({
      issuer_organization_id: input.issuerOrganizationId,
      product_version: product.version,
      financing_type: {
        product_id: input.productId,
      },
    });
  }

  /**
   * Get application and check product version
   */
  async getApplication(id: string) {
    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    // Extract product_id from financing_type
    const financingType = application.financing_type as any;
    const productId = financingType?.product_id;

    let isVersionMismatch = false;
    let latestProductVersion: number | undefined;

    if (productId) {
      const currentProduct = await this.productRepository.findById(productId);
      if (currentProduct) {
        latestProductVersion = currentProduct.version;
        isVersionMismatch = application.product_version !== currentProduct.version;
      }
    }

    return {
      ...application,
      isVersionMismatch,
      latestProductVersion,
    };
  }

  /**
   * Update a specific step in the application
   */
  async updateStep(id: string, input: UpdateApplicationStepInput): Promise<Application> {
    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    const fieldName = this.getFieldNameForStep(input.stepIndex);
    if (!fieldName) {
      throw new AppError(400, "INVALID_STEP_INDEX", "Invalid step index");
    }

    const updateData: Prisma.ApplicationUpdateInput = {
      [fieldName]: input.data as Prisma.InputJsonValue,
      updated_at: new Date(),
    };

    // Update last_completed_step if this is a new step
    if (input.stepIndex >= application.last_completed_step) {
      updateData.last_completed_step = input.stepIndex + 1;
    }

    return this.repository.update(id, updateData);
  }

  /**
   * Archive an application
   */
  async archiveApplication(id: string): Promise<Application> {
    const application = await this.repository.findById(id);
    if (!application) {
      throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
    }

    return this.repository.update(id, {
      status: "ARCHIVED",
      updated_at: new Date(),
    });
  }

  /**
   * Generate a simple cuid-like string for S3 keys
   */
  private generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}${random}`;
  }

  /**
   * Request presigned URL for uploading application document
   */
  async requestUploadUrl(params: {
    applicationId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    existingS3Key?: string;
  }): Promise<{ uploadUrl: string; s3Key: string; expiresIn: number }> {
    // Validate file type (PNG only)
    if (params.contentType !== "image/png") {
      throw new AppError(400, "VALIDATION_ERROR", "File type not allowed. Please upload PNG files only.");
    }

    // Validate file size (max 5MB)
    const maxSizeInBytes = 5 * 1024 * 1024;
    if (params.fileSize > maxSizeInBytes) {
      throw new AppError(400, "VALIDATION_ERROR", "File size must be less than 5MB");
    }

    // Get file extension
    const extension = getFileExtension(params.fileName) || "png";

    let s3Key: string;

    if (params.existingS3Key) {
      // Parse existing key to get version and cuid
      const parsed = parseApplicationDocumentKey(params.existingS3Key);
      if (!parsed) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid existing S3 key format");
      }

      // Generate new key with incremented version
      const newKey = generateApplicationDocumentKeyWithVersion({
        existingS3Key: params.existingS3Key,
        extension,
      });

      if (!newKey) {
        throw new AppError(400, "VALIDATION_ERROR", "Failed to generate new S3 key");
      }

      s3Key = newKey;
    } else {
      // Generate new cuid and create v1 key
      const cuid = this.generateCuid();
      s3Key = generateApplicationDocumentKey({
        applicationId: params.applicationId,
        cuid,
        extension,
        version: 1,
      });
    }

    // Generate presigned upload URL
    const { uploadUrl, expiresIn } = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: params.contentType,
      contentLength: params.fileSize,
    });

    return {
      uploadUrl,
      s3Key,
      expiresIn,
    };
  }

  /**
   * Delete an application document from S3
   */
  async deleteDocument(s3Key: string): Promise<void> {
    try {
      await deleteS3Object(s3Key);
      logger.info({ s3Key }, "Deleted application document from S3");
    } catch (error) {
      logger.warn({ s3Key, error }, "Failed to delete application document from S3");
      throw new AppError(500, "DELETE_FAILED", "Failed to delete document from S3");
    }
  }
}

export const applicationService = new ApplicationService();
