import { getCurlecConfig, type CurlecConfig } from "../../config/curlec";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import {
  createCurlecOrderInputSchema,
  curlecOrderPaymentsSchema,
  curlecOrderSchema,
  curlecPaymentSchema,
  curlecSettlementListSchema,
  type CreateCurlecOrderInput,
  type CurlecOrder,
  type CurlecPayment,
  type CurlecSettlementList,
} from "./curlec-schemas";

type HttpMethod = "GET" | "POST";

export class CurlecClient {
  constructor(private readonly config?: CurlecConfig) {}

  private resolveConfig(): CurlecConfig {
    return this.config ?? getCurlecConfig();
  }

  private basicAuthHeader(config: CurlecConfig): string {
    return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
  }

  private async request(
    method: HttpMethod,
    apiPath: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const config = this.resolveConfig();
    const url = `${config.apiBaseUrl}${apiPath}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: this.basicAuthHeader(config),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!response.ok) {
      logger.warn(
        {
          method,
          apiPath,
          status: response.status,
          bodyPreview: typeof parsed === "string" ? parsed.slice(0, 200) : parsed,
        },
        "Curlec API request failed"
      );
      throw new AppError(
        response.status >= 500 ? 502 : 502,
        "CURLEC_API_ERROR",
        `Curlec API ${method} ${apiPath} failed with HTTP ${response.status}`
      );
    }

    return parsed;
  }

  async createOrder(input: CreateCurlecOrderInput): Promise<CurlecOrder> {
    const params = createCurlecOrderInputSchema.parse(input);
    const raw = await this.request("POST", "/v1/orders", {
      amount: params.amountSen,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
      partial_payment: false,
    });

    return curlecOrderSchema.parse(raw);
  }

  async fetchPayment(paymentId: string): Promise<CurlecPayment> {
    const raw = await this.request("GET", `/v1/payments/${encodeURIComponent(paymentId)}`);
    return curlecPaymentSchema.parse(raw);
  }

  async fetchOrder(orderId: string): Promise<CurlecOrder> {
    const raw = await this.request("GET", `/v1/orders/${encodeURIComponent(orderId)}`);
    return curlecOrderSchema.parse(raw);
  }

  async fetchOrderPayments(orderId: string): Promise<CurlecPayment[]> {
    const raw = await this.request(
      "GET",
      `/v1/orders/${encodeURIComponent(orderId)}/payments`
    );
    return curlecOrderPaymentsSchema.parse(raw).items;
  }

  async fetchSettlements(params?: {
    year?: number;
    month?: number;
    count?: number;
    skip?: number;
  }): Promise<CurlecSettlementList> {
    const search = new URLSearchParams();
    if (params?.year !== undefined) search.set("year", String(params.year));
    if (params?.month !== undefined) search.set("month", String(params.month));
    if (params?.count !== undefined) search.set("count", String(params.count));
    if (params?.skip !== undefined) search.set("skip", String(params.skip));

    const query = search.toString();
    const path = query ? `/v1/settlements?${query}` : "/v1/settlements";
    const raw = await this.request("GET", path);
    return curlecSettlementListSchema.parse(raw);
  }
}

export function createCurlecClient(config?: CurlecConfig): CurlecClient {
  return new CurlecClient(config);
}
