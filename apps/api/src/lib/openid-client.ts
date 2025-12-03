import { Issuer, Client, generators } from "openid-client";
import { getCognitoConfig, getCognitoIssuerUrl } from "../config/aws";
import { logger } from "./logger";

let client: Client | null = null;

export async function initializeOpenIdClient(): Promise<Client> {
  if (client) {
    return client;
  }

  try {
    const config = getCognitoConfig();
    const issuerUrl = getCognitoIssuerUrl();

    logger.info({ issuerUrl }, "Discovering OpenID Issuer");

    const issuer = await Issuer.discover(issuerUrl);

    client = new issuer.Client({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uris: [config.redirectUri],
      response_types: ["code"],
    });

    logger.info({ clientId: config.clientId }, "OpenID Client initialized");

    return client;
  } catch (error) {
    logger.error({ error }, "Failed to initialize OpenID Client");
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

