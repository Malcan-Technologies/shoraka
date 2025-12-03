import { Issuer, Client, generators, custom } from "openid-client";
import { getCognitoConfig, getCognitoIssuerUrl } from "../config/aws";
import { logger } from "./logger";

let client: Client | null = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 10000;

custom.setHttpOptionsDefaults({
  timeout: REQUEST_TIMEOUT_MS,
});

async function discoverWithRetry(issuerUrl: string, retries = MAX_RETRIES): Promise<Issuer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info({ issuerUrl, attempt }, "Discovering OpenID Issuer");
      const issuer = await Issuer.discover(issuerUrl);
      logger.info({ issuerUrl }, "OpenID Issuer discovered successfully");
      return issuer;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (isLastAttempt) {
        logger.error(
          { issuerUrl, attempt, error: errorMessage },
          "Failed to discover OpenID Issuer after all retries"
        );
        throw error;
      }

      logger.warn(
        { issuerUrl, attempt, error: errorMessage, retriesLeft: retries - attempt },
        "OpenID Issuer discovery failed, retrying"
      );

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }

  throw new Error("Failed to discover OpenID Issuer");
}

export async function initializeOpenIdClient(): Promise<Client> {
  if (client) {
    return client;
  }

  let issuerUrl: string | undefined;
  try {
    const config = getCognitoConfig();
    issuerUrl = getCognitoIssuerUrl();

    const issuer = await discoverWithRetry(issuerUrl);

    client = new issuer.Client({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uris: [config.redirectUri],
      response_types: ["code"],
    });

    logger.info({ clientId: config.clientId }, "OpenID Client initialized");

    return client;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, issuerUrl },
      "Failed to initialize OpenID Client"
    );
    throw error;
  }
}

export function getOpenIdClient(): Client {
  if (!client) {
    throw new Error("OpenID Client not initialized. Call initializeOpenIdClient() first.");
  }
  return client;
}

export { generators };

