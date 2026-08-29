const mockFindByRequestId = jest.fn();
const mockUpdateStatus = jest.fn().mockResolvedValue({});
const mockAppendWebhookPayload = jest.fn().mockResolvedValue(undefined);
const mockOnboardingLogCreate = jest.fn().mockResolvedValue({});

jest.mock("./repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findByRequestId: (...args: unknown[]) => mockFindByRequestId(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
    appendWebhookPayload: (...args: unknown[]) => mockAppendWebhookPayload(...args),
  })),
}));

jest.mock("./api-client", () => ({
  getRegTankAPIClient: () => ({}),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        onboardingLog: { create: (...args: unknown[]) => mockOnboardingLogCreate(...args) },
      })
    ),
  },
}));

import { RegTankService } from "./service";

describe("RegTankService.handleWebhookUpdate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not append a synthetic webhook payload (persistence is owned by the webhook intake handler / refresh path)", async () => {
    mockFindByRequestId.mockResolvedValue({
      request_id: "LD001-R01",
      user_id: "user-1",
      investor_organization_id: null,
      issuer_organization_id: null,
      portal_type: "investor",
    });

    const service = new RegTankService();
    await service.handleWebhookUpdate({
      requestId: "LD001-R01",
      status: "PROCESSING",
    } as never);

    expect(mockUpdateStatus).toHaveBeenCalledTimes(1);
    expect(mockAppendWebhookPayload).not.toHaveBeenCalled();
  });

  it("still updates status even though it no longer persists a payload", async () => {
    mockFindByRequestId.mockResolvedValue({
      request_id: "LD001-R02",
      user_id: "user-1",
      investor_organization_id: null,
      issuer_organization_id: null,
      portal_type: "investor",
    });

    const service = new RegTankService();
    await service.handleWebhookUpdate({
      requestId: "LD001-R02",
      status: "REJECTED",
    } as never);

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "LD001-R02",
      expect.objectContaining({ status: expect.any(String) }),
      expect.anything()
    );
    expect(mockAppendWebhookPayload).not.toHaveBeenCalled();
  });
});
