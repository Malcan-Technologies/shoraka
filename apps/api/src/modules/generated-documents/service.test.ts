jest.mock("../applications/letter-of-offer/render-facility-lo-docx", () => ({
  readFacilityLoTemplateBytes: jest.fn(),
  renderFacilityLoDocx: jest.fn(),
}));
jest.mock("../applications/letter-of-offer/build-facility-lo-merge-data");
jest.mock("../applications/joint-several-guarantee/render-jsg-docx", () => ({
  readJsgTemplateBytes: jest.fn(),
  renderJsgDocx: jest.fn(),
}));
jest.mock("../applications/joint-several-guarantee/build-jsg-merge-data");
jest.mock("../applications/letter-of-offer/convert-docx-to-pdf");
jest.mock("../applications/deed-of-assignment/render-doa-docx", () => ({
  readDeedOfAssignmentTemplateBytes: jest.fn(),
  renderDeedOfAssignmentDocx: jest.fn(),
}));
jest.mock("../applications/deed-of-assignment/build-doa-merge-data");
jest.mock("../applications/facility-agreement/render-fa-docx", () => ({
  readFacilityAgreementTemplateBytes: jest.fn(),
  renderFacilityAgreementDocx: jest.fn(),
}));
jest.mock("../applications/facility-agreement/build-fa-merge-data");
jest.mock("../applications/repository");
jest.mock("../products/repository");
jest.mock("../organization/repository");
jest.mock("../../lib/prisma", () => ({
  prisma: {
    platformFinanceSetting: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    generatedDocumentEvidence: {
      create: jest.fn().mockResolvedValue({ id: "gde-1" }),
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
import * as buildJsgMerge from "../applications/joint-several-guarantee/build-jsg-merge-data";
import * as renderJsg from "../applications/joint-several-guarantee/render-jsg-docx";
import * as convertPdf from "../applications/letter-of-offer/convert-docx-to-pdf";
import * as buildDoaMerge from "../applications/deed-of-assignment/build-doa-merge-data";
import * as renderDoa from "../applications/deed-of-assignment/render-doa-docx";
import * as buildFaMerge from "../applications/facility-agreement/build-fa-merge-data";
import * as renderFa from "../applications/facility-agreement/render-fa-docx";
import { createFacilityLoFixture } from "../applications/letter-of-offer/facility-lo-fixture";
import { createJsgFixture } from "../applications/joint-several-guarantee/jsg-fixture";
import { createDeedOfAssignmentFixture } from "../applications/deed-of-assignment/doa-fixture";
import { createFacilityAgreementFixture } from "../applications/facility-agreement/fa-fixture";
import { prisma } from "../../lib/prisma";

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

  it("returns true when the signing package includes Guarantor Agreement (JSG)", () => {
    const jsgWorkflow = [
      {
        id: "financing_type",
        config: {
          signing_packages: {
            enabled: true,
            roles: [{ key: "guarantor", label: "Guarantor" }],
            documents: [
              {
                key: "guarantor_agreement",
                name: "Guarantor Agreement",
                source: "TEMPLATE",
                order: 0,
                signer_role_keys: ["guarantor"],
              },
            ],
          },
        },
      },
    ];
    expect(workflowDeclaresGeneratedDocumentType(jsgWorkflow, "arf_joint_several_guarantee")).toBe(
      true
    );
    expect(workflowDeclaresGeneratedDocumentType(jsgWorkflow, "arf_contract_facility_lo")).toBe(
      false
    );
  });

  it("does not treat business_details guarantor agreement as JSG", () => {
    const businessDetailsWorkflow = [
      {
        id: "business_details",
        config: {
          guarantor_agreement: {
            name: "Guarantor agreement",
            generated_document_type: "arf_joint_several_guarantee",
          },
        },
      },
    ];
    expect(
      workflowDeclaresGeneratedDocumentType(businessDetailsWorkflow, "arf_joint_several_guarantee")
    ).toBe(false);
  });

  it("returns true when the signing package includes Deed of Assignment", () => {
    const doaWorkflow = [
      {
        id: "financing_type",
        config: {
          signing_packages: {
            enabled: true,
            roles: [{ key: "issuer_director", label: "Director" }],
            documents: [
              {
                key: "deed_of_assignment",
                name: "Deed of Assignment",
                source: "TEMPLATE",
                order: 0,
                signer_role_keys: ["issuer_director"],
              },
            ],
          },
        },
      },
    ];
    expect(workflowDeclaresGeneratedDocumentType(doaWorkflow, "arf_deed_of_assignment")).toBe(true);
    expect(workflowDeclaresGeneratedDocumentType(doaWorkflow, "arf_joint_several_guarantee")).toBe(
      false
    );
  });

  it("returns true when the signing package includes Facility Agreement", () => {
    const faWorkflow = [
      {
        id: "financing_type",
        config: {
          signing_packages: {
            enabled: true,
            roles: [{ key: "issuer_director", label: "Director" }],
            documents: [
              {
                key: "facility_agreement",
                name: "Facility Agreement",
                source: "TEMPLATE",
                order: 0,
                signer_role_keys: ["issuer_director"],
              },
            ],
          },
        },
      },
    ];
    expect(workflowDeclaresGeneratedDocumentType(faWorkflow, "arf_facility_agreement")).toBe(true);
    expect(workflowDeclaresGeneratedDocumentType(faWorkflow, "arf_deed_of_assignment")).toBe(false);
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
  const jsgWorkflow = [
    {
      id: "financing_type",
      config: {
        signing_packages: {
          enabled: true,
          roles: [{ key: "guarantor", label: "Guarantor" }],
          documents: [
            {
              key: "guarantor_agreement",
              name: "Guarantor Agreement",
              source: "TEMPLATE",
              order: 0,
              signer_role_keys: ["guarantor"],
            },
          ],
        },
      },
    },
  ];
  const doaWorkflow = [
    {
      id: "financing_type",
      config: {
        signing_packages: {
          enabled: true,
          roles: [{ key: "issuer_director", label: "Director" }],
          documents: [
            {
              key: "deed_of_assignment",
              name: "Deed of Assignment",
              source: "TEMPLATE",
              order: 0,
              signer_role_keys: ["issuer_director"],
            },
          ],
        },
      },
    },
  ];
  const faWorkflow = [
    {
      id: "financing_type",
      config: {
        signing_packages: {
          enabled: true,
          roles: [{ key: "issuer_director", label: "Director" }],
          documents: [
            {
              key: "facility_agreement",
              name: "Facility Agreement",
              source: "TEMPLATE",
              order: 0,
              signer_role_keys: ["issuer_director"],
            },
          ],
        },
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
    jest.spyOn(buildJsgMerge, "buildJsgMergeData").mockReturnValue(createJsgFixture());
    jest.spyOn(renderJsg, "readJsgTemplateBytes").mockReturnValue(Buffer.from("jsg-template"));
    jest.spyOn(renderJsg, "renderJsgDocx").mockReturnValue(Buffer.from("jsg-docx"));
    jest.spyOn(buildDoaMerge, "buildDeedOfAssignmentMergeData").mockReturnValue(
      createDeedOfAssignmentFixture()
    );
    jest
      .spyOn(renderDoa, "readDeedOfAssignmentTemplateBytes")
      .mockReturnValue(Buffer.from("doa-template"));
    jest.spyOn(renderDoa, "renderDeedOfAssignmentDocx").mockReturnValue(Buffer.from("doa-docx"));
    jest
      .spyOn(buildFaMerge, "buildFacilityAgreementMergeData")
      .mockReturnValue(createFacilityAgreementFixture());
    jest
      .spyOn(renderFa, "readFacilityAgreementTemplateBytes")
      .mockReturnValue(Buffer.from("fa-template"));
    jest.spyOn(renderFa, "renderFacilityAgreementDocx").mockReturnValue(Buffer.from("fa-docx"));
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

  it("returns JSG PDF when the signing package includes Guarantor Agreement", async () => {
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow: jsgWorkflow,
    } as never);

    const result = await service.generateDocument({
      applicationId,
      typeKey: "arf_joint_several_guarantee",
      format: "pdf",
      userId,
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toMatch(/^ARF-JSG-.+\.pdf$/);
    expect(result.filename.endsWith(".pdf")).toBe(true);
    expect(buildJsgMerge.buildJsgMergeData).toHaveBeenCalled();
    expect(renderJsg.renderJsgDocx).toHaveBeenCalled();
    expect(convertPdf.convertDocxToPdf).toHaveBeenCalled();
  });

  it("rejects JSG when the product does not configure it", async () => {
    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_joint_several_guarantee",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_NOT_CONFIGURED",
    });
  });

  it("rejects JSG when authorised representatives have not been saved", async () => {
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow: jsgWorkflow,
    } as never);
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
        typeKey: "arf_joint_several_guarantee",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_DATA_INCOMPLETE",
    });
  });

  it("returns Deed of Assignment PDF when the signing package includes it", async () => {
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow: doaWorkflow,
    } as never);

    const result = await service.generateDocument({
      applicationId,
      typeKey: "arf_deed_of_assignment",
      format: "pdf",
      userId,
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toMatch(/^ARF-DOA-.+\.pdf$/);
    expect(buildDoaMerge.buildDeedOfAssignmentMergeData).toHaveBeenCalled();
    expect(renderDoa.renderDeedOfAssignmentDocx).toHaveBeenCalled();
    expect(convertPdf.convertDocxToPdf).toHaveBeenCalled();
  });

  it("rejects Deed of Assignment when the product does not configure it", async () => {
    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_deed_of_assignment",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_NOT_CONFIGURED",
    });
  });

  it("rejects Deed of Assignment when authorised representatives have not been saved", async () => {
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow: doaWorkflow,
    } as never);
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
        typeKey: "arf_deed_of_assignment",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_DATA_INCOMPLETE",
    });
  });

  it("returns Facility Agreement PDF for a contract offer", async () => {
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow: faWorkflow,
    } as never);

    const result = await service.generateDocument({
      applicationId,
      typeKey: "arf_facility_agreement",
      format: "pdf",
      userId,
      contractId: "contract_1",
    });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toMatch(/^ARF-FA-.+\.pdf$/);
    expect(buildFaMerge.buildFacilityAgreementMergeData).toHaveBeenCalledWith(
      expect.objectContaining({ offerKind: "contract" })
    );
    expect(renderFa.renderFacilityAgreementDocx).toHaveBeenCalled();
    expect(prisma.generatedDocumentEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          document_type: "arf_facility_agreement",
          contract_id: "contract_1",
          invoice_id: null,
        }),
      })
    );
  });

  it("returns Facility Agreement PDF for an invoice offer and stores invoice evidence", async () => {
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow: faWorkflow,
    } as never);
    applicationRepository.findById.mockResolvedValue({
      ...baseApplication,
      contract: {
        ...baseApplication.contract,
        offer_details: null,
      },
      invoices: [
        {
          id: "inv_1",
          display_reference: "INV-REF-1",
          offer_details: {
            offered_amount: 180000,
            platform_fee_rate_percent: 1.5,
            sent_at: "2026-08-20T00:00:00.000Z",
            offer_acceptance: baseApplication.contract.offer_details.offer_acceptance,
          },
        },
      ],
    } as never);

    const result = await service.generateDocument({
      applicationId,
      typeKey: "arf_facility_agreement",
      format: "pdf",
      userId,
      invoiceId: "inv_1",
    });

    expect(result.contentType).toBe("application/pdf");
    expect(buildFaMerge.buildFacilityAgreementMergeData).toHaveBeenCalledWith(
      expect.objectContaining({ offerKind: "invoice" })
    );
    expect(prisma.generatedDocumentEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          document_type: "arf_facility_agreement",
          invoice_id: "inv_1",
        }),
      })
    );
  });

  it("rejects Facility Agreement when no offer has been sent", async () => {
    productRepository.findByBaseAndVersion.mockResolvedValue({
      workflow: faWorkflow,
    } as never);
    applicationRepository.findById.mockResolvedValue({
      ...baseApplication,
      contract: { ...baseApplication.contract, offer_details: null },
      invoices: [],
    } as never);

    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_facility_agreement",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_REQUIRES_NOT_MET",
    });
  });

  it("rejects Facility Agreement when the product does not configure it", async () => {
    await expect(
      service.generateDocument({
        applicationId,
        typeKey: "arf_facility_agreement",
        format: "pdf",
        userId,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "GENERATED_DOCUMENT_NOT_CONFIGURED",
    });
  });
});
