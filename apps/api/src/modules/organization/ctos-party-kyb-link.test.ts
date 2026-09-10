import {
  OrganizationPartyEntityType,
  OrganizationPartyMembershipStatus,
  OrganizationPartyOrigin,
} from "@prisma/client";

const mockAddKybDirector = jest.fn();
const mockAddKybIndividualShareholder = jest.fn();
const mockOnboardingFindMany = jest.fn();
const mockPartyFindFirst = jest.fn();
const mockSupplementFindFirst = jest.fn();
const mockSupplementUpdate = jest.fn();
const mockCtosReportFindFirst = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    regTankOnboarding: {
      findMany: (...args: unknown[]) => mockOnboardingFindMany(...args),
    },
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
    },
    ctosPartySupplement: {
      findFirst: (...args: unknown[]) => mockSupplementFindFirst(...args),
      update: (...args: unknown[]) => mockSupplementUpdate(...args),
    },
    ctosReport: {
      findFirst: (...args: unknown[]) => mockCtosReportFindFirst(...args),
    },
  },
}));

jest.mock("../regtank/api-client", () => ({
  getRegTankAPIClient: () => ({
    addKybDirector: (...args: unknown[]) => mockAddKybDirector(...args),
    addKybIndividualShareholder: (...args: unknown[]) => mockAddKybIndividualShareholder(...args),
  }),
}));

import { linkCtosPartyToKyb } from "./ctos-party-kyb-link";

const PARTY_KEY = "user:550e8400-e29b-41d4-a716-446655440000";
const CTOS_KEY = "900101101234";
const KYC_ID = "KYC00001";
const KYB_ID = "KYB00001";
const SUPPLEMENT_ID = "sup-1";

function approvedJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requestId: "LD71656-R30",
    status: "APPROVED",
    screening: {
      requestId: KYC_ID,
      status: "PENDING",
    },
    ...overrides,
  };
}

function userAddedParty(overrides: Record<string, unknown> = {}) {
  return {
    origin: OrganizationPartyOrigin.USER_ADDED,
    entity_type: OrganizationPartyEntityType.INDIVIDUAL,
    membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
    is_director: true,
    is_shareholder: false,
    shareholding_percentage: null,
    ...overrides,
  };
}

function stubPersistAndKyb(portalType: "issuer" | "investor") {
  mockOnboardingFindMany.mockResolvedValue([
    { webhook_payloads: [{ kybRequestDto: { kybId: KYB_ID } }], regtank_response: null },
  ]);
  mockSupplementFindFirst.mockResolvedValue({ id: SUPPLEMENT_ID });
  mockSupplementUpdate.mockResolvedValue({});
  mockCtosReportFindFirst.mockResolvedValue(null);
  return portalType;
}

describe("linkCtosPartyToKyb USER_ADDED", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddKybDirector.mockResolvedValue({ requestId: KYB_ID });
    mockAddKybIndividualShareholder.mockResolvedValue({ requestId: KYB_ID });
  });

  it("issuer Director not in CTOS → APPROVED + KYC ID → addKybDirector", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockCtosReportFindFirst).not.toHaveBeenCalled();
    expect(mockAddKybDirector).toHaveBeenCalledTimes(1);
    expect(mockAddKybDirector).toHaveBeenCalledWith({
      requestId: KYB_ID,
      kycId: KYC_ID,
      designation: "DIRECTOR",
      remark: "Company party auto-link",
    });
    expect(mockAddKybIndividualShareholder).not.toHaveBeenCalled();
    expect(mockSupplementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SUPPLEMENT_ID },
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({ kybDirectorLinked: true }),
        }),
      })
    );
  });

  it("investor Director not in CTOS → APPROVED + KYC ID → addKybDirector", async () => {
    stubPersistAndKyb("investor");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());

    await linkCtosPartyToKyb({
      organizationId: "org-inv",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "investor",
    });

    expect(mockOnboardingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          investor_organization_id: "org-inv",
          onboarding_type: "CORPORATE",
        }),
      })
    );
    expect(mockAddKybDirector).toHaveBeenCalledTimes(1);
    expect(mockAddKybDirector).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: KYB_ID, kycId: KYC_ID, designation: "DIRECTOR" })
    );
  });

  it("issuer shareholder exactly 5% → addKybIndividualShareholder", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(
      userAddedParty({ is_director: false, is_shareholder: true, shareholding_percentage: 5 })
    );

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
    expect(mockAddKybIndividualShareholder).toHaveBeenCalledTimes(1);
    expect(mockAddKybIndividualShareholder).toHaveBeenCalledWith({
      requestId: KYB_ID,
      kycId: KYC_ID,
      percentOfShare: 5,
      remark: "Company party auto-link",
    });
  });

  it("investor shareholder exactly 5% → addKybIndividualShareholder", async () => {
    stubPersistAndKyb("investor");
    mockPartyFindFirst.mockResolvedValue(
      userAddedParty({ is_director: false, is_shareholder: true, shareholding_percentage: "5.0" })
    );

    await linkCtosPartyToKyb({
      organizationId: "org-inv",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "investor",
    });

    expect(mockAddKybIndividualShareholder).toHaveBeenCalledTimes(1);
    expect(mockAddKybIndividualShareholder).toHaveBeenCalledWith(
      expect.objectContaining({ kycId: KYC_ID, percentOfShare: 5 })
    );
  });

  it("shareholder 4.99% → shareholder association not called", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(
      userAddedParty({ is_director: false, is_shareholder: true, shareholding_percentage: 4.99 })
    );

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
    expect(mockAddKybIndividualShareholder).not.toHaveBeenCalled();
  });

  it("Director + shareholder >=5% → both association calls run", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(
      userAddedParty({ is_director: true, is_shareholder: true, shareholding_percentage: 10 })
    );

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).toHaveBeenCalledTimes(1);
    expect(mockAddKybIndividualShareholder).toHaveBeenCalledTimes(1);
    expect(mockSupplementUpdate).toHaveBeenCalledTimes(2);
  });

  it("Board-only → no association", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(
      userAddedParty({ is_director: false, is_shareholder: false })
    );

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
    expect(mockAddKybIndividualShareholder).not.toHaveBeenCalled();
  });

  it("Management-only → no association", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(
      userAddedParty({ is_director: false, is_shareholder: false })
    );

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
    expect(mockAddKybIndividualShareholder).not.toHaveBeenCalled();
  });

  it("LIVENESS_PASSED → no association", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson({ status: "LIVENESS_PASSED" }),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
    expect(mockOnboardingFindMany).not.toHaveBeenCalled();
  });

  it("WAIT_FOR_APPROVAL → no association", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson({ status: "WAIT_FOR_APPROVAL" }),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
  });

  it("APPROVED but no KYC ID → no association", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: {
        requestId: "LD71656-R30",
        status: "APPROVED",
        screening: null,
      },
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
  });

  it("KYC ID exists but pipeline not APPROVED → no immediate association", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson({ status: "WAIT_FOR_APPROVAL" }),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
  });

  it("retry can associate after APPROVED", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());
    const pending = approvedJson({ status: "WAIT_FOR_APPROVAL" });

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: pending,
      portalType: "issuer",
    });
    expect(mockAddKybDirector).not.toHaveBeenCalled();

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: { ...pending, status: "APPROVED" },
      portalType: "issuer",
    });
    expect(mockAddKybDirector).toHaveBeenCalledTimes(1);
  });

  it("association HTTP failure leaves KYC/AML state unchanged and flag unset", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());
    mockAddKybDirector.mockRejectedValue(new Error("RegTank 500"));

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).toHaveBeenCalledTimes(1);
    expect(mockSupplementUpdate).not.toHaveBeenCalled();
  });

  it("successful association sets flag; retry does not duplicate the same relationship", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());
    const json = approvedJson({ kybDirectorLinked: true });

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: json,
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
  });

  it("does not treat liveness requestId as the KYC ID", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(userAddedParty());

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: {
        requestId: "LD71656-R30",
        status: "APPROVED",
        screening: { requestId: KYC_ID, status: "IN_PROGRESS" },
      },
      portalType: "issuer",
    });

    expect(mockAddKybDirector).toHaveBeenCalledWith(expect.objectContaining({ kycId: KYC_ID }));
  });

  it("corporate USER_ADDED shareholder does not call individual association APIs", async () => {
    stubPersistAndKyb("issuer");
    mockPartyFindFirst.mockResolvedValue(
      userAddedParty({
        entity_type: OrganizationPartyEntityType.CORPORATE,
        is_director: false,
        is_shareholder: true,
        shareholding_percentage: 40,
      })
    );

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: PARTY_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
    expect(mockAddKybIndividualShareholder).not.toHaveBeenCalled();
  });
});

describe("linkCtosPartyToKyb CTOS-derived", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddKybDirector.mockResolvedValue({ requestId: KYB_ID });
    mockAddKybIndividualShareholder.mockResolvedValue({ requestId: KYB_ID });
    stubPersistAndKyb("issuer");
  });

  it("existing CTOS-derived director still associates from company_json", async () => {
    mockPartyFindFirst.mockResolvedValue({
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      entity_type: OrganizationPartyEntityType.INDIVIDUAL,
      membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      is_director: false,
      is_shareholder: false,
      shareholding_percentage: null,
    });
    mockCtosReportFindFirst.mockResolvedValue({
      company_json: {
        directors: [
          {
            party_type: "I",
            nic_brno: CTOS_KEY,
            position: "DO",
          },
        ],
      },
    });

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: CTOS_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockCtosReportFindFirst).toHaveBeenCalled();
    expect(mockAddKybDirector).toHaveBeenCalledWith(
      expect.objectContaining({
        kycId: KYC_ID,
        designation: "DIRECTOR",
        remark: "CTOS party auto-link",
      })
    );
  });

  it("CTOS-derived person missing from company_json is still skipped", async () => {
    mockPartyFindFirst.mockResolvedValue({
      origin: OrganizationPartyOrigin.CTOS_PARTY,
      entity_type: OrganizationPartyEntityType.INDIVIDUAL,
      membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      is_director: true,
      is_shareholder: false,
      shareholding_percentage: null,
    });
    mockCtosReportFindFirst.mockResolvedValue({ company_json: { directors: [] } });

    await linkCtosPartyToKyb({
      organizationId: "org-iss",
      partyKey: CTOS_KEY,
      onboardingJson: approvedJson(),
      portalType: "issuer",
    });

    expect(mockAddKybDirector).not.toHaveBeenCalled();
  });
});
