import type { Request, Response } from "express";
import { AppError, errorHandler } from "./error-handler";

jest.mock("../logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

function mockRes(): Response & { body: unknown; statusCode: number } {
  const res = {
    locals: { correlationId: "cid" },
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { body: unknown; statusCode: number };
}

describe("errorHandler", () => {
  const req = { headers: {}, path: "/v1/test", method: "POST" } as Request;

  it("maps body-parser JSON failures to 400 instead of leaking parse text", () => {
    const res = mockRes();
    const err = Object.assign(new SyntaxError("Unexpected end of JSON input"), {
      type: "entity.parse.failed",
      status: 400,
    });
    errorHandler(err, req, res, () => undefined);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "INVALID_JSON", message: "Request body must be valid JSON." },
    });
  });

  it("keeps AppError status and message", () => {
    const res = mockRes();
    errorHandler(new AppError(422, "SIGNING_PROVIDER_ERROR", "Provider failed"), req, res, () => undefined);
    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "SIGNING_PROVIDER_ERROR", message: "Provider failed" },
    });
  });
});
