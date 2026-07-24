const mockExecuteRaw = jest.fn().mockResolvedValue(1);

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
  },
}));

import { RegTankRepository } from "./repository";

describe("RegTankRepository.appendWebhookPayload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("issues a single atomic array_append UPDATE instead of read-then-write", async () => {
    const repository = new RegTankRepository();
    const payload = { requestId: "LD001-R01", status: "APPROVED", extraField: "unknown-provider-value" };

    await repository.appendWebhookPayload("LD001-R01", payload);

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = mockExecuteRaw.mock.calls[0];
    const sql = strings.join("?");

    expect(sql).toContain("array_append(webhook_payloads");
    expect(sql).toContain("WHERE request_id");
    // No intermediate SELECT — only the single UPDATE statement is issued.
    expect(sql.toUpperCase()).not.toContain("SELECT");

    // The JSON-serialized payload (preserving unknown/extra fields) and requestId are bound as params.
    expect(values).toContain(JSON.stringify(payload));
    expect(values).toContain("LD001-R01");
  });

  it("preserves extra/unknown provider fields verbatim in the serialized payload", async () => {
    const repository = new RegTankRepository();
    const payload = {
      requestId: "COD001",
      status: "WAIT_FOR_APPROVAL",
      somethingRegTankAddedLater: { nested: true, list: [1, 2, 3] },
    };

    await repository.appendWebhookPayload("COD001", payload);

    const [, ...values] = mockExecuteRaw.mock.calls[0];
    const serialized = values.find((v) => typeof v === "string" && v.includes("somethingRegTankAddedLater"));
    expect(serialized).toBe(JSON.stringify(payload));
  });
});
