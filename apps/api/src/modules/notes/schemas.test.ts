import { z } from "zod";
import {
  buildInvestorWithdrawalBalanceTxnKey,
  buildInvestorWithdrawalInstructionKey,
  createInvestorWithdrawalSchema,
  createWithdrawalSchema,
} from "./schemas";

describe("investor withdrawal request schema", () => {
  const intent = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("requires a UUID withdrawalIntentId", () => {
    expect(() =>
      createInvestorWithdrawalSchema.parse({
        amount: 100,
        investorOrganizationId: "org_1",
      })
    ).toThrow(z.ZodError);

    expect(() =>
      createInvestorWithdrawalSchema.parse({
        amount: 100,
        investorOrganizationId: "org_1",
        withdrawalIntentId: "not-a-uuid",
      })
    ).toThrow(z.ZodError);

    expect(
      createInvestorWithdrawalSchema.parse({
        amount: 250,
        investorOrganizationId: "org_1",
        withdrawalIntentId: intent,
      })
    ).toEqual({
      amount: 250,
      investorOrganizationId: "org_1",
      withdrawalIntentId: intent,
    });
  });

  it("builds deterministic instruction and balance keys from the client intent", () => {
    expect(buildInvestorWithdrawalInstructionKey(intent)).toBe(`investor-withdrawal:${intent}`);
    expect(buildInvestorWithdrawalBalanceTxnKey(intent)).toBe(
      `investor-balance:withdrawal:${intent}`
    );
  });

  it("does not require an intent on admin createWithdrawal", () => {
    expect(
      createWithdrawalSchema.parse({
        withdrawalType: "ISSUER_RESIDUAL_RETURN",
        amount: 1000,
        beneficiarySnapshot: { bank_name: "Maybank" },
      })
    ).toMatchObject({ withdrawalType: "ISSUER_RESIDUAL_RETURN" });
    expect(createWithdrawalSchema.shape).not.toHaveProperty("withdrawalIntentId");
  });
});
