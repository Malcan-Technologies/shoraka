const mockCreateApplicationLog = jest.fn();

jest.mock("./repository", () => ({
  createApplicationLog: (...args: unknown[]) => mockCreateApplicationLog(...args),
}));

jest.mock("./attach-display-references", () => ({
  attachApplicationLogDisplayReferences: jest.fn(async (params: unknown) => params),
}));

import { logApplicationActivity } from "./service";

describe("logApplicationActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rethrows when the caller passed a transaction client", async () => {
    mockCreateApplicationLog.mockRejectedValue(new Error("insert failed"));
    const tx = { applicationLog: { create: jest.fn() } } as never;
    await expect(
      logApplicationActivity(
        {
          userId: "user-1",
          applicationId: "app-1",
          eventType: "INVOICE_WITHDRAWN",
        },
        tx
      )
    ).rejects.toThrow("insert failed");
  });

  it("does not fail the caller when no transaction client is provided", async () => {
    mockCreateApplicationLog.mockRejectedValue(new Error("insert failed"));
    await expect(
      logApplicationActivity({
        userId: "user-1",
        applicationId: "app-1",
        eventType: "INVOICE_WITHDRAWN",
      })
    ).resolves.toBeUndefined();
  });
});
