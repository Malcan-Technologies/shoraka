import { AppError } from "../../../lib/http/error-handler";
import { REGTANK_RATE_LIMITED_CODE, REGTANK_RATE_LIMITED_MESSAGE } from "./regtank-rate-limit";
import { RegTankRefreshSession } from "./regtank-refresh-session";

function rateLimitError(): AppError {
  return new AppError(429, REGTANK_RATE_LIMITED_CODE, REGTANK_RATE_LIMITED_MESSAGE, {
    retryAfterSeconds: 8,
    httpStatus: 429,
  });
}

describe("RegTankRefreshSession", () => {
  it("fetches unique COD/EOD/KYC/KYB ids once", async () => {
    const client = {
      getCorporateOnboardingDetails: jest.fn(async (id: string) => ({ id, kind: "COD" })),
      getEntityOnboardingDetails: jest.fn(async (id: string) => ({ id, kind: "EOD" })),
      queryKYCStatus: jest.fn(async (id: string) => ({ id, kind: "KYC" })),
      queryKYBStatus: jest.fn(async (id: string) => ({ id, kind: "KYB" })),
    };
    const session = new RegTankRefreshSession(client);

    await session.getCorporateOnboardingDetails("COD1");
    await session.getCorporateOnboardingDetails("COD1");
    await session.getEntityOnboardingDetails("EOD1");
    await session.getEntityOnboardingDetails("EOD1");
    await session.queryKYCStatus("KYC1");
    await session.queryKYCStatus("KYC1");
    await session.queryKYBStatus("KYB1");
    await session.queryKYBStatus("KYB1");

    expect(client.getCorporateOnboardingDetails).toHaveBeenCalledTimes(1);
    expect(client.getEntityOnboardingDetails).toHaveBeenCalledTimes(1);
    expect(client.queryKYCStatus).toHaveBeenCalledTimes(1);
    expect(client.queryKYBStatus).toHaveBeenCalledTimes(1);
  });

  it("reuses the same EOD for a dual-role person", async () => {
    const client = {
      getCorporateOnboardingDetails: jest.fn(),
      getEntityOnboardingDetails: jest.fn(async (id: string) => ({ id })),
      queryKYCStatus: jest.fn(),
      queryKYBStatus: jest.fn(),
    };
    const session = new RegTankRefreshSession(client);
    await session.getEntityOnboardingDetails("EOD-DUAL");
    await session.getEntityOnboardingDetails("EOD-DUAL");
    expect(client.getEntityOnboardingDetails).toHaveBeenCalledTimes(1);
  });

  it("stops further fetches after a 429", async () => {
    const limited = new AppError(429, REGTANK_RATE_LIMITED_CODE, REGTANK_RATE_LIMITED_MESSAGE, {
      retryAfterSeconds: 8,
      httpStatus: 429,
    });
    const client = {
      getCorporateOnboardingDetails: jest.fn().mockRejectedValue(limited),
      getEntityOnboardingDetails: jest.fn(async () => ({ ok: true })),
      queryKYCStatus: jest.fn(),
      queryKYBStatus: jest.fn(),
    };
    const session = new RegTankRefreshSession(client);
    await expect(session.getCorporateOnboardingDetails("COD1")).rejects.toBe(limited);
    await expect(session.getEntityOnboardingDetails("EOD1")).rejects.toBeInstanceOf(AppError);
    expect(client.getEntityOnboardingDetails).not.toHaveBeenCalled();
  });

  it("forceRefresh bypasses KYB cache for not-ready retries, but not after 429", async () => {
    const client = {
      getCorporateOnboardingDetails: jest.fn(),
      getEntityOnboardingDetails: jest.fn(),
      queryKYCStatus: jest.fn(),
      queryKYBStatus: jest
        .fn()
        .mockResolvedValueOnce({ status: "" })
        .mockResolvedValueOnce({ status: "Approved" }),
    };
    const session = new RegTankRefreshSession(client);
    await session.queryKYBStatus("KYB1");
    await session.queryKYBStatus("KYB1", { forceRefresh: true });
    expect(client.queryKYBStatus).toHaveBeenCalledTimes(2);
  });
});
