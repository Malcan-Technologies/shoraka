import fs from "fs";
import type { TLSSocketOptions } from "tls";
import { logger } from "../logger";

const RDS_CA_CERT_PATH = "/app/rds-ca-cert.pem";

export function stripPgSslParamsFromConnectionString(connectionString: string): string {
  // pg-connection-string parses sslmode/ssl* from the connection string and overwrites `config.ssl`.
  // Since we pass an explicit `ssl` object (with `ca`), we must remove those query params.
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    url.searchParams.delete("sslcert");
    url.searchParams.delete("sslkey");
    url.searchParams.delete("sslrootcert");
    return url.toString();
  } catch {
    return connectionString;
  }
}

export function getRdsPgSslConfig(isProduction: boolean): TLSSocketOptions | boolean | undefined {
  if (!isProduction) return undefined;

  // Keep TLS behavior consistent between session pool + advisory-lock pool.
  if (fs.existsSync(RDS_CA_CERT_PATH)) {
    const caCert = fs.readFileSync(RDS_CA_CERT_PATH, "utf8");
    return { ca: caCert, rejectUnauthorized: true };
  }

  // Fall back to "insecure" only when the expected CA bundle isn't present.
  // This matches existing production behavior in `apps/api/src/app/session.ts`.
  logger.warn(`RDS CA certificate not found at ${RDS_CA_CERT_PATH} - using insecure SSL`);
  return { rejectUnauthorized: false };
}

