# RegTank KYC Integration Guide

This document summarizes our understanding of the RegTank API for KYC/KYB onboarding integration with CashSouk.

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
3. **Create Onboarding Request**: Backend calls RegTank API to create onboarding session, parsing and sending:
   - User's `firstName` and `lastName` (parsed from our user database fields `first_name` and `last_name`)
   - Webhook URL for status updates (configured/sent during request creation)
   - `referenceId` (our internal user ID) for webhook matching
4. **Get Verify Link**: RegTank returns a `verifyLink` URL
5. **Redirect to RegTank**: User is redirected to RegTank's hosted onboarding flow (no login required)
6. **Complete KYC**: User completes entire onboarding flow on RegTank's side (ID upload + liveness check)
7. **Progress Webhooks**: We receive progress webhooks for status changes (for monitoring/logging only)
8. **Final Status**: When we receive `APPROVED` or `REJECTED` webhook, we call Get Detail API to pull the full verified profile
9. **Redirect Back**: User is redirected back to our portal (return URL mechanism - see Open Questions #7)
10. **Update Database**: Update our database with verified user data from RegTank
11. **Show Status**: Display verified status to user in our application

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
3. **Create Onboarding Request**: Backend calls RegTank API to create onboarding session, parsing and sending:
   - User's `firstName` and `lastName` (parsed from our user database fields `first_name` and `last_name`)
   - Webhook URL for status updates (configured/sent during onboarding request creation)
   - `referenceId` (our internal user ID) for webhook matching
4. **Redirect to RegTank**: User is redirected to RegTank's `verifyLink` (no login required)
5. **Complete KYC**: User completes entire onboarding flow on RegTank's side (ID upload + liveness check)
6. **Webhook Updates**: We receive webhook notifications for status changes (progress updates logged, final status triggers action)
7. **Redirect Back**: User is redirected back to our portal (return URL mechanism - **needs clarification from RegTank** - see Open Questions #7)
8. **Update Database**: When `APPROVED` or `REJECTED` webhook received, we pull full details via Get Detail API and update user record

## Individual Onboarding Flow

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
  "dateOfBirth": 631152000000, // Epoch milliseconds
  "gender": "MALE", // MALE, FEMALE, UNSPECIFIED
  "governmentIdNumber": "123456789",
  "idType": "IDENTITY", // PASSPORT, IDENTITY, DRIVER_LICENSE, RESIDENCE_PERMIT
  "language": "EN", // UI language
  "bypassIdUpload": false, // If true, skip ID upload step
  "address": "123 Main St",
  "industry": "FINANCE", // See Appendix B
  "occupation": "PROFESSIONAL", // See Appendix C
  "tags": ["investor", "tier1"]
}
```

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
- `expiredIn` - Link expires in 24 hours by default

### 2. User Completes Onboarding

User visits `verifyLink` and:

1. Selects ID document type and country
2. Uploads or captures ID document (front + back if applicable)
3. Performs liveness check (video selfie)
4. System compares face on ID with selfie
5. Document undergoes IDV (authenticity check)
6. If enabled, KYC screening runs against sanctions databases

**After completion:** User should be redirected back to our portal (return URL mechanism - see Open Questions #7)

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

_Endpoint details: See sections 2.8-2.10 in RegTank docs_

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

1. **Webhook Security**: Do you send any signature/HMAC header for webhook verification? If so, what's the algorithm and which secret do we use?

2. ~~**Sandbox Environment**: Is there a sandbox/staging environment for testing? Are credentials different for sandbox vs production?~~ ✅ **ANSWERED** - Yes, sandbox provided with separate credentials (see Environment Configuration above)

3. ~~**Client Portal URL**: What is the exact base URL for API calls? Is it different per client?~~ ✅ **ANSWERED** - Yes, it's `shoraka-server.regtank.com` for production and `shoraka-trial-server.regtank.com` for sandbox

4. **referenceId in Webhook**: Is the `referenceId` we pass during onboarding request included in webhook payloads? The docs show `requestId` but not `referenceId`. We need this to match webhooks to our users.

### Important

5. **URL Expiration**: Default is 24 hours - can this be configured? Can users resume an expired session?

6. **Retry Behavior**: If a user fails liveness, can they retry indefinitely or is there a limit? (`exceedDeclinedLimit` suggests 3 times)

7. **Return URL**: ⚠️ **CRITICAL** - How do users get redirected back to our portal after completing or abandoning the KYC flow? We need to understand the redirect mechanism:
   - **Option A**: Is it a query parameter in the `verifyLink`? (e.g., `verifyLink?returnUrl=https://oursite.com/kyc/callback`)
   - **Option B**: Is it a field in the onboarding request body when creating the request? (e.g., `{"returnUrl": "https://oursite.com/kyc/callback", ...}`)
   - **Option C**: Is it configured globally in the RegTank admin portal per environment?
   - **Option D**: Is there another mechanism? (Please specify)
   - **Additional questions**:
     - What happens if user abandons the flow mid-way?
     - Can we pass custom parameters in the return URL (e.g., user ID, session token)?
     - Is the redirect automatic or does user need to click a button?

8. **Embedding**: Can we embed the onboarding flow in an iframe, or must we redirect? Are there X-Frame-Options restrictions?

9. **Rate Limits**: What are the API rate limits?

10. **Data Retention**: How long is onboarding data retained on RegTank's side?

### Nice to Have

11. **SDK/Widget**: Is there a JavaScript SDK for inline embedding?

12. **Customization**: Can we customize the onboarding UI (branding, colors, logo)?

13. **Languages**: What UI languages are supported? (Docs mention EN, ZH_CN, etc.)

14. **IP Whitelist**: Is there an IP whitelist for API access or webhook delivery?

15. **Approval Flow**: Is `WAIT_FOR_APPROVAL` reviewed by RegTank staff, or can we approve via API?

## References

- [RegTank API Documentation](https://regtank.gitbook.io/regtank-api-docs)
- [Authentication](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/1.-authentication)
- [Onboarding](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding)
- [Webhooks](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook)
- [Status Definitions](https://regtank.gitbook.io/regtank-api-docs/reference/appendix/appendix-g-list-of-the-digital-onboarding-progress-status)
