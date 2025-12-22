import { getRegTankConfig } from "../../config/regtank";
import { getRegTankOAuthClient } from "./oauth-client";
import {
  RegTankIndividualOnboardingRequest,
  RegTankOnboardingResponse,
  RegTankOnboardingDetails,
} from "./types";
import { logger } from "../../lib/logger";
import { AppError } from "../../lib/http/error-handler";

/**
 * RegTank API Client
 * Handles all HTTP requests to RegTank API with automatic OAuth token injection
 */
export class RegTankAPIClient {
  private readonly config = getRegTankConfig();
  private readonly oauthClient = getRegTankOAuthClient();

  /**
   * Make an authenticated request to RegTank API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await this.oauthClient.getAccessToken();
    const url = `${this.config.apiBaseUrl}${endpoint}`;

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    };

    logger.debug(
      {
        method: options.method || "GET",
        url,
        hasAuth: !!accessToken,
      },
      "Making RegTank API request"
    );

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const responseText = await response.text();
      let responseData: any;

      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        logger.error(
          { responseText, status: response.status },
          "Failed to parse RegTank API response"
        );
        throw new AppError(
          500,
          "INVALID_RESPONSE",
          "Invalid JSON response from RegTank API"
        );
      }

      if (!response.ok) {
        // Extract error message from various possible response structures
        let errorMessage = `RegTank API error (${response.status}): `;
        
        if (responseData.message) {
          errorMessage += responseData.message;
        } else if (responseData.error) {
          // Handle both string and object error fields
          if (typeof responseData.error === "string") {
            errorMessage += responseData.error;
          } else if (responseData.error?.message) {
            errorMessage += responseData.error.message;
          } else {
            errorMessage += JSON.stringify(responseData.error);
          }
        } else if (responseData.errors) {
          // Handle array of errors
          if (Array.isArray(responseData.errors)) {
            errorMessage += responseData.errors.map((e: any) => 
              typeof e === "string" ? e : e.message || JSON.stringify(e)
            ).join(", ");
          } else {
            errorMessage += JSON.stringify(responseData.errors);
          }
        } else if (responseData.detail) {
          errorMessage += responseData.detail;
        } else if (response.statusText) {
          errorMessage += response.statusText;
        } else {
          // Fallback: include full response for debugging
          errorMessage += JSON.stringify(responseData);
        }

        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            responseData,
            responseText,
            endpoint,
            url,
            errorMessage,
          },
          "RegTank API request failed"
        );

        throw new AppError(
          response.status,
          "REGTANK_API_ERROR",
          errorMessage
        );
      }

      logger.debug(
        {
          endpoint,
          status: response.status,
        },
        "RegTank API request successful"
      );

      return responseData as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          endpoint,
        },
        "Error making RegTank API request"
      );

      throw new AppError(
        500,
        "REGTANK_REQUEST_FAILED",
        `Failed to communicate with RegTank API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create individual onboarding request
   */
  async createIndividualOnboarding(
    request: RegTankIndividualOnboardingRequest
  ): Promise<RegTankOnboardingResponse> {
    logger.info(
      {
        email: request.email,
        referenceId: request.referenceId,
      },
      "Creating RegTank individual onboarding request"
    );

    return this.makeRequest<RegTankOnboardingResponse>(
      "/v3/onboarding/indv/request",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Get onboarding details by requestId
   */
  async getOnboardingDetails(
    requestId: string
  ): Promise<RegTankOnboardingDetails> {
    logger.debug({ requestId }, "Fetching RegTank onboarding details");

    return this.makeRequest<RegTankOnboardingDetails>(
      `/v3/onboarding/indv/request/${requestId}`
    );
  }

  /**
   * Restart onboarding (get new verifyLink)
   */
  async restartOnboarding(
    requestId: string
  ): Promise<RegTankOnboardingResponse> {
    logger.info({ requestId }, "Restarting RegTank onboarding");

    return this.makeRequest<RegTankOnboardingResponse>(
      `/v3/onboarding/indv/request/${requestId}/restart`,
      {
        method: "POST",
      }
    );
  }

  /**
   * Set onboarding settings (redirect URL, etc.)
   * This is typically called once per environment per formId
   * 
   * According to RegTank docs:
   * - formId: Required - Settings are per formId
   * - livenessConfidence: Required - Integer (default: 60)
   * - approveMode: Required - Boolean
   * - redirectUrl: Optional - URL to redirect after completion
   * 
   * Note: webhookUrl is configured globally via /alert/preferences endpoint, not here
   */
  async setOnboardingSettings(settings: {
    formId: number; // Required - Settings are per formId
    livenessConfidence: number; // Required - Face match threshold (default: 60)
    approveMode: boolean; // Required - Enable/disable Approve/Reject button
    redirectUrl?: string; // Optional - Redirect URL after completion
    kycApprovalTarget?: string; // Optional - "ACURIS" or "DOWJONES"
    enabledRegistrationEmail?: boolean; // Optional - Send email on status changes
  }): Promise<void> {
    const requestBody = {
      formId: settings.formId,
      livenessConfidence: settings.livenessConfidence,
      approveMode: settings.approveMode,
      redirectUrl: settings.redirectUrl,
      kycApprovalTarget: settings.kycApprovalTarget,
      enabledRegistrationEmail: settings.enabledRegistrationEmail,
    };

    logger.info(
      { 
        settings: {
          ...settings,
          // Don't log full URLs in production logs for security
          redirectUrl: settings.redirectUrl ? `${settings.redirectUrl.substring(0, 30)}...` : undefined,
        },
        requestBody: {
          ...requestBody,
          redirectUrl: requestBody.redirectUrl ? `${requestBody.redirectUrl.substring(0, 30)}...` : undefined,
        },
      },
      "Setting RegTank onboarding settings"
    );

    // Use correct endpoint: /v3/onboarding/indv/setting (not /request/json/setSettings)
    await this.makeRequest<{ message: string }>("/v3/onboarding/indv/setting", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
  }

  /**
   * Set webhook preferences (global configuration)
   * This is typically called once per environment
   * 
   * According to RegTank docs:
   * POST /alert/preferences
   * {
   *   "webhookUrl": "string",
   *   "webhookEnabled": boolean
   * }
   */
  async setWebhookPreferences(preferences: {
    webhookUrl: string; // Required - Webhook URL to receive notifications
    webhookEnabled: boolean; // Required - Enable/disable webhook notifications
  }): Promise<void> {
    logger.info(
      {
        webhookUrl: preferences.webhookUrl ? `${preferences.webhookUrl.substring(0, 30)}...` : undefined,
        webhookEnabled: preferences.webhookEnabled,
      },
      "Setting RegTank webhook preferences"
    );

    await this.makeRequest<{ message: string }>("/alert/preferences", {
      method: "POST",
      body: JSON.stringify(preferences),
    });
  }
}

// Singleton instance
let apiClientInstance: RegTankAPIClient | null = null;

/**
 * Get singleton API client instance
 */
export function getRegTankAPIClient(): RegTankAPIClient {
  if (!apiClientInstance) {
    apiClientInstance = new RegTankAPIClient();
  }
  return apiClientInstance;
}



