# RegTank KYC Integration Guide

This document summarizes our understanding of the RegTank API for KYC/KYB onboarding integration with CashSouk.

## Quick Start (Testing with Postman)

RegTank has provided Postman collection files. To test immediately:

1. Import the provided JSON files into Postman
2. Use these sandbox settings:
   - OAuth URL: `https://crm-server.regtank.com`
   - API URL: `https://shoraka-trial-server.regtank.com`
   - Client ID & Secret: See AWS Secrets Manager or contact team lead
3. Try the manual onboarding flow: https://shoraka-trial-onboarding.regtank.com/BaseInfo/emailVerify
4. View results in admin portal: https://shoraka-trial.regtank.com

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
         │──────────────────────>│                       │
         │                       │ 2. Create onboarding  │
         │                       │──────────────────────>│
         │                       │ 3. Return verifyLink  │
         │                       │<──────────────────────│
         │ 4. Redirect to URL    │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 5. User completes     │                       │
         │    entire flow        ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
         │    (ID + liveness)    │                       │
         │                       │                       │
         │                       │ 6. Webhooks: progress │
         │                       │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│ (log only)
         │                       │                       │
         │                       │ 7. Webhook: APPROVED  │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 8. Get full details   │
         │                       │──────────────────────>│
         │                       │<──────────────────────│
         │                       │                       │
         │ 9. Show verified      │                       │
         │<──────────────────────│                       │
```

**Flow Summary:**

1. User initiates KYC from our portal
2. We create onboarding session via RegTank API, get a `verifyLink`
3. User is redirected to RegTank's hosted onboarding flow
4. User completes ID upload + liveness check entirely on RegTank's side
5. We receive progress webhooks (for monitoring/logging only)
6. When we receive `APPROVED` or `REJECTED` webhook, we call Get Detail API to pull the full verified profile
7. Update our database with verified user data

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

> **Note:** OAuth URL (`crm-server.regtank.com`) is the same for both environments. The API server URL differs.

## Authentication

RegTank uses OAuth2 client credentials flow.

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

**Notes:**

- Token expires in ~1 hour
- Use `Authorization: Bearer <access_token>` header for subsequent requests
- Client credentials must be kept secret (store in SSM/Secrets Manager)
- Same OAuth server for both environments; credentials differ

## Individual Onboarding Flow

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
  "surname": "Doe", // Required - last name
  "forename": "John", // Required - first name
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
  - `POST /v1/kyc/start` - Initiate onboarding, return verifyLink
  - `GET /v1/kyc/status` - Check current status

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
  - Redirect to RegTank verifyLink
  - Handle return from RegTank

- [ ] **KYC Required Guard**
  - Block certain actions until KYC approved
  - Show appropriate messaging

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

7. **Return URL**: Can we configure a URL to redirect users back to our portal after completing/abandoning the flow?

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
