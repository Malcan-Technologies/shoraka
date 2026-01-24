import { ApplicationRepository } from "./repository";
import { ProductRepository } from "../products/repository";
import { CreateApplicationInput, UpdateApplicationStepInput } from "./schemas";
import { AppError } from "../../lib/http/error-handler";
import { Application, Prisma } from "@prisma/client";

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
}

export const applicationService = new ApplicationService();
