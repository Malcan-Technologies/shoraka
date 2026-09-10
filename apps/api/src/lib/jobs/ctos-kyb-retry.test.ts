const mockLinkCtosPartyToKyb = jest.fn();
const mockFindMany = jest.fn();
const mockFindFirst = jest.fn();
const mockUpdate = jest.fn();

jest.mock("../prisma", () => ({
  prisma: {
    ctosPartySupplement: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

jest.mock("../../modules/organization/ctos-party-kyb-link", () => ({
  linkCtosPartyToKyb: (...args: unknown[]) => mockLinkCtosPartyToKyb(...args),
}));

import { runCtosKybRetryJob } from "./ctos-kyb-retry";

describe("runCtosKybRetryJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLinkCtosPartyToKyb.mockResolvedValue(undefined);
    mockFindFirst.mockResolvedValue({ id: "sup-1", onboarding_json: { status: "APPROVED" } });
    mockUpdate.mockResolvedValue({});
  });

  it("retries investor supplements after APPROVED when association flags are incomplete", async () => {
    mockFindMany.mockResolvedValue([
      {
        issuer_organization_id: null,
        investor_organization_id: "org-inv",
        party_key: "user:1",
        onboarding_json: {
          requestId: "LD1",
          status: "APPROVED",
          screening: { requestId: "KYC1", status: "PENDING" },
        },
      },
    ]);

    await runCtosKybRetryJob();

    expect(mockLinkCtosPartyToKyb).toHaveBeenCalledWith({
      organizationId: "org-inv",
      partyKey: "user:1",
      onboardingJson: expect.objectContaining({ status: "APPROVED" }),
      portalType: "investor",
    });
  });

  it("does not retry when pipeline is WAIT_FOR_APPROVAL even if KYC ID exists", async () => {
    mockFindMany.mockResolvedValue([
      {
        issuer_organization_id: "org-iss",
        investor_organization_id: null,
        party_key: "user:1",
        onboarding_json: {
          requestId: "LD1",
          status: "WAIT_FOR_APPROVAL",
          screening: { requestId: "KYC1", status: "PENDING" },
        },
      },
    ]);

    await runCtosKybRetryJob();

    expect(mockLinkCtosPartyToKyb).not.toHaveBeenCalled();
  });

  it("does not retry a relationship that already succeeded", async () => {
    mockFindMany.mockResolvedValue([
      {
        issuer_organization_id: "org-iss",
        investor_organization_id: null,
        party_key: "user:1",
        onboarding_json: {
          status: "APPROVED",
          kybDirectorLinked: true,
          kybShareholderLinked: true,
        },
      },
    ]);

    await runCtosKybRetryJob();

    expect(mockLinkCtosPartyToKyb).not.toHaveBeenCalled();
  });
});
