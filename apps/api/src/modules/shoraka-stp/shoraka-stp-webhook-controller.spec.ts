import { shorakaStpCallbackHandler } from "./shoraka-stp-webhook-controller";
import { prisma } from "../../lib/prisma";
import type { Request, Response, NextFunction } from "express";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    shorakaTradeOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

function sha256Hex(value: string): string {
  // Local helper for test signature generation.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function buildSignatureSource(body: Record<string, unknown>): string {
  const secretKey = process.env.SHORAKA_SECRET_KEY as string;
  const apiId = process.env.SHORAKA_API_ID as string;

  const get = (k: string) => (body[k] === null || body[k] === undefined ? "" : String(body[k]));

  return [
    secretKey,
    apiId,
    body.orderId,
    get("status"),
    get("bankName"),
    get("ownershipName"),
    get("commodityType"),
    get("unit"),
    get("volume"),
    get("productType"),
    get("valueDate"),
    get("cancelDate"),
    get("orderType"),
    get("orderCurrency"),
    get("orderAmount"),
    get("murabahaAmount"),
    get("tenor"),
    get("tenorOther"),
    get("tenorOtherUnit"),
  ].join(";");
}

function makeRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.type = jest.fn().mockReturnValue(res);
  res.send = jest.fn();
  return res as Response;
}

function makeNext() {
  const next: NextFunction = jest.fn();
  return next;
}

describe("shoraka-stp webhook callback", () => {
  beforeAll(() => {
    process.env.SHORAKA_SECRET_KEY = "TEST_SECRET";
    process.env.SHORAKA_API_ID = "TEST_API_ID";
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts valid callback and updates status to Completed", async () => {
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue({
      id: "trade-order-1",
      provider_order_id: "provider-1",
    });
    (prisma.shorakaTradeOrder.update as jest.Mock).mockResolvedValue(undefined);

    const body = {
      orderId: "provider-1",
      status: "Completed",
      apiId: "TEST_API_ID",
      signature: "",

      bankName: null,
      ownershipName: "Issuer Name",
      commodityType: "000-COPPER",
      unit: "",
      volume: "",
      productType: "FINANCING",
      valueDate: "01/01/2026",
      cancelDate: null,
      orderType: "Buy & Sell",
      orderCurrency: "MYR",
      orderAmount: "100.00",
      murabahaAmount: "100.00",
      tenor: "O/N",
      tenorOther: null,
      tenorOtherUnit: null,
      certificateUrl: null,
    };

    const sigSource = buildSignatureSource(body);
    body.signature = sha256Hex(sigSource);

    const req = { body } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await shorakaStpCallbackHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(200);
    expect((res.type as jest.Mock).mock.calls[0][0]).toBe("text/plain");
    expect((res.send as jest.Mock).mock.calls[0][0]).toBe("OK");

    expect(prisma.shorakaTradeOrder.update).toHaveBeenCalledWith({
      where: { id: "trade-order-1" },
      data: expect.objectContaining({
        status: "Completed",
        callback_payload: body,
      }),
    });
  });

  it("rejects invalid signature", async () => {
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue({
      id: "trade-order-1",
      provider_order_id: "provider-1",
    });

    const body = {
      orderId: "provider-1",
      status: "Active",
      apiId: "TEST_API_ID",
      signature: "bad-signature",
      bankName: null,
      ownershipName: "Issuer Name",
      commodityType: "000-COPPER",
      unit: "",
      volume: "",
      productType: "FINANCING",
      valueDate: "01/01/2026",
      cancelDate: null,
      orderType: "Buy & Sell",
      orderCurrency: "MYR",
      orderAmount: "100.00",
      murabahaAmount: "100.00",
      tenor: "O/N",
      tenorOther: null,
      tenorOtherUnit: null,
      certificateUrl: null,
    };

    const req = { body } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await shorakaStpCallbackHandler(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(prisma.shorakaTradeOrder.update).not.toHaveBeenCalled();
  });

  it("rejects apiId mismatch", async () => {
    const body = {
      orderId: "provider-1",
      status: "Active",
      apiId: "WRONG_API",
      signature: "irrelevant",
      bankName: null,
      ownershipName: "Issuer Name",
      commodityType: "000-COPPER",
      unit: "",
      volume: "",
      productType: "FINANCING",
      valueDate: "01/01/2026",
      cancelDate: null,
      orderType: "Buy & Sell",
      orderCurrency: "MYR",
      orderAmount: "100.00",
      murabahaAmount: "100.00",
      tenor: "O/N",
      tenorOther: null,
      tenorOtherUnit: null,
      certificateUrl: null,
    };

    const req = { body } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await shorakaStpCallbackHandler(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(prisma.shorakaTradeOrder.update).not.toHaveBeenCalled();
  });

  it("rejects unknown provider_order_id", async () => {
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue(null);

    const body = {
      orderId: "unknown-provider-order",
      status: "Completed",
      apiId: "TEST_API_ID",
      signature: "irrelevant",
      bankName: null,
      ownershipName: "Issuer Name",
      commodityType: "000-COPPER",
      unit: "",
      volume: "",
      productType: "FINANCING",
      valueDate: "01/01/2026",
      cancelDate: null,
      orderType: "Buy & Sell",
      orderCurrency: "MYR",
      orderAmount: "100.00",
      murabahaAmount: "100.00",
      tenor: "O/N",
      tenorOther: null,
      tenorOtherUnit: null,
      certificateUrl: null,
    };

    const sigSource = buildSignatureSource(body);
    body.signature = sha256Hex(sigSource);

    const req = { body } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await shorakaStpCallbackHandler(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(prisma.shorakaTradeOrder.update).not.toHaveBeenCalled();
  });

  it("accepts Pending Sell callback and updates status", async () => {
    (prisma.shorakaTradeOrder.findUnique as jest.Mock).mockResolvedValue({
      id: "trade-order-2",
      provider_order_id: "provider-2",
    });
    (prisma.shorakaTradeOrder.update as jest.Mock).mockResolvedValue(undefined);

    const body = {
      orderId: "provider-2",
      status: "Pending Sell",
      apiId: "TEST_API_ID",
      signature: "",

      bankName: null,
      ownershipName: "Issuer Name",
      commodityType: "000-COPPER",
      unit: "",
      volume: "",
      productType: "FINANCING",
      valueDate: "01/01/2026",
      cancelDate: null,
      orderType: "Buy & Sell",
      orderCurrency: "MYR",
      orderAmount: "100.00",
      murabahaAmount: "100.00",
      tenor: "O/N",
      tenorOther: null,
      tenorOtherUnit: null,
      certificateUrl: null,
    };

    const sigSource = buildSignatureSource(body);
    body.signature = sha256Hex(sigSource);

    const req = { body } as unknown as Request;
    const res = makeRes();
    const next = makeNext();

    await shorakaStpCallbackHandler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(prisma.shorakaTradeOrder.update).toHaveBeenCalledWith({
      where: { id: "trade-order-2" },
      data: expect.objectContaining({
        status: "Pending Sell",
        callback_payload: body,
      }),
    });
  });
});

