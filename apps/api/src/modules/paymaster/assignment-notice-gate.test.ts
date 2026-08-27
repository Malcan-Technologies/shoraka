import {
  PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_CODE,
  PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { assertPaymasterAcknowledgementForDisbursement } from "./service";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    paymasterAssignmentNotice: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma";

describe("paymaster acknowledgement disbursement gate", () => {
  it("rejects disbursement when notice is not acknowledged", async () => {
    (prisma.paymasterAssignmentNotice.findFirst as jest.Mock).mockResolvedValue({
      status: "SENT",
    });
    await expect(assertPaymasterAcknowledgementForDisbursement("note-1")).rejects.toMatchObject({
      code: PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_CODE,
      message: PAYMASTER_ACKNOWLEDGEMENT_REQUIRED_MESSAGE,
    } satisfies Partial<AppError>);
  });

  it("allows disbursement when acknowledgement is confirmed", async () => {
    (prisma.paymasterAssignmentNotice.findFirst as jest.Mock).mockResolvedValue({
      status: "ACKNOWLEDGED",
    });
    await expect(assertPaymasterAcknowledgementForDisbursement("note-1")).resolves.toBeUndefined();
  });
});
