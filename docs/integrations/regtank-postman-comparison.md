# RegTank Postman Collection vs Documentation Comparison

## Summary of Findings

After comparing the Postman collection with the existing documentation, here are the key findings:

## ✅ Aligned Areas

### 1. OAuth Authentication
- **Postman**: `POST {{regtankCrmServerURL}}/oauth/token` with form-data
- **Documentation**: `POST https://crm-server.regtank.com/oauth/token` with multipart/form-data
- **Status**: ✅ **ALIGNED** - Both use form-data with `grant_type`, `client_id`, `client_secret`

### 2. Individual Onboarding Request Endpoint
- **Postman**: `POST https://{{companySpecificRegtankServerURL}}/v3/onboarding/indv/request`
- **Documentation**: `POST https://shoraka-trial-server.regtank.com/v3/onboarding/indv/request`
- **Status**: ✅ **ALIGNED** - Same endpoint structure

### 3. Individual Onboarding Query Endpoint
- **Postman**: `GET https://{{companySpecificRegtankServerURL}}/v3/onboarding/indv/query?requestId=LD01752`
- **Documentation**: `GET https://shoraka-trial-server.regtank.com/v3/onboarding/indv/query?requestId={requestId}`
- **Status**: ✅ **ALIGNED** - Same endpoint structure

### 4. Webhook Configuration
- **Postman**: `POST https://{{companySpecificRegtankServerURL}}/alert/preferences`
- **Documentation**: `POST https://shoraka-trial-server.regtank.com/alert/preferences`
- **Status**: ✅ **ALIGNED** - Same endpoint

## ⚠️ Discrepancies Found

### 1. Individual Onboarding Request - Field Names & Types

**Documentation shows:**
```json
{
  "dateOfBirth": 631152000000,  // Epoch milliseconds
  "bypassIdUpload": false,      // Boolean
  "proofOfAddress": {            // NOT in documentation
    "fileName": "proofOfAddress.pdf",
    "fileContent": "data:image/jpeg;base64,/9j.."
  }
}
```

**Postman Collection shows:**
```json
{
  "dateOfBirth": "1977-01-01",  // String (ISO date format)
  "yearOfBirth": "1977",         // String - NOT in documentation
  "bypassIdUpload": "FALSE",     // String "FALSE" not boolean false
  "proofOfAddress": {            // Present in Postman, missing in docs
    "fileName": "proofOfAddress.pdf",
    "fileContent": "data:image/jpeg;base64,/9j.."
  },
  "walletAddress": "KwmgX4oEAZRLDLaVBv6VbV2S8PiyYv23mctbqHdP6GjQAcDvZUNg"  // NOT in docs
}
```

**Issues:**
- ❌ `dateOfBirth` format differs: Documentation says epoch milliseconds, Postman uses ISO date string
- ❌ `yearOfBirth` field exists in Postman but not documented
- ❌ `bypassIdUpload` type differs: Documentation says boolean, Postman uses string "FALSE"/"TRUE"
- ❌ `proofOfAddress` exists in Postman but not documented
- ❌ `walletAddress` exists in Postman but not documented

### 2. Individual Onboarding - Additional Endpoints in Postman

**Postman has these endpoints NOT documented:**

1. **Onboarding ID Document Upload**
   - `POST /v3/onboarding/indv/document-upload`
   - Allows separate document upload after initial request
   - **Status**: ⚠️ **MISSING FROM DOCS** - Should be documented

2. **Onboarding Check (Liveness)**
   - `POST /v3/onboarding/indv/liveness-check`
   - Form-data with `requestId`, `token`, and `video` file
   - **Status**: ⚠️ **MISSING FROM DOCS** - Should be documented

3. **Onboarding Restart**
   - `POST /v3/onboarding/indv/restart`
   - Allows restarting a failed onboarding
   - **Status**: ⚠️ **MISSING FROM DOCS** - Should be documented

4. **Onboarding Get Setting**
   - `GET /v3/onboarding/indv/setting/query?formId=12306`
   - Retrieves onboarding form settings
   - **Status**: ⚠️ **MISSING FROM DOCS** - Should be documented

5. **Onboarding Set Setting**
   - `POST /v3/onboarding/indv/setting`
   - Configures onboarding settings (livenessConfidence, approveMode, etc.)
   - **Status**: ⚠️ **MISSING FROM DOCS** - Should be documented

### 3. Corporate Onboarding - URL Issue

**Postman Collection:**
- Line 456: `"raw": "https:///{{companySpecificRegtankServerURL}}/v3/onboarding/corp/request"`
- **Issue**: ❌ **TYPOS** - Triple slash `https:///` instead of `https://`

**Postman Collection:**
- Line 169: `"raw": "https:///{{companySpecificRegtankServerURL}}/v3/onboarding/indv/liveness-check"`
- **Issue**: ❌ **TYPOS** - Triple slash `https:///` instead of `https://`

### 4. Corporate Onboarding - Endpoints

**Postman has:**
1. `POST /v3/onboarding/corp/request` - Business onboarding request
2. `GET /v3/onboarding/corp/query?requestId=COD00502` - Query COD (Company Onboarding Data)
3. `GET /v3/onboarding/corp/indv/query?requestId=EOD00301` - Query EOD (Entity Onboarding Data)

**Documentation mentions:**
- Business Onboarding (COD/EOD) but says "_Endpoint details: See sections 2.8-2.10 in RegTank docs_"
- **Status**: ⚠️ **INCOMPLETE** - Should include actual endpoint details

### 5. KYC Endpoints - Acuris vs Dow Jones

**Postman has separate endpoints for:**
- Acuris KYC: `/v3/kyc/*`
- Dow Jones KYC: `/v3/djkyc/*`

**Documentation:**
- Only mentions "Acuris KYC" in examples
- Doesn't clearly distinguish between Acuris and Dow Jones endpoints
- **Status**: ⚠️ **INCOMPLETE** - Should document both providers

**Postman KYC Endpoints:**
1. `POST /v3/kyc/input` - Acuris KYC Request
2. `GET /v3/kyc/query?requestId=KYC01911&referenceId=id82937184` - Acuris KYC Query
3. `POST /v3/kyc/scoring` - Acuris KYC Generate Score
4. `POST /v3/kyc/ongoing-monitoring` - Acuris KYC OM
5. `POST /v3/djkyc/input` - Dow Jones KYC Request
6. `GET /v3/djkyc/query?requestId=DJKYC01669&referenceId=id82937184` - Dow Jones KYC Query
7. `POST /v3/djkyc/scoring` - Dow Jones KYC Generate Score
8. `POST /v3/djkyc/ongoing-monitoring` - Dow Jones KYC OM

### 6. KYB Endpoints - Acuris vs Dow Jones

**Postman has separate endpoints for:**
- Acuris KYB: `/v3/kyb/*`
- Dow Jones KYB: `/v3/djkyb/*`

**Postman KYB Endpoints:**
1. `POST /v3/kyb/input` - Acuris KYB Request
2. `GET /v3/kyb/query?requestId=KYB00351&referenceId=id62726482` - Acuris KYB Query
3. `POST /v3/kyb/complete-resolution` - Acuris KYB Complete Resolution
4. `POST /v3/kyb/scoring` - Acuris KYB Generate Score
5. `POST /v3/kyb/ongoing-monitoring` - Acuris KYB OM
6. `POST /v3/djkyb/input` - Dow Jones KYB Request
7. `GET /v3/djkyb/query?requestId=DJKYB00245&referenceId=id62726482` - Dow Jones KYB Query
8. `POST /v3/djkyb/complete-resolution` - Dow Jones KYB Complete Resolution
9. `POST /v3/djkyb/scoring` - Dow Jones KYB Generate Score
10. `POST /v3/djkyb/ongoing-monitoring` - Dow Jones KYB OM

**Documentation:**
- Only mentions KYB briefly, says "_Endpoint details: See sections 2.8-2.10 in RegTank docs_"
- **Status**: ⚠️ **INCOMPLETE** - Should include actual endpoint details

### 7. KYT Endpoints

**Postman has:**
1. `POST /v3/kyt/input` - KYT Request
2. `GET /v3/kyt/query?requestId=KYT00111&referenceId=id00000001` - KYT Query Status

**Documentation:**
- Only mentions KYT in overview: "KYT (Know Your Transaction) - Transaction monitoring"
- **Status**: ⚠️ **MISSING** - Should document KYT endpoints

### 8. Authorization Headers

**Postman Collection:**
- Some requests have BOTH:
  - `auth.bearer.token` (Postman auth tab)
  - `header.Authorization: Bearer <token>` (explicit header)
- This is redundant but not incorrect

**Documentation:**
- Only mentions `Authorization: Bearer <access_token>` header
- **Status**: ✅ **ALIGNED** - Both work, Postman just shows both methods

### 9. Request Body Format - Liveness Check

**Postman Collection:**
- `POST /v3/onboarding/indv/liveness-check` uses `form-data` with:
  - `requestId`: text
  - `token`: text (JWT token, not the OAuth token)
  - `video`: file

**Documentation:**
- Doesn't document this endpoint at all
- **Status**: ⚠️ **MISSING** - Should document liveness check endpoint

### 10. Corporate Onboarding Request Body

**Postman Collection shows:**
```json
{
  "email": "test@regtank.com",
  "companyName": "Company A",
  "formName": "Business End User Onboarding Example Form1"
}
```

**Documentation:**
- Doesn't show the actual request body structure
- **Status**: ⚠️ **MISSING** - Should document corporate onboarding request structure

## Recommendations

### High Priority Fixes

1. **Fix dateOfBirth format discrepancy**
   - Clarify whether it's epoch milliseconds or ISO date string
   - Postman uses ISO string, documentation says epoch milliseconds

2. **Document missing Individual Onboarding endpoints:**
   - Document Upload endpoint
   - Liveness Check endpoint
   - Restart endpoint
   - Get/Set Setting endpoints

3. **Document Corporate Onboarding properly:**
   - Include actual endpoint URLs
   - Include request/response examples
   - Document COD vs EOD distinction

4. **Document KYC/KYB/KYT endpoints:**
   - Include all endpoints from Postman
   - Distinguish between Acuris and Dow Jones providers
   - Include request/response examples

5. **Fix Postman collection typos:**
   - Fix triple slashes in URLs (lines 169, 456)

### Medium Priority

6. **Clarify field types:**
   - `bypassIdUpload`: boolean vs string
   - `dateOfBirth`: epoch vs ISO string
   - `yearOfBirth`: document if required

7. **Document additional fields:**
   - `proofOfAddress` structure
   - `walletAddress` field
   - `yearOfBirth` field

8. **Document query parameters:**
   - Both `requestId` and `referenceId` can be used for queries
   - Clarify when to use which

## ✅ Additional Answers Found from Postman Collection

### 1. Iframe Embedding (Question #8)

**Status**: ✅ **ANSWERED**

**Finding:**
The Postman collection shows API responses include the header:
```
X-Frame-Options: DENY
```

**Conclusion:**
- Iframe embedding is **NOT allowed**
- Must use redirect (not iframe) for the onboarding flow
- The `verifyLink` should open in a new window/tab or redirect the current page

### 2. Language Support (Question #13)

**Status**: ✅ **PARTIALLY ANSWERED**

**Findings from Postman Collection:**
- **English (EN)**: Confirmed - `"language": "EN"` in onboarding requests
- **Chinese**: Confirmed - Corporate onboarding response shows Chinese field aliases:
  - 名 (Given Name)
  - 中间名 (Middle Name)
  - 姓 (Surname)
  - 邮箱 (Email Address)
  - 性别 (Gender)
  - 出生日期 (Date of Birth)
  - 出生国家 (State of Birth)
  - 居住地址 (Residence Address)
  - 身份证件号码 (Number of Identification Certificate)
  - 中文姓名 (Chinese Name)
  - 国籍 (Nationality)
  - 其他称号 (Other Designation)

**Conclusion:**
- Multi-language support exists
- At least English and Chinese are supported
- Form fields can display in different languages

### 3. referenceId Usage (Question #4)

**Status**: ⚠️ **PARTIALLY ANSWERED**

**Finding:**
`referenceId` is extensively used in query endpoints:
- `GET /v3/kyc/query?requestId={requestId}&referenceId={referenceId}`
- `GET /v3/kyb/query?requestId={requestId}&referenceId={referenceId}`
- `GET /v3/kyt/query?requestId={requestId}&referenceId={referenceId}`

**Conclusion:**
- `referenceId` is a first-class identifier used alongside `requestId`
- This strongly suggests `referenceId` should be included in webhook payloads
- Still needs confirmation from RegTank

### 4. Rate Limits (Question #9)

**Status**: ⚠️ **NO EXPLICIT INFORMATION**

**Finding:**
- No explicit rate limit information found in Postman collection
- Official API documentation mentions HTTP 429 "Too Many Requests" errors
- Standard rate limiting exists but specific limits not documented

## ✅ Resolved: Return URL Mechanism

**Status**: ✅ **RESOLVED** - Confirmed via official RegTank API documentation

**Finding:**
The `redirectUrl` field in the Set Onboarding Settings endpoint (`POST /v3/onboarding/indv/setting`) is the mechanism for configuring where users are redirected after completing onboarding.

**Official Documentation Reference:**
- [RegTank API Documentation - Set Setting](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/2.-onboarding/2.7-individual-onboarding-endpoint-json-set-setting)

**Key Points:**
- `redirectUrl` is a String field in the settings request body
- Settings are configured **per `formId`** - each onboarding form can have its own redirect URL
- The redirect URL applies to all onboarding requests that use the specified `formId`
- This is a **one-time configuration** per `formId`, not per onboarding request
- Field types from official docs:
  - `formId`: Integer (not string)
  - `livenessConfidence`: Integer (not string) - required field
  - `approveMode`: Boolean (not string) - required field
  - `kycApprovalTarget`: String (e.g., "ACURIS" or "DOWJONES")
  - `enabledRegistrationEmail`: Boolean (not string)
  - `redirectUrl`: String

**Postman Collection Discrepancy:**
- Postman shows string values for `livenessConfidence` ("90") and `approveMode` ("false")
- Official docs specify Integer and Boolean types respectively
- **Recommendation**: Use Integer and Boolean types as per official documentation

## ✅ Webhook Configuration and Delivery

**Status**: ✅ **DOCUMENTED** - Confirmed via official RegTank API documentation

**Official Documentation References:**
- [Webhook Overview](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook)
- [Endpoint Definition](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.1-endpoint-definition)
- [Receiving Webhook Notifications](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications)

### Webhook Configuration

**Postman Collection:**
- `POST https://{{companySpecificRegtankServerURL}}/alert/preferences`
- Request body: `{ "webhookUrl": "string", "webhookEnabled": "boolean" }`

**Official Documentation:**
- `POST https://{client-portal-server}/alert/preferences`
- Same request body structure

**Status**: ✅ **ALIGNED** - Both match exactly

### Webhook URL Suffixes

**Official Documentation Confirms:**
RegTank automatically appends suffixes to the configured `webhookUrl` based on webhook type:

| Webhook Type | Suffix | Documentation Reference |
|--------------|--------|------------------------|
| Individual Onboarding | `/liveness` | [6.2.6](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.6-individual-onboarding-notification-definition) |
| KYC (Acuris) | `/kyc` | [6.2.1](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.1-kyc-notification-definition) |
| KYC (Dow Jones) | `/djkyc` | [6.2.2](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.2-djkyc-notification-definition) |
| KYB (Acuris) | `/kyb` | [6.2.3](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.3-kyb-notification-definition) |
| KYB (Dow Jones) | `/djkyb` | [6.2.4](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.4-djkyb-notification-definition) |
| KYT | `/kyt` | [6.2.5](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.5-kyt-notification-definition) |
| Business Onboarding (COD) | `/cod` | [6.2.7](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.7-business-onboarding-notification-definition-cod) |
| Business Onboarding (EOD) | `/eod` | [6.2.8](https://regtank.gitbook.io/regtank-api-docs/reference/api-reference/6.-webhook/6.2-receiving-webhook-notifications/6.2.8-business-onboarding-notification-definition-eod) |

**Example:**
If `webhookUrl` is configured as `https://api.cashsouk.com/v1/webhooks/regtank`, RegTank will send:
- Individual onboarding webhooks to: `https://api.cashsouk.com/v1/webhooks/regtank/liveness`
- KYC webhooks to: `https://api.cashsouk.com/v1/webhooks/regtank/kyc`
- KYB webhooks to: `https://api.cashsouk.com/v1/webhooks/regtank/kyb`
- etc.

**Postman Collection:**
- Does not explicitly show webhook suffix examples
- Webhook configuration endpoint is present and matches documentation

**Status**: ✅ **CONFIRMED** - Official documentation clearly specifies suffix-based routing

### Webhook Payload Structure

**Official Documentation Confirms:**
All webhooks include `requestId` and `referenceId` in the request body. The documentation states:

> "Take note that the record is tagged using the referenceId. Therefore referenceId is returned as part of the webhook response. Hence, referenceId must be a unique ID from the client-server."

**Key Findings:**
- ✅ `referenceId` is confirmed in all webhook payloads (request body)
- ✅ `requestId` is the RegTank system ID
- ✅ Each webhook type has specific additional fields (status, riskScore, etc.)
- ✅ Webhooks are sent as POST requests with JSON body
- ✅ Response should be HTTP 200 OK

**Status**: ✅ **RESOLVED** - All webhook types documented with payload structures

## Conclusion

The documentation is **partially aligned** with the Postman collection, but there are significant gaps:

- ✅ Core onboarding flow is documented
- ✅ OAuth authentication is correct
- ✅ Basic query endpoints are documented
- ✅ **Return URL mechanism confirmed** - `redirectUrl` in Set Onboarding Settings
- ⚠️ Many additional endpoints are missing from documentation
- ⚠️ Field types and formats have discrepancies (Postman uses strings where docs specify Integer/Boolean)
- ⚠️ Corporate, KYC, KYB, KYT endpoints need full documentation

**Recommendation**: Update the documentation to match the Postman collection and official API docs, especially for:
1. Individual onboarding additional endpoints
2. Corporate onboarding full details
3. KYC/KYB/KYT endpoints for both Acuris and Dow Jones
4. Field type clarifications - use official API documentation types (Integer/Boolean) over Postman examples (strings)

