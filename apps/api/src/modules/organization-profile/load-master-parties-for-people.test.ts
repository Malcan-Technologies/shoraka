import { buildDirectorShareholderPeopleListWithMaster } from "./load-master-parties-for-people";

const mockPartyFindMany = jest.fn();
const mockIssuerFindUnique = jest.fn();
const mockInvestorFindUnique = jest.fn();

jest.mock("./service", () => ({ seedMasterPartiesIfEmpty: jest.fn(async () => undefined) }));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    organizationPartyProfile: { findMany: (...args: unknown[]) => mockPartyFindMany(...args) },
    issuerOrganization: { findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args) },
    investorOrganization: { findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args) },
    regTankOnboarding: { findFirst: jest.fn(async () => null) },
  },
}));

const ONBOARDED_SSM = "8217649D";
const LATER_SSM = "202001234567";

function companyParty(ssm: string, origin: string) {
  return {
    party_key: ssm,
    membership_status: "MASTER_ACTIVE",
    entity_type: "CORPORATE",
    name: `Company ${ssm}`,
    identity_number: ssm,
    is_director: false,
    is_shareholder: true,
    shareholding_percentage: 30,
    email: null,
    field_sources: {},
    origin,
  };
}

const corporateEntities = {
  directors: [],
  shareholders: [],
  corporateShareholders: [
    {
      requestId: "COD1",
      status: "IN_PROGRESS",
      formContent: {
        displayAreas: [
          {
            displayArea: "Basic Information Setting",
            content: [{ fieldName: "Business Number", fieldValue: ONBOARDED_SSM }],
          },
        ],
      },
    },
  ],
};

describe.each(["issuer", "investor"] as const)("%s organisation company classification", (portal) => {
  beforeEach(() => {
    mockPartyFindMany.mockResolvedValue([
      companyParty(ONBOARDED_SSM, "CTOS_PARTY"),
      companyParty(LATER_SSM, "USER_ADDED"),
    ]);
    const org = { onboarding_status: "COMPLETED" };
    mockIssuerFindUnique.mockResolvedValue(org);
    mockInvestorFindUnique.mockResolvedValue(org);
  });

  it("requires KYB/AML for the onboarding company and not for the later company", async () => {
    const { people } = await buildDirectorShareholderPeopleListWithMaster(portal, "org-1", {
      ctos: null,
      issuerDirectorKycStatus: null,
      issuerDirectorAmlStatus: null,
      corporateEntities,
    });
    expect(people.find((p) => p.matchKey === ONBOARDED_SSM)?.inInitialOnboarding).toBe(true);
    expect(people.find((p) => p.matchKey === LATER_SSM)?.inInitialOnboarding).toBe(false);
  });

  it("keeps membership unknown when the onboarding snapshot is missing", async () => {
    const { people } = await buildDirectorShareholderPeopleListWithMaster(portal, "org-1", {
      ctos: null,
      issuerDirectorKycStatus: null,
      issuerDirectorAmlStatus: null,
      corporateEntities: null,
    });
    const later = people.find((p) => p.matchKey === LATER_SSM);
    expect(later).toBeDefined();
    expect("inInitialOnboarding" in (later as object)).toBe(false);
  });
});
