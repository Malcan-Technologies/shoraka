import { AppError } from "./http/error-handler";
import { FACILITY_CAPACITY_EXCEEDED } from "./contract-capacity-errors";
import { applyContractCapacityChange, applyContractCapacityChanges } from "./refresh-contract-facility";

function approvedContract(overrides: Record<string, unknown> = {}) {
  return {
    id: "contract-1",
    status: "APPROVED",
    originating_application_id: "app-1",
    approved_facility: 50_000,
    utilized_facility: 0,
    pending_facility: 0,
    repaid_facility: 0,
    available_facility: 50_000,
    lifetime_cap: 1_000_000,
    lifetime_used: 0,
    lifetime_remaining: 1_000_000,
    contract_details: {
      approved_facility: 50_000,
      financing: 40_000,
      value: 1_000_000,
    },
    ...overrides,
  };
}

function createTx(options?: { invoicesAfter?: unknown[] }) {
  const calls: string[] = [];
  let phase: "before" | "after" = "before";
  const invoicesAfter = options?.invoicesAfter ?? [];

  const tx = {
    $queryRaw: jest.fn(async () => {
      calls.push("lock");
      return [{ id: "contract-1" }];
    }),
    contract: {
      findUnique: jest.fn(async () => {
        calls.push("read-contract");
        return approvedContract();
      }),
      update: jest.fn(async () => {
        calls.push("persist");
        return approvedContract();
      }),
    },
    invoice: {
      findMany: jest.fn(async () => {
        calls.push("read-siblings");
        return phase === "before" ? [] : invoicesAfter;
      }),
      update: jest.fn(async () => {
        calls.push("mutate");
        phase = "after";
        return { id: "inv-1" };
      }),
      delete: jest.fn(async () => {
        calls.push("mutate");
        phase = "after";
      }),
    },
    note: {
      findMany: jest.fn(async () => []),
    },
    applicationLog: {
      create: jest.fn(),
    },
    noteEvent: {
      create: jest.fn(),
    },
  };

  return { tx, calls, setAfter: () => { phase = "after"; } };
}

describe("applyContractCapacityChange", () => {
  it("locks the contract before sibling writes and persists after mutate", async () => {
    const { tx, calls } = createTx();
    const { result } = await applyContractCapacityChange(
      "contract-1",
      tx as never,
      async (inner) => inner.invoice.update({ where: { id: "inv-1" }, data: {} })
    );

    expect(result).toEqual({ id: "inv-1" });
    expect(calls.indexOf("lock")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("lock")).toBeLessThan(calls.indexOf("mutate"));
    expect(calls.indexOf("mutate")).toBeLessThan(calls.indexOf("persist"));
    expect((tx as { $transaction?: unknown }).$transaction).toBeUndefined();
  });

  it("blocks a sibling overbook against live occupancy, not stored available", async () => {
    const { tx } = createTx({
      invoicesAfter: [
        {
          id: "inv-1",
          status: "SUBMITTED",
          details: { value: 200_000, applied_financing: 80_000 },
          offer_details: null,
        },
      ],
    });

    await expect(
      applyContractCapacityChange("contract-1", tx as never, async (inner) => {
        await inner.invoice.update({ where: { id: "inv-1" }, data: { status: "SUBMITTED" } });
      })
    ).rejects.toMatchObject({
      code: FACILITY_CAPACITY_EXCEEDED,
      statusCode: 422,
    } satisfies Partial<AppError>);
    expect(tx.contract.update).not.toHaveBeenCalled();
  });

  it("does not start a nested interactive transaction when already given a tx", async () => {
    const { tx } = createTx();
    const interactive = {
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    await applyContractCapacityChange("contract-1", tx as never, async () => "ok");
    expect(interactive.$transaction).not.toHaveBeenCalled();

    await applyContractCapacityChange("contract-1", interactive as never, async () => "ok");
    expect(interactive.$transaction).toHaveBeenCalledTimes(1);
  });

  it("allows a grandfathered over-limit snapshot to decrease", async () => {
    const { tx, setAfter } = createTx();
    tx.invoice.findMany.mockImplementation(async () => {
      return [
        {
          id: "inv-legacy",
          status: "APPROVED",
          details: { value: 300_000 },
          offer_details: { offered_amount: 80_000 },
        },
      ];
    });
    tx.invoice.update.mockImplementation(async () => {
      setAfter();
      tx.invoice.findMany.mockResolvedValue([]);
      return { id: "inv-legacy" };
    });
    tx.contract.findUnique.mockResolvedValue(
      approvedContract({
        utilized_facility: 80_000,
        available_facility: -30_000,
        contract_details: {
          approved_facility: 50_000,
          utilized_facility: 80_000,
          available_facility: -30_000,
          value: 1_000_000,
        },
      })
    );

    await expect(
      applyContractCapacityChange("contract-1", tx as never, async (inner) =>
        inner.invoice.update({
          where: { id: "inv-legacy" },
          data: { status: "WITHDRAWN" },
        })
      )
    ).resolves.toMatchObject({ result: { id: "inv-legacy" } });
  });
});

describe("applyContractCapacityChanges", () => {
  it("runs a single-id write through applyContractCapacityChange", async () => {
    const { tx, calls } = createTx();
    const { result, snapshots } = await applyContractCapacityChanges(
      ["contract-1"],
      tx as never,
      async (inner) => inner.invoice.update({ where: { id: "inv-1" }, data: {} })
    );
    expect(result).toEqual({ id: "inv-1" });
    expect(snapshots).toHaveLength(1);
    expect(calls[0]).toBe("lock");
  });

  it("runs mutate without locking when no contract ids are provided", async () => {
    const mutate = jest.fn(async () => "done");
    const { result, snapshots } = await applyContractCapacityChanges([], {
      invoice: { update: jest.fn() },
    } as never, mutate);
    expect(result).toBe("done");
    expect(snapshots).toEqual([]);
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
