const tx = {
  application: {
    findUnique: jest.fn().mockResolvedValue({
      id: "app-1",
      contract: { id: "contract-1", status: "SUBMITTED", offer_details: null },
      invoices: [{ id: "inv-1", status: "SUBMITTED", offer_details: null }],
      signing_envelopes: [],
    }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  contract: { update: jest.fn() },
  invoice: { update: jest.fn() },
};
const mockApply = jest.fn(async (_id: string, _db: unknown, mutate: (client: typeof tx) => Promise<unknown>) => ({
  result: await mutate(tx),
  snapshot: null,
}));
const mockTransaction = jest.fn(async (mutate: (client: typeof tx) => Promise<unknown>) => mutate(tx));

jest.mock("../../lib/refresh-contract-facility", () => ({
  applyContractCapacityChange: (...args: unknown[]) => mockApply(...args),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    application: {
      findUnique: jest.fn().mockResolvedValue({
        contract_id: "contract-1",
        financing_structure: { structure_type: "existing_contract" },
      }),
    },
    $transaction: mockTransaction,
  },
}));

import { closeApplicationAsRejected } from "./lifecycle-close";
import { prisma } from "../../lib/prisma";

describe("closeApplicationAsRejected capacity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.application.findUnique as jest.Mock).mockResolvedValue({
      contract_id: "contract-1",
      financing_structure: { structure_type: "existing_contract" },
    });
  });

  it("rejects children and refreshes occupancy under the contract lock", async () => {
    await closeApplicationAsRejected("app-1");
    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      prisma,
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invoice-only children without refreshing holder capacity", async () => {
    (prisma.application.findUnique as jest.Mock).mockResolvedValue({
      contract_id: "holder-1",
      financing_structure: { structure_type: "invoice_only" },
    });
    tx.application.findUnique.mockResolvedValueOnce({
      id: "app-1",
      contract: { id: "holder-1", status: "SUBMITTED", offer_details: null },
      invoices: [{ id: "inv-1", status: "SUBMITTED", offer_details: null }],
      signing_envelopes: [],
    });

    await closeApplicationAsRejected("app-1");

    expect(mockApply).not.toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalled();
    expect(tx.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "holder-1" } })
    );
  });
});
