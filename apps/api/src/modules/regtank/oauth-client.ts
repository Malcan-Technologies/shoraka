import { getRegTankConfig } from "../../config/regtank";
import { RegTankTokenResponse } from "./types";
import { logger } from "../../lib/logger";

/**
 * RegTank OAuth Client
 * Implements OAuth2 Client Credentials flow with token caching
 */
export class RegTankOAuthClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private readonly config = getRegTankConfig();

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer before expiration
      const expiresAtWithBuffer = new Date(
        this.tokenExpiresAt.getTime() - bufferTime
      );

      if (now < expiresAtWithBuffer) {
        logger.debug("Using cached RegTank access token");
        return this.accessToken;
      }
    }

    // Token expired or doesn't exist, fetch new one
    logger.info("Fetching new RegTank access token");
    return this.refreshToken();
  }

  /**
   * Refresh the access token using client credentials flow
   */
  private async refreshToken(): Promise<string> {
    try {
      const response = await fetch(this.config.oauthUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          },
          "Failed to obtain RegTank access token"
        );
        throw new Error(
          `RegTank OAuth failed: ${response.status} ${response.statusText}`
        );
      }

      const tokenData = (await response.json()) as RegTankTokenResponse;

      // Cache the token
      this.accessToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour
      this.tokenExpiresAt = new Date(
        Date.now() + expiresIn * 1000 - 60000
      ); // Subtract 1 minute for safety

      logger.info(
        {
          expiresIn,
          expiresAt: this.tokenExpiresAt.toISOString(),
        },
        "RegTank access token obtained successfully"
      );

      return this.accessToken;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error refreshing RegTank access token"
      );
      throw error;
    }
  }

  /**
   * Clear cached token (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }
}

// Singleton instance
let oauthClientInstance: RegTankOAuthClient | null = null;

/**
 * Get singleton OAuth client instance
 */
export function getRegTankOAuthClient(): RegTankOAuthClient {
  if (!oauthClientInstance) {
    oauthClientInstance = new RegTankOAuthClient();
  }
  return oauthClientInstance;
}



