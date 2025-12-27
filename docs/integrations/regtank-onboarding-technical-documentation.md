# RegTank Onboarding Integration - Technical Documentation

This document provides detailed technical documentation for the RegTank onboarding integration implementation in the CashSouk backend API.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Module Documentation](#module-documentation)
4. [API Endpoints](#api-endpoints)
5. [Database Schema](#database-schema)
6. [Configuration](#configuration)
7. [Data Flow](#data-flow)
8. [Error Handling](#error-handling)
9. [Security](#security)
10. [Testing](#testing)

---

## Overview

The RegTank onboarding integration enables KYC (Know Your Customer) verification for users in both the Investor and Issuer portals. **Note:** Personal Account onboarding is only available in the Investor portal. The Issuer portal only supports Company Account onboarding. The system uses:

- **Server-to-Server OAuth2** - Backend authenticates with RegTank (users never log in)
- **Webhook-Based Updates** - Asynchronous status notifications
- **Global Configuration** - Webhook URL configured once via `/alert/preferences`
- **Form-Based Settings** - Redirect URL configured per `formId` via `/v3/onboarding/indv/setting`
- **Dual Database Support** - Production and development database handlers

**Current Implementation Status:**
- ✅ Individual onboarding: Fully implemented (Investor portal only)
- ✅ Corporate onboarding: Fully implemented (both Investor and Issuer portals)

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
│  │  RegTank Controller                   │  │
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

**Function:** `getRegTankConfig()`

Retrieves and validates RegTank configuration from environment variables.

**Returns:** `RegTankConfig` object:
- `oauthUrl` - OAuth token endpoint URL
- `apiBaseUrl` - RegTank API base URL
- `onboardingProxyUrl` - Onboarding proxy URL (for verify links)
- `adminPortalUrl` - Admin portal URL for direct links (derived from `apiBaseUrl` by removing `-server`)
- `clientId` - OAuth client ID
- `clientSecret` - OAuth client secret
- `webhookSecret` - HMAC secret for webhook signature verification
- `redirectUrlInvestor` - Callback URL for investor portal
- `redirectUrlIssuer` - Callback URL for issuer portal

**Admin Portal URL Derivation:**
The admin portal URL is automatically derived from `REGTANK_API_BASE_URL`:
- `https://shoraka-trial-server.regtank.com` → `https://shoraka-trial.regtank.com`
- `https://shoraka-server.regtank.com` → `https://shoraka.regtank.com`

This allows direct linking to onboarding records in the RegTank admin portal from the CashSouk admin panel.

**Note:** Form IDs are not part of the config object. RegTank uses three different form IDs:
- **Personal Account (Investor portal)**: Individual onboarding form ID
- **Company Account (Investor portal)**: Corporate onboarding form ID for investors
- **Company Account (Issuer portal)**: Corporate onboarding form ID for issuers

Each form ID is configured separately via environment variables (with fallback defaults) or passed directly in the request body.

**Environment Variables:**
- `REGTANK_OAUTH_URL`
- `REGTANK_API_BASE_URL`
- `REGTANK_ONBOARDING_PROXY_URL`
- `REGTANK_CLIENT_ID`
- `REGTANK_CLIENT_SECRET`
- `REGTANK_WEBHOOK_SECRET`
- `REGTANK_REDIRECT_URL_INVESTOR`
- `REGTANK_REDIRECT_URL_ISSUER`
- `REGTANK_INVESTOR_PERSONAL_FORM_ID` - Form ID for personal account onboarding in investor portal (default: 1036131)
- `REGTANK_INVESTOR_CORPORATE_FORM_ID` - Form ID for corporate account onboarding in investor portal (default: 1015520)
- `REGTANK_ISSUER_CORPORATE_FORM_ID` - Form ID for corporate account onboarding in issuer portal (default: 1015520)
- `REGTANK_WEBHOOK_MODE` (optional) - "dev" or "prod" (default: "prod")
- `API_URL` (optional) - Base URL for webhook URLs
- `DATABASE_URL_DEV` (optional) - Dev database connection string

**Throws:** Error if required environment variables are missing

---

### OAuth Client Module

**File:** `apps/api/src/modules/regtank/oauth-client.ts`

**Class:** `RegTankOAuthClient`

Manages OAuth2 Client Credentials flow for server-to-server authentication.

#### `getAccessToken(): Promise<string>`

Retrieves a valid access token, using cached token if available and not expired.

**Logic:**
1. Checks if cached token exists and is still valid (with 5-minute buffer)
2. Returns cached token if valid
3. Otherwise calls `refreshToken()` to get a new token

**Returns:** Valid access token string

**Throws:** Error if token refresh fails

#### `refreshToken(): Promise<string>`

Fetches a new access token from RegTank OAuth server.

**Process:**
1. Makes POST request to OAuth URL with `grant_type=client_credentials`
2. Sends `client_id` and `client_secret` in form-data body
3. Parses response to extract `access_token` and `expires_in`
4. Caches token with expiration time (subtracts 1 minute for safety)
5. Returns the access token

**Returns:** New access token string

**Throws:** Error if OAuth request fails

#### `clearCache(): void`

Clears the cached access token. Useful for testing or forced refresh.

---

### API Client Module

**File:** `apps/api/src/modules/regtank/api-client.ts`

**Class:** `RegTankAPIClient`

Handles all HTTP requests to RegTank API with automatic OAuth token injection.

#### `makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T>`

Generic method to make authenticated requests to RegTank API.

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

#### `createIndividualOnboarding(request: RegTankIndividualOnboardingRequest): Promise<RegTankOnboardingResponse>`

Creates a new individual onboarding request in RegTank.

**Important:** The request body does NOT include `webhookUrl` or `redirectUrl`:
- `webhookUrl` is configured globally via `/alert/preferences` endpoint
- `redirectUrl` is configured per `formId` via `/v3/onboarding/indv/setting` endpoint

**Returns:** `RegTankOnboardingResponse` containing:
- `requestId` - RegTank's unique request ID
- `verifyLink` - URL to redirect user to RegTank portal
- `expiredIn` - Link expiration time in seconds (default: 86400 = 24 hours)
- `timestamp` - Response timestamp (GMT +8)

#### `createCorporateOnboarding(request: RegTankCorporateOnboardingRequest): Promise<RegTankOnboardingResponse>`

Creates a new corporate (business) onboarding request in RegTank.

**Endpoint:** `POST /v3/onboarding/corp/request`

**Request Body:**
The request body sent to RegTank API contains:
- `email` (required) - User's email address
- `companyName` (required) - Company name
- `formName` (required) - Form name for RegTank corporate onboarding
- `formId` (optional) - Form ID for RegTank corporate onboarding. If not provided, defaults to portal-specific environment variable:
  - Investor portal: `REGTANK_INVESTOR_CORPORATE_FORM_ID` (default: 1015520)
  - Issuer portal: `REGTANK_ISSUER_CORPORATE_FORM_ID` (default: 1015520)

**Important Notes:**
- `referenceId` is used internally by CashSouk for tracking and webhook matching, but is **NOT sent** to RegTank API
- RegTank API does not accept `referenceId` in the request body
- `formId` is required by RegTank to identify the correct form configuration. Different form IDs are used for:
  - Company Account (Investor portal): Corporate onboarding form for investors
  - Company Account (Issuer portal): Corporate onboarding form for issuers

**Returns:** `RegTankOnboardingResponse` containing:
- `requestId` - RegTank's unique request ID
- `verifyLink` - URL to redirect user to RegTank portal
- `expiredIn` - Link expiration time in seconds (default: 86400 = 24 hours)
- `timestamp` - Response timestamp

#### `getOnboardingDetails(requestId: string): Promise<RegTankOnboardingDetails>`

Fetches current onboarding status and details from RegTank.

**Endpoint:** `GET /v3/onboarding/indv/request/{requestId}`

**Returns:** `RegTankOnboardingDetails` containing status, substatus, and additional fields

#### `restartOnboarding(requestId: string, options?): Promise<RegTankOnboardingResponse>`

Restarts an onboarding by creating a new record that inherits personal information from the original.

**Endpoint:** `POST /v3/onboarding/indv/restart` (with `requestId` in body)

**Important:** The restart endpoint returns a **new requestId** (e.g., `LD00001-R01` suffix indicates restart). 
The old record should be marked as cancelled in the database and a new record created with the new requestId.

**Parameters (optional):**
- `language` - Language code (default: "EN")
- `idType` - ID type override
- `skipFormPage` - Skip form page (default: true)

**Returns:** New `RegTankOnboardingResponse` with new requestId and verify link

#### `setOnboardingSettings(settings: {...}): Promise<void>`

Configures onboarding settings per formId (redirect URL, liveness confidence, etc.).

**Endpoint:** `POST /v3/onboarding/indv/setting`

**Parameters:**
- `formId` (required) - Form ID (settings are per formId)
- `livenessConfidence` (required) - Face match threshold (default: 60)
- `approveMode` (required) - Boolean to enable/disable manual approve/reject
- `redirectUrl` (optional) - URL to redirect after completion
- `kycApprovalTarget` (optional) - "ACURIS" or "DOWJONES"
- `enabledRegistrationEmail` (optional) - Send email on status changes

**Note:** This is a one-time configuration per `formId`. The `redirectUrl` applies to all onboarding requests using the specified `formId`.

#### `setWebhookPreferences(preferences: {...}): Promise<void>`

Sets webhook preferences globally (webhook URL and enabled status).

**Endpoint:** `POST /alert/preferences`

**Parameters:**
- `webhookUrl` (required) - Webhook URL to receive notifications
- `webhookEnabled` (required) - Boolean to enable/disable webhook notifications

**Note:** This is a one-time configuration per environment. The webhook URL applies to all webhooks for the environment.

---

### Repository Module

**File:** `apps/api/src/modules/regtank/repository.ts`

**Class:** `RegTankRepository`

Handles all database operations for the `RegTankOnboarding` table.

#### `createOnboarding(data: {...}): Promise<RegTankOnboarding>`

Creates a new RegTank onboarding record in the database.

**Parameters:**
- `userId` - User ID
- `organizationId` - Organization ID (optional)
- `organizationType` - "PERSONAL" or "COMPANY"
- `portalType` - "investor" or "issuer"
- `requestId` - RegTank's request ID
- `referenceId` - Our internal reference (usually organizationId)
- `onboardingType` - "INDIVIDUAL" or "CORPORATE"
- `verifyLink` - URL to redirect user
- `verifyLinkExpiresAt` - Link expiration timestamp
- `status` - Initial status (usually "PENDING" or "IN_PROGRESS")
- `substatus` - Optional substatus
- `regtankResponse` - Full RegTank API response (stored as JSON)

**Returns:** Created `RegTankOnboarding` record

#### `findByRequestId(requestId: string): Promise<RegTankOnboardingWithRelations | null>`

Finds onboarding record by RegTank's request ID.

**Includes:**
- User data (user_id, email, first_name, last_name)
- Investor organization (if applicable)
- Issuer organization (if applicable)

#### `updateStatus(requestId: string, data: {...}): Promise<RegTankOnboarding>`

Updates onboarding status and related fields.

**Parameters:**
- `requestId` - RegTank's request ID
- `data` - Update object containing:
  - `status` - New status
  - `substatus` - Optional substatus
  - `verifyLink` - Optional new verify link
  - `verifyLinkExpiresAt` - Optional new expiration
  - `completedAt` - Optional completion timestamp

#### `appendWebhookPayload(requestId: string, payload: any): Promise<RegTankOnboarding>`

Appends a webhook payload to the `webhook_payloads` JSON array for audit trail.

**Note:** This maintains a complete history of all webhook events for debugging and audit purposes.

---

### Service Module

**File:** `apps/api/src/modules/regtank/service.ts`

**Class:** `RegTankService`

Main business logic layer that orchestrates the onboarding flow.

#### `startPersonalOnboarding(req: Request, userId: string, organizationId: string, portalType: PortalType): Promise<{...}>`

Initiates personal (individual) onboarding for an organization.

**Note:** This method is only used for Investor portal. The Issuer portal does not support Personal Account onboarding.

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

4. **Set webhook preferences (non-blocking):**
   - Attempts to configure webhook URL globally via `setWebhookPreferences()`
   - Logs warning if fails, continues with onboarding

5. **Set onboarding settings (non-blocking):**
   - Attempts to configure settings via `setOnboardingSettings()`
   - Settings include: formId, livenessConfidence, approveMode, redirectUrl
   - If settings don't exist, logs warning and continues

6. **Create onboarding request:**
   - Builds request with user data (email, forename, surname)
   - Includes referenceId (organizationId)
   - Includes formId to link to configured settings
   - **Does NOT include webhookUrl or redirectUrl** (configured separately)
   - Calls RegTank API: `createIndividualOnboarding()`

7. **Store record:**
   - Creates `RegTankOnboarding` record in database using `createOnboarding()` method
   - Links to user and organization
   - Stores verifyLink and expiration
   - Sets initial status: `IN_PROGRESS` for personal accounts, `PENDING` for company accounts
   - **Note:** Since Personal Account onboarding is only available in Investor portal, there's no risk of duplicate `request_id` across portals, so we use `createOnboarding()` instead of upsert logic

8. **Logging:**
   - Creates `OnboardingLog` entry with event_type "ONBOARDING_STARTED"
   - Includes request metadata (IP, user agent, device info)

**Returns:**
- `verifyLink` - URL to redirect user to RegTank
- `requestId` - RegTank's request ID
- `expiresIn` - Link expiration in seconds
- `organizationType` - "PERSONAL" or "COMPANY"

#### `handleWebhookUpdate(payload: RegTankWebhookPayload): Promise<void>`

Processes webhook updates from RegTank.

**Process:**
1. **Find record:**
   - Looks up onboarding by `requestId`
   - Throws error if not found

2. **Append payload:**
   - Adds payload to `webhook_payloads` array for history

3. **Update status:**
   - Updates status and substatus in database
   - Detects liveness completion (`LIVENESS_PASSED` or `WAIT_FOR_APPROVAL`)
   - Sets status to `PENDING_APPROVAL` when liveness completes
   - Sets `completed_at` if status is APPROVED or REJECTED

4. **If APPROVED:**
   - Checks organization exists before updating (defensive)
   - Updates organization: `onboarding_status = COMPLETED`
   - Updates `onboarded_at` timestamp
   - Updates user's account array (replaces "temp" with organizationId)
   - Creates `OnboardingLog` entry with event_type "ONBOARDING_COMPLETED"
   - Error handling: Logs warnings if organization not found, continues with user updates

**Important Notes:**
- This method is idempotent - can be called multiple times safely
- Defensive programming: Checks if organization exists before updates
- Graceful degradation: Continues processing user updates even if organization update fails

#### `getOnboardingStatus(userId: string, organizationId: string, portalType: PortalType): Promise<{...}>`

Retrieves current onboarding status for an organization.

**Process:**
1. Access verification (organization exists, user has access)
2. Finds onboarding record for organization
3. Returns "NOT_STARTED" if no record exists

**Returns:**
- `status` - Current status
- `substatus` - Optional substatus
- `requestId` - RegTank's request ID
- `verifyLink` - Verify link (if available)
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

#### `syncOnboardingStatus(userId: string, organizationId: string, portalType: PortalType): Promise<{...}>`

Manually syncs onboarding status from RegTank API (fallback when webhooks fail).

**Process:**
1. Access verification
2. Finds onboarding record
3. Calls `getOnboardingDetails()` to get latest status
4. Updates database with new status
5. If APPROVED, updates organization status to COMPLETED

**Returns:** Synced status with `synced: true` flag

#### `retryOnboarding(req: Request, userId: string, organizationId: string, portalType: PortalType): Promise<{...}>`

Restarts a failed or expired onboarding.

**Process:**
1. Finds existing onboarding record
2. Verifies user is organization owner
3. Calls `restartOnboarding()` API to get new verify link
4. Updates database with new verify link and expiration
5. Resets status to "IN_PROGRESS" (personal) or "PENDING" (company)

**Returns:** New verify link and expiration

---

### Controller Module

**File:** `apps/api/src/modules/regtank/controller.ts`

#### `POST /v1/regtank/start-individual-onboarding`

**Note:** This endpoint is only used by the Investor portal. The Issuer portal does not support Personal Account onboarding.

#### `POST /v1/regtank/start-corporate-onboarding`

**Note:** This endpoint is used by both Investor and Issuer portals for Company Account onboarding.

#### `POST /v1/regtank/start-onboarding` (Deprecated)

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

#### `GET /v1/regtank/status/:organizationId?portalType=investor|issuer`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "PENDING" | "IN_PROGRESS" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | ...,
    "substatus": "string (optional)",
    "requestId": "string (optional)",
    "verifyLink": "string (optional)",
    "createdAt": "ISO date string",
    "updatedAt": "ISO date string"
  },
  "correlationId": "string"
}
```

#### `POST /v1/regtank/retry/:organizationId?portalType=investor|issuer`

**Authentication:** Required

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

#### `POST /v1/regtank/sync-status/:organizationId?portalType=investor|issuer`

**Authentication:** Required

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

---

### Webhook Handler Module

**File:** `apps/api/src/modules/regtank/webhook-handler.ts`

**Class:** `RegTankWebhookHandler`

Handles webhook signature verification and processing for production database.

#### `verifySignature(rawBody: string, receivedSignature: string): boolean`

Verifies HMAC-SHA256 signature of webhook payload.

**Process:**
1. Computes HMAC-SHA256 signature using `webhookSecret`
2. Handles signature format variations ("sha256=<sig>" or just "<sig>")
3. Uses constant-time comparison to prevent timing attacks

**Security:** Uses `crypto.timingSafeEqual()` to prevent timing attacks

#### `processWebhook(rawBody: string, signature?: string): Promise<void>`

Processes incoming webhook payload.

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

**Purpose:** Public webhook endpoint (no authentication required)

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

**Note:** According to the [official RegTank documentation](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications), RegTank automatically appends suffixes to the configured `webhookUrl`:
- `/liveness` for Individual Onboarding
- `/kyc` for Acuris KYC
- `/djkyc` for Dow Jones KYC
- `/kyb` for Acuris KYB
- `/djkyb` for Dow Jones KYB
- `/kyt` for KYT Monitoring
- `/cod` for Business Onboarding (COD)
- `/eod` for Business Onboarding (EOD)

**Current Implementation:** The current implementation handles all webhooks at the base endpoint `/v1/webhooks/regtank`. To support RegTank's suffix-based routing, you may need to add route handlers for each suffix (e.g., `/v1/webhooks/regtank/liveness`, `/v1/webhooks/regtank/kyc`, etc.) or configure your routing to accept all paths under `/v1/webhooks/regtank/*`.

---

### Dev Webhook Handler Module

**File:** `apps/api/src/modules/regtank/webhook-handler-dev.ts`

**Class:** `RegTankDevWebhookHandler`

Handles webhooks for development database. Identical to production handler but writes to dev database.

#### `handleWebhookUpdate(payload: RegTankWebhookPayload): Promise<void>`

Updates dev database with webhook data.

**Process:**
1. Attempts to find onboarding in dev database
2. **Fallback:** If not found in dev, checks production database
   - If found in production, creates a copy in dev database
   - Re-queries from dev database to ensure correct reference
3. Appends payload to history
4. Updates status (with liveness completion detection)
5. If APPROVED, updates organization in dev database (with existence check)
6. Updates user's account array in dev database
7. Creates onboarding log in dev database

**Important Notes:**
- Uses `prismaDev` client instead of `prisma` to write to separate database
- **Production fallback:** Allows webhooks for onboarding created in production to be processed by dev handler
- **Re-query after copy:** After copying from production, the record is re-queried from dev to ensure subsequent operations reference the dev database version
- **Organization existence check:** Checks if organization exists in dev before attempting updates

#### `POST /v1/webhooks/regtank/dev`

**Purpose:** Dev webhook endpoint for testing in production

**Use Case:** Allows testing webhooks in production environment without affecting production data. Supports processing webhooks for onboarding initiated in production by creating dev database copies on-the-fly.

---

## API Endpoints Summary

### Authenticated Endpoints (Bearer Token Required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/regtank/start-onboarding` | Start new onboarding |
| GET | `/v1/regtank/status/:organizationId` | Get onboarding status |
| POST | `/v1/regtank/retry/:organizationId` | Retry failed onboarding |
| POST | `/v1/regtank/sync-status/:organizationId` | Manually sync status |

### Admin Endpoints (Admin Role Required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/v1/admin/onboarding-applications` | List onboarding applications with filters |
| GET | `/v1/admin/onboarding-applications/pending-count` | Get count of applications requiring admin action |
| POST | `/v1/admin/onboarding-applications/:id/restart` | Restart onboarding via RegTank restart API |

**Admin Restart Flow:**
When an admin restarts an onboarding, the system:
1. Calls RegTank's `POST /v3/onboarding/indv/restart` with the original requestId
2. RegTank returns a **new requestId** (e.g., `LD00001-R01` suffix)
3. Marks the old database record as CANCELLED
4. Creates a new database record with the new requestId
5. Resets the organization's onboarding_status to PENDING
6. Logs the action in onboarding_logs

**Response Fields:**
The `OnboardingApplicationResponse` includes `regtankPortalUrl` which provides a direct link to the onboarding record in RegTank admin portal (e.g., `https://shoraka-trial.regtank.com/app/liveness/LD00001?archived=false`).

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
- `id` - UUID (primary key)
- `user_id` - UUID (foreign key to `User`)
- `investor_organization_id` - UUID (nullable, foreign key to `InvestorOrganization`)
- `issuer_organization_id` - UUID (nullable, foreign key to `IssuerOrganization`)
- `organization_type` - Enum ("PERSONAL" | "COMPANY")
- `portal_type` - String ("investor" | "issuer")
- `request_id` - String (unique, RegTank's request ID)
- `reference_id` - String (unique, our internal reference)
- `onboarding_type` - String ("INDIVIDUAL" | "CORPORATE")
- `verify_link` - String (nullable, URL to RegTank portal)
- `verify_link_expires_at` - Timestamp (nullable)
- `status` - String (PENDING, IN_PROGRESS, PENDING_APPROVAL, APPROVED, REJECTED, etc.)
- `substatus` - String (nullable)
- `submitted_at` - Timestamp (nullable)
- `completed_at` - Timestamp (nullable)
- `webhook_payloads` - JSON array (history of all webhooks)
- `regtank_response` - JSON (full RegTank API response)
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Relations:**
- `user` - Belongs to `User`
- `investor_organization` - Belongs to `InvestorOrganization` (optional)
- `issuer_organization` - Belongs to `IssuerOrganization` (optional)

**Indexes:**
- `request_id` (unique)
- `reference_id` (unique)
- `investor_organization_id`
- `issuer_organization_id`
- `user_id`

### `OnboardingStatus` Enum

```prisma
enum OnboardingStatus {
  PENDING
  IN_PROGRESS
  PENDING_APPROVAL
  COMPLETED
}
```

**Status Flow:**
- `PENDING` - Initial status for company accounts
- `IN_PROGRESS` - Initial status for personal accounts (when user clicks "Yes, create Personal Account")
- `PENDING_APPROVAL` - Set when liveness test completes (`LIVENESS_PASSED` or `WAIT_FOR_APPROVAL` webhook received)
- `COMPLETED` - Set when `APPROVED` webhook received

---

## Configuration

### Environment Variables

**Required:**
- `REGTANK_OAUTH_URL` - OAuth token endpoint
- `REGTANK_API_BASE_URL` - RegTank API base URL
- `REGTANK_CLIENT_ID` - OAuth client ID
- `REGTANK_CLIENT_SECRET` - OAuth client secret
- `REGTANK_WEBHOOK_SECRET` - HMAC secret for webhooks
- `REGTANK_REDIRECT_URL_INVESTOR` - Investor callback URL
- `REGTANK_REDIRECT_URL_ISSUER` - Issuer callback URL

**Form ID Configuration:**
- `REGTANK_INVESTOR_PERSONAL_FORM_ID` - Form ID for personal account onboarding in investor portal (default: 1036131)
- `REGTANK_INVESTOR_CORPORATE_FORM_ID` - Form ID for corporate account onboarding in investor portal (default: 1015520)
- `REGTANK_ISSUER_CORPORATE_FORM_ID` - Form ID for corporate account onboarding in issuer portal (default: 1015520)
  - **Note:** RegTank uses three different form IDs for different scenarios:
    - **Personal Account (Investor portal)**: Individual onboarding form ID (default: 1036131)
    - **Company Account (Investor portal)**: Corporate onboarding form ID for investors (default: 1015520)
    - **Company Account (Issuer portal)**: Corporate onboarding form ID for issuers (default: 1015520)
  - Each form ID can be passed directly in the request body, or the system will use the appropriate portal-specific env var as fallback
  - Each form ID requires separate settings configuration via `/v3/onboarding/indv/setting` endpoint

**Optional:**
- `REGTANK_WEBHOOK_MODE` - "dev" or "prod" (default: "prod")
- `API_URL` - Base URL for webhook URLs
- `DATABASE_URL_DEV` - Dev database connection string

### Configuration Loading

Configuration is loaded once at startup and cached. Missing required variables cause application startup to fail.

---

## Data Flow

### Complete Onboarding Flow

```
1. User creates organization (PERSONAL/COMPANY)
   └─> Organization created with onboarding_status = PENDING or IN_PROGRESS
   └─> Note: Personal Account (PERSONAL) only available in Investor portal

2. Frontend calls startRegTankOnboarding(organizationId) or startCorporateOnboarding(organizationId)
   └─> POST /v1/regtank/start-individual-onboarding (Investor portal only)
   └─> POST /v1/regtank/start-corporate-onboarding (both portals)

3. Backend validates and prepares request
   ├─> Validates user/organization
   ├─> Checks for existing onboarding
   ├─> Sets webhook preferences (non-blocking, one-time)
   ├─> Sets onboarding settings (redirectUrl per formId, non-blocking, one-time)
   └─> Creates onboarding request (NO webhookUrl/redirectUrl in body)

4. Backend calls RegTank API
   ├─> OAuth: Get access token (cached or fresh)
   ├─> POST /v3/onboarding/indv/request
   └─> Receives verifyLink and requestId

5. Backend stores record
   └─> Creates RegTankOnboarding record in database using createOnboarding()
       - Status: IN_PROGRESS (personal) or PENDING (company)
       - Note: No upsert logic needed since Personal Account only exists in Investor portal

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
       ├─> Sets status to PENDING_APPROVAL when liveness completes
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

**Common Error Codes (Internal):**
- `USER_NOT_FOUND` - User doesn't exist
- `ORGANIZATION_NOT_FOUND` - Organization doesn't exist
- `FORBIDDEN` - Access denied
- `ALREADY_COMPLETED` - Onboarding already completed
- `ONBOARDING_NOT_FOUND` - Onboarding record not found
- `REGTANK_API_ERROR` - RegTank API call failed
- `INVALID_SIGNATURE` - Webhook signature invalid
- `INVALID_PAYLOAD` - Invalid webhook payload
- `SYNC_FAILED` - Status sync failed

**RegTank API Error Codes:**
- `ERROR_VALUE_INVALID` - Invalid field value
- `ERROR_MISSING_PARAM` - Required field missing
- `ERROR_DATA_NOT_FOUND` - formId does not exist
- `ERROR_INVALID_ID_TYPE` - ID type doesn't match document type
- `Invalid Request Parameters` - Missing required fields
- `Too Many Requests` (HTTP 429) - Rate limit exceeded

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
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

## Security

### OAuth Tokens
- Tokens are cached in memory (not persisted)
- Auto-refresh with 5-minute buffer before expiration
- Never logged or exposed

### Webhook Signatures
- HMAC-SHA256 verification
- Constant-time comparison to prevent timing attacks
- Signature optional in dev mode for testing

### Access Control
- All endpoints require authentication (except webhooks)
- Organization ownership/membership verified
- Webhook endpoints are public but signature-verified

### Data Privacy
- Sensitive data (URLs) truncated in logs
- Full webhook payloads stored for audit trail
- No PII logged in production

---

## Testing

### Dev Webhook Handler
- Allows testing webhooks in production
- Writes to separate dev database
- Doesn't affect production data
- Supports processing webhooks for onboarding created in production

### Manual Status Sync
- Fallback when webhooks aren't working
- Can be called from frontend callback page
- Useful for debugging

### Localhost Restrictions
- RegTank cannot redirect to localhost
- Use ngrok or public URLs for development
- Validation prevents localhost URLs

---

## Future Improvements

1. **Corporate Onboarding Enhancements:**
   - Corporate onboarding endpoint is implemented and functional
   - Could add support for additional corporate onboarding features as needed

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

*Last Updated: December 2024*
