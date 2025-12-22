/**
 * TypeScript types for RegTank integration
 */

export type RegTankOnboardingType = "INDIVIDUAL" | "CORPORATE";

export type RegTankOnboardingStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type PortalType = "investor" | "issuer";

/**
 * RegTank OAuth Token Response
 */
export interface RegTankTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * RegTank Individual Onboarding Request
 */
export interface RegTankIndividualOnboardingRequest {
  email: string;
  surname: string; // last_name
  forename: string; // first_name
  middleName?: string;
  referenceId: string; // Our internal user ID or org ID
  countryOfResidence: string; // ISO 3166 code
  nationality: string;
  placeOfBirth: string;
  idIssuingCountry: string;
  dateOfBirth?: string; // ISO date string (YYYY-MM-DD)
  yearOfBirth?: string;
  gender: "MALE" | "FEMALE" | "UNSPECIFIED";
  governmentIdNumber: string;
  idType: "PASSPORT" | "IDENTITY" | "DRIVER_LICENSE" | "RESIDENCE_PERMIT";
  language: string; // e.g., "EN"
  bypassIdUpload?: boolean; // If true, URL points directly to liveness check screen (default: false)
  skipFormPage?: boolean; // If true, URL points directly to form page (default: true)
  address?: string;
  walletAddress?: string;
  industry?: string;
  occupation?: string;
  tags?: string[];
  proofOfAddress?: {
    fileName: string;
    fileContent: string; // Base64 encoded
  };
  formId?: number;
  // Note: webhookUrl is configured globally via /alert/preferences endpoint
  // Note: redirectUrl is configured via /v3/onboarding/indv/setting endpoint
}

/**
 * RegTank Onboarding Response
 */
export interface RegTankOnboardingResponse {
  requestId: string;
  verifyLink: string;
  expiredIn: number; // seconds
  timestamp: string;
}

/**
 * RegTank Webhook Payload
 */
export interface RegTankWebhookPayload {
  requestId: string;
  referenceId?: string;
  status: string;
  substatus?: string;
  timestamp?: string;
  [key: string]: any; // Allow additional fields
}

/**
 * RegTank Onboarding Details Response
 */
export interface RegTankOnboardingDetails {
  requestId: string;
  status: string;
  substatus?: string;
  [key: string]: any;
}



