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

import { runCtosKybRetryJob, ctosPartySupplementNeedsKybRetry } from "./ctos-kyb-retry";
import {
  ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID,
  ADMIN_PEOPLE_DEMO_INVESTOR_ORG_ID,
  adminPeopleDemoSupplement,
} from "../../modules/admin/admin-people-demo-data";

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

  it("does not retry Admin People demo issuer/investor supplements (KYB already marked linked)", async () => {
    mockFindMany.mockResolvedValue([
      {
        issuer_organization_id: ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID,
        investor_organization_id: null,
        party_key: "880101145001",
        onboarding_json: adminPeopleDemoSupplement({
          requestId: "EOD90001",
          status: "APPROVED",
          screeningStatus: "APPROVED",
          screeningRequestId: "KYC90001",
        }),
      },
      {
        issuer_organization_id: null,
        investor_organization_id: ADMIN_PEOPLE_DEMO_INVESTOR_ORG_ID,
        party_key: "770101145021",
        onboarding_json: adminPeopleDemoSupplement({
          requestId: "EOD90021",
          status: "APPROVED",
          screeningStatus: "APPROVED",
          screeningRequestId: "KYC90021",
        }),
      },
    ]);

    await runCtosKybRetryJob();

    expect(mockLinkCtosPartyToKyb).not.toHaveBeenCalled();
  });

  it("still retries a normal organisation that is APPROVED without KYB link flags", async () => {
    mockFindMany.mockResolvedValue([
      {
        issuer_organization_id: ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID,
        investor_organization_id: null,
        party_key: "880101145001",
        onboarding_json: adminPeopleDemoSupplement({
          requestId: "EOD90001",
          status: "APPROVED",
          screeningStatus: "APPROVED",
          screeningRequestId: "KYC90001",
        }),
      },
      {
        issuer_organization_id: "org-live-issuer",
        investor_organization_id: null,
        party_key: "900101101234",
        onboarding_json: {
          requestId: "LD-LIVE",
          status: "APPROVED",
          screening: { requestId: "KYC00199", status: "APPROVED" },
        },
      },
    ]);

    await runCtosKybRetryJob();

    expect(mockLinkCtosPartyToKyb).toHaveBeenCalledTimes(1);
    expect(mockLinkCtosPartyToKyb).toHaveBeenCalledWith({
      organizationId: "org-live-issuer",
      partyKey: "900101101234",
      onboardingJson: expect.objectContaining({ status: "APPROVED", requestId: "LD-LIVE" }),
      portalType: "issuer",
    });
  });
});

describe("ctosPartySupplementNeedsKybRetry", () => {
  it("is false for demo seed supplements and true for a live APPROVED incomplete row", () => {
    expect(
      ctosPartySupplementNeedsKybRetry(
        adminPeopleDemoSupplement({
          requestId: "EOD90001",
          status: "APPROVED",
          screeningStatus: "APPROVED",
          screeningRequestId: "KYC90001",
        })
      )
    ).toBe(false);
    expect(
      ctosPartySupplementNeedsKybRetry({
        requestId: "LD-LIVE",
        status: "APPROVED",
        screening: { requestId: "KYC00199", status: "APPROVED" },
      })
    ).toBe(true);
  });
});
