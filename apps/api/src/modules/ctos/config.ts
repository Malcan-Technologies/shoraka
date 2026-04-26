/**
 * SECTION: CTOS environment configuration
 * WHY: Credentials and endpoints must never be hardcoded
 * INPUT: process.env
 * OUTPUT: validated config object or null if disabled
 * WHERE USED: ctos client
 */

import fs from "fs";
import path from "path";

export interface CtosConfig {
  clientId: string;
  username: string;
  password: string;
  tokenUrl: string;
  soapUrl: string;
  companyCode: string;
  accountNo: string;
  userId: string;
  privateKeyPem: string;
}

function readPrivateKeyPem(): string | null {
  const inline = process.env.CTOS_PRIVATE_KEY?.trim();
  if (inline) {
    return inline.replace(/\\n/g, "\n");
  }
  const keyPath = process.env.CTOS_PRIVATE_KEY_PATH?.trim();
  if (!keyPath) return null;
  const resolved = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return fs.readFileSync(resolved, "utf-8");
}

export function getCtosConfig(): CtosConfig | null {
  // ===============================
  // SECTION: CTOS DEBUG LOG
  // WHY: Track CTOS flow step-by-step (prod vs local issue)
  // INPUT: request / response / token
  // OUTPUT: console logs only
  // WHERE USED: CTOS integration flow
  // ===============================
  console.log("CTOS ENV:", process.env.CTOS_ENV);
  console.log("CTOS BASE URL:", process.env.CTOS_SOAP_URL);
  console.log("CTOS SSO URL:", process.env.CTOS_TOKEN_URL);

  const clientId = process.env.CTOS_CLIENT_ID?.trim();
  const username = process.env.CTOS_USERNAME?.trim();
  const password = process.env.CTOS_PASSWORD?.trim();
  const tokenUrl = process.env.CTOS_TOKEN_URL?.trim();
  const soapUrl = process.env.CTOS_SOAP_URL?.trim();
  const companyCode = process.env.CTOS_COMPANY_CODE?.trim();
  const accountNo = process.env.CTOS_ACCOUNT_NO?.trim();
  const userId = process.env.CTOS_USER_ID?.trim();
  const privateKeyPem = readPrivateKeyPem();

  if (
    !clientId ||
    !username ||
    !password ||
    !tokenUrl ||
    !soapUrl ||
    !companyCode ||
    !accountNo ||
    !userId ||
    !privateKeyPem
  ) {
    console.log("CTOS CONFIG: incomplete or disabled (one or more required values missing)");
    return null;
  }

  return {
    clientId,
    username,
    password,
    tokenUrl,
    soapUrl,
    companyCode,
    accountNo,
    userId,
    privateKeyPem,
  };
}
