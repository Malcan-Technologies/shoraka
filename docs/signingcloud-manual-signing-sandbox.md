# SigningCloud Manual Signing – Sandbox Walkthrough

Pre-implementation checklist and test flow for [SigningCloud Manual Signing API](https://docs.signingcloud.com/s/api-integration/doc/manual-signing-vTUnpqSO0T).

## Credential Mapping

SigningCloud uses two credentials. Ensure your `.env` matches:

| Env Var       | Bruno Name | Purpose                     | Example value (from Bruno)              |
|---------------|------------|-----------------------------|-----------------------------------------|
| `SC_API_KEY`  | `api_key`  | Client ID for token request | `FCED73AC7B87B0B6B45E`                  |
| `SC_API_SECRET` | `api_secret` | MAC validation + AES decryption | `FE234D43457BD3525BB3D0DAFFD94306E30C2E56` |

**Note:** Your current `.env` has credentials swapped compared to Bruno. For decryption to work, `SC_API_SECRET` must be the **longer** hex string (`FE234D43457BD3525BB3D0DAFFD94306E30C2E56`) and `SC_API_KEY` the shorter one (`FCED73AC7B87B0B6B45E`).

## What to Test Before Implementation

### 1. Get Access Token & Decrypt

**Purpose:** Confirm auth flow. SigningCloud returns an encrypted payload; you must decrypt it to obtain `at` (access token).

**Flow:**
1. `GET {{base_url}}/signserver/v1/accesstoken?client_id={{SC_API_KEY}}`
2. Response: `{ data: string, mac: string }`
3. Validate MAC: `sha256(data + apiSecret) === mac`
4. Decrypt `data` with AES-256-ECB (key = sha256(apiSecret))
5. Parse JSON and read `at`

**Sandbox script:** `apps/api/_sandbox/decrypt-access-token.ts`

Run: `cd apps/api && npx tsx _sandbox/decrypt-access-token.ts`

**Success criteria:**
- HTTP 200
- MAC validation passes
- Decrypted JSON contains `at`
- Token format like `{uuid}-{suffix}` (e.g. `14031a9e-551e-4bef-bf31-7868bc6acb28-00002c4d`)

**Troubleshooting:**
- If `Invalid token response: expected { data, mac }` — the API may return an error object (e.g. `{ error: "..." }`) instead. Check the logged raw response and verify credentials; staging may require different env or account setup.
- If `MAC validation failed` — ensure `SC_API_SECRET` is the longer hex (FE23...), not the client_id. Swap with `SC_API_KEY` if needed.
- Align `SC_API_KEY`/`SC_API_SECRET` with Bruno `api_key`/`api_secret` if unsure.

---

### Decrypt any SigningCloud response

All SigningCloud responses that include `data` + `mac` use the same encryption. Use `decrypt-response.ts` to decrypt any such response:

```bash
# From JSON string:
pnpm tsx _sandbox/decrypt-response.ts '{"data":"fc3b39da67...","mac":"447dbda30..."}'

# From stdin:
echo '{"data":"...","mac":"..."}' | pnpm tsx _sandbox/decrypt-response.ts

# Two args (data, mac):
pnpm tsx _sandbox/decrypt-response.ts "<data_hex>" "<mac_hex>"
```

Shared logic lives in `_sandbox/signingcloud-decrypt.ts`; the upload script uses it and prints the decrypted payload on success.

---

### 2. Upload Document (Offer Letter PDF)

**Purpose:** Confirm document upload endpoint, payload shape, and returned document/session IDs.

**Prerequisites:**
- Valid `access_token` from Step 1
- Sample PDF (e.g. from `generateContractOfferLetterStream`)

**Flow (from SigningCloud manual signing docs):**
1. Prepare PDF (Buffer or base64) and filename
2. Call document upload endpoint (method and URL from docs)
3. Include `Authorization` with `access_token`
4. Verify response (document ID, URL, or similar)

**Sandbox script:** `apps/api/_sandbox/upload-offer-letter.ts` — decrypts and prints the response payload on success.

**Success criteria:**
- Upload returns 200/201
- Response includes document/session identifier for signing

**Troubleshooting:**
- If `File hash verification failed` — the API hashes the uploaded file and compares to `uploadFileHash`. Default algorithm is SHA-1; try `SC_FILE_HASH=sha256` if staging expects a different hash.
- Set `SC_SIGNER_EMAIL` (default: `p2p.dev@shorakagroup.com`) for the signer. Set `SC_BASE_URL` if not using staging default.

**Decrypted upload response** typically contains `docid` and `contractnum` — use for follow-up APIs (e.g. signing URL).

---

### 3. Get Document Detail

**Purpose:** Fetch document metadata, status, and possibly signing/preview URLs using `contractnum` or `docid` from the upload response.

**Sandbox script:** `apps/api/_sandbox/get-document-detail.ts`

```bash
pnpm tsx _sandbox/get-document-detail.ts <contractnum>
pnpm tsx _sandbox/get-document-detail.ts --docid <docid>
```

If you get 404, set `SC_DOCUMENT_DETAIL_ENDPOINT` to the exact URL from [Get Document Detail docs](https://docs.signingcloud.com/s/api-integration/doc/get-document-detail-new-DNGNBzCUGE).

---

### 4. Create Signing Session & Get Signing URL (if separate from Get Document Detail)

**Purpose:** Ensure you can generate a signing URL the issuer can open to sign.

**Flow:** Follow SigningCloud manual signing docs for:
- Creating a signing session/envelope from the uploaded document
- Adding signer(s) and sign fields
- Retrieving the signing URL

---

### 5. End-to-End: Generate PDF → Upload → Signing URL

**Purpose:** Validate full flow with real offer letter generation.

**Flow:**
1. Generate contract offer letter PDF (use `generateContractOfferLetterStream` + buffer aggregation)
2. Fetch access token and decrypt
3. Upload PDF to SigningCloud
4. Create signing session and get URL
5. Verify URL opens and shows the document

---

## Next Steps After Sandbox

1. Extract token fetch/decrypt into `lib/signingcloud/` or `modules/signingcloud/`
2. Add document upload + signing URL creation to application/contract flow
3. Integrate signing URL into issuer sign pages (contract/invoice)
4. Handle webhooks/callbacks for signature completion (if applicable)
