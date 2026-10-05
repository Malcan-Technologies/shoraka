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
  prisma: { applicationReview: { update: jest.fn() } },
}));
jest.mock("../applications/logs/service", () => ({ logApplicationActivity: jest.fn() }));

import { prisma } from "../../lib/prisma";
import { logApplicationActivity } from "../applications/logs/service";
import { AdminService } from "./service";

type AcceptanceApplication = {
  contract?: { status?: string } | null;
  invoices?: Array<{ contract_id?: string | null; status?: string }>;
  application_reviews?: { section: string; status: string }[];
};

type PrivateHelpers = {
  ensureAcceptanceHubReviewApprovedIfOfferComplete: (
    repository: unknown,
    applicationId: string,
    application: AcceptanceApplication,
    workflow: unknown,
    structureType?: string | null
  ) => Promise<void>;
  ensureExistingContractAcceptanceReviewApproved: (
    repository: unknown,
    applicationId: string,
    application: AcceptanceApplication
  ) => Promise<void>;
};

const signingOnlyWorkflow = [
  {
    id: "financing_type_1",
    config: { signing_packages: { documents: [{ key: "facility", name: "Facility" }] } },
  },
];

const reviewUpdate = (prisma as unknown as { applicationReview: { update: jest.Mock } })
  .applicationReview.update;
const logActivity = logApplicationActivity as jest.Mock;

const expectedLog = (oldStatus: string) =>
  expect.objectContaining({
    userId: null,
    applicationId: "app-1",
    eventType: "SECTION_REVIEWED_APPROVED",
    portal: null,
    remark: "Approved automatically because the offer was accepted",
    metadata: {
      scope: "section",
      scope_key: "acceptance_documents",
      old_status: oldStatus,
      new_status: "APPROVED",
    },
    source: "INTERNAL",
  });

describe("AdminService acceptance auto-approve activity log", () => {
  const helpers = new AdminService() as unknown as PrivateHelpers;
  const repository = { ensureApplicationReviewSection: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ensureAcceptanceHubReviewApprovedIfOfferComplete", () => {
    const run = (reviewStatus: string) =>
      helpers.ensureAcceptanceHubReviewApprovedIfOfferComplete(
        repository,
        "app-1",
        {
          contract: { status: "APPROVED" },
          invoices: [],
          application_reviews: [{ section: "acceptance_documents", status: reviewStatus }],
        },
        signingOnlyWorkflow,
        "new_contract"
      );

    it("logs a system approval after flipping a PENDING row", async () => {
      await run("PENDING");

      expect(reviewUpdate).toHaveBeenCalledTimes(1);
      expect(logActivity).toHaveBeenCalledTimes(1);
      expect(logActivity).toHaveBeenCalledWith(expectedLog("PENDING"));
      expect(reviewUpdate.mock.invocationCallOrder[0]).toBeLessThan(
        logActivity.mock.invocationCallOrder[0]
      );
    });

    it("neither writes nor logs when the row is already APPROVED", async () => {
      await run("APPROVED");

      expect(reviewUpdate).not.toHaveBeenCalled();
      expect(logActivity).not.toHaveBeenCalled();
    });
  });

  describe("ensureExistingContractAcceptanceReviewApproved", () => {
    it("logs with old_status PENDING when no acceptance row exists", async () => {
      await helpers.ensureExistingContractAcceptanceReviewApproved(repository, "app-1", {
        contract: { status: "APPROVED" },
        application_reviews: [],
      });

      expect(reviewUpdate).toHaveBeenCalledTimes(1);
      expect(logActivity).toHaveBeenCalledTimes(1);
      expect(logActivity).toHaveBeenCalledWith(expectedLog("PENDING"));
    });

    it("does nothing while the contract is not approved", async () => {
      await helpers.ensureExistingContractAcceptanceReviewApproved(repository, "app-1", {
        contract: { status: "OFFER_SENT" },
        application_reviews: [{ section: "acceptance_documents", status: "PENDING" }],
      });

      expect(repository.ensureApplicationReviewSection).not.toHaveBeenCalled();
      expect(reviewUpdate).not.toHaveBeenCalled();
      expect(logActivity).not.toHaveBeenCalled();
    });
  });
});
