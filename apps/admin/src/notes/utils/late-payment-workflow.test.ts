import type { NoteDetail } from "@cashsouk/types";
import { NoteServicingStatus, NoteStatus } from "@cashsouk/types";
import {
  resolveLatePaymentActionGates,
  resolveLatePaymentTimeline,
} from "./late-payment-workflow";

function note(partial: Partial<NoteDetail> & Pick<NoteDetail, "servicingStatus">): NoteDetail {
  return {
    fundingStatus: "FUNDED",
    status: "ACTIVE",
    gracePeriodDays: 5,
    arrearsThresholdDays: 30,
    paymentSchedules: [{ sequence: 1, dueDate: "2026-01-01" }],
    daysPastDue: 0,
    ...partial,
  } as NoteDetail;
}

describe("resolveLatePaymentTimeline", () => {
  it("maps OVERDUE to in-grace and LATE is not arrears", () => {
    const overdue = resolveLatePaymentTimeline(
      note({ servicingStatus: NoteServicingStatus.OVERDUE, daysPastDue: 3 })
    );
    expect(overdue.phase).toBe("in-grace");
    expect(overdue.workflowLabel).toBe("Overdue");

    const late = resolveLatePaymentTimeline(
      note({ servicingStatus: NoteServicingStatus.LATE, daysPastDue: 12 })
    );
    expect(late.phase).toBe("late");
    expect(late.workflowLabel).toBe("Late");
    expect(late.phase).not.toBe("arrears");
    expect(late.phase).not.toBe("default-eligible");
  });

  it("maps ARREARS to default-eligible", () => {
    const timeline = resolveLatePaymentTimeline(
      note({ servicingStatus: NoteServicingStatus.ARREARS, daysPastDue: 40 })
    );
    expect(timeline.phase).toBe("default-eligible");
    expect(timeline.workflowLabel).toBe("Default eligible");
  });

  it("maps DEFAULTED from servicing status", () => {
    const timeline = resolveLatePaymentTimeline(
      note({ servicingStatus: NoteServicingStatus.DEFAULTED, status: NoteStatus.DEFAULTED })
    );
    expect(timeline.phase).toBe("defaulted");
  });

  it("keeps persisted days past due after default", () => {
    const timeline = resolveLatePaymentTimeline(
      note({
        servicingStatus: NoteServicingStatus.DEFAULTED,
        status: NoteStatus.DEFAULTED,
        daysPastDue: 41,
      })
    );
    expect(timeline.daysPastMaturity).toBe(41);
  });

  it("counts fallback overdue days on the Malaysia calendar", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-10T16:00:00.000Z"));
    try {
      const timeline = resolveLatePaymentTimeline(
        note({
          servicingStatus: NoteServicingStatus.CURRENT,
          daysPastDue: 0,
          gracePeriodDays: 5,
        })
      );
      expect(timeline.daysPastMaturity).toBe(10);
      expect(timeline.phase).toBe("late");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("resolveLatePaymentActionGates", () => {
  it("allows mark default only when ARREARS", () => {
    const lateGates = resolveLatePaymentActionGates({
      timeline: resolveLatePaymentTimeline(
        note({ servicingStatus: NoteServicingStatus.LATE, daysPastDue: 10 })
      ),
      servicingOpen: true,
      canDefaultPermission: true,
      servicingStatusArrears: false,
      defaultReason: "Issuer missed the arrears threshold",
    });
    expect(lateGates.canMarkDefault).toBe(false);

    const arrearsGates = resolveLatePaymentActionGates({
      timeline: resolveLatePaymentTimeline(
        note({ servicingStatus: NoteServicingStatus.ARREARS, daysPastDue: 40 })
      ),
      servicingOpen: true,
      canDefaultPermission: true,
      servicingStatusArrears: true,
      defaultReason: "Issuer missed the arrears threshold",
    });
    expect(arrearsGates.canMarkDefault).toBe(true);
  });

  it("allows generating a default letter after the note is already defaulted", () => {
    const gates = resolveLatePaymentActionGates({
      timeline: resolveLatePaymentTimeline(
        note({ servicingStatus: NoteServicingStatus.DEFAULTED, status: NoteStatus.DEFAULTED })
      ),
      servicingOpen: true,
      canDefaultPermission: true,
      servicingStatusArrears: false,
      defaultReason: "",
    });
    expect(gates.canGenerateDefaultLetter).toBe(true);
    expect(gates.canMarkDefault).toBe(false);
  });
});
