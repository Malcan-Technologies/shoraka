const mockContractFindMany = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    contract: {
      findMany: (...args: unknown[]) => mockContractFindMany(...args),
    },
  },
}));

import { realFacilityContractWhere } from "../../lib/standalone-holder-contract";
import { ContractRepository } from "./repository";

describe("ContractRepository.findApprovedByOrganization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContractFindMany.mockResolvedValue([]);
  });

  it("defensively excludes standalone holder contracts", async () => {
    await new ContractRepository().findApprovedByOrganization("org-1");

    expect(mockContractFindMany).toHaveBeenCalledWith({
      where: {
        issuer_organization_id: "org-1",
        status: "APPROVED",
        AND: [realFacilityContractWhere()],
      },
      orderBy: { created_at: "desc" },
    });
  });
});
