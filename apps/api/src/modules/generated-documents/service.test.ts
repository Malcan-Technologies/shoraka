jest.mock("../applications/letter-of-offer/render-facility-lo-docx", () => ({
  readFacilityLoTemplateBytes: jest.fn(),
  renderFacilityLoDocx: jest.fn(),
}));
jest.mock("../applications/letter-of-offer/build-facility-lo-merge-data");
jest.mock("../applications/letter-of-offer/convert-docx-to-pdf");
jest.mock("../applications/repository");
jest.mock("../products/repository");
jest.mock("../organization/repository");
jest.mock("../../lib/prisma", () => ({
  prisma: {
    platformFinanceSetting: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

import { AppError } from "../../lib/http/error-handler";
import {
  GeneratedDocumentsService,
  workflowDeclaresGeneratedDocumentType,
} from "./service";
import { ApplicationRepository } from "../applications/repository";
import { ProductRepository } from "../products/repository";
import { OrganizationRepository } from "../organization/repository";
import * as buildMerge from "../applications/letter-of-offer/build-facility-lo-merge-data";
import * as renderDocx from "../applications/letter-of-offer/render-facility-lo-docx";
import * as convertPdf from "../applications/letter-of-offer/convert-docx-to-pdf";
import { createFacilityLoFixture } from "../applications/letter-of-offer/facility-lo-fixture";

describe("workflowDeclaresGeneratedDocumentType", () => {
  const workflow = [
    {
      id: "financing_type",
      config: {
        acceptance_documents: [
          {
            name: "Letter of Offer",
            generated_document_type: "arf_contract_facility_lo",
          },
        ],
      },
    },
  ];

  it("returns true when acceptance row declares the type", () => {
    expect(workflowDeclaresGeneratedDocumentType(workflow, "arf_contract_facility_lo")).toBe(true);
  });

  it("returns false when type is not on the product", () => {
    const emptyWorkflow = [{ id: "financing_type", config: { acceptance_documents: [] } }];
    expect(workflowDeclaresGeneratedDocumentType(emptyWorkflow, "arf_contract_facility_lo")).toBe(
      false
    );
  });
});

describe("GeneratedDocumentsService.generateDocument", () => {
  const applicationId = "app_test_001";
  const userId = "user_issuer_1";
  const workflow = [
    {
      id: "financing_type",
      config: {
        acceptance_documents: [
          {
            name: "Letter of Offer",
            generated_document_type: "arf_contract_facility_lo",
          },
        ],
      },
    },
  ];

  let service: GeneratedDocumentsService;
  let applicationRepository: jest.Mocked<ApplicationRepository>;
  let productRepository: jest.Mocked<ProductRepository>;
  let organizationRepository: jest.Mocked<OrganizationRepository>;

  const baseApplication = {
    id: applicationId,
    issuer_organization_id: "org_1",
    product_version: 3,
    financing_type: { product_id: "prod_base_1" },
    company_details: {},
    business_details: {},
    issuer_organization: {
      id: "org_1",
      owner_user_id: userId,
      name: "Test Issuer Ltd",
      registration_number: "123456-A",
      address: "1 Test Street",
      corporate_onboarding_data: null,
    },
    contract: {
      id: "contract_1",
      issuer_organization_id: "org_1",
      contract_details: { approved_facility: 100000 },
      offer_details: {
        offered_facility: 100000,
        sent_at: "2026-08-01T00:00:00.000Z",
        offer_acceptance: {
          status: "PENDING_ISSUER",
          authorized_parties_draft: {
            submitted_by_user_id: "user_issuer_1",
            submitted_at: "2026-08-01T01:00:00.000Z",
            parties: [
              {
                key: "issuer",
                entity_kind: "ISSUER",
                representatives: [
                  {
                    name: "Ali",
                    email: "ali@co.my",
                    ic_number: "820508105871",
                    capacity: "director",
                    person_match_key: "820508105871",
                  },
                ],
              },
            ],
          },
        },
      },
      customer_details: {},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    applicationRepository = new ApplicationRepository() as jest.Mocked<ApplicationRepository>;
    productRepository = new ProductRepository() as jest.Mocked<ProductRepository>;
    organizationRepository = new OrganizationRepository() as jest.Mocked<OrganizationRepository>;
    service = new GeneratedDocumentsService(
      applicationRepository,
      productRepository,
      organizationRepository
    );

    applicationRepository.findById.mockResolvedValue(baseApplication as never);
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow,
    } as never);

    jest.spyOn(buildMerge, "buildFacilityLoMergeData").mockReturnValue(createFacilityLoFixture());
    jest.spyOn(renderDocx, "readFacilityLoTemplateBytes").mockReturnValue(Buffer.from("template"));
    jest.spyOn(renderDocx, "renderFacilityLoDocx").mockReturnValue(Buffer.from("docx"));
    jest.spyOn(convertPdf, "convertDocxToPdf").mockResolvedValue(Buffer.from("%PDF-mock"));
  });

  it("returns PDF when gates pass", async () => {
    const result = await service.generateDocument({
      applicationId,
      typeKey: "arf_contract_facility_lo",
      format: "pdf",
      userId,
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename.endsWith(".pdf")).toBe(true);
    expect(result.templateSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(convertPdf.convertDocxToPdf).toHaveBeenCalled();
  });

  it("rejects when product does not configure the generated type", async () => {
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow: [{ id: "financing_type", config: { acceptance_documents: [] } }],
    } as never);

    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_contract_facility_lo",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_NOT_CONFIGURED",
    });
  });

  it("rejects when contract offer_details is missing", async () => {
    applicationRepository.findById.mockResolvedValue({
      ...baseApplication,
      contract: {
        ...baseApplication.contract,
        offer_details: null,
      },
    } as never);

    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_contract_facility_lo",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_REQUIRES_NOT_MET",
    });
  });

  it("rejects unknown type keys", async () => {
    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "unknown_type",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects issuer without org access", async () => {
    applicationRepository.findById.mockResolvedValue({
      ...baseApplication,
      issuer_organization: {
        ...baseApplication.issuer_organization,
        owner_user_id: "other_user",
      },
    } as never);
    organizationRepository.getOrganizationMember.mockResolvedValue(null);

    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_contract_facility_lo",
        format: "pdf",
        userId,
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("allows admin generate without issuer membership", async () => {
    applicationRepository.findById.mockResolvedValue({
      ...baseApplication,
      issuer_organization: {
        ...baseApplication.issuer_organization,
        owner_user_id: "other_user",
      },
    } as never);

    const result = await service.generateDocument({
      applicationId,
      typeKey: "arf_contract_facility_lo",
      format: "pdf",
      userId: "admin_user",
      asAdmin: true,
    });

    expect(result.buffer.toString()).toBe("%PDF-mock");
    expect(organizationRepository.getOrganizationMember).not.toHaveBeenCalled();
  });

  it("rejects when authorised representatives have not been saved", async () => {
    applicationRepository.findById.mockResolvedValue({
      ...baseApplication,
      contract: {
        ...baseApplication.contract,
        offer_details: {
          offered_facility: 100000,
          sent_at: "2026-08-01T00:00:00.000Z",
        },
      },
    } as never);

    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_contract_facility_lo",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_DATA_INCOMPLETE",
    });
  });

  it("rejects when the frozen product has no invoice sub-limit", async () => {
    jest.spyOn(buildMerge, "buildFacilityLoMergeData").mockReturnValue({
      ...createFacilityLoFixture(),
      sub_limit_per_invoice_rm: "",
      part_b_financing_amount_rm: "",
    });

    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_contract_facility_lo",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_DATA_INCOMPLETE",
    });
  });
});
