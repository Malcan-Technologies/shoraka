import { PrismaClient } from "@prisma/client";
import {
  getGatewayPaymentsExceptionCount,
  listGatewayPayments,
} from "./admin-service";
import { gatewayPaymentExceptionsWhere } from "./gateway-payment-list-filter";

describe("gateway payment exceptions count/list parity", () => {
  it("uses the same canonical WHERE for list total and pending-count", async () => {
    const count = jest.fn().mockResolvedValue(3);
    const findMany = jest.fn().mockResolvedValue([]);
    const db = { gatewayPayment: { count, findMany } } as unknown as PrismaClient;

    const listed = await listGatewayPayments(
      { page: 1, pageSize: 20, filter: "exceptions" },
      db
    );
    const pending = await getGatewayPaymentsExceptionCount(db);

    expect(listed.total).toBe(3);
    expect(pending.count).toBe(3);
    expect(count.mock.calls[0]?.[0]).toEqual({ where: gatewayPaymentExceptionsWhere() });
    expect(count.mock.calls[1]?.[0]).toEqual({ where: gatewayPaymentExceptionsWhere() });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: gatewayPaymentExceptionsWhere() })
    );
  });
});
