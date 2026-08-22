/**
 * Deterministic lock-order test. A real two-connection FOR UPDATE race needs a
 * live Postgres pool and seeded contract FKs; this repo's payment integration
 * harness does not create facility rows. Serialization is proven here by call
 * order: lock → mutate → persist, and by apply refusing to nest $transaction.
 */
import { applyContractCapacityChange } from "./refresh-contract-facility";

describe("contract capacity lock ordering", () => {
  it("never trusts stored available and always locks before sibling writes", async () => {
    const order: string[] = [];
    let invoices: Array<{
      id: string;
      status: string;
      details: Record<string, unknown>;
      offer_details: unknown;
    }> = [];

    const contract = {
      id: "contract-1",
      status: "APPROVED",
      originating_application_id: null,
      approved_facility: 100_000,
      utilized_facility: 0,
      pending_facility: 0,
      repaid_facility: 0,
      available_facility: 999_999,
      lifetime_cap: 1_000_000,
      lifetime_used: 0,
      lifetime_remaining: 1_000_000,
      contract_details: {
        approved_facility: 100_000,
        available_facility: 999_999,
        value: 1_000_000,
      },
    };

    const tx = {
      $queryRaw: jest.fn(async () => {
        order.push("lock");
        return [{ id: "contract-1" }];
      }),
      contract: {
        findUnique: jest.fn(async () => contract),
        update: jest.fn(async () => {
          order.push("persist");
        }),
      },
      invoice: {
        findMany: jest.fn(async () => invoices),
        update: jest.fn(async () => {
          order.push("sibling-write");
          invoices = [
            {
              id: "inv-1",
              status: "SUBMITTED",
              details: { value: 50_000, applied_financing: 20_000 },
              offer_details: null,
            },
          ];
        }),
      },
      note: { findMany: jest.fn(async () => []) },
      applicationLog: { create: jest.fn() },
      noteEvent: { create: jest.fn() },
    };

    await applyContractCapacityChange("contract-1", tx as never, async (inner) => {
      await inner.invoice.update({ where: { id: "inv-1" }, data: { status: "SUBMITTED" } });
    });

    expect(order).toEqual(["lock", "sibling-write", "persist"]);
    expect(tx.contract.update).toHaveBeenCalled();
    const persistData = tx.contract.update.mock.calls[0]?.[0]?.data;
    expect(Number(persistData.pending_facility)).toBe(20_000);
    expect(Number(persistData.available_facility)).toBe(80_000);
    expect((persistData.contract_details as Record<string, unknown>).capacity_snapshot_version).toBe(1);
  });
});
