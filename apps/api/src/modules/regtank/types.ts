/**
 * TypeScript types for RegTank integration
 */

export type RegTankOnboardingType = "INDIVIDUAL" | "CORPORATE";

export type RegTankOnboardingStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "FORM_FILLING"
  | "LIVENESS_PASSED"
  | "PENDING_APPROVAL"
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
  [key: string]: unknown; // Allow storage as JSON
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

/**
 * RegTank Corporate Onboarding Request
 */
export interface RegTankCorporateOnboardingRequest {
  email: string;
  companyName: string;
  formName: string;
  referenceId: string;
}

/**
 * RegTank Individual Onboarding Webhook (6.2.6)
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.6-individual-onboarding-notification-definition
 */
export interface RegTankIndividualOnboardingWebhook {
  requestId: string;
  status: string;
  timestamp: string;
  exceedDeclinedLimit: boolean;
  ocrResults?: {
    validUntil?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    idType?: string;
    idIssuedCountry?: string;
    idNumber?: string;
  };
  confidence?: number;
  [key: string]: unknown; // Allow storage as JSON
}

/**
 * RegTank COD Webhook (6.2.7)
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.7-business-onboarding-notification-definition-cod
 */
export interface RegTankCODWebhook {
  requestId: string;
  status: string;
  timestamp: string;
  isPrimary: boolean;
  corpIndvDirectors: string[];
  corpIndvShareholders: string[];
  corpBizShareholders: string[];
  kybId: string;
  corpIndvDirectorCount: number;
  corpIndvShareholderCount: number;
  corpBizShareholderCount: number;
  [key: string]: unknown; // Allow storage as JSON
}

/**
 * RegTank EOD Webhook (6.2.8)
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.8-business-onboarding-notification-definition-eod
 */
export interface RegTankEODWebhook {
  requestId: string;
  status: string;
  timestamp: string;
  confidence: number;
  kycId: string;
  [key: string]: unknown; // Allow storage as JSON
}

/**
 * RegTank KYC Webhook (6.2.1)
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.1-kyc-notification-definition
 */
export interface RegTankKYCWebhook {
  requestId: string;
  referenceId: string;
  riskScore: string;
  riskLevel: string;
  status: string;
  messageStatus: string;
  possibleMatchCount: number;
  blacklistedMatchCount: number;
  assignee: string;
  timestamp: string;
  onboardingId?: string;
  tags: string[];
  [key: string]: unknown; // Allow storage as JSON
}

/**
 * RegTank KYB Webhook (6.2.3)
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.3-kyb-notification-definition
 */
export interface RegTankKYBWebhook {
  requestId: string;
  referenceId: string;
  riskScore: string;
  riskLevel: string;
  status: string;
  messageStatus: string;
  possibleMatchCount: number;
  blacklistedMatchCount: number;
  assignee: string;
  timestamp: string;
  onboardingId?: string;
  tags: string[];
  [key: string]: unknown; // Allow storage as JSON
}

/**
 * RegTank KYT Webhook (6.2.5)
 * Reference: https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.5-kyt-notification-definition
 */
export interface RegTankKYTWebhook {
  requestId: string;
  referenceId: string;
  riskScore: string;
  riskLevel: string;
  typeOfChange: string;
  status: string;
  messageStatus: string;
  assignee: string;
  timestamp: string;
  [key: string]: unknown; // Allow storage as JSON
}

