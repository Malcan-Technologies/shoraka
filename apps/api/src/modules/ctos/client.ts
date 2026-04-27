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
  return jwt.sign(
    {
      jti: randomUUID(),
      sub: cfg.clientId,
      iss: cfg.clientId,
      aud: cfg.tokenUrl,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    },
    cfg.privateKeyPem,
    { algorithm: "RS256" }
  );
}

export async function getCtosAccessToken(cfg: CtosConfig): Promise<string> {
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
    throw new Error("CTOS authentication failed");
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("CTOS token response missing access_token");
  }

  console.log("CTOS access token received");
  return data.access_token;
}

export async function callCtosSoap(cfg: CtosConfig, innerBatchXml: string): Promise<string> {
  const token = await getCtosAccessToken(cfg);
  const envelope = wrapSoap(innerBatchXml);

  const res = await fetch(cfg.soapUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/xml",
    },
    body: envelope,
  });

  const text = await res.text();
  if (!res.ok) {
    logger.error({ status: res.status, bodyPreview: text.slice(0, 300) }, "CTOS SOAP request failed");
    throw new Error("CTOS SOAP request failed");
  }

  const match = text.match(/<return>([\s\S]*?)<\/return>/);
  if (!match?.[1]) {
    throw new Error("Invalid CTOS SOAP response (no return payload)");
  }

  console.log("CTOS SOAP response decoded");
  return Buffer.from(match[1], "base64").toString("utf-8");
}
