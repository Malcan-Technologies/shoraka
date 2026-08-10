import { WithdrawalType } from "@prisma/client";
import { NoteService } from "./service";

describe("NoteService withdrawal display reference allocation", () => {
  const service = new NoteService() as any;

  it("allocates product-scoped WDL reference for note-linked withdrawals", async () => {
    const tx: any = {
      withdrawalInstruction: {
        create: jest.fn().mockResolvedValue({
          id: "wdl_1",
          note_id: "note_1",
          created_at: new Date("2026-08-10T01:00:00.000Z"),
        }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "wdl_1",
          note_id: "note_1",
          display_reference: "WDL-ARF-202608-A1Z",
        }),
      },
      note: {
        findUnique: jest.fn().mockResolvedValue({
          id: "note_1",
          product_snapshot: { product_code: "ARF" },
          source_application_id: null,
        }),
      },
      displayReferenceAllocation: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      application: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const created = await service.createWithdrawalInstructionWithDisplayReference(tx, {
      note_id: "note_1",
      requested_by_user_id: "user_1",
      withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
      amount: 1000,
      beneficiary_snapshot: {},
    });

    expect(tx.displayReferenceAllocation.create).toHaveBeenCalledTimes(1);
    expect(tx.displayReferenceAllocation.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        module_code: "WDL",
        product_code: "ARF",
        entity_type: "withdrawal_instruction",
        entity_id: "wdl_1",
      })
    );
    expect(tx.withdrawalInstruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wdl_1" },
        data: { display_reference: expect.stringMatching(/^WDL-ARF-202608-[A-Z0-9]{3}$/) },
      })
    );
    expect(created.display_reference).toBe("WDL-ARF-202608-A1Z");
  });

  it("allocates account-scoped WDL reference for withdrawals without a note", async () => {
    const tx: any = {
      withdrawalInstruction: {
        create: jest.fn().mockResolvedValue({
          id: "wdl_account",
          note_id: null,
          created_at: new Date("2026-08-10T01:00:00.000Z"),
        }),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "wdl_account",
          note_id: null,
          display_reference: "WDL-202608-X7A",
        }),
      },
      displayReferenceAllocation: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const created = await service.createWithdrawalInstructionWithDisplayReference(tx, {
      requested_by_user_id: "user_1",
      withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
      amount: 250,
      beneficiary_snapshot: {},
    });

    expect(created.id).toBe("wdl_account");
    expect(tx.displayReferenceAllocation.create).toHaveBeenCalledTimes(1);
    expect(tx.displayReferenceAllocation.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        module_code: "WDL",
        product_code: null,
        entity_type: "withdrawal_instruction",
        entity_id: "wdl_account",
      })
    );
    expect(tx.withdrawalInstruction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wdl_account" },
        data: { display_reference: expect.stringMatching(/^WDL-202608-[A-Z0-9]{3}$/) },
      })
    );
    expect(created.display_reference).toBe("WDL-202608-X7A");
  });

  it("returns existing allocation on retry without creating a duplicate", async () => {
    const tx: any = {
      withdrawalInstruction: {
        create: jest.fn().mockResolvedValue({
          id: "wdl_account",
          note_id: null,
          created_at: new Date("2026-08-10T01:00:00.000Z"),
        }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "wdl_account",
          note_id: null,
          display_reference: "WDL-202608-X7A",
        }),
      },
      displayReferenceAllocation: {
        create: jest.fn().mockRejectedValue({
          code: "P2002",
          meta: { target: ["entity_type", "entity_id"] },
        }),
        findUnique: jest.fn().mockResolvedValue({
          display_reference: "WDL-202608-X7A",
          module_code: "WDL",
          product_code: null,
          entity_type: "withdrawal_instruction",
          entity_id: "wdl_account",
        }),
      },
    };

    const created = await service.createWithdrawalInstructionWithDisplayReference(tx, {
      requested_by_user_id: "user_1",
      withdrawal_type: WithdrawalType.INVESTOR_WITHDRAWAL,
      amount: 250,
      beneficiary_snapshot: {},
    });

    expect(created.display_reference).toBe("WDL-202608-X7A");
    expect(tx.withdrawalInstruction.update).not.toHaveBeenCalled();
  });
});
