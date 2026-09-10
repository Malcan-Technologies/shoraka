# Stable Person identity / minimal Manual Add — implementation plan

Status: **plan only. Do not implement yet.**

Product decisions: [person-onboarding-consistency-plan.md](./person-onboarding-consistency-plan.md).

This document is the **implementation** plan for that product: minimal Manual Add, optional government ID at Send, and stable `party_key`. It does **not** change SigningCloud, RegTank APIs, platform invitation, Person Email lifecycle, CTOS name splitting, or membership-status enum.

Do not invent a `PENDING` membership status. A new Manual Add Person is:

```text
MASTER_ACTIVE
+ KYC/AML = Not Started  (no supplement send evidence)
```

That already matches `canonicalPartyKycOnboardingStatus` (null → UI **Not Started**).

---

## 0. Sequencing (do not ship as one dump)

| Phase | Scope | Depends on |
|---|---|---|
| **P0** | Stable `user:{uuid}` for pre-ID directors/shareholders; people[] inclusion; exact-key Send/email/supplement; remove CashSouk ID Send block; no observe-rekey of `user:` keys | Product accept `matchKey = party_key` |
| **P1** | APPROVED → `queryOnboardingDetails`; fill-empty seed; identity collision (no silent merge) | P0 |
| **P2** | Minimal Add Person UI (issuer, investor company, Admin onboarding-eligible individual); completeness UX that does not treat pre-onboarding as a finished ComRep profile | P0 (P1 preferred before “profile complete” copy) |

P0 may keep the **current full Add form** if the API already allows create-without-ID. P2 is when the form shrinks.

Existing CTOS Adopt people (`party_key` = NRIC) must keep working in every phase.

---

## 1. Approved target flow

```text
Name *
Person Email *
Role *  (Director and/or Shareholder; not exclusive)
Shareholding % * only if Role includes Shareholder

→ create Person
   membership = MASTER_ACTIVE
   origin = USER_ADDED
   party_key = user:{uuid}
   identity_number = null
   KYC/AML = Not Started

→ Send sendPartyKycAmlOnboarding / sendDirectorCtosPartyOnboarding
   governmentIdNumber = "" if identity unknown
   governmentIdNumber = identity_number if known

→ Person completes RegTank
→ APPROVED webhook
→ GET /v3/onboarding/indv/query?requestId=
→ fill-empty seed confirmed OPP fields (stamp REGTANK)
→ issuer/admin completes remaining CashSouk / ComRep fields
```

Corporate shareholder Add, Board/Management Add, personal-investor onboarding: **out of scope** of the minimal form. They keep current create paths.

---

## 2. CTOS Adopt (unchanged path)

```text
CTOS Person → EXTERNAL_OBSERVED → Admin Adopt → MASTER_ACTIVE
→ issuer Person Email → same Send
```

CTOS still supplies Name, NRIC/passport, roles, share % when present. Do not change CTOS name processing, Adopt UI, or Adopt API unless a P0 lookup bug requires using exact `party_key` (Adopt already uses OPP `id`).

---

## 3. Convergence

After `MASTER_ACTIVE`, both origins use the **same** Send, webhooks, supplement, People UI.

```text
CTOS Adopt ─┐
            ├→ same Person → same Send → same webhooks → same People UI
Manual Add ─┘
```

No second onboarding function.

---

## 4–5. Manual Add create (API then UI)

### API (P0)

Split create validation:

- **Onboarding-eligible individual** (Director and/or Shareholder, `entityType=INDIVIDUAL`): require Name, Person Email, at least one of those roles, shareholding % if Shareholder; **do not** run `validateIssuerPersonForm` for identity/gender/DOB/address/share-type/designation.
- **Preserve** `assertIssuerShareholderThreshold` (>=5%). `<5%` shareholder create stays rejected.
- **Corporate / Board / Management** (and any create that still sends full ComRep): keep `createPartySchema` + `validateIssuerPersonForm`.

`createUserAddedParty`:

- Remove `needsIdentity` for director/shareholder when this is the minimal onboarding create.
- `party_key = canonical(identity)` **only if** identity is actually provided (old clients / tests / CTOS-like payloads).
- Else `party_key = user:{uuid}` (`USER_GENERATED_PARTY_KEY_PREFIX` already exists).
- Do not merge/create-by-email. Skip `findExistingPartyForIdentityKey` when there is no identity.
- `membership_status = MASTER_ACTIVE` (already).
- Stamp `field_sources` USER or ADMIN for provided fields only.

Person Email is **required** on this create (today it is optional on the full form).

### UI (P2)

Replace `AddPersonForm` **individual Director/Shareholder** path with:

```text
Add Person
Name *
Person Email *
Roles: [ ] Director  [ ] Shareholder
If Shareholder: Shareholding % *
[Add Person]
```

Keep a **separate** full form for corporate shareholders and for Board/Management (issuer + Admin). Do not force exclusive roles.

Investor company: same minimal fields. Do **not** add issuer-only ComRep widgets (designation, SC share type, etc.) to investor.

---

## 6. Name

Keep one `OrganizationPartyProfile.name`. No forename/surname columns.

Send: existing `splitForenameSurname`. Require non-empty Name before Send. Do not send `"User"` for a missing name. Keep `"."` surname for **single-word** names only.

Do not change CTOS name processing. Split weaknesses: **FUTURE IMPROVEMENTS** only.

---

## 7. Government ID at Send (P0)

```text
identity_number present → governmentIdNumber = that value (normalized for payload as today)
identity_number absent  → governmentIdNumber = ""
```

Never fabricate. Never use email as ID.

Remove `"Party has no government ID for onboarding"` **only in P0 after** exact `party_key` lookup works. Do not remove it in isolation.

`idType` stays `"IDENTITY"` on request (current). Mapping returned document type → `identity_prefix` is P1 and must not be guessed (see §15).

---

## 8. Stable identity model

```text
party_key          = stable internal Person key (NRIC-shaped for historical CTOS rows; user:{uuid} for new pre-ID rows)
identity_number    = government identity (nullable)
identity_prefix    = NRIC | PASSPORT | ROC | null
email              = operational Person contact (not identity)
user_id            = optional CashSouk account link (unchanged)
```

After APPROVED: fill `identity_number` / `identity_prefix` if empty and no collision. **Never change `party_key`.**

---

## 9. Audit: `party_key == government ID` assumptions

Shared helper to add (do not change `normalizeDirectorShareholderIdKey` itself):

```text
resolvePartyLookupKey(raw):
  if isGeneratedUserPartyKey(raw) → return raw exactly (keep colon and hyphens)
  else → normalizeDirectorShareholderIdKey(raw)
```

OPP/supplement DB lookups use **exact** `party_key` as stored. For historical NRIC keys, callers may still pass a hyphenated IC; resolve via canonical **only when the key is not `user:`**.

### `createUserAddedParty`

```text
Current assumption = directors/shareholders/board require identity; party_key = canonical ID or user:uuid only for management-only
Problem with user:{uuid} = create throws "Identity number is required for this role"
Planned change = allow director/shareholder create without identity → user:{uuid}; if identity provided, keep today’s ID-keyed create (backward compatible)
Backward compatibility = existing tests/clients that send NRIC still get NRIC party_key; CTOS Adopt unchanged
```

### `operationalMatchKeyForMasterParty`

```text
Current assumption = matchKey is canonical identity; user: + empty identity → null → excluded from people[]
Problem = pre-ID Person never appears on KYC list / Send
Planned change = if isGeneratedUserPartyKey(partyKey) → return exact partyKey; else keep identity-first then canonical party_key
Backward compatibility = CTOS/NRIC rows still match on identity; only user: rows change
```

### `mergeMasterPartiesIntoPeopleList`

```text
Current assumption = skips parties with null matchKey; folded matchKey is normalized ID
Problem = user: directors never folded
Planned change = include MASTER_ACTIVE eligible roles using exact user: matchKey; attach supplement by exact party_key; set a display identity field from identity_number (not from matchKey)
Backward compatibility = NRIC-keyed rows unchanged
```

### `normalizeDirectorShareholderIdKey`

```text
Current assumption = trim, uppercase, strip non-alphanumerics (colon/hyphens gone)
Problem = user:abc-def → USERABCDEF; OPP lookup misses
Planned change = do not change this function; stop using it as the Send/email/supplement lookup key for generated keys
Backward compatibility = all government-ID matching stays
```

### `sendDirectorCtosPartyOnboarding` / `sendPartyKycAmlOnboarding`

```text
Current assumption = input.partyKey is a government ID; people[].matchKey compared after normalize; OPP/supplement where party_key = normalized pk; idGov required
Problem = cannot find user: Person; Send blocked without ID
Planned change = lookup people[] by exact matchKey when generated, else normalized ID; find OPP/supplement by exact stored party_key; governmentIdNumber from identity_number or ""; require Name; keep email + company COMPLETED + eligibility
Backward compatibility = CTOS Persons still send with NRIC party_key and existing ID
```

Also update `resolveKycEligibleDisplayRow` (compares `idNumber` / `enquiryId` to partyKey) so `user:` keys match the people[] row, not CTOS `ctos-${nric}` ids.

### `writeOrganizationPartyEmail` and org `upsertCtosPartyEmail`

```text
Current assumption = partyKey argument is stored party_key; upsert path normalizes input first
Problem = UI/API that normalize before write will miss user: rows; upsertCtosPartyEmail currently normalizeDirectorShareholderIdKey(input.partyKey)
Planned change = pass exact party_key; skip normalize for generated keys; supplement create/update uses same exact key
Backward compatibility = NRIC writes unchanged; email lifecycle functions (planPersonEmailWrite) unchanged
```

### Supplement lookup (`findCtosPartySupplementForOrg`)

```text
Current assumption = unique (org, party_key); party_key is NRIC
Problem = none if callers pass exact key; broken if callers pass normalized user: key
Planned change = always store and read exact party_key (NRIC or user:{uuid}); never rekey supplement after approval
Backward compatibility = existing supplement rows stay NRIC-keyed
```

### `buildSafeReferenceId`

```text
Current assumption = sanitise to [A-Za-z0-9_-]; colon stripped; max 99
Problem = user:{uuid} becomes user{uuid} in referenceId — acceptable as correlation, not identity
Planned change = keep function; document that referenceId is transport correlation, not government ID; do not parse NRIC out of it
Backward compatibility = none needed
```

### Webhook matching (`findCtosPartySupplementByOnboardingJsonMatch`)

```text
Current assumption = requestId JSON path, then stored referenceId; org id from referenceId prefix before first _
Problem = none if requestId is persisted at Send; referenceId fallback still works if stored at Send
Planned change = keep prefer requestId then stored referenceId; persist both on Send as today; do not match webhooks by government ID
Backward compatibility = existing NRIC supplements unchanged
```

### CTOS observation (`observeExternalCtosParties`)

```text
Current assumption = party_key of candidate is NRIC; findExistingPartyForIdentityKey; if found and party_key differs, rekey OPP to NRIC
Problem = after identity_number is seeded, observe would rekey user:{uuid} → NRIC and desync supplement + RegTank referenceId
Planned change = match by identity_number; if row isGeneratedUserPartyKey, NEVER rekey; update external_observation / fill-empty only; do not create a second EXTERNAL_OBSERVED when identity already matches a MASTER_ACTIVE row
Backward compatibility = NRIC-keyed CTOS rows still rekey only when both keys are identity-shaped (legacy mgmt: etc.), not user:
```

### `findExistingPartyForIdentityKey`

```text
Current assumption = match canonical party_key OR identity_number OR stripped user:/mgmt: prefix
Problem = stripGeneratedPartyKeyPrefix("user:{uuid}") then canonicalize could theoretically collide with a weird ID; uuid is not NRIC-shaped
Planned change = keep identity_number matching (required for later CTOS); do not treat the uuid suffix as an identity; when matching, skip comparing generated party_key to NRIC except via identity_number
Backward compatibility = NRIC and hyphenated IC matching stay
```

### `fillEmptyPartyFromCandidate`

```text
Current assumption = may set party_key = candidate.partyKey (NRIC) when different
Problem = rekeys user: rows after identity appears
Planned change = if isGeneratedUserPartyKey(row.party_key) → never assign data.party_key; still fill-empty identity_number
Backward compatibility = CTOS/REGTANK-origin rows that already use ID keys keep current rekey (only when not user:)
```

`createUserAddedParty` update-existing branch that rekeys when identity is supplied: do not use that branch to convert a `user:` Send-already-happened Person. If a `user:` Person later receives identity via **patch/seed**, patch must not rekey (today `patchPartyProfile` already does not rekey).

### Legacy `director_kyc_status` / `isLegacyCtosPartyKycApproved`

```text
Current assumption = lookup by normalized government ID
Problem = user: keys will not hit legacy JSON (correct — those people are supplement-only)
Planned change = no change; generated keys return not-legacy-approved
Backward compatibility = existing APPROVED COD directors unchanged
```

### Extra: `buildSupplementMapByMatchKey`, `linkCtosPartyToKyb`, `matchPersonToParty`, `getDirectorKycPartyRecord`

```text
buildSupplementMapByMatchKey = today drops keys that normalize to empty and hashes normalized IDs; must index exact user: party_key
linkCtosPartyToKyb = finds CTOS company_json row by normalized party_key; for user: keys use identity_number when present, else skip KYB link (no CTOS party yet)
matchPersonToParty = today finds OPP by person.matchKey as identity; must find by exact partyKey OR identity_number
getDirectorKycPartyRecord = leave ID-based; unused for user: rows
```

### Display: `buildDirectorShareholderDisplayRowForEmailEligibility`

```text
Current assumption = MISSING_GOVERNMENT_ID ⇒ cannot enter email / cannot Send (COD/EOD unresolved bucket)
Problem = if we reuse that warning for pre-ID Manual Add, Send stays blocked and UI treats them as unresolved EOD
Planned change = do not set identityWarning on user: people[]; canSendOnboarding true when eligible role + email rules pass; show ID as pending (see §10)
Backward compatibility = true COD unresolved rows keep MISSING_GOVERNMENT_ID
```

---

## 10. people[] must include pre-ID People

Desired:

```text
MASTER_ACTIVE
+ eligible role (Director or individual Shareholder >=5%)
+ Name
+ Person Email
+ no government ID
→ still in People UI, onboarding list, Send, Admin People
```

`matchKey` for these rows = **exact `party_key`** (`user:{uuid}`).

Add a separate display field (recommended: `identityNumber` on `ApplicationPersonRow`, from OPP `identity_number`):

```text
present → show as today
absent  → "Not available" / "Pending onboarding"
```

Do **not** put `user:{uuid}` in the government-ID column.

Do **not** set `identityWarning: MISSING_GOVERNMENT_ID`. That flag means unresolved COD/EOD, empty matchKey, excluded from Send.

Admin People already lists OPP cards (`organization-people-panel`) independently of people[]. Still fold into `people[]` so KYC chips and issuer Send work. Admin has no Send today; no need to add Admin Send in this task.

`PersonIdentityCard` / `data-person-key`: do not use normalized-stripped user keys as if they were NRIC. Prefer OPP `id` or exact `party_key`.

---

## 11. Send lookup

```text
UI/API sends exact stable party_key (people[].matchKey)
→ find people[] row by that key
→ find OPP by exact party_key
→ find supplement by exact party_key
```

Government ID for the RegTank body is **not** the lookup key.

Name: reject Send if `splitForenameSurname` would fall back to `"User"` because the name is empty.

---

## 12. Supplement

Continue unique `(issuer|investor org, party_key)`.

`party_key` may be NRIC-shaped **or** `user:{uuid}`.

Email / Send / status / screening read and write that exact key. **Do not rekey** the supplement after approval.

---

## 13. RegTank `referenceId`

Keep `buildSafeReferenceId(orgId, partyKey)`.

```text
party_key may be user:{uuid}
referenceId is a transport correlation value
referenceId is NOT identity
do not depend on referenceId containing a government ID
```

Webhook: `requestId` first, stored `referenceId` fallback (already).

---

## 14. After APPROVED: query + seed (P1)

Trigger: `tryUpdateCtosPartyOnboardingFromWebhook` after persisting APPROVED (normalized). Also cover restart requestIds if status lands APPROVED there.

```text
onboarding.status APPROVED
→ queryOnboardingDetails(requestId)
→ GET /v3/onboarding/indv/query?requestId=
→ userProfile
```

Fill-empty only; stamp `REGTANK`. Preserve CTOS / USER / ADMIN.

| Field | Seed? |
|---|---|
| `name` | Only if OPP.name empty (Manual Add usually already USER) |
| `identity_number` | If empty and no collision |
| `identity_prefix` | Only with confirmed mapping (§15); else leave null |
| `gender` | If empty and value is exactly MALE or FEMALE (map to SC). Skip UNSPECIFIED |
| `date_of_birth` | If empty and parseable |
| `nationality` | If empty **and** value already matches stored Appendix A names; otherwise skip (open question) |

Do **not** seed: unstructured address, phone, salutation, shares, designation, board/management, **email**.

KYC/AML stay on supplement. Query failure must **not** fail the webhook: log, keep APPROVED, identity remains empty until a retry (reuse existing refresh/query helper if one exists; no new queue required for v1).

---

## 15. Identity prefix (do not invent NRIC vs passport)

RegTank surfaces (current code / types):

```text
Request:            idType = PASSPORT | IDENTITY | DRIVER_LICENSE | RESIDENCE_PERMIT
                    (Person Send today always sends IDENTITY)

Query userProfile:  documentType, documentNum, governmentIdNumber, idIssuingCountry
OCR webhook:        ocrResults.idType, idNumber, idIssuedCountry
Personal-org extract uses userProfile.documentType / documentNum, not OPP
```

SC `identity_prefix` is only `NRIC | PASSPORT | ROC`.

**Confirmed enough to implement without guessing:**

- If returned `documentType` or OCR `idType` is exactly `PASSPORT` (case-insensitive) → `PASSPORT`.

**Not sufficiently supported (needs compliance confirmation):**

- `IDENTITY` → NRIC (MyKad is likely, not proven; foreign national ID is not NRIC)
- `DRIVER_LICENSE` / `RESIDENCE_PERMIT` → no SC prefix
- Infer NRIC from 12-digit pattern
- Infer from `idIssuingCountry === MY`

Until confirmed:

```text
identity_number may be seeded
identity_prefix left null
```

Issuer later completes prefix as a CashSouk/ComRep field. Completeness UX must allow “ID present, prefix missing”.

---

## 16. Later CTOS refresh

Intended:

```text
Manual Person party_key = user:{uuid}
APPROVED → identity_number = 900101xxxxxx
CTOS refresh → candidate 900101xxxxxx
→ findExistingPartyForIdentityKey matches via identity_number
→ fill-empty / external_observation on SAME row
→ party_key stays user:{uuid}
```

Do not create `EXTERNAL_OBSERVED` if that identity already belongs to `MASTER_ACTIVE`.

Do not rekey.

If CTOS refresh happens **before** identity is seeded, CTOS will still create `EXTERNAL_OBSERVED` with NRIC `party_key` (today). That is the collision in §17.

---

## 17. Collision handling (simple, no parallel ID system)

Do not silently merge, rekey, or overwrite.

**When:** seeding `identity_number` from RegTank, or CTOS observe about to create a new row, and `findExistingPartyForIdentityKey` finds **another** party (not self).

**Store** (no migration): JSON on the **onboarding** Person, sibling to CTOS observation so observe merge cannot drop it, e.g. `external_observation.identityConflict` **or** a dedicated key `identity_conflict` inside existing JSON. Preserve this key in `mergeObservationResolutions`.

```text
{
  status: "BLOCKED",
  canonicalIdentity: "...",
  otherPartyId: "...",
  otherPartyKey: "...",
  otherMembershipStatus: "MASTER_ACTIVE" | "EXTERNAL_OBSERVED",
  source: "REGTANK_QUERY" | "CTOS_OBSERVE",
  at: ISO-8601
}
```

Do **not** write `identity_number` onto either row in the blocked path.

**Admin sees it:** existing Admin People. Banner on the onboarding Person card. If the other row is `EXTERNAL_OBSERVED`, it already appears under “New people from CTOS” — add a line that it conflicts with the onboarding Person. Do **not** use Adopt here (Adopt would create a second `MASTER_ACTIVE` with NRIC `party_key`).

**Actions (v1, reuse inactivate / leave observed):**

| Other row | Allowed |
|---|---|
| `MASTER_ACTIVE` | Keep both without linking. Admin inactivates the incorrect Person (existing inactivate). No merge button. |
| `EXTERNAL_OBSERVED` | Default: keep both, no identity seed, do not Adopt. Explicit Admin: **Keep onboarding Person** (seed identity onto `user:{uuid}`, do not promote observed; mark observed as not-adoptable / leave observed) **or** **Keep CTOS Person** (inactivate onboarding Person, Adopt later as today). Both are explicit, not silent. |

Issuer portal: show a non-destructive “Identity needs Admin review” on the card; no self-serve merge.

Do not build a new identity-resolution product. This is a blocked seed + Admin People banner + existing inactivate/Adopt-elsewhere.

---

## 18–20. Unchanged on purpose

Person Email lifecycle: **no change**.

Platform invitation / `User` / `OrganizationMember` / `Invitation` / `user_id`: **no change**. Never auto-link by email. Person Email may prefill invite.

SigningCloud: **no change**. Do not edit `signing/**`, `ekyc/**`, `signingcloud/**`, authorized-parties snapshot code. Signing still reads `people[].email` from OPP email.

---

## 21. ComRep after onboarding (completeness UX)

`computeIssuerPersonCompleteness` today treats a new Person as missing identity, gender, DOB, nationality, address, share type/units/amount, designation, etc. That would show “N fields missing” on a brand-new pre-onboarding card.

Do **not** add a membership status for this.

Reuse KYC chip (`getFinalStatusLabel` kyc_only) + completeness, **gated**:

| State | How | Completeness |
|---|---|---|
| Onboarding not started | KYC Not Started; no send evidence | Do **not** count RegTank-deferred identity/profile fields as blocking. Optional: “Complete onboarding first”. |
| Onboarding in progress | KYC In Progress / WFA | Same: do not block on deferred ComRep identity fields. |
| Onboarding approved but profile incomplete | KYC Approved + `computeIssuerPersonCompleteness` > 0 | **Now** list remaining CashSouk/ComRep fields (prefix, address, salutation, designation, share type/units/amount, dates, board/management as applicable). |
| Profile complete | KYC Approved + completeness empty | No missing banner |

Investor company: do **not** newly apply issuer monthly [05000]/[06000] completeness. If the shared `PersonIdentityCard` already shows issuer `missingCount` on investor, stop using issuer completeness for investor (P2). Investor later edit stays the fields investor already has.

---

## 22. Manual Add UI (P2)

After create: People card, KYC Not Started, Send onboarding (issuer/investor; Admin still no Send unless already planned elsewhere).

After approval: View/Edit shows seeded fields (read-only where source REGTANK and locked by existing fill-empty rules) and empty ComRep fields for issuer/admin to complete.

Board/Management added later via existing Person edit (`partyPatchSchema` / `validatePartyPatch` — patch already allows filling previously empty fields; it rejects **clearing** required fields). Confirm patch does not require identity to be present before other fields can be saved (today `rejectClearedRequiredText` only fires if the client sends an empty identity). **Do not** start requiring full ComRep on every patch.

---

## 23. Admin

Same OPP model. Admin may inspect, patch permitted fields, see identity conflict, complete ComRep.

**Minimal Add in Admin:** yes for **onboarding-eligible individuals** (same fields as issuer).

**Unsafe to replace Admin Add entirely:** Admin still must add corporate shareholders and Board/Management with the full form (identity required for those roles today). Keep that path.

Admin create already uses `createUserAddedParty` with `source: ADMIN`. Same API split as issuer.

---

## 24. Investor company

Same architecture: stable `party_key`, minimal add, same Send, same seed, same email lifecycle.

Personal investor: unchanged.

Do not add issuer ComRep fields to investor.

---

## 25. Tests to add

```text
create Director without government ID → party_key user:{uuid}, MASTER_ACTIVE
create >=5% shareholder without government ID → user:{uuid}
<5% shareholder → still rejected (existing threshold)
pre-ID Person appears in people[] with matchKey = exact party_key, no MISSING_GOVERNMENT_ID
Send finds user:{uuid} exactly (colon preserved)
Send with no ID → governmentIdNumber empty
Send with existing CTOS ID → sends that ID
supplement row keyed by user:{uuid}
IN_PROGRESS email change still resets local pipeline/screening
APPROVED webhook + query seeds identity_number when empty
party_key unchanged after seed
later CTOS identity match finds same Person by identity_number
CTOS observe does not rekey user:{uuid}
collision MASTER_ACTIVE → no seed, no silent merge
collision EXTERNAL_OBSERVED → blocked seed, Admin review payload
invite / user_id unchanged
people[].email still from OPP.email
SigningCloud / signing/** / ekyc/** files unchanged (grep/guard in test or review)
create with NRIC still uses NRIC party_key (backward compatible)
single-word name still sends surname "."
empty name rejected at Send
```

---

## 26. Files to change (when implementation starts)

**P0 — identity + Send (no UI required)**

- `apps/api/src/modules/organization-profile/service.ts` — `createUserAddedParty`, observe rekey, `fillEmptyPartyFromCandidate`
- `apps/api/src/modules/organization-profile/schemas.ts` — split create schema
- `packages/types/src/comrep-requiredness.ts` — optional `validateOnboardingPersonCreate`
- `packages/types/src/organization-party-key.ts` — lookup helper
- `apps/api/src/modules/admin/build-people-list.ts` — matchKey, supplement map, fold
- `packages/types/src/application-people-display.ts` — identity display vs unresolved warning
- `packages/types/src/director-shareholder-display.ts` — eligibility row ID display only as needed
- `apps/api/src/modules/organization/service.ts` — Send, email upsert, `resolveKycEligibleDisplayRow`, ID gate
- `apps/api/src/modules/organization-profile/person-email.ts` — exact key (if callers fixed)
- `apps/api/src/modules/organization/ctos-party-kyb-link.ts` — match by identity_number for user: keys

**P1 — query seed + collision**

- `apps/api/src/modules/regtank/webhooks/individual-onboarding-handler.ts`
- New small helper (organization-profile): seed from userProfile + collision
- `apps/api/src/modules/organization-profile/serialize.ts` — preserve `identityConflict` in observation merge
- Admin People banner on existing cards

**P2 — UI + completeness**

- `packages/ui/src/portal-person-forms.tsx` — `AddPersonForm` split
- `packages/ui/src/portal-people-section.tsx` — Send key, pending ID copy, completeness gating
- `packages/ui/src/person-identity-card.tsx` — pending ID; do not treat user: as NRIC
- `apps/admin/src/organizations/components/organization-person-editor-dialog.tsx` + `organization-people-panel.tsx`
- `packages/types/src/comrep-profile.ts` — gate `computeIssuerPersonCompleteness` by onboarding state **or** call-site gating (prefer call-site to avoid hiding true gaps after APPROVED)

**Do not touch**

- `signing/**`, `ekyc/**`, `signingcloud/**`, authorized-parties snapshot
- RegTank HTTP contract / `api-client` URLs (only *use* existing `queryOnboardingDetails`)
- Invitation / User / OrganizationMember models
- `splitForenameSurname` logic (except reject empty name before calling it for Send)

---

## FUTURE IMPROVEMENTS

- `splitForenameSurname` is not legal-name parsing (Malay / Indian / Chinese / compound names). Do not change in this work.
- Person Send still hardcodes `MY` / `UNSPECIFIED` gender on the **request**. Out of scope.
- Unique partial DB index on canonical `identity_number` per org (safer than app-only collision).
- Retry job if APPROVED query fails.
- Confirmed `IDENTITY` → NRIC mapping if compliance signs off.
- Nationality ISO vs Appendix A mapping.

---

## STABLE PERSON IDENTITY / MINIMAL ADD IMPLEMENTATION PLAN

```text
MANUAL ADD
Initial fields = Name, Person Email, Role (Director and/or Shareholder), Shareholding % if Shareholder
Membership status after create = MASTER_ACTIVE
KYC status after create = Not Started
Full ComRep required before create = No (individual onboarding-eligible path only)

PARTY KEY
Pre-ID party_key = user:{uuid}
Government identity storage = identity_number (+ identity_prefix if mapping confirmed)
Rekey after approval = No

PEOPLE[]
How pre-ID Person is included = fold MASTER_ACTIVE eligible roles with matchKey = exact party_key;
  display ID from identity_number or "Not available / Pending onboarding";
  never MISSING_GOVERNMENT_ID / unresolved-COD bucket

SEND
Person lookup = exact party_key (do not strip user: punctuation)
ID known = governmentIdNumber = identity_number
ID unknown = governmentIdNumber = ""

SUPPLEMENT
Key = same exact party_key (NRIC historical OR user:{uuid}); never rekey

REGTANK REFERENCE
Correlation strategy = buildSafeReferenceId(orgId, partyKey); webhook requestId then stored referenceId;
  referenceId is not identity

APPROVED QUERY
Trigger = Person supplement status APPROVED in existing individual webhook handler
Endpoint = GET /v3/onboarding/indv/query?requestId= (queryOnboardingDetails)
Fields seeded = empty name, identity_number, identity_prefix if confirmed, gender MALE/FEMALE, DOB, nationality if Appendix A-safe
Seed precedence = fill-empty only; stamp REGTANK; never overwrite CTOS/USER/ADMIN; never overwrite email

CTOS LATER REFRESH
Matching strategy = findExistingPartyForIdentityKey via identity_number
Rekey behavior = never rekey user:{uuid}; do not create duplicate EXTERNAL_OBSERVED when MASTER_ACTIVE already has that identity

COLLISION
Existing MASTER_ACTIVE = block seed; keep both; Admin inactivate the wrong one; no merge
EXTERNAL_OBSERVED = block seed; do not Adopt; Admin explicit Keep onboarding Person vs Keep CTOS Person
Admin action = banner on existing Admin People; reuse inactivate; do not invent a new identity product

COMREP AFTER ONBOARDING
Fields deferred = NRIC/passport prefix if unresolved, gender/DOB/nationality until seeded, structured address, salutation, designation, share type/units/amount, appointment/resignation, board/management
Completeness UX = hide deferred field-missing until KYC Approved; then show remaining gaps; investor does not gain issuer ComRep

EMAIL LIFECYCLE
Changed = No

PLATFORM INVITE
Changed = No

SIGNINGCLOUD
Changed = No
MUST BE: No

DATABASE / MIGRATIONS NEEDED =
No membership-status enum change.
No new tables required for v1.
Collision stored in existing OPP JSON.
Optional later: unique partial index on (org, canonical identity_number) where identity_number is not null.
people[] DTO may add identityNumber for display (API shape, not a migration).

FILES TO CHANGE =
See §26 (P0 / P1 / P2). SigningCloud files must remain untouched.

TESTS TO ADD =
See §25.

RISKS / OPEN QUESTIONS =
1. people[].matchKey today is documented as government ID. Forward behavior: matchKey = stable party_key. Anything (scripts, tests, Admin deep-links) that assumes matchKey === NRIC must be updated. COD unresolved rows stay the old empty-matchKey warning.
2. identity_prefix: only PASSPORT is safe to auto-set; IDENTITY→NRIC needs compliance confirmation. Seed ID number without prefix until then.
3. Race: CTOS observe before RegTank seed creates EXTERNAL_OBSERVED NRIC row; collision Admin path must be implemented before relying on “same Person” CTOS compare. Nationality Appendix A mapping is unconfirmed — skip seed if not an exact known name.
4. linkCtosPartyToKyb cannot attach a user: Person to CTOS company_json until identity_number exists — acceptable.

SAFE TO IMPLEMENT =
No as one unphased change.
Yes as sequenced P0 → P1 → P2 after accepting:
  matchKey = stable party_key;
  identity_prefix left null unless document type is exactly PASSPORT;
  collision = block seed + Admin review, never silent merge/rekey;
  no new membership status;
  SigningCloud / invite / email lifecycle / CTOS name split unchanged.
```
