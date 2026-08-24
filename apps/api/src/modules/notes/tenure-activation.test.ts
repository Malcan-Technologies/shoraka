import { AppError } from "../../lib/http/error-handler";
import { Prisma } from "@prisma/client";
import {
  noteActivationUpdateData,
  resolveTenureActivationFields,
  syncPaymentScheduleDueDate,
} from "./tenure-activation";

describe("resolveTenureActivationFields", () => {
  const now = new Date("2026-08-24T08:00:00.000Z");

  it("keeps legacy activation as now and leaves maturity untouched", () => {
    expect(
      resolveTenureActivationFields({
        tenureDays: null,
        now,
      })
    ).toEqual({
      activatedAt: now,
      disbursementValueDate: null,
      maturityDate: null,
      updateMaturity: false,
    });
  });

  it("requires a Malaysia calendar date for tenure notes", () => {
    expect(() => resolveTenureActivationFields({ tenureDays: 90, now })).toThrow(AppError);
    try {
      resolveTenureActivationFields({ tenureDays: 90, now });
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 400,
        code: "DISBURSEMENT_VALUE_DATE_INVALID",
        message: "Actual disbursement date is required.",
      });
    }
  });

  it("sets value date, activated date, and maturity atomically for 20 Aug 2026 + 90 days", () => {
    const fields = resolveTenureActivationFields({
      tenureDays: 90,
      disbursementValueDate: "2026-08-20",
      now,
    });
    expect(fields.updateMaturity).toBe(true);
    expect(fields.disbursementValueDate?.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(fields.activatedAt.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(fields.maturityDate?.toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(noteActivationUpdateData(fields)).toEqual({
      activated_at: fields.activatedAt,
      disbursement_value_date: fields.disbursementValueDate,
      maturity_date: fields.maturityDate,
    });
  });

  it("rejects a future Malaysia calendar date", () => {
    expect(() =>
      resolveTenureActivationFields({
        tenureDays: 90,
        disbursementValueDate: "2026-08-25",
        now: new Date("2026-08-23T16:00:00.000Z"),
      })
    ).toThrow(/cannot be in the future/);
  });
});

describe("syncPaymentScheduleDueDate", () => {
  it("updates sequence 1 when it exists", async () => {
    const dueDate = new Date("2026-11-18T00:00:00.000Z");
    const tx = {
      notePaymentSchedule: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
      },
      note: { findUniqueOrThrow: jest.fn() },
    };

    await syncPaymentScheduleDueDate(tx as never, "note_1", dueDate);

    expect(tx.notePaymentSchedule.updateMany).toHaveBeenCalledWith({
      where: { note_id: "note_1", sequence: 1 },
      data: { due_date: dueDate },
    });
    expect(tx.notePaymentSchedule.create).not.toHaveBeenCalled();
  });

  it("creates sequence 1 when missing", async () => {
    const dueDate = new Date("2026-11-18T00:00:00.000Z");
    const target = new Prisma.Decimal(10000);
    const rate = new Prisma.Decimal(10);
    const tx = {
      notePaymentSchedule: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      note: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          target_amount: target,
          profit_rate_percent: rate,
        }),
      },
    };

    await syncPaymentScheduleDueDate(tx as never, "note_1", dueDate);

    expect(tx.notePaymentSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        note_id: "note_1",
        sequence: 1,
        due_date: dueDate,
        expected_principal: target,
      }),
    });
  });
});
