# Business Onboarding Documentation Discrepancies

This document lists discrepancies between the official RegTank API documentation, Postman collection, current documentation, and implementation.

## Summary

After reviewing the official RegTank API documentation for Business Onboarding (sections 2.8, 2.9, 2.10), the following discrepancies were found:

---

## ✅ CORRECT: Implementation Matches Official Documentation

The current implementation correctly **does NOT send `formId`** in the corporate onboarding request body. It only sends:
- `email` (String)
- `companyName` (String)
- `formName` (String)

This matches the official RegTank API documentation.

---

## ❌ DISCREPANCIES: Documentation vs Official API Docs

### 1. Request Body - `formId` Field

**Official RegTank API Documentation (2.8):**
- Request body includes ONLY: `email`, `companyName`, `formName`
- **NO `formId` field** is documented or accepted

**Postman Collection:**
- Shows request body without `formId` (line 448): `{"email": "test@regtank.com", "companyName": "Company A", "formName": "Business End User Onboarding Example Form1"}`

**Current Documentation (`regtank-kyc-integration.md`):**
- ❌ Shows `formId: 1015520` in the request body example (line 440)
- ❌ Lists `formId` as an "Optional Field" (line 449-452)
- ❌ Incorrectly states: "formId is required by RegTank to identify the correct form configuration" (line 457)

**Current Documentation (`regtank-onboarding-technical-documentation.md`):**
- ❌ Lists `formId` as an optional field in the request body (line 245-247)
- ❌ Incorrectly states: "formId is required by RegTank to identify the correct form configuration" (line 252)

**Current Implementation:**
- ✅ Correctly does NOT send `formId` to RegTank API
- Only sends: `email`, `companyName`, `formName`

**Action Required:**
- Remove `formId` from request body examples in both documentation files
- Remove `formId` from "Optional Fields" sections
- Add note that `formId` is NOT sent to RegTank API (it's only used internally by CashSouk for form name selection)

---

### 2. Request Body - Missing Field Details

**Official RegTank API Documentation (2.8):**
- Clearly documents that all three fields (`email`, `companyName`, `formName`) are **required** (marked with `*`)
- Provides field type information:
  - `email` (String) - Intended recipient email address
  - `companyName` (String) - Registered Company Name
  - `formName` (String) - Business form name

**Current Documentation:**
- ✅ Correctly marks all three fields as required
- ✅ Field descriptions are present

**Status:** ✅ Aligned

---

### 3. Response Body - Missing Field Details

**Official RegTank API Documentation (2.8):**
- Response includes:
  - `requestId` (String) - Unique ID generated from the request
  - `verifyLink` (String) - Link generated from the request (used to access onboarding portal)
  - `expiredIn` (Integer) - Duration before URL expired in seconds (default: 86400 = 24 hours)
  - `timestamp` (Datetime) - Time when URL is generated (GMT +8)

**Current Documentation:**
- ✅ Response fields are documented correctly

**Status:** ✅ Aligned

---

### 4. Error Responses - Missing Documentation

**Official RegTank API Documentation (2.8):**
- HTTP 400: "The email already exists"
- Provides sample error response:
```json
{
  "timestamp": "2023-06-23T09:33:17.175+00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "The email already exists",
  "path": "/v3/onboarding/corp/request"
}
```

**Current Documentation:**
- ❌ Error responses are not documented for corporate onboarding

**Action Required:**
- Add error response documentation similar to individual onboarding section

---

### 5. COD Query Response - Missing Detailed Field Descriptions

**Official RegTank API Documentation (2.9):**
- Documents comprehensive response fields:
  - `requestId` (String) - Corresponding COD id
  - `formId` (String) - Id of business onboarding form
  - `deviceType` (String) - Type of device used for submission
  - `status` (Enum) - Progress of business onboarding
  - `approveStatus` (String) - Progress of approval
  - `kybType` (String) - Database used for screening
  - `formContent` (Object) - Submitted form details
  - `sendEmailStatus` (Enum) - Status of email sent
  - `lastModifiedBy` (Object) - User who last modified the record
  - `isPrimary` (Boolean) - Company to be onboarded
  - `requestIpAddress` (String) - Request's IP address
  - `directorCount` (Integer) - Number of directors
  - `individualShareholderCount` (Integer) - Number of individual shareholders
  - `corporateShareholderCount` (Integer) - Number of corporate shareholders
  - `corporateIndividuals` (Object) - List of corporate individuals
  - `corporateRequests` (Object) - List of corporate requests
  - `kybRequest` (Object) - KYB request

**Current Documentation:**
- ❌ Only provides generic description: "Returns company-level onboarding details including company information, documents, and status"
- ❌ Missing detailed field descriptions

**Action Required:**
- Add comprehensive field descriptions for COD query response

---

### 6. COD Query Error Responses - Missing Documentation

**Official RegTank API Documentation (2.9):**
- HTTP 404: "COD record not found"
- Sample error:
```json
{
  "timestamp": "2023-06-23T09:33:17.175+00:00",
  "status": 404,
  "error": "Not Found",
  "message": "COD00001 not Found",
  "path": "/v3/onboarding/corp/query"
}
```

**Current Documentation:**
- ❌ Error responses are not documented

**Action Required:**
- Add error response documentation for COD query

---

### 7. EOD Query Response - Missing Detailed Field Descriptions

**Official RegTank API Documentation (2.10):**
- Documents response structure:
  - `corporateIndividualRequest` (Object) - Corporate individual request info
  - `corporateUserRequestInfo` (Object) - Corporate user request info (with formContent)
  - `corporateDocumentInfo` (Object) - Corporate document info
  - `corporateLivenessCheckInfo` (Object) - Corporate liveness check info
  - `kycRequest` (Object) - KYC request info

**Current Documentation:**
- ✅ Lists the main response sections correctly
- ❌ Missing detailed field descriptions within each section

**Action Required:**
- Add more detailed descriptions of nested fields within each response object

---

### 8. EOD Query Error Responses - Missing Documentation

**Official RegTank API Documentation (2.10):**
- HTTP 404: "EOD record not found"
- Sample error:
```json
{
  "timestamp": "2023-06-23T09:33:17.175+00:00",
  "status": 404,
  "error": "Not Found",
  "message": "EOD00001 not Found",
  "path": "/v3/onboarding/corp/indv/query"
}
```

**Current Documentation:**
- ❌ Error responses are not documented

**Action Required:**
- Add error response documentation for EOD query

---

## 📋 Action Items Summary

### High Priority

1. **Fix Request Body Documentation:**
   - Remove `formId` from request body examples in `regtank-kyc-integration.md` (line 440)
   - Remove `formId` from "Optional Fields" section in `regtank-kyc-integration.md` (line 449-452)
   - Remove incorrect note about `formId` being required by RegTank (line 457)
   - Update `regtank-onboarding-technical-documentation.md` to remove `formId` from request body documentation (line 245-247, 252)
   - Add clarification that `formId` is used internally by CashSouk but NOT sent to RegTank API

2. **Add Error Response Documentation:**
   - Add HTTP 400 error (email already exists) for corporate onboarding request
   - Add HTTP 404 error (COD record not found) for COD query
   - Add HTTP 404 error (EOD record not found) for EOD query

3. **Enhance COD Query Response Documentation:**
   - Add detailed field descriptions for all COD query response fields
   - Include field types and descriptions from official documentation

### Medium Priority

4. **Enhance EOD Query Response Documentation:**
   - Add more detailed descriptions of nested fields within each response object
   - Reference official documentation examples for structure

5. **Update Postman Comparison Document:**
   - Update section 10 (Corporate Onboarding Request Body) to clarify that `formId` is NOT sent to RegTank API
   - Note that Postman collection example is correct (no formId), but documentation incorrectly shows it

---

## ✅ Verification Checklist

After updates, verify:

- [ ] Request body examples show ONLY `email`, `companyName`, `formName` (no `formId`)
- [ ] `formId` is not listed as an optional field in request body
- [ ] Documentation clarifies that `formId` is used internally but NOT sent to RegTank API
- [ ] Error responses are documented for all three endpoints (request, COD query, EOD query)
- [ ] COD query response includes detailed field descriptions
- [ ] EOD query response includes detailed field descriptions
- [ ] All references to official RegTank API documentation are up-to-date

---

*Last Updated: Based on official RegTank API documentation (sections 2.8, 2.9, 2.10) and codebase review*

