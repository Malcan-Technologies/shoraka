# RegTank Onboarding Integration - Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Module Documentation](#module-documentation)
   - [Configuration Module](#configuration-module)
   - [OAuth Client Module](#oauth-client-module)
   - [API Client Module](#api-client-module)
   - [Repository Module](#repository-module)
   - [Service Module](#service-module)
   - [Controller Module](#controller-module)
   - [Webhook Handler Module](#webhook-handler-module)
   - [Dev Webhook Handler Module](#dev-webhook-handler-module)
   - [Type Definitions](#type-definitions)
   - [Validation Schemas](#validation-schemas)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [Frontend Integration](#frontend-integration)
7. [Data Flow](#data-flow)
8. [Error Handling](#error-handling)

---

## Overview

The RegTank onboarding integration enables KYC (Know Your Customer) verification for users in both the Investor and Issuer portals. The system uses a server-to-server OAuth2 flow with webhooks for asynchronous status updates.

**Key Features:**
- Server-to-server authentication (users never log into RegTank)
- Automatic token caching and refresh
- Webhook-based status updates
- Manual status sync fallback
- Support for both production and development databases
- Dual portal support (investor/issuer)

---

## Architecture

```
┌─────────────┐
│   Frontend  │
│  (Next.js)  │
└──────┬──────┘
       │
       │ HTTP Requests
       │
┌──────▼─────────────────────────────────────┐
│         Backend API (Express)              │
│  ┌──────────────────────────────────────┐  │
│  │  RegTank Controller                  │  │
│  │  - /v1/regtank/start-onboarding     │  │
│  │  - /v1/regtank/status/:id           │  │
│  │  - /v1/regtank/retry/:id            │  │
│  │  - /v1/regtank/sync-status/:id      │  │
│  └──────────────┬───────────────────────┘  │
│                 │                            │
│  ┌──────────────▼───────────────────────┐  │
│  │  RegTank Service                     │  │
│  │  - Business Logic                    │  │
│  │  - Orchestration                     │  │
│  └──────────────┬───────────────────────┘  │
│                 │                            │
│  ┌──────────────▼───────────────────────┐  │
│  │  RegTank API Client                  │  │
│  │  - HTTP Requests                     │  │
│  │  - Error Handling                    │  │
│  └──────────────┬───────────────────────┘  │
│                 │                            │
│  ┌──────────────▼───────────────────────┐  │
│  │  RegTank OAuth Client                │  │
│  │  - Token Management                  │  │
│  │  - Auto-refresh                      │  │
│  └──────────────┬───────────────────────┘  │
└─────────────────┼──────────────────────────┘
                  │
                  │ OAuth + API Calls
                  │
         ┌────────▼────────┐
         │   RegTank API   │
         │  (External)      │
         └────────┬────────┘
                  │
                  │ Webhooks
                  │
         ┌────────▼────────┐
         │  Webhook Handler │
         │  (Production)    │
         └─────────────────┘
                  │
         ┌────────▼────────┐
         │  Dev Webhook    │
         │  Handler        │
         └─────────────────┘
```

---

## Module Documentation

### Configuration Module

**File:** `apps/api/src/config/regtank.ts`

#### `getRegTankConfig()`

**Purpose:** Retrieves and validates RegTank configuration from environment variables.

**Returns:** `RegTankConfig` object containing:
- `oauthUrl`: OAuth token endpoint URL
- `apiBaseUrl`: RegTank API base URL
- `onboardingProxyUrl`: Onboarding proxy URL (for verify links)
- `clientId`: OAuth client ID
- `clientSecret`: OAuth client secret
- `webhookSecret`: HMAC secret for webhook signature verification
- `redirectUrlInvestor`: Callback URL for investor portal
- `redirectUrlIssuer`: Callback URL for issuer portal
- `formId`: Form ID for onboarding settings

**Environment Variables Required:**
- `REGTANK_OAUTH_URL`
- `REGTANK_API_BASE_URL`
- `REGTANK_ONBOARDING_PROXY_URL`
- `REGTANK_CLIENT_ID`
- `REGTANK_CLIENT_SECRET`
- `REGTANK_WEBHOOK_SECRET`
- `REGTANK_REDIRECT_URL_INVESTOR`
- `REGTANK_REDIRECT_URL_ISSUER`
- `REGTANK_FORM_ID`

**Throws:** Error if required environment variables are missing.

---

### OAuth Client Module

**File:** `apps/api/src/modules/regtank/oauth-client.ts`

#### `RegTankOAuthClient` Class

Manages OAuth2 Client Credentials flow for server-to-server authentication with RegTank.

#### `getAccessToken(): Promise<string>`

**Purpose:** Retrieves a valid access token, using cached token if available and not expired.

**Logic:**
1. Checks if cached token exists and is still valid (with 5-minute buffer)
2. Returns cached token if valid
3. Otherwise calls `refreshToken()` to get a new token

**Returns:** Valid access token string

**Throws:** Error if token refresh fails

#### `refreshToken(): Promise<string>`

**Purpose:** Fetches a new access token from RegTank OAuth server using client credentials.

**Process:**
1. Makes POST request to OAuth URL with `grant_type=client_credentials`
2. Sends `client_id` and `client_secret` in request body
3. Parses response to extract `access_token` and `expires_in`
4. Caches token with expiration time (subtracts 1 minute for safety)
5. Returns the access token

**Returns:** New access token string

**Throws:** Error if OAuth request fails

#### `clearCache(): void`

**Purpose:** Clears the cached access token. Useful for testing or forced refresh.

**Side Effects:** Sets `accessToken` and `tokenExpiresAt` to `null`

#### `getRegTankOAuthClient(): RegTankOAuthClient`

**Purpose:** Singleton factory function to get OAuth client instance.

**Returns:** Singleton `RegTankOAuthClient` instance

---

### API Client Module

**File:** `apps/api/src/modules/regtank/api-client.ts`

#### `RegTankAPIClient` Class

Handles all HTTP requests to RegTank API with automatic OAuth token injection.

#### `makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T>`

**Purpose:** Generic method to make authenticated requests to RegTank API.

**Parameters:**
- `endpoint`: API endpoint path (e.g., `/v3/onboarding/indv/request`)
- `options`: Fetch API options (method, body, headers, etc.)

**Process:**
1. Gets access token from OAuth client
2. Constructs full URL from `apiBaseUrl` + `endpoint`
3. Adds `Authorization: Bearer <token>` header
4. Makes HTTP request
5. Parses response as JSON
6. Handles errors with detailed logging
7. Returns typed response data

**Error Handling:**
- Extracts error messages from various response formats
- Logs detailed error information
- Throws `AppError` with appropriate status code and message

**Returns:** Typed response data

**Throws:** `AppError` if request fails

#### `createIndividualOnboarding(request: RegTankIndividualOnboardingRequest): Promise<RegTankOnboardingResponse>`

**Purpose:** Creates a new individual onboarding request in RegTank.

**Parameters:**
- `request`: Onboarding request object with user data, referenceId, webhookUrl, redirectUrl, etc.

**Process:**
1. Logs request details
2. Calls `makeRequest` with `POST /v3/onboarding/indv/request`
3. Sends request body as JSON

**Returns:** `RegTankOnboardingResponse` containing:
- `requestId`: RegTank's unique request ID
- `verifyLink`: URL to redirect user to RegTank portal
- `expiredIn`: Link expiration time in seconds
- `timestamp`: Response timestamp

#### `getOnboardingDetails(requestId: string): Promise<RegTankOnboardingDetails>`

**Purpose:** Fetches current onboarding status and details from RegTank.

**Parameters:**
- `requestId`: RegTank's request ID

**Process:**
1. Calls `makeRequest` with `GET /v3/onboarding/indv/request/{requestId}`
2. Returns onboarding details

**Returns:** `RegTankOnboardingDetails` containing:
- `requestId`: Request ID
- `status`: Current status (PENDING, APPROVED, REJECTED, etc.)
- `substatus`: Optional substatus
- Additional fields as returned by RegTank

#### `restartOnboarding(requestId: string): Promise<RegTankOnboardingResponse>`

**Purpose:** Restarts a failed or expired onboarding, generating a new verify link.

**Parameters:**
- `requestId`: RegTank's request ID to restart

**Process:**
1. Calls `makeRequest` with `POST /v3/onboarding/indv/request/{requestId}/restart`
2. Returns new verify link and expiration

**Returns:** `RegTankOnboardingResponse` with new verify link

#### `setOnboardingSettings(settings: {...}): Promise<void>`

**Purpose:** Configures onboarding settings per formId (redirect URL, liveness confidence, etc.).

**Parameters:**
- `settings`: Settings object containing:
  - `formId`: Required - Form ID (settings are per formId)
  - `livenessConfidence`: Required - Face match threshold (default: 60)
  - `approveMode`: Required - Boolean to enable/disable manual approve/reject
  - `redirectUrl`: Optional - URL to redirect after completion
  - `kycApprovalTarget`: Optional - "ACURIS" or "DOWJONES"
  - `enabledRegistrationEmail`: Optional - Send email on status changes

**Process:**
1. Constructs request body with settings
2. Calls `makeRequest` with `POST /v3/onboarding/indv/setting`
3. Logs settings (with URL truncation for security)

**Returns:** Promise that resolves when settings are saved

**Note:** This is a one-time configuration per `formId`. If settings don't exist, this may fail, but the onboarding request will still work with `redirectUrl` in the request body.

#### `getRegTankAPIClient(): RegTankAPIClient`

**Purpose:** Singleton factory function to get API client instance.

**Returns:** Singleton `RegTankAPIClient` instance

---

### Repository Module

**File:** `apps/api/src/modules/regtank/repository.ts`

#### `RegTankRepository` Class

Handles all database operations for the `RegTankOnboarding` table.

#### `createOnboarding(data: {...}): Promise<RegTankOnboarding>`

**Purpose:** Creates a new RegTank onboarding record in the database.

**Parameters:**
- `data`: Object containing:
  - `userId`: User ID
  - `organizationId`: Organization ID (optional)
  - `organizationType`: "PERSONAL" or "COMPANY"
  - `portalType`: "investor" or "issuer"
  - `requestId`: RegTank's request ID
  - `referenceId`: Our internal reference (usually organizationId)
  - `onboardingType`: "INDIVIDUAL" or "CORPORATE"
  - `verifyLink`: URL to redirect user
  - `verifyLinkExpiresAt`: Link expiration timestamp
  - `status`: Initial status (usually "PENDING")
  - `substatus`: Optional substatus
  - `regtankResponse`: Full RegTank API response (stored as JSON)

**Process:**
1. Determines which organization ID field to use based on `portalType`
2. Creates record in `regTankOnboarding` table
3. Links to user and organization (investor or issuer)

**Returns:** Created `RegTankOnboarding` record

#### `findByRequestId(requestId: string): Promise<RegTankOnboardingWithRelations | null>`

**Purpose:** Finds onboarding record by RegTank's request ID.

**Parameters:**
- `requestId`: RegTank's unique request ID

**Returns:** Onboarding record with related user and organization data, or `null` if not found

**Includes:**
- User data (user_id, email, first_name, last_name)
- Investor organization (if applicable)
- Issuer organization (if applicable)

#### `findByReferenceId(referenceId: string): Promise<RegTankOnboardingWithRelations | null>`

**Purpose:** Finds onboarding record by our internal reference ID (usually organizationId).

**Parameters:**
- `referenceId`: Our internal reference ID

**Returns:** Onboarding record with relations, or `null` if not found

#### `findByOrganizationId(organizationId: string, portalType: "investor" | "issuer"): Promise<RegTankOnboardingWithRelations | null>`

**Purpose:** Finds the most recent onboarding record for an organization.

**Parameters:**
- `organizationId`: Organization ID
- `portalType`: "investor" or "issuer"

**Process:**
1. Determines which organization ID field to query based on `portalType`
2. Finds most recent record (ordered by `created_at DESC`)

**Returns:** Most recent onboarding record with relations, or `null` if not found

#### `updateStatus(requestId: string, data: {...}): Promise<RegTankOnboarding>`

**Purpose:** Updates onboarding status and related fields.

**Parameters:**
- `requestId`: RegTank's request ID
- `data`: Update object containing:
  - `status`: New status
  - `substatus`: Optional substatus
  - `verifyLink`: Optional new verify link
  - `verifyLinkExpiresAt`: Optional new expiration
  - `submittedAt`: Optional submission timestamp
  - `completedAt`: Optional completion timestamp

**Returns:** Updated `RegTankOnboarding` record

#### `appendWebhookPayload(requestId: string, payload: any): Promise<RegTankOnboarding>`

**Purpose:** Appends a webhook payload to the `webhook_payloads` JSON array for audit trail.

**Parameters:**
- `requestId`: RegTank's request ID
- `payload`: Webhook payload object

**Process:**
1. Retrieves current `webhook_payloads` array
2. Appends new payload to array
3. Updates record with new array

**Returns:** Updated `RegTankOnboarding` record

**Note:** This maintains a complete history of all webhook events for debugging and audit purposes.

#### `findPendingOnboardings(): Promise<RegTankOnboarding[]>`

**Purpose:** Finds all onboarding records with PENDING or IN_PROGRESS status.

**Returns:** Array of pending onboarding records, ordered by creation date (newest first)

#### `findByUserId(userId: string): Promise<RegTankOnboarding[]>`

**Purpose:** Finds all onboarding records for a specific user.

**Parameters:**
- `userId`: User ID

**Returns:** Array of user's onboarding records, ordered by creation date (newest first)

#### `updateRegTankResponse(requestId: string, response: any): Promise<RegTankOnboarding>`

**Purpose:** Updates the stored RegTank API response.

**Parameters:**
- `requestId`: RegTank's request ID
- `response`: Full RegTank API response object

**Returns:** Updated `RegTankOnboarding` record

---

### Service Module

**File:** `apps/api/src/modules/regtank/service.ts`

#### `RegTankService` Class

Main business logic layer that orchestrates the onboarding flow.

#### `startPersonalOnboarding(req: Request, userId: string, organizationId: string, portalType: PortalType): Promise<{...}>`

**Purpose:** Initiates personal (individual) onboarding for an organization.

**Parameters:**
- `req`: Express request object (for metadata extraction)
- `userId`: Authenticated user ID
- `organizationId`: Organization ID to onboard
- `portalType`: "investor" or "issuer"

**Process:**
1. **Validation:**
   - Verifies user exists and has first_name/last_name
   - Verifies organization exists
   - Verifies user is organization owner
   - Prevents starting if already COMPLETED

2. **Check for existing onboarding:**
   - If PENDING/IN_PROGRESS onboarding exists with valid verifyLink, returns it

3. **Configuration:**
   - Determines redirect URL based on portal type
   - Determines webhook URL based on `REGTANK_WEBHOOK_MODE` env var
   - Validates URLs are not localhost

4. **Set RegTank settings (non-blocking):**
   - Attempts to configure settings via `setOnboardingSettings()`
   - If settings don't exist, logs warning and continues
   - Settings include: formId, livenessConfidence, approveMode, redirectUrl

5. **Create onboarding request:**
   - Builds request with user data (email, forename, surname)
   - Includes referenceId (organizationId), webhookUrl, redirectUrl
   - Calls RegTank API: `createIndividualOnboarding()`

6. **Store record:**
   - Creates `RegTankOnboarding` record in database
   - Links to user and organization
   - Stores verifyLink and expiration

7. **Logging:**
   - Creates `OnboardingLog` entry with event_type "ONBOARDING_STARTED"
   - Includes request metadata (IP, user agent, device info)

**Returns:** Object containing:
- `verifyLink`: URL to redirect user to RegTank
- `requestId`: RegTank's request ID
- `expiresIn`: Link expiration in seconds
- `organizationType`: "PERSONAL" or "COMPANY"

**Throws:** `AppError` if validation fails or RegTank API call fails

#### `handleWebhookUpdate(payload: RegTankWebhookPayload): Promise<void>`

**Purpose:** Processes webhook updates from RegTank.

**Parameters:**
- `payload`: Webhook payload containing:
  - `requestId`: RegTank's request ID
  - `status`: New status (APPROVED, REJECTED, etc.)
  - `substatus`: Optional substatus
  - `referenceId`: Optional reference ID
  - `timestamp`: Optional timestamp

**Process:**
1. **Find record:**
   - Looks up onboarding by `requestId`
   - Throws error if not found

2. **Append payload:**
   - Adds payload to `webhook_payloads` array for history

3. **Update status:**
   - Updates status and substatus in database
   - Sets `completed_at` if status is APPROVED or REJECTED

4. **If APPROVED:**
   - Updates organization: `onboarding_status = COMPLETED`
   - Updates `onboarded_at` timestamp
   - Updates user's account array (replaces "temp" with organizationId)
   - Creates `OnboardingLog` entry with event_type "ONBOARDING_COMPLETED"

**Throws:** `AppError` if onboarding not found

**Note:** This method is idempotent - can be called multiple times safely.

#### `getOnboardingStatus(userId: string, organizationId: string, portalType: PortalType): Promise<{...}>`

**Purpose:** Retrieves current onboarding status for an organization.

**Parameters:**
- `userId`: User ID (for access verification)
- `organizationId`: Organization ID
- `portalType`: "investor" or "issuer"

**Process:**
1. **Access verification:**
   - Verifies organization exists
   - Verifies user is member or owner

2. **Find onboarding:**
   - Looks up onboarding record for organization
   - Returns "NOT_STARTED" if no record exists

**Returns:** Object containing:
- `status`: Current status
- `substatus`: Optional substatus
- `requestId`: RegTank's request ID
- `verifyLink`: Verify link (if available)
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

**Throws:** `AppError` if organization not found or access denied

#### `syncOnboardingStatus(userId: string, organizationId: string, portalType: PortalType): Promise<{...}>`

**Purpose:** Manually syncs onboarding status from RegTank API (fallback when webhooks fail).

**Parameters:**
- `userId`: User ID (for access verification)
- `organizationId`: Organization ID
- `portalType`: "investor" or "issuer"

**Process:**
1. **Access verification:**
   - Verifies organization exists and user has access

2. **Find onboarding:**
   - Looks up onboarding record
   - Verifies `requestId` exists

3. **Fetch from RegTank:**
   - Calls `getOnboardingDetails()` to get latest status
   - Updates database with new status

4. **If APPROVED:**
   - Updates organization status to COMPLETED
   - Updates `onboarded_at` timestamp

**Returns:** Object containing:
- `status`: Current status from RegTank
- `substatus`: Optional substatus
- `requestId`: RegTank's request ID
- `synced`: Always `true`

**Throws:** `AppError` if organization/onboarding not found, access denied, or RegTank API call fails

#### `retryOnboarding(req: Request, userId: string, organizationId: string, portalType: PortalType): Promise<{...}>`

**Purpose:** Restarts a failed or expired onboarding.

**Parameters:**
- `req`: Express request object
- `userId`: User ID
- `organizationId`: Organization ID
- `portalType`: "investor" or "issuer"

**Process:**
1. **Find existing onboarding:**
   - Looks up existing onboarding record
   - Throws error if not found

2. **Access verification:**
   - Verifies user is organization owner

3. **Restart in RegTank:**
   - Calls `restartOnboarding()` API to get new verify link
   - Updates database with new verify link and expiration
   - Resets status to "PENDING"

**Returns:** Object containing:
- `verifyLink`: New verify link
- `requestId`: Same request ID (restarted)
- `expiresIn`: New expiration in seconds
- `organizationType`: Organization type

**Throws:** `AppError` if onboarding not found, access denied, or RegTank API call fails

---

### Controller Module

**File:** `apps/api/src/modules/regtank/controller.ts`

#### `POST /v1/regtank/start-onboarding`

**Purpose:** API endpoint to start RegTank onboarding.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "organizationId": "string (CUID)",
  "portalType": "investor" | "issuer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verifyLink": "https://...",
    "requestId": "string",
    "expiresIn": 86400,
    "organizationType": "PERSONAL" | "COMPANY"
  },
  "correlationId": "string"
}
```

**Process:**
1. Validates authentication
2. Parses and validates request body
3. Calls `RegTankService.startPersonalOnboarding()`
4. Returns result

**Error Responses:**
- `400`: Bad request (missing fields, already completed, etc.)
- `403`: Forbidden (not organization owner)
- `404`: Organization not found
- `500`: Internal server error

#### `GET /v1/regtank/status/:organizationId?portalType=investor|issuer`

**Purpose:** API endpoint to get onboarding status.

**Authentication:** Required

**Path Parameters:**
- `organizationId`: Organization ID (CUID)

**Query Parameters:**
- `portalType`: "investor" or "issuer" (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "PENDING" | "APPROVED" | "REJECTED" | ...,
    "substatus": "string (optional)",
    "requestId": "string (optional)",
    "verifyLink": "string (optional)",
    "createdAt": "ISO date string",
    "updatedAt": "ISO date string"
  },
  "correlationId": "string"
}
```

**Process:**
1. Validates authentication
2. Parses path and query parameters
3. Calls `RegTankService.getOnboardingStatus()`
4. Returns result

**Error Responses:**
- `400`: Invalid portalType
- `403`: Forbidden (no access to organization)
- `404`: Organization not found

#### `POST /v1/regtank/retry/:organizationId?portalType=investor|issuer`

**Purpose:** API endpoint to retry failed/expired onboarding.

**Authentication:** Required

**Path Parameters:**
- `organizationId`: Organization ID (CUID)

**Query Parameters:**
- `portalType`: "investor" or "issuer" (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "verifyLink": "https://...",
    "requestId": "string",
    "expiresIn": 86400,
    "organizationType": "PERSONAL" | "COMPANY"
  },
  "correlationId": "string"
}
```

**Process:**
1. Validates authentication
2. Parses path and query parameters
3. Calls `RegTankService.retryOnboarding()`
4. Returns result

**Error Responses:**
- `400`: Invalid portalType
- `403`: Forbidden (not organization owner)
- `404`: Onboarding not found

#### `POST /v1/regtank/sync-status/:organizationId?portalType=investor|issuer`

**Purpose:** API endpoint to manually sync status from RegTank API.

**Authentication:** Required

**Path Parameters:**
- `organizationId`: Organization ID (CUID)

**Query Parameters:**
- `portalType`: "investor" or "issuer" (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "APPROVED" | "REJECTED" | ...,
    "substatus": "string (optional)",
    "requestId": "string",
    "synced": true
  },
  "correlationId": "string"
}
```

**Process:**
1. Validates authentication
2. Parses path and query parameters
3. Calls `RegTankService.syncOnboardingStatus()`
4. Returns result

**Error Responses:**
- `400`: Invalid portalType
- `403`: Forbidden (no access to organization)
- `404`: Organization or onboarding not found
- `500`: Sync failed

---

### Webhook Handler Module

**File:** `apps/api/src/modules/regtank/webhook-handler.ts`

#### `RegTankWebhookHandler` Class

Handles webhook signature verification and processing for production database.

#### `verifySignature(rawBody: string, receivedSignature: string): boolean`

**Purpose:** Verifies HMAC-SHA256 signature of webhook payload.

**Parameters:**
- `rawBody`: Raw request body as string
- `receivedSignature`: Signature from `X-RegTank-Signature` header

**Process:**
1. Computes HMAC-SHA256 signature using `webhookSecret`
2. Handles signature format variations ("sha256=<sig>" or just "<sig>")
3. Uses constant-time comparison to prevent timing attacks

**Returns:** `true` if signature is valid, `false` otherwise

**Security:** Uses `crypto.timingSafeEqual()` to prevent timing attacks

#### `processWebhook(rawBody: string, signature?: string): Promise<void>`

**Purpose:** Processes incoming webhook payload.

**Parameters:**
- `rawBody`: Raw request body as string
- `signature`: Optional signature from header

**Process:**
1. **Signature verification:**
   - Verifies signature if provided
   - Logs warning if no signature (allows in dev mode)
   - Throws error if signature is invalid

2. **Parse payload:**
   - Parses JSON payload
   - Validates required fields (`requestId`, `status`)

3. **Process webhook:**
   - Calls `RegTankService.handleWebhookUpdate()`

**Throws:** `AppError` if:
- Signature is invalid (401)
- Payload is invalid JSON (400)
- Required fields are missing (400)
- Onboarding not found (404)

#### `POST /v1/webhooks/regtank`

**Purpose:** Public webhook endpoint (no authentication required).

**Request:**
- Method: POST
- Headers:
  - `Content-Type: application/json`
  - `X-RegTank-Signature: sha256=<signature>` (optional)
- Body: JSON webhook payload

**Response:**
```json
{
  "success": true,
  "message": "Webhook received and processed"
}
```

**Process:**
1. Extracts raw body (using `express.raw()` middleware)
2. Extracts signature from header
3. Calls `webhookHandler.processWebhook()`
4. Returns 200 OK immediately (processing is async)

**Error Responses:**
- `400`: Invalid payload
- `401`: Invalid signature
- `500`: Internal server error

---

### Dev Webhook Handler Module

**File:** `apps/api/src/modules/regtank/webhook-handler-dev.ts`

#### `RegTankDevWebhookHandler` Class

Handles webhooks for development database. Identical to production handler but writes to dev database.

#### `verifySignature(rawBody: string, receivedSignature: string): boolean`

**Purpose:** Same as production handler - verifies HMAC-SHA256 signature.

#### `processWebhook(rawBody: string, signature?: string): Promise<void>`

**Purpose:** Processes webhook for dev database.

**Process:**
1. Same signature verification as production
2. Calls `handleWebhookUpdate()` which uses `prismaDev` client

#### `handleWebhookUpdate(payload: RegTankWebhookPayload): Promise<void>`

**Purpose:** Updates dev database with webhook data.

**Process:**
1. Finds onboarding in dev database
2. Appends payload to history
3. Updates status
4. If APPROVED, updates organization in dev database
5. Updates user's account array in dev database
6. Creates onboarding log in dev database

**Note:** Uses `prismaDev` client instead of `prisma` to write to separate database.

#### `POST /v1/webhooks/regtank/dev`

**Purpose:** Dev webhook endpoint for testing in production.

**Process:** Same as production endpoint but uses `RegTankDevWebhookHandler`

**Use Case:** Allows testing webhooks in production environment without affecting production data.

---

### Type Definitions

**File:** `apps/api/src/modules/regtank/types.ts`

#### Types and Interfaces

**`RegTankOnboardingType`**
- `"INDIVIDUAL"` | `"CORPORATE"`

**`RegTankOnboardingStatus`**
- `"PENDING"` | `"IN_PROGRESS"` | `"APPROVED"` | `"REJECTED"` | `"EXPIRED"`

**`PortalType`**
- `"investor"` | `"issuer"`

**`RegTankTokenResponse`**
```typescript
{
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}
```

**`RegTankIndividualOnboardingRequest`**
- Complete request structure for creating individual onboarding
- Includes: email, forename, surname, referenceId, country/nationality, dateOfBirth, gender, idType, webhookUrl, redirectUrl, etc.

**`RegTankOnboardingResponse`**
```typescript
{
  requestId: string;
  verifyLink: string;
  expiredIn: number;
  timestamp: string;
}
```

**`RegTankWebhookPayload`**
```typescript
{
  requestId: string;
  referenceId?: string;
  status: string;
  substatus?: string;
  timestamp?: string;
  [key: string]: any; // Additional fields
}
```

**`RegTankOnboardingDetails`**
```typescript
{
  requestId: string;
  status: string;
  substatus?: string;
  [key: string]: any; // Additional fields
}
```

---

### Validation Schemas

**File:** `apps/api/src/modules/regtank/schemas.ts`

#### `startOnboardingSchema`

**Purpose:** Zod schema for validating start onboarding request body.

**Validation:**
- `organizationId`: Must be valid CUID
- `portalType`: Must be "investor" or "issuer"

#### `organizationIdParamSchema`

**Purpose:** Zod schema for validating organization ID path parameter.

**Validation:**
- `organizationId`: Must be valid CUID

---

## API Endpoints Summary

### Authenticated Endpoints (Bearer Token Required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/regtank/start-onboarding` | Start new onboarding |
| GET | `/v1/regtank/status/:organizationId` | Get onboarding status |
| POST | `/v1/regtank/retry/:organizationId` | Retry failed onboarding |
| POST | `/v1/regtank/sync-status/:organizationId` | Manually sync status |

### Public Endpoints (No Authentication)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/webhooks/regtank` | Production webhook |
| POST | `/v1/webhooks/regtank/dev` | Dev webhook (for testing) |

---

## Database Schema

### `RegTankOnboarding` Table

**Primary Key:** `id` (UUID)

**Fields:**
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key to `User`)
- `investor_organization_id`: UUID (nullable, foreign key to `InvestorOrganization`)
- `issuer_organization_id`: UUID (nullable, foreign key to `IssuerOrganization`)
- `organization_type`: Enum ("PERSONAL" | "COMPANY")
- `portal_type`: String ("investor" | "issuer")
- `request_id`: String (unique, RegTank's request ID)
- `reference_id`: String (unique, our internal reference)
- `onboarding_type`: String ("INDIVIDUAL" | "CORPORATE")
- `verify_link`: String (nullable, URL to RegTank portal)
- `verify_link_expires_at`: Timestamp (nullable)
- `status`: String (PENDING, APPROVED, REJECTED, etc.)
- `substatus`: String (nullable)
- `submitted_at`: Timestamp (nullable)
- `completed_at`: Timestamp (nullable)
- `webhook_payloads`: JSON array (history of all webhooks)
- `regtank_response`: JSON (full RegTank API response)
- `created_at`: Timestamp
- `updated_at`: Timestamp

**Relations:**
- `user`: Belongs to `User`
- `investor_organization`: Belongs to `InvestorOrganization` (optional)
- `issuer_organization`: Belongs to `IssuerOrganization` (optional)

**Indexes:**
- `request_id` (unique)
- `reference_id` (unique)
- `investor_organization_id`
- `issuer_organization_id`
- `user_id`

---

## Frontend Integration

### Organization Context

**File:** `packages/config/src/organization-context.tsx`

#### `startRegTankOnboarding(organizationId: string): Promise<{...}>`

**Purpose:** Frontend function to start RegTank onboarding.

**Process:**
1. Calls `POST /v1/regtank/start-onboarding`
2. Returns `verifyLink`, `requestId`, `expiresIn`, `organizationType`
3. Frontend redirects user to `verifyLink`

#### `syncRegTankStatus(organizationId: string): Promise<{...}>`

**Purpose:** Frontend function to manually sync status.

**Process:**
1. Calls `POST /v1/regtank/sync-status/:organizationId`
2. Automatically refreshes organizations after sync
3. Returns synced status

### Callback Page

**File:** `apps/investor/src/app/regtank-callback/page.tsx`  
**File:** `apps/issuer/src/app/regtank-callback/page.tsx`

**Purpose:** Handles user return from RegTank portal.

**Process:**
1. **Immediate sync:**
   - Calls `syncRegTankStatus()` to fetch latest status
   - Updates database if status changed

2. **Polling:**
   - Polls every 1 second for status updates
   - Checks if `onboardingStatus === "COMPLETED"`
   - Stops after 10 seconds max

3. **Redirect:**
   - Redirects to dashboard when complete
   - Shows loading/success/error states

---

## Data Flow

### Complete Onboarding Flow

```
1. User creates organization (PERSONAL/COMPANY)
   └─> Organization created with onboarding_status = PENDING

2. Frontend calls startRegTankOnboarding(organizationId)
   └─> POST /v1/regtank/start-onboarding

3. Backend validates and prepares request
   ├─> Validates user/organization
   ├─> Checks for existing onboarding
   ├─> Sets RegTank settings (non-blocking)
   └─> Creates onboarding request

4. Backend calls RegTank API
   ├─> OAuth: Get access token (cached or fresh)
   ├─> POST /v3/onboarding/indv/request
   └─> Receives verifyLink and requestId

5. Backend stores record
   └─> Creates RegTankOnboarding record in database

6. Frontend redirects user
   └─> window.location.href = verifyLink

7. User completes onboarding on RegTank
   ├─> Uploads ID documents
   ├─> Performs liveness check
   └─> RegTank processes verification

8. RegTank sends webhook (async)
   └─> POST /v1/webhooks/regtank
       ├─> Verifies signature
       ├─> Updates database
       └─> Updates organization status if APPROVED

9. User returns to callback page
   ├─> Calls syncRegTankStatus() (fallback)
   ├─> Polls for status updates
   └─> Redirects to dashboard when complete
```

---

## Error Handling

### Error Types

**`AppError`**
- Custom error class with status code, error code, and message
- Used throughout the application for consistent error responses

**Common Error Codes:**
- `USER_NOT_FOUND`: User doesn't exist
- `ORGANIZATION_NOT_FOUND`: Organization doesn't exist
- `FORBIDDEN`: Access denied
- `ALREADY_COMPLETED`: Onboarding already completed
- `ONBOARDING_NOT_FOUND`: Onboarding record not found
- `REGTANK_API_ERROR`: RegTank API call failed
- `INVALID_SIGNATURE`: Webhook signature invalid
- `INVALID_PAYLOAD`: Invalid webhook payload
- `SYNC_FAILED`: Status sync failed

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
  },
  "correlationId": "string"
}
```

### Logging

All errors are logged with:
- Error message and stack trace
- Request context (userId, organizationId, etc.)
- Correlation ID for tracing

---

## Configuration

### Environment Variables

**Required:**
- `REGTANK_OAUTH_URL`: OAuth token endpoint
- `REGTANK_API_BASE_URL`: RegTank API base URL
- `REGTANK_CLIENT_ID`: OAuth client ID
- `REGTANK_CLIENT_SECRET`: OAuth client secret
- `REGTANK_WEBHOOK_SECRET`: HMAC secret for webhooks
- `REGTANK_REDIRECT_URL_INVESTOR`: Investor callback URL
- `REGTANK_REDIRECT_URL_ISSUER`: Issuer callback URL
- `REGTANK_FORM_ID`: Form ID for settings

**Optional:**
- `REGTANK_WEBHOOK_MODE`: "dev" or "prod" (default: "prod")
- `API_URL`: Base URL for webhook URLs
- `DATABASE_URL_DEV`: Dev database connection string

### Configuration Loading

Configuration is loaded once at startup and cached. Missing required variables cause application startup to fail.

---

## Security Considerations

1. **OAuth Tokens:**
   - Tokens are cached in memory (not persisted)
   - Auto-refresh with 5-minute buffer before expiration
   - Never logged or exposed

2. **Webhook Signatures:**
   - HMAC-SHA256 verification
   - Constant-time comparison to prevent timing attacks
   - Signature optional in dev mode for testing

3. **Access Control:**
   - All endpoints require authentication
   - Organization ownership/membership verified
   - Webhook endpoints are public but signature-verified

4. **Data Privacy:**
   - Sensitive data (URLs) truncated in logs
   - Full webhook payloads stored for audit trail
   - No PII logged in production

---

## Testing Considerations

1. **Dev Webhook Handler:**
   - Allows testing webhooks in production
   - Writes to separate dev database
   - Doesn't affect production data

2. **Manual Status Sync:**
   - Fallback when webhooks aren't working
   - Can be called from frontend callback page
   - Useful for debugging

3. **Localhost Restrictions:**
   - RegTank cannot redirect to localhost
   - Use ngrok or public URLs for development
   - Validation prevents localhost URLs

---

## Future Improvements

1. **Corporate Onboarding:**
   - Currently only individual onboarding implemented
   - Corporate onboarding endpoint exists but not fully integrated

2. **User Profile Integration:**
   - Currently uses hardcoded values for country, nationality, etc.
   - Should pull from user profile when available

3. **Settings Management:**
   - Settings endpoint may fail if settings don't exist
   - Could add settings creation/update logic

4. **Webhook Retry:**
   - Could implement retry logic for failed webhook processing
   - Currently relies on manual sync as fallback

---

## Conclusion

The RegTank onboarding integration provides a robust, production-ready KYC verification system with:

- **Reliability:** Multiple fallback mechanisms (webhooks + manual sync)
- **Security:** OAuth2 authentication, webhook signature verification
- **Observability:** Comprehensive logging and audit trail
- **Flexibility:** Support for both production and development workflows
- **User Experience:** Seamless redirect flow with status polling

The system is designed to handle edge cases gracefully and provides multiple ways to ensure status updates are captured even if webhooks fail.

