# CashSouk — Grey-box testing modules

This is a briefing for a penetration tester who already has accounts, knows the hostnames, and can call the API. It is not a source dump. Use it to decide *where* to spend time.

Companion: [External penetration test brief](./external-pentest-brief.md) (hosts, RoE, out of scope).

---

## How to read this

Grey-box here means: you know the shape of the product, the roles, and the main API prefixes. You do not need the database. You *do* need to think like a user who can also open DevTools and replay HTTP.

Work **one module at a time**. Most serious issues will be one of:

1. **Seeing or changing another organisation’s records** (horizontal)
2. **Doing something your role is not allowed to do** (vertical)
3. **Making money, KYC, or a signature change without a genuine event** (integrity)
4. **Using a public or weakly gated URL that was meant for a vendor or an email link**

API base: `https://api.cashsouk.com/v1`  
Auth: Cognito access token as `Authorization: Bearer …`  
Portal hint: `X-Portal: investor | issuer | admin` (the API also infers portal from Origin / Referer)

Successful JSON looks like `{ success: true, data, correlationId }`. Failures look like `{ success: false, error: { code, message }, correlationId }`. Send `X-Correlation-ID` if you want traces tied to a finding.

User IDs are short (5 characters). Organisation, application, note, and payment IDs are longer. Swap IDs between the two orgs you are given — that is the basic test for almost every module.

---

## People and tenancy (read this first)

CashSouk is not “one user = one account”. It is **users inside organisations**, with **roles on the user** and **membership on the org**.

| Who | Portal | What they are |
| --- | ------ | ------------- |
| Investor | `investor.cashsouk.com` | Puts money in a wallet, buys notes on the marketplace, withdraws |
| Issuer (borrower) | `issuer.cashsouk.com` | Onboards a company, applies for financing, pays fees, services notes |
| Admin | `admin.cashsouk.com` | Reviews onboarding, applications, notes, money movement. Fine-grained permissions on top of the ADMIN role |
| External signer | Email / SMS link, no portal login | Signs a document or does MyKad eKYC via a secret URL |

A person can be **both investor and issuer**. That is allowed. They must not become **admin** by self-service. Admin is invited.

An organisation has an owner and members. Members can be invited by email or by a generated link (`/accept-invitation?token=…`). Treat those tokens like session secrets.

Onboarding is a **status machine** on the organisation (`PENDING` → … → `COMPLETED` or `REJECTED`). Webhooks and admin buttons move it. The user should not be able to skip gates by PATCHing status.

---

## Module 1 — Authentication and session

**What it is.** Login and signup go through AWS Cognito Hosted UI (`auth.cashsouk.com`), then the API callback at `/v1/auth/cognito/callback` (also `/api/auth/...`). Portals keep Cognito tokens (access ~1 hour, refresh ~30 days). After that, every API call is Bearer JWT. The API looks up the user by Cognito `sub`.

**Useful endpoints.** `/v1/auth/me`, `/v1/auth/logout`, `/v1/auth/refresh-token`, `/v1/auth/profile`, password and email-verify routes, `/v1/auth/sync-user` (unauthenticated body: Cognito sub + email + roles).

**What to try.**

- Replay or steal a Bearer token from one portal and use it on another.
- Logout: is the refresh token actually dead? Can the old access token still hit `/v1/auth/me`?
- `sync-user`: can you create or attach a user by posting someone else’s `cognitoSub` / email / `roles: ["ADMIN"]` without a real Cognito session?
- Password reset and email verification: token reuse, user enumeration, host-header tricks on redirect URLs.
- CORS: credentials from a random origin against `api.cashsouk.com`.
- Cookie vs header confusion: some auth is cookie-based (Amplify), API is Bearer. Mix them.

**Interesting if.** An unauthenticated caller can mint a platform user, pick a role, or keep a session after logout.

---

## Module 2 — Roles, portal switching, dual identity

**What it is.** Roles live on the user: `INVESTOR`, `ISSUER`, `ADMIN`. The request’s *active* role comes from `X-Portal` / Origin, but only if the user actually has that role. Spoofing `X-Portal: admin` on an investor account should do nothing useful.

Self-service: `POST /v1/auth/add-role` (authenticated). Switching: `POST /v1/auth/switch-role`. Onboarding completion can also add a role.

Investor/issuer routes additionally require that onboarding arrays (`investor_account` / `issuer_account`) are not empty. Admin routes require the ADMIN role **and** an `admin` row with permissions.

**What to try.**

- `add-role` with `ADMIN`. Then hit `/v1/admin/...`.
- Investor token + `X-Portal: issuer` against issuer-only routes (and the reverse).
- Dual-role account: act as investor while targeting issuer org IDs you do not belong to.
- Admin portal login with a non-admin Cognito user (the callback is supposed to refuse).
- Complete-onboarding / cancel-onboarding for a role you were never invited into.

**Interesting if.** You can make `roles` include `ADMIN`, or make `requireRole(ISSUER)` succeed for a user who only onboarded as investor.

---

## Module 3 — Organisations and members

**What it is.** Two parallel org trees:

- `/v1/organizations/investor/:id/...`
- `/v1/organizations/issuer/:id/...`

Create org, patch profile, members, invite, generate-link, change member role, transfer ownership, leave, accept invitation (`POST /v1/organizations/invitations/accept`). Corporate extras: corporate-entities, CTOS party email, send-director-onboarding, unresolved-identity, refresh-AML.

**What to try.**

- Swap `:id` between Org A and Org B for every verb (GET, PATCH, POST members, DELETE member, transfer-ownership).
- Use a **member** token for owner-only actions (invite, transfer, generate-link).
- Invitation token: guess, reuse after accept, use from a different email account, use investor token on an issuer invite.
- `generate-link` — is the token in the JSON response over-disclosed? Does it expire?
- Cross-tree: investor org ID on `/organizations/issuer/:id`.

**Interesting if.** You can read another company’s directors, add yourself as member, or steal ownership with a link that was not meant for you.

---

## Module 4 — Onboarding, KYC / KYB, CTOS, AML

**What it is.** Organisation status is supposed to move by:

- **RegTank** (liveness, company onboarding, KYC/KYB, AML) via webhooks
- **Admin buttons** (SSM/CTOS check, submission approval, AML approval, final complete)
- **User actions** that are allowed in the current state (submit, accept T&Cs, pay onboarding fee)

Personal investors skip the SSM/CTOS gate. Corporate issuers and corporate investors do not. Final `COMPLETED` is admin-only, not webhook-only.

Related authenticated API: `/v1/regtank/...` (user) and `/v1/regtank/...` admin routes (refresh status, etc.). Admin also acts through `/v1/admin/...` onboarding endpoints.

**What to try.**

- PATCH org / application status to `COMPLETED` or `onboarding_approved: true` as the user.
- Call admin approve/reject endpoints with an investor or issuer token.
- Replay or forge **RegTank webhooks** (Module 12) to approve your own org.
- Access another org’s RegTank payload, CTOS report, or director IC numbers.
- Director onboarding links: use them as a stranger; see if they bind to the wrong person.
- Refresh-AML as a non-owner.

**Interesting if.** You can look “fully onboarded” without admin and without a real RegTank approval, or read another company’s KYC pack.

---

## Module 5 — Applications, contracts, invoices, documents

**What it is.** The issuer financing file. Typical chain:

1. Issuer creates an **application** (product + company + financials + documents)
2. Admin reviews sections (company, financials, guarantors, documents, contract, invoice)
3. **Contract / facility** is offered; issuer pays facility fee; documents are signed
4. **Invoices** are attached, offered, accepted (OTP on some accept steps)
5. Admin turns approved invoices into **notes** on the marketplace

Prefixes: `/v1/applications`, `/v1/contracts`, `/v1/invoices`, plus nested fee routes. Admin review lives under `/v1/admin`.

**What to try.**

- CRUD another issuer’s application by ID (list, get, patch step, patch status, delete draft, archive, cancel).
- Download `/v1/applications/:id/summary-pdf` and document delete for someone else’s file.
- Change status to skip review (`APPROVED`, offer sent, etc.).
- Invoice offer accept: OTP brute force / reuse; accept an offer that is not yours.
- Guarantor records: PII leak across applications.
- Admin “send offer” / waive facility fee with a low-privilege admin (see Module 11).

**Interesting if.** Issuer A can read Issuer B’s financials or accept B’s invoice offer; or an issuer can self-approve.

---

## Module 6 — File storage (signed S3 URLs)

**What it is.** The browser never talks to the bucket as a public website. The API mints short-lived URLs.

- Authenticated: `POST /v1/s3/download-url` and `/v1/s3/view-url` with `{ s3Key }`
- Keys shaped `applications/{applicationId}/…` are checked against application access
- Other key prefixes are currently **auth-only** (any logged-in user who knows the key)
- Public legal docs and marketplace prospectuses also return signed URLs (Modules 9 and 15)

**What to try.**

- Ask for another application’s key (`applications/{theirId}/...`).
- Path tricks: `../`, encoded slashes, keys outside `applications/`.
- Use a view URL past expiry; share it with an unauthenticated browser.
- PUT/overwrite via an upload URL if the client ever receives one (content-type, size, key prefix).
- Harvest keys from API JSON (applications, prospectus, legal docs) and request them as a different user.

**Interesting if.** Any authenticated user can fetch objects they were not shown in the UI, or an expired URL still serves.

---

## Module 7 — Signing and eKYC (including people with no login)

**What it is.** Multi-party envelopes (SigningCloud). Admin sends the package. Recipients sign in-portal **or** via an **external access token** in the URL.

Unauthenticated (rate-limited) under `/v1/signing/external/:accessToken`:

- Get envelope, verify access code (often IC / low entropy), reset gate
- Start eKYC session, open/accept warning, start signing, confirm signed, sync from provider

Also unauthenticated: `/v1/ekyc/status|fail|complete` with a **token** in query/body. Completing eKYC this way is supposed to be bound to that token.

Admin: `/v1/admin/signing/...` (send, void, remind). Issuer: `/v1/signing/applications/:applicationId/...`.

Webhook: `POST /v1/webhooks/signingcloud` (and `/api/v1/webhooks/signingcloud`). Encrypted bodies use a MAC; plaintext may also be accepted — check what production actually does.

**What to try.**

- Token in the email link: reuse, swap onto another envelope, skip the IC gate, brute the IC (rate limit is 120 / 15 min).
- `ekyc/complete` with a guessed or stolen token; `ekyc/fail` on someone else’s signing session.
- Confirm-signed without actually signing at the vendor.
- Download signed PDFs as the wrong issuer or as investor.
- Forge the SigningCloud webhook to mark a contract signed.

**Interesting if.** A random person with the link (or without the IC) can sign as a director, or eKYC complete marks a platform user verified.

---

## Module 8 — Payments and investor wallet

**What it is.** FPX via Curlec (Razorpay). Two **gateway accounts** — they must not be mixed:

| Account | What lands there |
| ------- | ---------------- |
| `INVESTOR_POOL` | Investor deposits |
| `OPERATING` | Issuer onboarding fee, application processing fee, facility fee, excess late charges |

Checkout is started from the portals. Completion is supposed to happen when **Curlec calls the webhook**, not when the user returns from the bank.

| Flow | Who | Typical prefix |
| ---- | --- | -------------- |
| Deposit | Investor | `/v1/investor/deposits` |
| Onboarding fee | Issuer | `/v1/issuer/onboarding-fee` |
| Processing fee | Issuer | `/v1/applications/:id/processing-fee` |
| Facility fee | Issuer | `/v1/contracts/:id/facility-fee` |
| Excess late charges | (auth) | `/v1/notes/:id/excess-late-charges` |

Webhooks (raw body, signature header `x-razorpay-signature`, event id `x-razorpay-event-id`):

- `POST /v1/webhooks/curlec/investor-pool`
- `POST /v1/webhooks/curlec/operating`

Admin: `/v1/admin/gateway-payments`, `/v1/admin/gateway-recon`, refunds. Investor: `POST /v1/investor/balance/withdraw`. **Test top-up** `POST /v1/investor/balance/test-topup` must be dead in production.

**What to try.**

- Create a deposit/fee, then POST a **forged captured** webhook (no/invalid signature, wrong account path, replay `event-id`, out-of-order failed→captured).
- Credit **investor wallet** via the **operating** webhook path (and the reverse).
- Change amount between checkout create and webhook (underpay, overpay).
- Race two investments or two deposits against the same balance.
- IDOR on `GET /v1/investor/deposits/:id` and fee GET-by-id.
- Withdraw more than available; withdraw another org’s balance.
- Confirm test-top-up is 403 in production.

**Interesting if.** Wallet or “fee paid” flips without a signed Curlec event, or money appears on the wrong ledger bucket.

---

## Module 9 — Marketplace, notes, investments

**What it is.** A **note** is the investable instrument (from an approved application/invoice). Admin creates and publishes. Investors buy from the marketplace using wallet balance. Issuers see their own notes.

| Surface | Auth | Prefix |
| ------- | ---- | ------ |
| Public catalogue + note detail + prospectus PDF URLs | None | `/v1/public/marketplace` |
| Invest | Investor | `POST /v1/marketplace/notes/:id/investments` |
| Portfolio / investments / statements | Investor | `/v1/investor/...` |
| Issuer note list / payment advice | Issuer | `/v1/issuer/...` |
| Create, disburse, default, settle | Admin | `/v1/admin/notes` |

Public listing is **read-only** and should hide unpublished / non-live notes. Prospectus PDF comes back as a signed URL — treat over-disclosure of unpublished files as a finding.

**What to try.**

- Invest in a draft, closed, or not-yet-published note.
- Invest more than remaining headroom; invest with empty wallet; negative / decimal tricks.
- Two investors racing the last ringgit.
- `GET /v1/public/marketplace/notes/:id` for a note you only saw in admin (unpublished).
- Investor A’s `GET /v1/investor/investments` and prospectus-by-investment-id as Investor B.
- Issuer listing notes that are not theirs.

**Interesting if.** You can buy with no money, oversubscribe a note, or read a prospectus that was never published.

---

## Module 10 — Withdrawals, disbursement, settlement, paymasters

**What it is.** After investment, cash is supposed to sit in ledger buckets, then:

- **Disbursement** to the issuer (admin + trustee paperwork)
- **Repayment** from issuer (payment advice + evidence upload)
- **Settlement** back to investors
- **Investor withdrawal** of unused wallet cash
- **Paymasters** (obligors) on notes — admin master data, issuer assignment

Admin: `/v1/admin/withdrawals`, `/v1/admin/investments`, `/v1/admin/paymasters`, note settlement/disbursement/default routes. Issuer paymasters: `/v1/issuer/paymasters`.

**What to try.**

- Investor withdraw to a beneficiary you did not register; change beneficiary after submit.
- Approve / release a withdrawal as a finance-less admin or as a user.
- Issuer submit repayment evidence on another issuer’s note.
- Disbursement twice; settlement before repayment; default marks you can undo without permission.
- Paymaster PII (legal customer) leaked on public marketplace or to the wrong issuer.

**Interesting if.** You can move platform cash or mark a note settled without the intended maker-checker path.

---

## Module 11 — Admin RBAC

**What it is.** Every admin is `UserRole.ADMIN` plus an **admin role config** with dotted permissions (`notes.manage`, `gateway_payments.manage`, `roles.manage`, …). Super Admin bypasses the list. Other roles do not.

The UI hides buttons. **The API must still refuse.** Permissions of interest:

- `roles.manage` — invite admins, change permissions (crown jewels)
- `users.manage` / `organizations.manage`
- `onboarding.manage`, `applications.manage`
- `notes.disbursement.manage`, `notes.settlement.manage`, `investor_withdrawals.manage`
- `gateway_payments.manage`, `gateway_reconciliation.manage`
- `platform_settings.manage`

Ask for **two admin accounts** with different roles (e.g. operations vs finance vs a custom role with `dashboard.view` only).

**What to try.**

- Call every `/v1/admin/*` family with the weak admin. Especially create-note, disburse, refund, approve onboarding, invite admin, patch role permissions.
- Deactivate the last Super Admin / promote yourself.
- IDOR is less relevant here than **function-level** access; still try other users’ objects.

**Interesting if.** A view-only or finance-only admin can change roles, approve KYC, or push money.

---

## Module 12 — Inbound webhooks (no user session)

These are internet-facing POST routes. They are **supposed** to be called only by vendors. Treat them as unauthenticated until you have proved the signature.

| Vendor | Paths (prefix `/v1/webhooks`) | Trust |
| ------ | ----------------------------- | ----- |
| Curlec | `/curlec/operating`, `/curlec/investor-pool` | HMAC (`x-razorpay-signature`), event id |
| RegTank | `/regtank`, `/regtank/liveness`, `codliveness`, `eodliveness`, `kyc`, `djkyc`, `kyb`, `djkyb`, `kyt` | Vendor auth — confirm what production actually checks |
| RegTank “dev” | `/regtank/dev/...` | Should be off in production (or tightly gated). Writes were designed to hit a **dev** database from prod |
| SigningCloud | `/signingcloud` (also `/api/v1/webhooks/signingcloud`) | MAC on encrypted payload |
| Shoraka STP (Shariah commodity) | `/v1/webhooks/...` STP callback | `signature` field over order fields |

Also: some RegTank paths are aliased at the app root as well as under `/v1`.

**What to try.**

- Empty signature, wrong secret, truncated body, JSON vs raw body.
- Replay the same event; swap payload onto another org / payment id.
- Hit `/regtank/dev` in production.
- Cross-wire Curlec operating payload to investor-pool URL.
- STP callback: flip `status` to completed for someone else’s `orderId`.

**Interesting if.** Unsigned JSON changes KYC, a signature, or a wallet.

Do **not** attack Curlec, RegTank, Cognito, or SigningCloud’s own infrastructure. The finding is CashSouk accepting a bad callback.

---

## Module 13 — Public and weakly gated surfaces

No login, by design:

| Path | Intended content |
| ---- | ---------------- |
| `GET /healthz` | Liveness (no DB) |
| `GET /readyz` | DB ping — extra info |
| `/v1/public/marketplace/...` | Live notes + prospectus URLs |
| `/v1/public/legal-documents/...` | Published T&Cs etc. |
| `/v1/issuer/products` | Active product catalogue (no auth) |
| `/v1` | API banner (mentions `/api-docs`) |
| `/v1/signing/external/...`, `/v1/ekyc/...` | Capability if you have the token |
| Landing `cashsouk.com` | Marketing + login/signup entry |

`/api-docs` (Swagger) is mounted only when `NODE_ENV !== production`. Confirm it is gone. Same for auth bypass (`DISABLE_AUTH`) and test wallet top-up.

**What to try.**

- Product catalogue: does `workflow` leak internal review steps or unpublished products?
- Legal document version IDs: unpublished or admin-only versions.
- `readyz` / error bodies: stack traces, hostnames, versions.
- Origin bypass of CloudFront/WAF to the load balancer (see external brief).

---

## Module 14 — Notifications and activity

**What it is.** In-app notifications `/v1/notifications` (list, read, preferences, admin send). Activity `/v1/activities`. Application logs `/v1/applications/:id/logs`. Admin can broadcast to investors, issuers, or everyone.

**What to try.**

- Read / mark-read another user’s notification by id.
- Change preferences to disable security mail for another user.
- Admin send as a non-`notifications.manage` admin.
- Activity feed: other orgs’ events, PII in log metadata.

**Interesting if.** You can harvest emails or application remarks from another tenant, or spam the platform as a normal user.

---

## Module 15 — Legal documents and acceptances

**What it is.** Admin publishes versions. Users must accept before some flows (invest, onboarding). Public download/view for published slugs. Authenticated `/v1/legal-documents`. Admin CRUD + external acceptance + audit under `/v1/admin/legal-documents*`.

**What to try.**

- Skip acceptance and still `POST` an investment.
- Accept on behalf of another user; bind a version id that is not current.
- Public download of a draft version id.
- Admin-only audit logs with a user token.

---

## Module 16 — Edge, headers, and “should not exist in prod”

Not a product feature, but run it once:

- TLS, HSTS, cookie flags on auth cookies, CSP on the four Next apps (API disables CSP on purpose).
- Host routing: landing / investor / issuer / admin / api.
- WAF in front; try whether origin ALB is directly reachable.
- Confirm **absent**: Swagger, `DISABLE_AUTH`, `/v1/investor/balance/test-topup`, RegTank `/dev` webhooks, verbose Prisma errors.
- Global API rate limit is very high; tighter limits exist on external signing, OTP, and SigningCloud webhooks — OTP on invoice accept is the one worth hammering carefully inside RoE.

---

## Suggested order of work

1. **Module 1–2** until login, tokens, and `add-role` are understood.  
2. **Module 12** (webhooks) in parallel — they do not need a polished UI session.  
3. **Module 8 then 9** (money).  
4. **Module 3–7** (tenancy, KYC, files, signing) with two orgs of each type.  
5. **Module 11** with a second, weaker admin.  
6. **Module 13** as a cleanup pass for leftovers.

For each finding: host, method, path, role used, ID you swapped, and whether the UI hid the action (UI hide is not a control).

---

## Accounts to ask for (grey-box)

Minimum useful set:

| Account | Why |
| ------- | --- |
| Investor org A (completed KYC, funded wallet) | Happy-path invest / withdraw |
| Investor org B (completed, empty wallet) | Cross-tenant + insufficient-funds |
| Issuer org A (completed, with at least one application/note if possible) | Own-object baseline |
| Issuer org B | IDOR target |
| Dual-role user (investor + issuer) | Portal / `X-Portal` confusion |
| Admin — Super Admin | Oracle for “what the button does” |
| Admin — restricted (e.g. view-only or finance-only) | Function-level RBAC |
| One unused invitation / external signing link in a **test** envelope | Token handling |

If money webhooks cannot be fired against real Curlec, agree a **staging** environment or a captured-and-replayed signed payload under RoE. Unsigned production webhook tests should still be attempted; they should fail closed.
