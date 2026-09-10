const mockQueryOnboardingDetails = jest.fn();
const mockPartyFindFirst = jest.fn();
const mockPartyFindMany = jest.fn();
const mockPartyUpdate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
      findMany: (...args: unknown[]) => mockPartyFindMany(...args),
      update: (...args: unknown[]) => mockPartyUpdate(...args),
    },
  },
}));

jest.mock("../regtank/api-client", () => ({
  getRegTankAPIClient: () => ({
    queryOnboardingDetails: (...args: unknown[]) => mockQueryOnboardingDetails(...args),
  }),
}));

import { enrichPartyFromApprovedOnboardingQuery } from "./regtank-party-seed";

const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";

describe("enrichPartyFromApprovedOnboardingQuery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPartyFindMany.mockResolvedValue([]);
    mockPartyUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);
  });

  it("seeds identity_number from query userProfile and does not rekey user:{uuid}", async () => {
    mockQueryOnboardingDetails.mockResolvedValue({
      userProfile: { documentNum: "900101-10-1234", documentType: "IDENTITY", gender: "MALE" },
    });
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: generatedKey,
      name: "Pre Id",
      email: "preid@example.com",
      identity_number: null,
      identity_prefix: null,
      gender: null,
      date_of_birth: null,
      nationality: null,
      field_sources: {},
      entity_type: "INDIVIDUAL",
      external_observation: null,
    });

    await enrichPartyFromApprovedOnboardingQuery({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: generatedKey,
      requestId: "LD-1",
    });

    expect(mockQueryOnboardingDetails).toHaveBeenCalledWith("LD-1");
    expect(mockPartyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "party-1" },
        data: expect.objectContaining({
          identity_number: "900101101234",
          gender: "MALE",
        }),
      })
    );
    const data = mockPartyUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.party_key).toBeUndefined();
    expect(data.email).toBeUndefined();
  });

  it("does not update OPP when queryOnboardingDetails fails", async () => {
    mockQueryOnboardingDetails.mockRejectedValue(new Error("timeout"));
    await enrichPartyFromApprovedOnboardingQuery({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: generatedKey,
      requestId: "LD-1",
    });
    expect(mockPartyFindFirst).not.toHaveBeenCalled();
    expect(mockPartyUpdate).not.toHaveBeenCalled();
  });

  it("is idempotent when identity is already seeded", async () => {
    mockQueryOnboardingDetails.mockResolvedValue({
      userProfile: { documentNum: "900101-10-1234", gender: "MALE" },
    });
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: generatedKey,
      name: "Pre Id",
      email: "preid@example.com",
      identity_number: "900101101234",
      identity_prefix: null,
      gender: "MALE",
      date_of_birth: null,
      nationality: null,
      field_sources: {
        identityNumber: { source: "REGTANK", updatedAt: "2026-09-10T00:00:00.000Z" },
        gender: { source: "REGTANK", updatedAt: "2026-09-10T00:00:00.000Z" },
      },
      entity_type: "INDIVIDUAL",
      external_observation: null,
    });

    await enrichPartyFromApprovedOnboardingQuery({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: generatedKey,
      requestId: "LD-1",
    });
    expect(mockPartyUpdate).not.toHaveBeenCalled();
  });
});
