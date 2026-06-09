import crypto from "crypto";
import { logger } from "../../lib/logger";

type SubmitOrderResponse = {
  orderId?: string;
  status?: string;
  [key: string]: unknown;
};

type OrderStatusResponse = {
  orderId?: string;
  status?: string;
  [key: string]: unknown;
};

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEnv(name: string): string {
  // Avoid accidentally logging secrets.
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function buildSubmitSignatureSource(input: Record<string, string>): string {
  // Signature format: SECRET_KEY;API_ID;product_type;commodity_type;ownership;value_date;order_currency;order_amount;murabaha_amount;tenor;tenor_other;tenor_other_unit;order_type
  const secretKey = safeEnv("SHORAKA_SECRET_KEY");
  const apiId = safeEnv("SHORAKA_API_ID");
  return [
    secretKey,
    apiId,
    input.product_type,
    input.commodity_type,
    input.ownership,
    input.value_date,
    input.order_currency,
    input.order_amount,
    input.murabaha_amount,
    input.tenor,
    input.tenor_other,
    input.tenor_other_unit,
    input.order_type,
  ].join(";");
}

function buildSimpleSignatureSource(orderId: string): string {
  // Signature format for orderstatus/certificate: SECRET_KEY;API_ID;order_id
  const secretKey = safeEnv("SHORAKA_SECRET_KEY");
  const apiId = safeEnv("SHORAKA_API_ID");
  return [secretKey, apiId, orderId].join(";");
}

function toFormUrlEncodedBody(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) sp.set(k, v);
  return sp.toString();
}

export async function submitOrder(params: {
  values: {
    product_type: string;
    commodity_type: string;
    ownership: string;
    value_date: string;
    order_currency: string;
    order_amount: string;
    murabaha_amount: string;
    tenor: string;
    tenor_other: string;
    tenor_other_unit: string;
    order_type: string;
  };
}): Promise<{ response: SubmitOrderResponse; signature: string | null }> {
  const baseUrl = safeEnv("SHORAKA_BASE_URL");

  const signatureSource = buildSubmitSignatureSource(params.values);
  const signature = sha256Hex(signatureSource);

  // IMPORTANT: do not include real secret/signature source in logs.
  // We mask the first segment (the secret) and log only previews.
  const signatureSourceParts = signatureSource.split(";");
  if (signatureSourceParts.length > 0) signatureSourceParts[0] = "***SECRET***";
  const signatureSourceMasked = signatureSourceParts.join(";");

  logger.info(
    {
      endpoint: "/api/submitorder",
      signaturePreview: signature.slice(0, 8),
      signatureSourceMaskedPreview: signatureSourceMasked.slice(0, 140),
    },
    "Shoraka submitorder request prepared"
  );

  const body = toFormUrlEncodedBody({
    api_id: safeEnv("SHORAKA_API_ID"),
    product_type: params.values.product_type,
    commodity_type: params.values.commodity_type,
    ownership: params.values.ownership,
    value_date: params.values.value_date,
    order_currency: params.values.order_currency,
    order_amount: params.values.order_amount,
    murabaha_amount: params.values.murabaha_amount,
    tenor: params.values.tenor,
    tenor_other: params.values.tenor_other,
    tenor_other_unit: params.values.tenor_other_unit,
    order_type: params.values.order_type,
    signature,
  });

  const res = await fetch(`${baseUrl}/api/submitorder`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    logger.error({ status: res.status, endpoint: "/api/submitorder", responsePreview: text.slice(0, 200) });
    throw new Error("Shoraka submitorder failed");
  }

  const json = (text ? JSON.parse(text) : {}) as SubmitOrderResponse;
  return { response: json, signature };
}

export async function getOrderStatus(params: { orderId: string }): Promise<OrderStatusResponse> {
  const baseUrl = safeEnv("SHORAKA_BASE_URL");

  const signatureSource = buildSimpleSignatureSource(params.orderId);
  const signature = sha256Hex(signatureSource);

  const body = toFormUrlEncodedBody({
    api_id: safeEnv("SHORAKA_API_ID"),
    order_id: params.orderId,
    signature,
  });

  const res = await fetch(`${baseUrl}/api/orderstatus`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    logger.error({ status: res.status, endpoint: "/api/orderstatus", responsePreview: text.slice(0, 200) });
    throw new Error("Shoraka orderstatus failed");
  }

  return (text ? JSON.parse(text) : {}) as OrderStatusResponse;
}

export async function getCertificatePdf(params: { orderId: string }): Promise<Buffer> {
  const baseUrl = safeEnv("SHORAKA_BASE_URL");

  const signatureSource = buildSimpleSignatureSource(params.orderId);
  const signature = sha256Hex(signatureSource);

  const body = toFormUrlEncodedBody({
    api_id: safeEnv("SHORAKA_API_ID"),
    order_id: params.orderId,
    signature,
  });

  const res = await fetch(`${baseUrl}/api/certificate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, endpoint: "/api/certificate", responsePreview: text.slice(0, 200) });
    throw new Error("Shoraka certificate fetch failed");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    logger.warn({ endpoint: "/api/certificate", contentType }, "Shoraka certificate response content-type unexpected");
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

