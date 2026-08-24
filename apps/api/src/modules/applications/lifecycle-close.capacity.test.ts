const mockApply = jest.fn(async (_id: string, _db: unknown, mutate: (tx: unknown) => Promise<unknown>) => {
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
  return { result: await mutate(tx), snapshot: null };
});

jest.mock("../../lib/refresh-contract-facility", () => ({
  applyContractCapacityChange: (...args: unknown[]) => mockApply(...args),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    application: { findUnique: jest.fn().mockResolvedValue({ contract_id: "contract-1" }) },
    $transaction: jest.fn(),
  },
}));

import { closeApplicationAsRejected } from "./lifecycle-close";
import { prisma } from "../../lib/prisma";

describe("closeApplicationAsRejected capacity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
