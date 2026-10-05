jest.mock("../../lib/refresh-contract-facility", () => ({
  applyContractCapacityChange: jest.fn(),
  lockContractRow: jest.fn(),
}));
jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../../lib/http/request-utils", () => ({
  extractRequestMetadata: () => ({
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    deviceInfo: "test",
    deviceType: "desktop",
  }),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {},
}));
jest.mock("../applications/logs/service", () => ({ logApplicationActivity: jest.fn() }));

import { AdminService } from "./service";

type SyncAcceptance = (
  repository: unknown,
  applicationId: string,
  application: Record<string, unknown>,
  reviewerUserId: string
) => Promise<void>;

const signingOnlyWorkflow = [
  {
    id: "financing_type_1",
    config: { signing_packages: { documents: [{ key: "facility", name: "Facility" }] } },
  },
];

function buildApplication(contractStatus: string): Record<string, unknown> {
  return {
    id: "app-1",
    financing_type: { product_id: "product-1" },
    financing_structure: { structure_type: "new_contract" },
    product_version: 1,
    acceptance_documents: { documents: [{ name: "Board Resolution" }] },
    application_reviews: [{ section: "acceptance_documents", status: "APPROVED" }],
    application_review_items: [],
    contract: { status: contractStatus, offer_details: null },
    invoices: [],
  };
}

describe("AdminService syncAcceptanceDocumentsSectionFromItems", () => {
  const service = new AdminService();
  const repository = {
    ensureApplicationReviewSection: jest.fn(),
    updateSectionReviewStatus: jest.fn(),
    removeDraftAmendment: jest.fn(),
    getApplicationById: jest.fn(),
  };
  const getReviewSectionPolicy = jest.fn();
  const logReviewActivity = jest.fn();
  const sync = (application: Record<string, unknown>) =>
    (
      service as unknown as { syncAcceptanceDocumentsSectionFromItems: SyncAcceptance }
    ).syncAcceptanceDocumentsSectionFromItems(repository, "app-1", application, "admin-1");

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { getReviewSectionPolicy: jest.Mock }).getReviewSectionPolicy =
      getReviewSectionPolicy.mockResolvedValue({ productWorkflow: signingOnlyWorkflow });
    (service as unknown as { logReviewActivity: jest.Mock }).logReviewActivity =
      logReviewActivity.mockResolvedValue(undefined);
  });

  it("does not downgrade or log when the accepted offer owns the Acceptance row", async () => {
    await sync(buildApplication("APPROVED"));

    expect(getReviewSectionPolicy).toHaveBeenCalledTimes(1);
    expect(repository.ensureApplicationReviewSection).not.toHaveBeenCalled();
    expect(repository.updateSectionReviewStatus).not.toHaveBeenCalled();
    expect(logReviewActivity).not.toHaveBeenCalled();
  });

  it("returns before any product lookup when there are no document or party keys", async () => {
    await sync({
      ...buildApplication("APPROVED"),
      acceptance_documents: {},
      contract: { status: "APPROVED", offer_details: null },
      invoices: [],
    });

    expect(getReviewSectionPolicy).not.toHaveBeenCalled();
    expect(repository.updateSectionReviewStatus).not.toHaveBeenCalled();
    expect(logReviewActivity).not.toHaveBeenCalled();
  });

  it("skips the product lookup while the offer cannot be accepted yet", async () => {
    await sync(buildApplication("OFFER_SENT"));

    expect(getReviewSectionPolicy).not.toHaveBeenCalled();
  });

  it("derives PENDING from item rows while the offer is still out", async () => {
    await sync(buildApplication("OFFER_SENT"));

    expect(repository.updateSectionReviewStatus).toHaveBeenCalledWith(
      "app-1",
      "acceptance_documents",
      "PENDING",
      "admin-1"
    );
    expect(logReviewActivity).toHaveBeenCalledWith(
      "app-1",
      "section",
      "acceptance_documents",
      "APPROVED",
      "PENDING",
      "admin-1",
      null,
      undefined
    );
  });
});
