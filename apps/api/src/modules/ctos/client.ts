/**
 * SECTION: CTOS HTTP client (token + SOAP)
 * WHY: Exchange JWT for bearer token and fetch base64 report XML
 * INPUT: inner batch XML, config
 * OUTPUT: decoded report XML string
 * WHERE USED: ctos report service
 */

import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { logger } from "../../lib/logger";
import type { CtosConfig } from "./config";

function wrapSoap(inner: string): string {
  const escaped = inner.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.proxy.xml.ctos.com.my/">
  <soapenv:Body>
    <ws:request>
      <input>${escaped}</input>
    </ws:request>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function generateClientAssertion(cfg: CtosConfig): string {
  // ===============================
  // SECTION: CTOS DEBUG LOG
  // WHY: Track CTOS flow step-by-step (prod vs local issue)
  // INPUT: request / response / token
  // OUTPUT: console logs only
  // WHERE USED: CTOS integration flow
  // ===============================
  const payloadObject = {
    jti: randomUUID(),
    sub: cfg.clientId,
    iss: cfg.clientId,
    aud: cfg.tokenUrl,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  const jwtToken = jwt.sign(payloadObject, cfg.privateKeyPem, { algorithm: "RS256" });
  logger.debug({ payload: payloadObject }, "CTOS JWT payload created");
  logger.debug("CTOS JWT signed for client assertion");
  return jwtToken;
}

export async function getCtosAccessToken(cfg: CtosConfig): Promise<string> {
  // ===============================
  // SECTION: CTOS DEBUG LOG
  // WHY: Track CTOS flow step-by-step (prod vs local issue)
  // INPUT: request / response / token
  // OUTPUT: console logs only
  // WHERE USED: CTOS integration flow
  // ===============================
  const client_id = cfg.clientId;
  const username = cfg.username;
  const CTOS_SSO_URL = cfg.tokenUrl;
  logger.debug({ client_id, username, url: CTOS_SSO_URL }, "CTOS login request");

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: cfg.clientId,
    username: cfg.username,
    password: cfg.password,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: generateClientAssertion(cfg),
  });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, bodyPreview: text.slice(0, 200) }, "CTOS token request failed");
    console.error("CTOS ERROR MESSAGE:", "CTOS authentication failed");
    console.error("CTOS ERROR RESPONSE:", text);
    console.error("CTOS ERROR STATUS:", res.status);
    throw new Error("CTOS authentication failed");
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  logger.debug(
    {
      status: res.status,
      hasAccessToken: Boolean(data.access_token),
      expiresIn: data.expires_in,
    },
    "CTOS login response"
  );
  if (!data.access_token) {
    throw new Error("CTOS token response missing access_token");
  }

  return data.access_token;
}

export async function callCtosSoap(cfg: CtosConfig, innerBatchXml: string): Promise<string> {
  // ===============================
  // SECTION: CTOS DEBUG LOG
  // WHY: Track CTOS flow step-by-step (prod vs local issue)
  // INPUT: request / response / token
  // OUTPUT: console logs only
  // WHERE USED: CTOS integration flow
  // ===============================
  const CTOS_SOAP_URL = cfg.soapUrl;
  logger.debug("CTOS SOAP: operation ws:request (only request; no requestConfirm in this client)");
  try {
    logger.debug({ soapUrl: CTOS_SOAP_URL, innerBatchXmlLength: innerBatchXml.length }, "CTOS SOAP request");
    const token = await getCtosAccessToken(cfg);
    const envelope = wrapSoap(innerBatchXml);
    logger.debug({ envelopeLength: envelope.length }, "CTOS SOAP envelope built");

    const res = await fetch(cfg.soapUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/xml",
      },
      body: envelope,
    });

    const text = await res.text();
    logger.debug({ status: res.status, responseLength: text.length }, "CTOS SOAP raw response");
    if (!res.ok) {
      logger.error({ status: res.status, bodyPreview: text.slice(0, 300) }, "CTOS SOAP request failed");
      console.error("CTOS ERROR MESSAGE:", "CTOS SOAP request failed");
      console.error("CTOS ERROR RESPONSE:", text);
      console.error("CTOS ERROR STATUS:", res.status);
      throw new Error("CTOS SOAP request failed");
    }

    const match = text.match(/<return>([\s\S]*?)<\/return>/);
    if (!match?.[1]) {
      console.error("CTOS ERROR MESSAGE:", "Invalid CTOS SOAP response (no return payload)");
      console.error("CTOS ERROR RESPONSE:", text);
      throw new Error("Invalid CTOS SOAP response (no return payload)");
    }

    const decoded = Buffer.from(match[1], "base64").toString("utf-8");
    logger.debug({ decodedXmlLength: decoded.length }, "CTOS SOAP response decoded");
    return decoded;
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { data?: unknown; status?: number } };
    console.error("CTOS ERROR MESSAGE:", err?.message ?? String(error));
    console.error("CTOS ERROR RESPONSE:", err?.response?.data);
    console.error("CTOS ERROR STATUS:", err?.response?.status);
    throw error;
  }
}
