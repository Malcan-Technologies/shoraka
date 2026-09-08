import { AppError } from "../../../lib/http/error-handler";
import {
  isRegTankRateLimited,
  REGTANK_RATE_LIMITED_CODE,
  REGTANK_RATE_LIMITED_MESSAGE,
} from "./regtank-rate-limit";

export type RegTankRefreshClient = {
  getCorporateOnboardingDetails: (requestId: string) => Promise<unknown>;
  getEntityOnboardingDetails: (requestId: string) => Promise<unknown>;
  queryKYCStatus: (kycId: string) => Promise<unknown>;
  queryKYBStatus: (kybId: string) => Promise<unknown>;
  queryOnboardingDetails?: (requestId: string) => Promise<unknown>;
};

/**
 * Request-scoped RegTank cache. One admin refresh shares COD/EOD/KYC/KYB bodies.
 * Not persisted. Stops new fetches after the first 429 in this session.
 */
export class RegTankRefreshSession {
  rateLimited = false;
  retryAfterSeconds: number | null = null;
  private rateLimitError: AppError | null = null;
  private readonly cod = new Map<string, Promise<unknown>>();
  private readonly eod = new Map<string, Promise<unknown>>();
  private readonly kyc = new Map<string, Promise<unknown>>();
  private readonly kyb = new Map<string, Promise<unknown>>();
  private readonly individual = new Map<string, Promise<unknown>>();

  constructor(private readonly client: RegTankRefreshClient) {}

  private rememberRateLimit(error: unknown): void {
    if (!isRegTankRateLimited(error)) return;
    this.rateLimited = true;
    if (error instanceof AppError) {
      this.rateLimitError = error;
      const details = error.details;
      if (details && typeof details === "object" && "retryAfterSeconds" in details) {
        const retryAfter = (details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
        if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
          this.retryAfterSeconds = retryAfter;
        }
      }
    } else {
      this.rateLimitError = new AppError(
        429,
        REGTANK_RATE_LIMITED_CODE,
        REGTANK_RATE_LIMITED_MESSAGE
      );
    }
  }

  private cached(
    map: Map<string, Promise<unknown>>,
    id: string,
    load: () => Promise<unknown>,
    forceRefresh = false
  ): Promise<unknown> {
    if (this.rateLimited) {
      return Promise.reject(
        this.rateLimitError ??
          new AppError(429, REGTANK_RATE_LIMITED_CODE, REGTANK_RATE_LIMITED_MESSAGE)
      );
    }
    const key = id.trim();
    if (!key) {
      return Promise.reject(new Error("Missing RegTank request id"));
    }
    if (!forceRefresh) {
      const existing = map.get(key);
      if (existing) return existing;
    }
    const pending = Promise.resolve()
      .then(() => load())
      .catch((error: unknown) => {
        this.rememberRateLimit(error);
        throw error;
      });
    map.set(key, pending);
    return pending;
  }

  getCorporateOnboardingDetails(requestId: string): Promise<unknown> {
    return this.cached(this.cod, requestId, () =>
      this.client.getCorporateOnboardingDetails(requestId)
    );
  }

  getEntityOnboardingDetails(requestId: string): Promise<unknown> {
    return this.cached(this.eod, requestId, () => this.client.getEntityOnboardingDetails(requestId));
  }

  queryKYCStatus(kycId: string): Promise<unknown> {
    return this.cached(this.kyc, kycId, () => this.client.queryKYCStatus(kycId));
  }

  queryKYBStatus(kybId: string, options?: { forceRefresh?: boolean }): Promise<unknown> {
    return this.cached(
      this.kyb,
      kybId,
      () => this.client.queryKYBStatus(kybId),
      options?.forceRefresh === true
    );
  }

  queryOnboardingDetails(requestId: string): Promise<unknown> {
    if (!this.client.queryOnboardingDetails) {
      return Promise.reject(new Error("queryOnboardingDetails is not available"));
    }
    return this.cached(this.individual, requestId, () =>
      this.client.queryOnboardingDetails!(requestId)
    );
  }
}
