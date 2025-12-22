# RegTank KYC Integration Guide

This document summarizes our understanding of the RegTank API for KYC/KYB onboarding integration with CashSouk.

> **Note:** This documentation has been cross-referenced with the RegTank Postman collection (v3.0 - Shoraka Digital Trial). Some field types and formats differ between the original documentation and the Postman collection examples. Where discrepancies exist, both formats are noted and should be verified with RegTank. See `regtank-postman-comparison.md` for detailed comparison findings.

## Quick Start (Testing with Postman)

### Digital Onboarding (Manual Testing)

For manual testing of the digital onboarding flow:

1. **Verify Email and Fill Personal Information**: Visit the manual onboarding portal:
   - **Trial/Sandbox**: https://shoraka-trial-onboarding.regtank.com/BaseInfo/emailVerify
   - **Production**: https://shoraka-onboarding.regtank.com/BaseInfo/emailVerify

2. **Complete Onboarding Process**: Follow the on-screen instructions to complete the entire onboarding flow (ID upload + liveness check)

3. **View Results**: After successful submission, view the onboarding results and details in the RegTank Client Portal:
   - **Trial/Sandbox**: https://shoraka-trial.regtank.com
   - **Production**: https://shoraka.regtank.com

### API Testing with Postman

RegTank has provided Postman collection files. To test the API:

1. **Import Postman Collections**: Import the 2 JSON files into Postman

2. **Configure Postman Environment** with these sandbox settings:
   - **RegTank OAuth URL**: `https://crm-server.regtank.com`
   - **RegTank API URL**: `https://shoraka-trial-server.regtank.com`
   - **Company-specific RegTank server URL**: `https://shoraka-trial-server.regtank.com`
   - **RegTank Onboarding server URL**: `https://shoraka-trial-onboarding-proxy.regtank.com`
   - **Client ID**: `6c3eb4f4-3402-45a3-8707-a365059e7581`
   - **Client Secret**: `88b2d5fe7d5ac366f0d7b59f67bf9ee4`

3. **Test API Endpoints**: Use the imported collections to test OAuth authentication and onboarding request creation

For detailed instructions, refer to [RegTank API Documentation](https://regtank.gitbook.io/regtank-api-docs/).

## Overview

RegTank provides a compliance and risk management platform that handles:

- **Digital Onboarding** - ID document verification + liveness check
- **KYC (Know Your Customer)** - Individual screening against sanctions/watchlists
- **KYB (Know Your Business)** - Business entity verification
- **KYT (Know Your Transaction)** - Transaction monitoring

For CashSouk, we primarily need:

- **Individual Onboarding** for Investors (personal identity verification)
- **Business Onboarding (COD/EOD)** for Issuers (company + director verification)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  CashSouk App   │     │  CashSouk API   │     │   RegTank API   │
│  (Frontend)     │     │  (Backend)      │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. Click "Start KYC"  │                       │
         │    Choose Personal/   │                       │
         │    Company            │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ 2. Server-to-Server   │
         │                       │    OAuth: Get token   │
         │                       │    (Backend auth only)│
         │                       │──────────────────────>│
         │                       │ 3. Return access_token│
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 4. Create onboarding │
         │                       │    Parse firstName/   │
         │                       │    lastName from DB   │
         │                       │    Include webhook URL│
         │                       │──────────────────────>│
         │                       │ 5. Return verifyLink  │
         │                       │<──────────────────────│
         │                       │                       │
         │ 6. Redirect to        │                       │
         │    RegTank site       │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 7. User completes     │                       │
         │    entire flow        ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
         │    (ID + liveness)    │                       │
         │    (No login required)│                       │
         │                       │                       │
         │                       │ 8. Webhooks: progress │
         │                       │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│ (log only)
         │                       │                       │
         │                       │ 9. Webhook: APPROVED  │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 10. Get full details  │
         │                       │──────────────────────>│
         │                       │<──────────────────────│
         │                       │                       │
         │ 11. Redirect back     │                       │
         │     to our site       │                       │
         │     (mechanism TBD)   │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 12. Show verified     │                       │
         │<──────────────────────│                       │
```

**Flow Summary:**

1. **User Initiates**: User clicks "Start KYC" and chooses **Personal** or **Company** onboarding type
2. **Server-to-Server OAuth**: Backend automatically authenticates with RegTank OAuth server (using client credentials) to obtain `access_token`. **Important**: Users do NOT log into RegTank - this is backend-only authentication.
3. **Configure Onboarding Settings** (One-time per `formId`): If not already configured, backend calls Set Onboarding Settings API to configure:
   - `redirectUrl` - Our callback URL (e.g., `https://api.cashsouk.com/v1/kyc/callback`)
   - `livenessConfidence` - Face match threshold
   - `approveMode` - Manual approval settings
   - Other form-specific settings
4. **Create Onboarding Request**: Backend calls RegTank API to create onboarding session, parsing and sending:
   - User's `firstName` and `lastName` (parsed from our user database fields `first_name` and `last_name`)
   - `formId` - Links to the configured settings (including `redirectUrl`)
   - Webhook URL for status updates (configured/sent during onboarding request creation)
   - `referenceId` (our internal user ID) for webhook matching
5. **Get Verify Link**: RegTank returns a `verifyLink` URL
6. **Redirect to RegTank**: User is redirected to RegTank's hosted onboarding flow (no login required)
7. **Complete KYC**: User completes entire onboarding flow on RegTank's side (ID upload + liveness check)
8. **Progress Webhooks**: We receive progress webhooks for status changes (for monitoring/logging only)
9. **Final Status**: When we receive `APPROVED` or `REJECTED` webhook, we call Get Detail API to pull the full verified profile
10. **Redirect Back**: User is automatically redirected back to our portal using the `redirectUrl` configured in Set Onboarding Settings
11. **Update Database**: Update our database with verified user data from RegTank
12. **Show Status**: Display verified status to user in our application

## Environment Configuration

RegTank has provided us with both **Production** and **Trial/Sandbox** environments.

### Production Environment

| Component         | URL                                                           |
| ----------------- | ------------------------------------------------------------- |
| OAuth Server      | `https://crm-server.regtank.com`                              |
| API Server        | `https://shoraka-server.regtank.com`                          |
| Onboarding Proxy  | `https://shoraka-onboarding-proxy.regtank.com`                |
| Client Portal     | `https://shoraka.regtank.com`                                 |
| Manual Onboarding | `https://shoraka-onboarding.regtank.com/BaseInfo/emailVerify` |

**All config (URLs + credentials):** Stored in AWS Secrets Manager at `cashsouk/prod/regtank`

### Trial/Sandbox Environment

| Component         | URL                                                                 |
| ----------------- | ------------------------------------------------------------------- |
| OAuth Server      | `https://crm-server.regtank.com`                                    |
| API Server        | `https://shoraka-trial-server.regtank.com`                          |
| Onboarding Proxy  | `https://shoraka-trial-onboarding-proxy.regtank.com`                |
| Client Portal     | `https://shoraka-trial.regtank.com`                                 |
| Manual Onboarding | `https://shoraka-trial-onboarding.regtank.com/BaseInfo/emailVerify` |

**All config (URLs + credentials):** Stored in AWS Secrets Manager at `cashsouk/staging/regtank`

**Trial/Sandbox Credentials:**

- **Client ID**: `6c3eb4f4-3402-45a3-8707-a365059e7581`
- **Client Secret**: `88b2d5fe7d5ac366f0d7b59f67bf9ee4`

> **Note:** OAuth URL (`crm-server.regtank.com`) is the same for both environments. The API server URL differs.

## Authentication

RegTank uses OAuth2 client credentials flow. This is **server-to-server authentication** - our backend authenticates with RegTank, not the end users.

**Key Points:**

- **Backend-only authentication**: Users never log into RegTank directly
- **Automatic**: OAuth happens automatically in our backend when a user initiates KYC
- **No user interaction**: Users are not involved in the authentication process
- **Secure**: Client credentials are stored securely in AWS Secrets Manager

**Endpoint:** `POST https://crm-server.regtank.com/oauth/token`

**Request:**

```
Content-Type: multipart/form-data

grant_type: client_credentials
client_id: <from secrets manager>
client_secret: <from secrets manager>
```

**Response:**

```json
{
  "access_token": "eyJhbG...",
  "token_type": "bearer",
  "expires_in": 3599,
  "scope": "read write",
  "sub": "client-id",
  "jti": "unique-token-id"
}
```

**Implementation Notes:**

- Token expires in ~1 hour - implement token caching/refresh in RegTank service
- Use `Authorization: Bearer <access_token>` header for subsequent requests
- Client credentials must be kept secret (store in SSM/Secrets Manager)
- Same OAuth server for both environments; credentials differ
- **This is server-to-server authentication** - users do NOT log in to RegTank directly
- OAuth happens automatically in backend when user initiates KYC
- After obtaining access token, backend creates onboarding request and redirects user to RegTank's hosted flow (no login required)

## Integration Flow Overview

Based on our implementation plan, the flow works as follows:

1. **User Initiates**: User clicks "Start KYC" and selects **Personal** or **Company** onboarding type
2. **Server-to-Server OAuth Authentication**: Backend automatically authenticates with RegTank OAuth server using client credentials to obtain `access_token`. **Critical**: This is server-to-server authentication - users never log into RegTank directly.
3. **Configure Onboarding Settings** (One-time per `formId`): If not already configured, backend calls Set Onboarding Settings API to set:
   - `redirectUrl` - Our callback URL (e.g., `https://api.cashsouk.com/v1/kyc/callback`)
   - `livenessConfidence` - Face match threshold
   - `approveMode` - Manual approval settings
   - Other form-specific settings
4. **Create Onboarding Request**: Backend calls RegTank API to create onboarding session, parsing and sending:
   - User's `firstName` and `lastName` (parsed from our user database fields `first_name` and `last_name`)
   - `formId` - Links to the configured settings (including `redirectUrl`)
   - Webhook URL for status updates (configured/sent during onboarding request creation)
   - `referenceId` (our internal user ID) for webhook matching
5. **Redirect to RegTank**: User is redirected to RegTank's `verifyLink` (no login required)
6. **Complete KYC**: User completes entire onboarding flow on RegTank's side (ID upload + liveness check)
7. **Webhook Updates**: We receive webhook notifications for status changes (progress updates logged, final status triggers action)
8. **Redirect Back**: User is automatically redirected back to our portal using the `redirectUrl` configured in settings (see Set Onboarding Settings endpoint)
9. **Update Database**: When `APPROVED` or `REJECTED` webhook received, we pull full details via Get Detail API and update user record

## Individual Onboarding Flow

> **Reference:** [RegTank API Documentation - Individual Onboarding Endpoint](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.1-individual-onboarding-endpoint-json-request)

### Prerequisites

Before creating an onboarding request, ensure:

1. **OAuth Authentication**: Backend authenticates with RegTank OAuth server to obtain `access_token` (server-to-server, no user login)
2. **User Data Parsing**: Parse user's `firstName` and `lastName` from our database fields (`user.first_name` → `forename`, `user.last_name` → `surname`)
3. **Webhook Configuration**: Webhook URL is configured/sent when creating the onboarding request (one-time setup per environment, but URL is included in each request)

### 1. Create Onboarding Request

**Endpoint:**

- Production: `POST https://shoraka-server.regtank.com/v3/onboarding/indv/request`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/onboarding/indv/request`

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json; charset=utf-8
```

**Request Body:**

```json
{
  "email": "user@example.com", // Required
  "surname": "Doe", // Required - last name (parsed from our user.last_name)
  "forename": "John", // Required - first name (parsed from our user.first_name)
  "middleName": "William", // Optional
  "referenceId": "cashsouk-user-123", // Our internal user ID - IMPORTANT for webhook matching
  "countryOfResidence": "MY", // ISO 3166 code
  "nationality": "MY",
  "placeOfBirth": "MY",
  "idIssuingCountry": "MY",
  "dateOfBirth": "1977-01-01", // ISO date string (YYYY-MM-DD) - Note: Postman uses string format
  "yearOfBirth": "1977", // Optional - year as string
  "gender": "MALE", // MALE, FEMALE, UNSPECIFIED
  "governmentIdNumber": "123456789",
  "idType": "IDENTITY", // PASSPORT, IDENTITY, DRIVER_LICENSE, RESIDENCE_PERMIT
  "language": "EN", // UI language
  "bypassIdUpload": false, // Boolean - If true, URL points directly to liveness check screen (default: false)
  "skipFormPage": true, // Boolean - If true, URL points directly to form page (default: true)
  "address": "123 Main St",
  "walletAddress": "KwmgX4oEAZRLDLaVBv6VbV2S8PiyYv23mctbqHdP6GjQAcDvZUNg", // Optional - crypto wallet address
  "industry": "WINE_SPIRITS", // See Appendix B - Postman example uses WINE_SPIRITS
  "occupation": "CHIEF_EXECUTIVES_SENIOR_OFFICIALS_AND_LEGISLATORS", // See Appendix C
  "tags": [], // Array of strings
  "proofOfAddress": { // Optional - proof of address document
    "fileName": "proofOfAddress.pdf",
    "fileContent": "data:image/jpeg;base64,/9j..." // Base64 encoded file
  }
}
```

**Field Type Notes:**
- `dateOfBirth`: ISO date string format (`"1977-01-01"`) or epoch time format. According to [official API docs](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.1-individual-onboarding-endpoint-json-request), both formats are accepted.
- `bypassIdUpload`: **Boolean** (not string) - According to [official API docs](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.1-individual-onboarding-endpoint-json-request), this is a boolean field. Default is `false`. If `true`, URL points directly to liveness check screen.
- `skipFormPage`: **Boolean** - New field in official API docs. If `true`, URL points directly to form page. Default is `true`.
- `yearOfBirth`: Optional integer field. Redundant if `dateOfBirth` is provided.
- `proofOfAddress`: Optional object for uploading proof of address document with `fileName` (string) and `fileContent` (base64 string).
- `walletAddress`: Optional field for crypto wallet addresses.
- `formId`: Optional integer - The respective ID of the individual onboarding form.
- `webhookUrl`: Optional string - Webhook URL for status updates (set per request, not in settings).
- `redirectUrl`: Optional string - Redirect URL after completion (can be set per request or in settings).

**Note:** Some Postman collection examples show string values for boolean fields, but the [official API documentation](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.1-individual-onboarding-endpoint-json-request) specifies boolean types. Use the types from the official documentation.

**Key Implementation Notes:**

- **Data Parsing**: `forename` and `surname` must be parsed from our user database fields (`user.first_name` → `forename`, `user.last_name` → `surname`)
- **Webhook Configuration**: Webhook URL is included/configured when creating the onboarding request (see Webhooks section for one-time setup)
- **Reference ID**: `referenceId` must be our internal user ID to match webhook payloads to users
- **Server-to-Server**: OAuth authentication happens automatically in backend before this request (users never log into RegTank)

**Response:**

```json
{
  "requestId": "abc123-unique-id",
  "verifyLink": "https://onboarding.regtank.com/v3/abc123-unique-id",
  "expiredIn": 86400,
  "timestamp": "2024-01-15T10:00:00+08:00"
}
```

**Key Fields:**

- `requestId` - Store this; used to query status and receive webhooks
- `verifyLink` - URL to redirect user to (or generate QR code)
- `expiredIn` - Link expires in 24 hours by default (86400 seconds)
- `timestamp` - Time when the first liveness test URL is generated (GMT +8)

**Error Responses:**

According to the [official API documentation](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.1-individual-onboarding-endpoint-json-request), the following error codes may be returned:

| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| 400 | `ERROR_VALUE_INVALID` | The specified value is invalid (e.g., invalid idType, occupation, industry, gender, or empty values) |
| 400 | `ERROR_MISSING_PARAM` | Required items were not set or invalid value (e.g., referenceId, idType) |
| 400 | `ERROR_DATA_NOT_FOUND` | formId does not exist |
| 400 | `ERROR_INVALID_ID_TYPE` | Your ID type does not match with the document type |
| 400 | `Invalid Request Parameters` | Missing required fields (e.g., surname, forename, email must not be blank) |
| 429 | `Too Many Requests` | Rate limit exceeded |

**Example Error Response:**

```json
{
  "errorCode": "ERROR_VALUE_INVALID",
  "errorMsg": "The specified value is invalid. [Input item: idType, input value: Empty]",
  "requestUID": "d1d5ec97-1d72-4843-a420-f37b4909e92e"
}
```

Or:

```json
{
  "timestamp": "2024-09-02T09:33:34.041+00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid Request Parameters",
  "path": "/v3/onboarding/indv/request",
  "errors": [
    {
      "surname": "must not be blank"
    },
    {
      "forename": "must not be blank"
    },
    {
      "email": "must not be blank"
    }
  ]
}
```

### 2. User Completes Onboarding

User visits `verifyLink` and:

1. Selects ID document type and country
2. Uploads or captures ID document (front + back if applicable)
3. Performs liveness check (video selfie)
4. System compares face on ID with selfie
5. Document undergoes IDV (authenticity check)
6. If enabled, KYC screening runs against sanctions databases

**After completion:** User should be redirected back to our portal (return URL mechanism - see Open Questions #7)

### 2a. Onboarding ID Document Upload (Optional)

If you need to upload ID documents separately after creating the onboarding request:

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/onboarding/indv/document-upload`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/onboarding/indv/document-upload`

**Request Body:**
```json
{
  "requestId": "LD01752",
  "email": "testmail@mail.com",
  "documentType": "Identity",
  "frontImage": {
    "fileName": "icFront.jpeg",
    "fileContent": "data:image/jpeg;base64,/9j..." // Base64 encoded image
  },
  "backImage": {
    "fileName": "icBack.jpeg",
    "fileContent": "data:image/jpg;base64,/9j..." // Base64 encoded image (optional for some ID types)
  }
}
```

**Note:** This endpoint is optional if documents are uploaded through the `verifyLink` flow.

### 2b. Onboarding Liveness Check (Alternative Method)

If you need to upload liveness video separately:

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/onboarding/indv/liveness-check`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/onboarding/indv/liveness-check`

**Request:** `multipart/form-data`
- `requestId`: Text (e.g., "LD01752")
- `token`: Text (JWT token from onboarding request, not OAuth token)
- `video`: File (video file for liveness check)

**Note:** This endpoint is typically not needed if users complete the flow via `verifyLink`, as liveness is handled in the hosted flow.

### 2c. Onboarding Restart

If a user needs to restart a failed onboarding:

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/onboarding/indv/restart`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/onboarding/indv/restart`

**Request Body:**
```json
{
  "requestId": "LD01752",
  "email": "user@example.com"
}
```

**Response:** Returns a new `verifyLink` for the user to restart the onboarding process.

### 2d. Get Onboarding Settings

Retrieve onboarding form settings:

**Endpoint:**
- Production: `GET https://shoraka-server.regtank.com/v3/onboarding/indv/setting/query?formId={formId}`
- Sandbox: `GET https://shoraka-trial-server.regtank.com/v3/onboarding/indv/setting/query?formId={formId}`

**Query Parameters:**
- `formId`: Required - The form ID to query settings for

### 2e. Set Onboarding Settings

Configure onboarding settings (liveness confidence threshold, approval mode, redirect URL, etc.):

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/onboarding/indv/setting`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/onboarding/indv/setting`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json; charset=utf-8
```

**Request Body:**
```json
{
  "formId": 12306, // Integer - ID of individual onboarding form
  "livenessConfidence": 90, // Integer (required) - Face Match Percentage Threshold (default: 60)
  "approveMode": false, // Boolean (required) - Enable/disable Approve/Reject button on client portal
  "kycApprovalTarget": "DOWJONES", // String - KYC provider: "ACURIS" or "DOWJONES"
  "enabledRegistrationEmail": true, // Boolean - Enable/disable registration email to end-user
  "redirectUrl": "https://api.cashsouk.com/v1/kyc/callback" // String - URL redirected after onboarding completion
}
```

**Field Descriptions:**
- `formId`: Integer - The ID of the individual onboarding form. Settings are applied per `formId`.
- `livenessConfidence`: Integer (required) - Face match percentage threshold to pass face comparison. Default is 60.
- `approveMode`: Boolean (required) - If `true`, enables Approve/Reject button on the RegTank client portal.
- `kycApprovalTarget`: String - KYC provider for auto AML screening: `"ACURIS"` or `"DOWJONES"`.
- `enabledRegistrationEmail`: Boolean - If `true`, RegTank sends email to end-user on status changes.
- `redirectUrl`: String - **URL where users are redirected after completing onboarding**. This is the answer to the return URL mechanism.

**Response:**
```json
{
  "message": "Success"
}
```

**Important Notes:**
- ✅ **Return URL Mechanism Confirmed**: The `redirectUrl` field in this endpoint configures where users are redirected after completing onboarding.
- Settings are configured **per `formId`**, so you can have different redirect URLs for different onboarding forms.
- The `redirectUrl` applies to all onboarding requests that use the specified `formId`.
- This is a **one-time configuration** per `formId` - you don't need to set it for each onboarding request.

**Field Type Note:** The Postman collection shows string values (e.g., `"90"`, `"false"`), but the official API documentation specifies:
- `livenessConfidence`: Integer (not string)
- `approveMode`: Boolean (not string)
- `formId`: Integer (not string)

Use the types specified in the official documentation (Integer/Boolean) rather than the Postman examples (strings).

**Reference:** [RegTank API Documentation - Set Setting](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.7-individual-onboarding-endpoint-json-set-setting)

### 3. Get Onboarding Details (Polling)

**Endpoint:**

- Production: `GET https://shoraka-server.regtank.com/v3/onboarding/indv/query?requestId={requestId}`
- Sandbox: `GET https://shoraka-trial-server.regtank.com/v3/onboarding/indv/query?requestId={requestId}`

Or query by email:

- Production: `GET https://shoraka-server.regtank.com/v3/onboarding/indv/query?email={email}`
- Sandbox: `GET https://shoraka-trial-server.regtank.com/v3/onboarding/indv/query?email={email}`

**Response includes:**

```json
{
  "requestId": "abc123",
  "status": "APPROVED",
  "userProfile": {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-15",
    "nationality": "MY",
    "gender": "MALE",
    "governmentIdNumber": "A12345678",
    "referenceId": "cashsouk-user-123"
  },
  "documentInfo": {
    "countryCode": "MY",
    "documentType": "IDENTITY",
    "frontDocumentUrl": "https://...",
    "backDocumentUrl": "https://..."
  },
  "livenessCheckInfo": {
    "documentUrl": "https://...",
    "selfieUrl": "https://...",
    "verifyStatus": "LIVENESS_PASSED",
    "confidence": 98.5
  },
  "kycPositiveMatch": false,
  "requestDate": "2024-01-15T10:00:00",
  "verifyDate": "2024-01-15T10:15:00"
}
```

## Onboarding Status State Machine

```
URL_GENERATED ────────────> EMAIL_SENT (if email option used)
      │                          │
      └──────────────┬───────────┘
                     ▼
               PROCESSING
                     │
      ┌──────────────┼──────────────┐
      ▼              │              ▼
ID_UPLOADED_FAILED   │        ID_UPLOADED
(retry allowed)      │              │
                     │              ▼
                     │       LIVENESS_STARTED
                     │              │
                     │    ┌─────────┼─────────┐
                     │    ▼         │         ▼
                     │ CAMERA_FAILED│   LIVENESS_FAILED
                     │ (retry)      │   (may retry)
                     │              │
                     │              ▼
                     │       LIVENESS_PASSED
                     │              │
                     │              ▼
                     │      WAIT_FOR_APPROVAL
                     │              │
                     │    ┌─────────┴─────────┐
                     │    ▼                   ▼
                     │ APPROVED            REJECTED
                     │
                     ▼
                  EXPIRED (if URL not used in time)
```

### Status Definitions

| Status               | Description                                  |
| -------------------- | -------------------------------------------- |
| `URL_GENERATED`      | Onboarding link created, user hasn't started |
| `EMAIL_SENT`         | Email with link sent to user                 |
| `PROCESSING`         | User started but not complete                |
| `ID_UPLOADED`        | ID document successfully uploaded            |
| `ID_UPLOADED_FAILED` | ID failed quality/OCR check (user can retry) |
| `LIVENESS_STARTED`   | User clicked "I'm ready" for liveness        |
| `CAMERA_FAILED`      | Camera not available (user can retry)        |
| `LIVENESS_PASSED`    | Face match successful                        |
| `LIVENESS_FAILED`    | Face comparison failed                       |
| `WAIT_FOR_APPROVAL`  | Pending manual review                        |
| `APPROVED`           | Final approval                               |
| `REJECTED`           | Final rejection                              |
| `EXPIRED`            | Link expired                                 |

## Webhooks

### Configuration

Webhook URL is configured **once per environment** via the RegTank API or admin portal. This is a one-time setup, not something our application needs to call repeatedly.

**Endpoint (for manual setup if needed):**

- Production: `POST https://shoraka-server.regtank.com/alert/preferences`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/alert/preferences`

**Request:**

```json
{
  "webhookUrl": "https://api.cashsouk.com/v1/webhooks/regtank",
  "webhookEnabled": true
}
```

> **Note:** This is a one-time configuration per environment. Can also be set via the RegTank admin portal (shoraka.regtank.com or shoraka-trial.regtank.com).

### Individual Onboarding Webhook

**Your endpoint:** `POST {webhookUrl}/liveness`

RegTank appends `/liveness` to your webhook URL for individual onboarding notifications.

**Webhook Payload:**

```json
{
  "requestId": "abc123-unique-id",
  "status": "APPROVED",
  "timestamp": "2024-01-15T10:15:00+08:00",
  "exceedDeclinedLimit": false,
  "ocrResult": {
    "firstName": "John",
    "lastName": "Doe",
    "documentNumber": "A12345678"
  },
  "confidence": 98.5
}
```

**Fields:**

| Field                 | Type     | Description                              |
| --------------------- | -------- | ---------------------------------------- |
| `requestId`           | String   | RegTank's unique onboarding ID           |
| `status`              | String   | Current status (see status table)        |
| `timestamp`           | Datetime | When status changed                      |
| `exceedDeclinedLimit` | Boolean  | True if liveness failed 3+ times         |
| `ocrResult`           | Object   | OCR-extracted data (if liveness done)    |
| `confidence`          | Float    | Face match percentage (if liveness done) |

### Recommended Webhook Handling Strategy

**We receive webhooks at every status change**, but we don't need to act on all of them:

| Status                                                           | Action                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `URL_GENERATED`, `PROCESSING`, `ID_UPLOADED`, `LIVENESS_STARTED` | **Log only** - Update UI progress indicator if desired                         |
| `LIVENESS_PASSED`, `WAIT_FOR_APPROVAL`                           | **Log only** - User is progressing, await final status                         |
| `APPROVED`                                                       | **Pull full details** via Get Detail API, update user record, unlock features  |
| `REJECTED`                                                       | **Pull full details** to get rejection reason, update user record, notify user |
| `LIVENESS_FAILED`, `EXPIRED`                                     | **Update status** - User may need to retry                                     |

**Key insight:** Let the user complete the entire flow on RegTank's side. When we receive `APPROVED` or `REJECTED`, then call the Get Detail API to pull the complete verified profile data.

### Webhook Types

| Endpoint Suffix | Purpose                         |
| --------------- | ------------------------------- |
| `/liveness`     | Individual Onboarding (6.2.6)   |
| `/kyc`          | KYC screening results (6.2.1)   |
| `/kyb`          | Business Onboarding COD (6.2.3) |

## Admin Portal (RegTank Client Portal)

RegTank provides a web-based admin portal where CashSouk staff can view and manage onboarding records.

| Environment | Portal URL                        |
| ----------- | --------------------------------- |
| Production  | https://shoraka.regtank.com       |
| Sandbox     | https://shoraka-trial.regtank.com |

**Features:**

- View all onboarding submissions
- Review ID documents and liveness photos
- Approve or reject pending applications
- Configure onboarding settings
- View KYC screening results

> **Note:** Access credentials for the admin portal should be requested separately from RegTank.

## Admin Approval Flow (CashSouk Admin Portal)

After users complete their onboarding on RegTank's side, CashSouk admins must review and approve the applications. The approval flow differs between Personal (Individual) and Company onboarding.

### Two-Step RegTank Approval Process

On RegTank's side, there are **two approval steps** that must be completed in order:

1. **Onboarding Approval** - Review the submitted ID documents and liveness check results
2. **AML Approval** - Review the Anti-Money Laundering screening results

Both steps are performed in the RegTank admin portal.

### Personal Onboarding Flow (Investors)

Personal onboarding is simpler as it goes directly to RegTank for approval:

```
User completes onboarding on RegTank
           ↓
Status: WAIT_FOR_APPROVAL (appears in our admin queue)
           ↓
Admin opens RegTank Portal → Onboarding Approval
           ↓
Admin opens RegTank Portal → AML Approval
           ↓
Webhook received → User status updated to APPROVED
```

**Admin Steps:**

1. Review application details in CashSouk Admin Portal
2. Click "Open RegTank Portal" to access the RegTank admin interface
3. Search for the user by email in RegTank
4. Complete Onboarding Approval (review ID documents and liveness)
5. Complete AML Approval (review sanctions/watchlist screening)
6. Return to CashSouk - status updates automatically via webhook

### Company Onboarding Flow (Issuers)

Company onboarding has an **additional internal step** - SSM (Suruhanjaya Syarikat Malaysia) verification must be done on our side before proceeding to RegTank:

```
User completes onboarding on RegTank
           ↓
Status: PENDING_SSM_REVIEW (appears in our admin queue)
           ↓
Admin verifies company against SSM records (internal)
           ↓
SSM Approved → Status: SSM_APPROVED
           ↓
Admin opens RegTank Portal → Onboarding Approval
           ↓
Admin opens RegTank Portal → AML Approval
           ↓
Webhook received → User status updated to APPROVED
```

**Admin Steps:**

1. Review application and company details in CashSouk Admin Portal
2. **SSM Verification (Internal):**
   - Verify company name matches SSM records
   - Confirm SSM registration number is valid and active
   - Check business address matches registered address
   - Verify listed directors match SSM records
   - Approve or reject SSM verification
3. After SSM approval, click "Open RegTank Portal"
4. Complete Onboarding Approval in RegTank
5. Complete AML Approval in RegTank
6. Return to CashSouk - status updates automatically via webhook

### Internal Status Tracking

CashSouk tracks the following approval statuses:

| Status               | Description                                  | Applies To       |
| -------------------- | -------------------------------------------- | ---------------- |
| `PENDING_SSM_REVIEW` | Awaiting internal SSM verification           | Company only     |
| `SSM_APPROVED`       | SSM verified, awaiting RegTank onboarding    | Company only     |
| `PENDING_ONBOARDING` | Awaiting onboarding approval in RegTank      | Personal/Company |
| `PENDING_AML`        | Onboarding approved, awaiting AML in RegTank | Personal/Company |
| `APPROVED`           | Fully approved (all steps complete)          | Personal/Company |
| `REJECTED`           | Rejected at any step                         | Personal/Company |

### Admin Portal Page

The Onboarding Approval page is located at `/onboarding-approval` in the CashSouk Admin Portal and provides:

- **Unified Queue**: Single view of all pending applications (Investor + Issuer)
- **Filters**: Filter by portal (Investor/Issuer), type (Personal/Company), and status
- **Step-by-Step Guidance**: Visual progress stepper showing current step
- **SSM Verification Panel**: For company applications, displays company details and verification checklist
- **RegTank Portal Links**: Direct links to open RegTank in a new tab

### Key Implementation Notes

1. **Webhook-Driven Updates**: Status changes from RegTank are received via webhooks and automatically update our database
2. **SSM Verification is Internal**: This step is performed entirely within CashSouk before going to RegTank
3. **RegTank Portal Opens in New Tab**: Admin must search for the user by email in RegTank's interface
4. **Audit Trail**: All approval actions are logged for compliance purposes

## Business Onboarding (COD/EOD)

For company issuers, RegTank supports a two-tier process:

1. **COD (Company Onboarding Data)** - Company-level verification
2. **EOD (Entity Onboarding Data)** - Individual directors/shareholders verification

This is more complex and involves:

- Business registration documents
- Director liveness verification
- Ultimate beneficial owner identification

### 1. Create Business Onboarding Request

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/onboarding/corp/request`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/onboarding/corp/request`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json; charset=utf-8
```

**Request Body:**
```json
{
  "email": "test@regtank.com",
  "companyName": "Company A",
  "formName": "Business End User Onboarding Example Form1"
}
```

**Response:**
Returns a `requestId` and `verifyLink` similar to individual onboarding.

### 2. Query Company Onboarding Data (COD)

**Endpoint:**
- Production: `GET https://shoraka-server.regtank.com/v3/onboarding/corp/query?requestId={requestId}`
- Sandbox: `GET https://shoraka-trial-server.regtank.com/v3/onboarding/corp/query?requestId={requestId}`

**Query Parameters:**
- `requestId`: Required - The COD request ID

**Response:** Returns company-level onboarding details including company information, documents, and status.

### 3. Query Entity Onboarding Data (EOD)

**Endpoint:**
- Production: `GET https://shoraka-server.regtank.com/v3/onboarding/corp/indv/query?requestId={requestId}`
- Sandbox: `GET https://shoraka-trial-server.regtank.com/v3/onboarding/corp/indv/query?requestId={requestId}`

**Query Parameters:**
- `requestId`: Required - The EOD request ID (for individual directors/shareholders)

**Response:** Returns individual entity (director/shareholder) onboarding details including:
- Corporate individual request info
- Corporate user request info (with form content)
- Corporate document info
- Corporate liveness check info
- KYC request info

**Note:** The EOD query response includes detailed form content with field aliases, field names, field types, and field values for each director/shareholder.

## KYC (Know Your Customer) Screening

RegTank supports two KYC providers: **Acuris** and **Dow Jones**. Each has separate endpoints.

### Acuris KYC

#### 1. Acuris KYC Request

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/kyc/input`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/kyc/input`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json; charset=utf-8
```

**Request Body:**
```json
{
  "surname": "Smith",
  "middleName": "Rob",
  "forename": "John",
  "gender": "MALE",
  "enableReScreening": false,
  "enableOnGoingMonitoring": false,
  "dateOfBirth": "1972-01-23",
  "assignee": "isaac@regtank.com",
  "address1": "23 Broad St",
  "address2": "San Francisco",
  "countryOfResidence": "US",
  "email": "john.smith@mail.com",
  "governmentIdNumber": "EN-05-10092",
  "idIssuingCountry": "US",
  "nationality": "SG",
  "phone": "85640976",
  "placeOfBirth": "SG",
  "referenceId": "id82937184",
  "yearOfBirth": 1972
}
```

**Response:** Returns a `requestId` for tracking the KYC screening.

#### 2. Acuris KYC Query Status

**Endpoint:**
- Production: `GET https://shoraka-server.regtank.com/v3/kyc/query?requestId={requestId}&referenceId={referenceId}`
- Sandbox: `GET https://shoraka-trial-server.regtank.com/v3/kyc/query?requestId={requestId}&referenceId={referenceId}`

**Query Parameters:**
- `requestId`: Required - The KYC request ID
- `referenceId`: Optional - Your internal reference ID

#### 3. Acuris KYC Generate Score

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/kyc/scoring`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/kyc/scoring`

**Request Body:**
```json
{
  "requestId": "KYC01911"
}
```

#### 4. Acuris KYC Ongoing Monitoring

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/kyc/ongoing-monitoring`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/kyc/ongoing-monitoring`

**Request Body:**
```json
{
  "requestId": "KYC01911",
  "enabled": true
}
```

### Dow Jones KYC

Dow Jones KYC uses the same endpoint structure but with `/djkyc/` prefix instead of `/kyc/`:

- `POST /v3/djkyc/input` - Dow Jones KYC Request
- `GET /v3/djkyc/query?requestId={requestId}&referenceId={referenceId}` - Dow Jones KYC Query Status
- `POST /v3/djkyc/scoring` - Dow Jones KYC Generate Score
- `POST /v3/djkyc/ongoing-monitoring` - Dow Jones KYC Ongoing Monitoring

**Request/Response formats are similar to Acuris KYC**, but may have additional fields like:
- `profileNotes`: Boolean
- `occupationTitle`: Boolean
- `strictDateMatch`: Boolean
- `industry`: String (e.g., "ACCOMMODATION_AND_FOOD_SERVICES")
- `occupation`: String (e.g., "CHIEF_EXECUTIVES_SENIOR_OFFICIALS_AND_LEGISLATORS")
- `tags`: Array of strings

## KYB (Know Your Business) Screening

RegTank supports two KYB providers: **Acuris** and **Dow Jones**. Each has separate endpoints.

### Acuris KYB

#### 1. Acuris KYB Request

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/kyb/input`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/kyb/input`

**Request Body:**
```json
{
  "businessName": "Apple",
  "businessIdNumber": "12345ABCD",
  "address1": "23 Broad St",
  "address2": "San Francisco",
  "sizeOfTheCompany": "FROM_500_AND_MORE",
  "email": "apple@mail.com",
  "phone": "62739201",
  "website": "apple.com",
  "referenceId": "id62726482",
  "natureOfBusiness": "COMPUTER_SOFTWARE_ENGINEERING",
  "companyType": "CORPORATION",
  "countryOfIncorporation": "US",
  "countryOfHeadQuarter": "US",
  "dateOfIncorporation": "2021-01-01",
  "assignee": "quanlei@regtank.com",
  "enableReScreening": true,
  "enableOnGoingMonitoring": true,
  "operatingCountry": "US",
  "tags": []
}
```

#### 2. Acuris KYB Query Status

**Endpoint:**
- Production: `GET https://shoraka-server.regtank.com/v3/kyb/query?requestId={requestId}&referenceId={referenceId}`
- Sandbox: `GET https://shoraka-trial-server.regtank.com/v3/kyb/query?requestId={requestId}&referenceId={referenceId}`

#### 3. Acuris KYB Complete Resolution

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/kyb/complete-resolution`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/kyb/complete-resolution`

**Request Body:**
```json
{
  "requestId": "KYB00200"
}
```

#### 4. Acuris KYB Generate Score

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/kyb/scoring`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/kyb/scoring`

#### 5. Acuris KYB Ongoing Monitoring

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/kyb/ongoing-monitoring`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/kyb/ongoing-monitoring`

### Dow Jones KYB

Dow Jones KYB uses the same endpoint structure but with `/djkyb/` prefix instead of `/kyb/`:

- `POST /v3/djkyb/input` - Dow Jones KYB Request
- `GET /v3/djkyb/query?requestId={requestId}&referenceId={referenceId}` - Dow Jones KYB Query Status
- `POST /v3/djkyb/complete-resolution` - Dow Jones KYB Complete Resolution
- `POST /v3/djkyb/scoring` - Dow Jones KYB Generate Score
- `POST /v3/djkyb/ongoing-monitoring` - Dow Jones KYB Ongoing Monitoring

**Note:** Dow Jones KYB request may include an additional `relationship` field (e.g., "Partner").

## KYT (Know Your Transaction) Monitoring

### 1. KYT Request

**Endpoint:**
- Production: `POST https://shoraka-server.regtank.com/v3/kyt/input`
- Sandbox: `POST https://shoraka-trial-server.regtank.com/v3/kyt/input`

**Request Body:**
```json
{
  "address": "3Pv7L9EeYyAMcn7U3tTWyKWxFpVJHfQBTa",
  "asset": "BTC",
  "referenceId": "id00000001",
  "assignee": "quanlei@regtank.com",
  "riskScoreChange": true,
  "newTransaction": true
}
```

### 2. KYT Query Status

**Endpoint:**
- Production: `GET https://shoraka-server.regtank.com/v3/kyt/query?requestId={requestId}&referenceId={referenceId}`
- Sandbox: `GET https://shoraka-trial-server.regtank.com/v3/kyt/query?requestId={requestId}&referenceId={referenceId}`

**Query Parameters:**
- `requestId`: Required - The KYT request ID
- `referenceId`: Optional - Your internal reference ID

## Implementation Checklist

### Backend (`apps/api`)

- [ ] **RegTank Service** (`src/modules/kyc/regtank.service.ts`)
  - OAuth token management (with caching/refresh)
  - Create individual onboarding request
  - Query onboarding status
  - Create business onboarding request

- [ ] **Webhook Controller** (`src/modules/kyc/webhook.controller.ts`)
  - `POST /v1/webhooks/regtank/liveness` - Individual onboarding
  - `POST /v1/webhooks/regtank/kyc` - KYC screening
  - `POST /v1/webhooks/regtank/kyb` - Business onboarding
  - Verify webhook authenticity (ask RegTank about signature)
  - Idempotency handling

- [ ] **KYC Controller** (`src/modules/kyc/kyc.controller.ts`)
  - `POST /v1/kyc/start` - Initiate onboarding (choose Personal/Company), authenticate with RegTank OAuth, create onboarding request, return verifyLink
  - `GET /v1/kyc/status` - Check current status
  - Handle return from RegTank (redirect callback after completion)

- [ ] **Database**
  - Store `regtankRequestId` on user record
  - Store `kycStatus` enum
  - Store extracted profile data from RegTank

- [ ] **Environment Variables** (all loaded at runtime from AWS Secrets Manager)

  ```bash
  # Required variables (stored in Secrets Manager, injected at container start)
  REGTANK_OAUTH_URL          # OAuth token endpoint
  REGTANK_API_URL            # API server (environment-specific)
  REGTANK_ONBOARDING_PROXY_URL  # Onboarding proxy (environment-specific)
  REGTANK_CLIENT_ID          # OAuth client ID
  REGTANK_CLIENT_SECRET      # OAuth client secret
  ```

  **AWS Secrets Manager Structure:**

  ```
  cashsouk/prod/regtank     → Production credentials & URLs
  cashsouk/staging/regtank  → Sandbox credentials & URLs
  ```

  **ECS Task Definition Example:**

  ```json
  {
    "secrets": [
      {
        "name": "REGTANK_API_URL",
        "valueFrom": "arn:aws:secretsmanager:ap-southeast-5:ACCOUNT:secret:cashsouk/prod/regtank:API_URL::"
      },
      {
        "name": "REGTANK_CLIENT_ID",
        "valueFrom": "arn:aws:secretsmanager:ap-southeast-5:ACCOUNT:secret:cashsouk/prod/regtank:CLIENT_ID::"
      }
    ]
  }
  ```

  > **Note:** All RegTank configuration is loaded at **runtime** from AWS Secrets Manager, not baked in at build time. This allows credential rotation and environment switching without rebuilding Docker images.

### Frontend (Investor/Issuer Portals)

- [ ] **KYC Status Component**
  - Show current verification status
  - Display pending/approved/rejected states
  - Show extracted profile data after approval

- [ ] **Start KYC Flow**
  - Button to initiate verification
  - User selects **Personal** or **Company** onboarding type
  - Backend handles OAuth authentication with RegTank
  - Backend creates onboarding request with user's firstName/lastName
  - Redirect to RegTank verifyLink
  - Handle return from RegTank (redirect callback)

- [ ] **KYC Required Guard**
  - Block certain actions until KYC approved
  - Show appropriate messaging

### Admin Portal (`apps/admin`)

- [x] **Onboarding Approval Page** (`app/onboarding-approval/page.tsx`)
  - Unified queue showing all pending applications
  - Filters for portal (Investor/Issuer), type (Personal/Company), status
  - Search by name, email, or company registration number

- [x] **Onboarding Queue Table** (`components/onboarding-queue-table.tsx`)
  - Table displaying applications with status badges
  - Pagination support

- [x] **Onboarding Review Dialog** (`components/onboarding-review-dialog.tsx`)
  - Step-by-step approval guidance
  - Different flows for Personal vs Company applications
  - Links to RegTank portal for external approval steps

- [x] **SSM Verification Panel** (`components/ssm-verification-panel.tsx`)
  - Display company details for verification
  - Verification checklist
  - Approve/Reject actions for internal SSM step

- [x] **Approval Progress Stepper** (`components/approval-progress-stepper.tsx`)
  - Visual indicator of current approval step
  - Different step configurations for Personal vs Company

- [ ] **Backend Integration** (pending)
  - Connect to actual API endpoints
  - Real-time status updates via webhooks
  - SSM verification persistence

### Database Schema Addition

```prisma
model User {
  // ... existing fields

  // KYC Fields
  kycStatus           KycStatus @default(NOT_STARTED)
  regtankRequestId    String?   @unique
  kycSubmittedAt      DateTime?
  kycApprovedAt       DateTime?
  kycRejectionReason  String?

  // Verified profile data (from RegTank)
  verifiedFirstName   String?
  verifiedLastName    String?
  verifiedDob         DateTime?
  verifiedNationality String?
  verifiedIdNumber    String?
  verifiedIdType      String?
  livenessConfidence  Float?
}

enum KycStatus {
  NOT_STARTED
  URL_GENERATED
  IN_PROGRESS
  LIVENESS_PASSED
  PENDING_APPROVAL
  APPROVED
  REJECTED
  FAILED
  EXPIRED
}
```

## Open Questions for RegTank

### Critical (Blockers)

1. ~~**Webhook Security**: Do you send any signature/HMAC header for webhook verification? If so, what's the algorithm and which secret do we use?~~ ✅ **ANSWERED**

   **Answer:** RegTank will use **HMAC-SHA256 signature** for webhook verification.
   
   **Implementation Details:**
   - **Algorithm:** HMAC-SHA256
   - **Header Name:** `X-RegTank-Signature` (to be confirmed with RegTank)
   - **Header Format:** `X-RegTank-Signature: sha256=<signature>` or `X-RegTank-Signature: <signature>` (exact format to be confirmed)
   - **Secret:** Shared secret key provided by RegTank (stored in AWS Secrets Manager)
   - **Verification Process:**
     1. RegTank computes HMAC-SHA256 of the raw request body using the shared secret
     2. RegTank includes the signature in the `X-RegTank-Signature` header
     3. Our webhook endpoint receives the request and extracts the signature from the header
     4. We compute HMAC-SHA256 of the received request body using our stored secret
     5. We compare our computed signature with the received signature
     6. If signatures match, process the webhook; if not, reject with 401 Unauthorized
   
   **Implementation Requirements:**
   - Webhook endpoint must verify signature **before** processing the payload
   - Use raw request body for signature computation (not parsed JSON)
   - Store webhook secret in AWS Secrets Manager at `cashsouk/prod/regtank` and `cashsouk/staging/regtank`
   - Implement idempotency using `requestId` to prevent duplicate processing
   - Log all webhook attempts (successful and failed) for audit trail
   - Return appropriate HTTP status codes:
     - `200 OK` - Webhook processed successfully
     - `401 Unauthorized` - Invalid signature
     - `500 Internal Server Error` - Processing error (retry may be attempted)
   
   **Example Verification Code (Node.js/TypeScript):**
   ```typescript
   import crypto from 'crypto';
   
   function verifyWebhookSignature(
     rawBody: string,
     receivedSignature: string,
     secret: string
   ): boolean {
     const computedSignature = crypto
       .createHmac('sha256', secret)
       .update(rawBody)
       .digest('hex');
     
     // Use constant-time comparison to prevent timing attacks
     return crypto.timingSafeEqual(
       Buffer.from(computedSignature),
       Buffer.from(receivedSignature)
     );
   }
   ```
   
   **Note:** Exact header name and signature format (hex/base64) to be confirmed with RegTank during webhook implementation.

2. ~~**Sandbox Environment**: Is there a sandbox/staging environment for testing? Are credentials different for sandbox vs production?~~ ✅ **ANSWERED** - Yes, sandbox provided with separate credentials (see Environment Configuration above)

3. ~~**Client Portal URL**: What is the exact base URL for API calls? Is it different per client?~~ ✅ **ANSWERED** - Yes, it's `shoraka-server.regtank.com` for production and `shoraka-trial-server.regtank.com` for sandbox

4. **referenceId in Webhook**: Is the `referenceId` we pass during onboarding request included in webhook payloads? The docs show `requestId` but not `referenceId`. We need this to match webhooks to our users.
   
   **Finding from Postman Collection:** `referenceId` is extensively used in query endpoints:
   - KYC Query: `GET /v3/kyc/query?requestId={requestId}&referenceId={referenceId}`
   - KYB Query: `GET /v3/kyb/query?requestId={requestId}&referenceId={referenceId}`
   - KYT Query: `GET /v3/kyt/query?requestId={requestId}&referenceId={referenceId}`
   
   This suggests `referenceId` is a first-class identifier that should be included in webhook payloads, but this needs confirmation from RegTank.

### Important

5. ~~**URL Expiration**: Default is 24 hours - can this be configured? Can users resume an expired session?~~ ✅ **ANSWERED**

   **Answer:** URL expiration is currently set to **24 hours** and cannot be configured. This is the default retention period for onboarding links.
   
   **Note:** If a user's session expires, they would need to restart the onboarding process (use the Restart endpoint if available).

6. ~~**Retry Behavior**: If a user fails liveness, can they retry indefinitely or is there a limit? (`exceedDeclinedLimit` suggests 3 times)~~ ✅ **ANSWERED**

   **Answer:** Users can retry liveness check **up to 3 times maximum**. After 3 failed attempts, the `exceedDeclinedLimit` flag will be set to `true` in webhook payloads.

7. ~~**Return URL**: ⚠️ **CRITICAL** - How do users get redirected back to our portal after completing or abandoning the KYC flow?~~ ✅ **ANSWERED**

   **Answer:** The `redirectUrl` is configured via the **Set Onboarding Settings** endpoint (`POST /v3/onboarding/indv/setting`). 
   
   **Key Points:**
   - `redirectUrl` is a String field in the settings request body
   - Settings are configured **per `formId`** - each onboarding form can have its own redirect URL
   - The redirect URL applies to all onboarding requests that use the specified `formId`
   - This is a **one-time configuration** per `formId`, not per onboarding request
   
   **Reference:** [RegTank API Documentation - Set Setting](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.7-individual-onboarding-endpoint-json-set-setting)
   
   **Additional Answers:**
   - **7a. Abandonment:** Redirect will still occur if RegTank can find back the user's data on their side. This means if a user abandons the flow mid-way but RegTank has their session data, they can still be redirected back.
   - **7b. Query Parameters:** According to the [official documentation](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.7-individual-onboarding-endpoint-json-set-setting), `redirectUrl` is a String field, so you can include query parameters in the URL (e.g., `https://api.cashsouk.com/v1/kyc/callback?userId=123&token=abc`).
   - **7c. Automatic Redirect:** Once onboarding is completed, RegTank automatically calls the `redirectUrl` - no user button click required.

8. ~~**Embedding**: Can we embed the onboarding flow in an iframe, or must we redirect? Are there X-Frame-Options restrictions?~~ ✅ **ANSWERED**

   **Answer:** Iframe embedding is **NOT allowed**. The Postman collection shows that API responses include the header `X-Frame-Options: DENY`, which prevents the onboarding flow from being embedded in an iframe.
   
   **Conclusion:** You **must redirect** users to RegTank's hosted onboarding flow. The `verifyLink` returned from the onboarding request should be opened in a new window/tab or redirect the current page, not embedded in an iframe.

9. **Rate Limits**: What are the API rate limits?

   **Finding from Postman Collection:** No explicit rate limit information found in the collection. However, the official API documentation mentions HTTP 429 "Too Many Requests" errors, indicating rate limiting exists.
   
   **Still need clarification:**
   - What are the specific rate limits (requests per minute/hour)?
   - Do different endpoints have different rate limits?
   - Are rate limits per API key or per IP address?

10. ~~**Data Retention**: How long is onboarding data retained on RegTank's side?~~ ✅ **ANSWERED**

   **Answer:** Onboarding data retention is set to **24 hours** (same as URL expiration period). This is the confirmed retention period for onboarding sessions and data on RegTank's servers.
   
   **Important Notes:**
   - RegTank retains onboarding session data (ID documents, liveness videos, form submissions) for **24 hours**
   - After 24 hours, the data may be archived or deleted depending on RegTank's data retention policy
   - **For long-term storage:** We must pull and store verified user data in our own database via the Get Detail API when we receive `APPROVED` webhooks
   - Do not rely on RegTank's 24-hour retention for data retrieval - always store verified data immediately upon approval
   
   **Implementation Recommendation:**
   - When receiving `APPROVED` webhook, immediately call Get Detail API to retrieve full verified profile
   - Store all verified data in our database (see Database Schema Addition section)
   - Store document URLs if needed (note: these may expire after 24 hours)

### Nice to Have

11. ~~**SDK/Widget**: Is there a JavaScript SDK for inline embedding?~~ ✅ **ANSWERED**

   **Answer:** No, there is no JavaScript SDK or widget for RegTank. All onboarding and approval processes are handled entirely within the RegTank portal. Users must be redirected to RegTank's hosted onboarding flow.

12. ~~**Customization**: Can we customize the onboarding UI (branding, colors, logo)?~~ ✅ **ANSWERED**

   **Answer:** The onboarding UI customization is handled on CashSouk's side at `admin.cashsouk.com/onboarding-approval` (our admin portal for reviewing applications). The actual RegTank onboarding flow (where users complete ID upload and liveness) cannot be customized - it uses RegTank's standard UI.
   
   **Note:** This means:
   - RegTank's onboarding flow (ID upload, liveness check) uses their standard UI
   - Our admin portal (`admin.cashsouk.com/onboarding-approval`) can be customized for our internal review process
   - The RegTank client portal (where admins approve) also uses RegTank's standard UI

13. ~~**Languages**: What UI languages are supported? (Docs mention EN, ZH_CN, etc.)~~ ✅ **PARTIALLY ANSWERED**

   **Answer from Postman Collection:**
   - **English (EN)** is confirmed - Postman collection shows `"language": "EN"` in onboarding requests
   - **Chinese** is confirmed - Corporate onboarding response shows Chinese field aliases (名, 中间名, 姓, 邮箱, 性别, etc.)
   - Multi-language support exists - Form content can display field aliases in different languages
   
   **Still need clarification:**
   - What are all the supported language codes? (e.g., EN, ZH_CN, ZH_TW, etc.)
   - Can language be changed per onboarding request, or is it set globally?
   - Are all UI elements translated, or only form fields?

14. **IP Whitelist**: Is there an IP whitelist for API access or webhook delivery?

15. ~~**Approval Flow**: Is `WAIT_FOR_APPROVAL` reviewed by RegTank staff, or can we approve via API?~~ ✅ **ANSWERED**

   **Answer:** Onboarding approvals can **only be reviewed by RegTank staff** at their portal. There is no API endpoint for programmatic approval. 
   
   **Approval Process:**
   - When status reaches `WAIT_FOR_APPROVAL`, the application appears in the RegTank client portal
   - CashSouk admins must log into the RegTank portal (e.g., `shoraka.regtank.com` or `shoraka-trial.regtank.com`)
   - Admins review and approve/reject applications in the RegTank portal
   - Status updates are sent back to CashSouk via webhooks
   
   **Note:** This is a manual approval process - there is no API endpoint to approve/reject onboarding requests programmatically.

## References

- [RegTank API Documentation](https://regtank.gitbook.io/regtank-api-docs)
- [Authentication](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/1.-authentication)
- [Onboarding](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding)
- [Webhooks](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook)
- [Status Definitions](https://regtank.gitbook.io/regtank-api-docs/reference/appendix/appendix-g-list-of-the-digital-onboarding-progress-status)
