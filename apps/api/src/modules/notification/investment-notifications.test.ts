const sendTypedAndLogSystem = jest.fn().mockResolvedValue({ id: "n1" });

jest.mock("./service", () => ({
  NotificationService: jest.fn(),
}));

import { notifyInvestmentCommitted } from "./investment-notifications";
import { NotificationTypeIds } from "./registry";
import { NotificationService } from "./service";

describe("investment committed notifications", () => {
  const svc = { sendTypedAndLogSystem } as unknown as NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends exactly once to the committing investor with amount and note title", async () => {
    await notifyInvestmentCommitted({
      notificationService: svc,
      investmentId: "inv-1",
      recipientUserId: "user-1",
      amount: 2500,
      noteId: "note-1",
      noteTitle: "Invoice Note",
    });

    expect(sendTypedAndLogSystem).toHaveBeenCalledTimes(1);
    expect(sendTypedAndLogSystem).toHaveBeenCalledWith(
      "user-1",
      NotificationTypeIds.INVESTMENT_COMMITTED,
      { amount: 2500, noteId: "note-1", noteTitle: "Invoice Note" },
      "investment:inv-1:notif:investment_committed:user:user-1",
      { targetType: "INVESTORS" }
    );
  });

  it("uses a stable investment/user idempotency key so retries do not create a new send identity", async () => {
    const args = {
      notificationService: svc,
      investmentId: "inv-1",
      recipientUserId: "user-1",
      amount: 2500,
      noteId: "note-1",
      noteTitle: "Invoice Note",
    };
    await notifyInvestmentCommitted(args);
    await notifyInvestmentCommitted(args);

    const keys = sendTypedAndLogSystem.mock.calls.map((c) => c[3]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("does not pass channel overrides; Admin type config is respected by sendTyped", async () => {
    await notifyInvestmentCommitted({
      notificationService: svc,
      investmentId: "inv-1",
      recipientUserId: "user-1",
      amount: 2500,
      noteId: "note-1",
      noteTitle: "Invoice Note",
    });

    expect(sendTypedAndLogSystem.mock.calls[0]).toHaveLength(5);
    expect(sendTypedAndLogSystem.mock.calls[0][4]).toEqual({ targetType: "INVESTORS" });
  });

  it("skips send when there is no recipient user", async () => {
    await notifyInvestmentCommitted({
      notificationService: svc,
      investmentId: "inv-1",
      recipientUserId: null,
      amount: 2500,
      noteId: "note-1",
      noteTitle: "Invoice Note",
    });
    expect(sendTypedAndLogSystem).not.toHaveBeenCalled();
  });
});
