import { OrganizationType, OrganizationMemberRole, OnboardingStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { OrganizationService } from "./service";

const sentinelError = new Error("SHOULD_REACH_AFTER_PLATFORM_GATE_REMOVAL");

jest.mock("../../lib/audit", () => ({
  auditContextFromRequest: jest.fn().mockReturnValue({}),
  persistOrganizationUpdateAndOnboardingLogs: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../admin/organization-profile-audit", () => ({
  buildOrganizationProfileAuditEvidence: jest.fn().mockReturnValue({
    updatedFields: [],
    previousValues: {},
    nextValues: {},
    bankFieldsChanged: false,
  }),
}));

jest.mock("../../lib/prisma", () => {
  const findUnique = jest.fn().mockResolvedValue({
    user_id: "member-1",
    investor_account: ["temp"],
    issuer_account: ["temp"],
  });
  const update = jest.fn().mockResolvedValue({});
  return {
    prisma: {
      user: { findUnique, update },
    },
  };
});

jest.mock("../payment/onboarding-fee-service", () => ({
  assertIssuerOnboardingFeePaid: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@cashsouk/types", () => {
  const actual = jest.requireActual("@cashsouk/types") as Record<string, unknown>;
  return {
    ...actual,
    resolvePartyLookupKey: jest.fn().mockReturnValue("pk"),
  };
});

describe("permission model cleanup: operational actions vs platform access mgmt", () => {
  let service: OrganizationService;

  beforeEach(() => {
    service = new OrganizationService();
    jest.clearAllMocks();
  });

  const memberOrg = {
    owner_user_id: "owner-1",
    members: [
      { user_id: "member-1", role: OrganizationMemberRole.ORGANIZATION_MEMBER },
    ],
    name: "Org A",
    display_reference: "ORG-A",
    phone_number: null,
    address: null,
    first_name: null,
    last_name: null,
    middle_name: null,
    bank_account_details: null,
    corporate_onboarding_data: {},
    onboarding_status: OnboardingStatus.NOT_STARTED,
    type: OrganizationType.COMPANY,
  } as any;

  it("updateOrganizationProfile allows ORGANIZATION_MEMBER (issuer)", async () => {
    jest.spyOn(service as any, "getOrganization").mockResolvedValue(memberOrg);
    const result = await service.updateOrganizationProfile(
      "member-1",
      "org-a",
      "issuer",
      { phoneNumber: "123" } as any
    );
    expect(result).toEqual({ success: true });
  });

  it("updateOrganizationProfile blocks non-member (issuer)", async () => {
    jest
      .spyOn(service as any, "getOrganization")
      .mockRejectedValue(new AppError(403, "FORBIDDEN", "You do not have access to this organization"));

    await expect(
      service.updateOrganizationProfile(
        "non-member-1",
        "org-a",
        "issuer",
        { phoneNumber: "123" } as any
      )
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  it("updateCorporateInfo allows ORGANIZATION_MEMBER (investor)", async () => {
    jest.spyOn(service as any, "getOrganization").mockResolvedValue(memberOrg);
    (service as any).repository.updateCorporateInfo = jest.fn().mockResolvedValue(undefined);

    const result = await service.updateCorporateInfo(
      "member-1",
      "org-a",
      "investor",
      { corporateName: "New name" } as any
    );
    expect(result).toEqual({ success: true });
  });

  it("completeOnboarding allows ORGANIZATION_MEMBER (investor)", async () => {
    jest.spyOn(service as any, "getOrganization").mockResolvedValue({
      ...memberOrg,
      onboarding_status: OnboardingStatus.NOT_STARTED,
    });
    (service as any).repository.updateInvestorOrganizationOnboarding = jest.fn().mockResolvedValue({
      id: "org-a",
      onboarding_status: OnboardingStatus.COMPLETED,
    });
    const result = await service.completeOnboarding(
      {} as any,
      "member-1",
      "org-a",
      "investor"
    );
    expect(result).toBeTruthy();
  });

  it("sendDirectorCtosPartyOnboarding allows ORGANIZATION_MEMBER (member reaches downstream eligibility step)", async () => {
    jest.spyOn(service as any, "getOrganization").mockResolvedValue({
      ...memberOrg,
      onboarding_status: OnboardingStatus.COMPLETED,
    });

    jest.spyOn(service as any, "getCorporateEntities").mockRejectedValue(sentinelError);

    await expect(
      service.sendDirectorCtosPartyOnboarding(
        "member-1",
        "org-a",
        "issuer",
        { partyKey: "party-key" } as any
      )
    ).rejects.toBe(sentinelError);
  });

  it("platform access mgmt stays restricted elsewhere: non-member still blocked by org access", async () => {
    jest
      .spyOn(service as any, "getOrganization")
      .mockRejectedValue(new AppError(403, "FORBIDDEN", "You do not have access to this organization"));

    await expect(
      service.sendDirectorCtosPartyOnboarding(
        "non-member-1",
        "org-a",
        "issuer",
        { partyKey: "party-key" } as any
      )
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });
});

