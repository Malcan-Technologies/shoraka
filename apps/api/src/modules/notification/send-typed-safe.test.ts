import { NotificationTypeIds } from "./registry";
import { sendTypedSafe, sendTypedToUsersSafe } from "./send-typed-safe";

describe("sendTypedSafe", () => {
  it("returns the created notification", async () => {
    const sendTyped = jest.fn().mockResolvedValue({ id: "n1" });
    await expect(
      sendTypedSafe(
        { sendTyped },
        "user-1",
        NotificationTypeIds.NOTE_PUBLISHED,
        { noteId: "n1", noteTitle: "Note One" },
        "key-1"
      )
    ).resolves.toEqual({ id: "n1" });
    expect(sendTyped).toHaveBeenCalledWith(
      "user-1",
      NotificationTypeIds.NOTE_PUBLISHED,
      { noteId: "n1", noteTitle: "Note One" },
      "key-1"
    );
  });

  it("returns null when a recipient send throws", async () => {
    const sendTyped = jest.fn().mockRejectedValue(new Error("user missing"));
    await expect(
      sendTypedSafe({ sendTyped }, "user-1", NotificationTypeIds.NOTE_PUBLISHED, {
        noteId: "n1",
        noteTitle: "Note One",
      })
    ).resolves.toBeNull();
  });

  it("keeps batch results aligned with recipient order after a failure", async () => {
    const sendTyped = jest
      .fn()
      .mockRejectedValueOnce(new Error("user missing"))
      .mockResolvedValueOnce({ id: "n2" });

    await expect(
      sendTypedToUsersSafe(
        { sendTyped },
        ["u1", "u2"],
        NotificationTypeIds.NOTE_PUBLISHED,
        { noteId: "n1", noteTitle: "Note One" },
        (userId) => `key:${userId}`
      )
    ).resolves.toEqual([null, { id: "n2" }]);
  });
});
