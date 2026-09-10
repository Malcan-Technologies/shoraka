# Person onboarding consistency plan

Status: **plan only. Do not implement yet.**

This is the product and architecture plan for **company Person** RegTank onboarding (issuer and investor company People). It is **not** personal-org onboarding, **not** platform invitation, and **not** SigningCloud.

Wording: this is **minimal pre-onboarding Person creation**. It is **not** “email-only Manual Add”. Name and Role are required. Shareholding % is required only when Role includes Shareholder.

---

## Product decision (approved)

```text
Government ID is NOT universally required before Person RegTank Send.

Minimum data before Person Send:
- Name
- Person Email
- Eligible role
- Company onboarding COMPLETED
- Shareholding % only when Role includes Shareholder (existing >=5% eligibility)

Government ID:
- if known → send it
- if unknown → allow Send (empty / omitted governmentIdNumber)
- never fabricate an ID
- never use email as identity
```

This rule is the **same** for:

```text
CTOS-adopted Person
manually added Person
issuer company People
investor company People
```

Do not create origin-specific Person onboarding pipelines. Both paths use the existing:

```text
sendPartyKycAmlOnboarding
/ sendDirectorCtosPartyOnboarding
```

---

## CURRENT MANUAL ADD vs NEW MANUAL ADD

### CURRENT MANUAL ADD

Full ComRep Person form **before** create / before RegTank:

```text
Name
IC / passport + identity prefix
Gender
DOB
Nationality
Residential address + state + postcode
Roles
Share type / units / amount / %
Designation
Appointment / resignation (when officer)
optional Person Email
→ create Person
→ Send RegTank later (today also blocked if government ID missing)
```

API/UI enforcement today: `validateIssuerPersonForm` + `createPartySchema` + `createUserAddedParty` (`needsIdentity` for director / shareholder / board).

### NEW MANUAL ADD

**Minimal pre-onboarding Person creation:**

```text
Name *
Person Email *
Role *
Shareholding % *  only if Role includes Shareholder
→ create pending Person (stable party_key; government ID may be empty)
→ Send RegTank (same Send function as CTOS Adopt)
→ Person APPROVED
→ GET /v3/onboarding/indv/query?requestId=
→ seed missing verified/base OPP fields (fill-empty, stamp REGTANK)
→ issuer/admin completes remaining CashSouk / ComRep fields
```

Full ComRep Person profile is **not** required before onboarding.

Do not implement the UI until this plan’s identity architecture is accepted and an implementation phase is explicitly started.

---

## 1. Why this is changing

RegTank `POST /v3/onboarding/indv/request` requires email + forename + surname. `governmentIdNumber` is optional.

CashSouk currently adds its own gate in `sendDirectorCtosPartyOnboarding`:

```text
"Party has no government ID for onboarding"
```

Personal-org onboarding already starts the same individual API with `governmentIdNumber: ""`.

Therefore Person Send must not block solely because government ID is missing — **once** `party_key` architecture for pre-ID People is resolved.

---

## 2. Consistent Person Send rule

Allowed when:

```text
Person has Name
+ Person Email
+ eligible role (Director, or individual Shareholder >=5%)
+ company onboarding COMPLETED
+ if Shareholder: shareholding % present so >=5% can be evaluated
```

If OPP already has a government ID → send it.

If OPP does not → send empty / omitted `governmentIdNumber` per the existing RegTank client contract.

Do not manufacture a fake ID. Do not use email as identity.

---

## 3. CTOS Adopt (unchanged identity; same Send)

CTOS-adopted Persons usually already have Name, NRIC/passport, Director/shareholder role, possibly shareholding %. Preserve all of that.

```text
CTOS Adopt
→ CTOS already supplies Name + identity + role
→ issuer supplies Person Email
→ Send onboarding (same function)
```

Known government ID continues to be sent. The change is only that government ID is no longer a **universal** Send prerequisite.

Do not remove CTOS identity data. Do not alter CTOS matching. Do not change CTOS name processing.

---

## 4. Manual Add — minimal pre-onboarding form

### Initial fields (Person / individual)

| Field | Required | Why |
|---|---|---|
| **Name** (one full-name field) | Yes | OPP.name; RegTank forename/surname via existing split at Send |
| **Person Email** | Yes | RegTank request email; existing email lifecycle |
| **Role** | Yes | Determines whether Send is eligible |
| **Shareholding %** | Only if Role includes Shareholder | Existing CashSouk rule: individual shareholder onboarding-eligible only if >=5% |

Role on this form means the **operational KYC role(s)** needed to decide Send:

- Director → onboarding eligible
- Individual shareholder → onboarding eligible only if shareholding % >= 5%
- A Person may be both Director and Shareholder (keep that; do not force a single exclusive role)

Board / Management are **not** initial Add fields. Current business logic does **not** send Board/Management-only people to Person RegTank. Do not assume they require it. They remain later CashSouk / ComRep fields.

This plan is for **individual Person** onboarding. Corporate (company) shareholder add is a different form and is out of scope here.

### Do **not** ask at initial Manual Add

```text
NRIC / Passport
Identity prefix / type
Gender
Date of Birth
Nationality
Residential address
State
Postcode
Salutation
Designation
Share type
Share units
Share amount
Appointment / resignation dates
other ComRep Person profile fields
```

Those are either:

- seeded later from RegTank when mapping is confirmed and the OPP field is empty, or
- completed later by issuer/admin as CashSouk / ComRep-only fields.

---

## 5. Name model

CashSouk keeps **one** full Name field:

```text
OrganizationPartyProfile.name = full Person name
people[].name = same
```

Do **not** introduce Forename / Surname fields in CashSouk.

At RegTank Send:

```text
full name → existing splitForenameSurname(...) → RegTank forename + surname
```

CTOS already supplies a full Person name. Preserve:

```text
CTOS full name → OPP / people[].name → existing splitForenameSurname at Send
```

Do not change CTOS name processing. Do not change current split behavior in this task.

Require a usable non-empty Name before Send. Do not invent surname data. Do not use the empty-name fallback `"User"` / `"."` for **missing** names.

The existing `"."` surname workaround for **legitimate single-word names** may stay. Weaknesses of the split belong only under **FUTURE IMPROVEMENTS / NOTES**.

---

## 6. Role eligibility (unchanged business rule)

```text
Director                  → onboarding eligible
Individual shareholder    → onboarding eligible iff shareholding % >= 5%
Board / Management only   → not Person RegTank Send (current logic)
```

Do not change the >=5% rule.

---

## 7. After RegTank approval

```text
Person reaches APPROVED
→ GET /v3/onboarding/indv/query?requestId=
→ obtain userProfile
→ seed missing OPP profile fields (fill-empty only)
```

The query can return name, government ID, email, gender, DOB, nationality, country, phone, address string, ID issuing country, kycId, document/liveness data.

Do not blindly map all fields. Use only confirmed mappings.

---

## 8. RegTank → OPP seed policy

CashSouk master-data precedence:

```text
OPP field empty              → RegTank may seed → stamp field source REGTANK
OPP already filled by CTOS   → preserve
OPP already filled by USER   → preserve
OPP already filled by ADMIN  → preserve
```

Do not silently overwrite existing master data.

No RegTank-vs-master comparison UI unless already planned elsewhere.

### Fields RegTank may potentially seed (empty + mapping confirmed)

| OPP field | Seed from query? |
|---|---|
| `name` | Yes, if empty |
| `identity_number` + inferred `identity_prefix` | Yes, if empty — **does not rekey `party_key`** |
| `gender` | Yes, if empty and mapping to SC Male/Female is confirmed |
| `date_of_birth` | Yes, if empty |
| `nationality` | Yes, if empty and Appendix A mapping is confirmed |

### Do not blindly map

```text
unstructured RegTank address string → structured OPP address / state / postcode
phone                               → no Person phone column on OPP
salutation
shareholding % / units / amount / share type
designation / designation other
board / management roles
email                               → already collected; do not overwrite locked/master email from query
country / placeOfBirth hardcoded MY on request vs returned country
```

KYC/AML status remains on `CtosPartySupplement.onboarding_json`.

---

## 9. CashSouk-only / ComRep fields come later

After onboarding, issuer/admin complete remaining Person profile as appropriate. These are **not** initial Add fields.

ComRep still needs them for later reporting (monthly issuer [05000] shareholding, [06000] board/management, and related annual operator tabs). Collection is deferred, not cancelled.

Typical later CashSouk / ComRep fields:

```text
Salutation
Identity prefix (if still empty after RegTank)
Structured residential / business address (line, state, postcode)
Designation + Designation - Others
Share type + Type of Shares - Others
Shareholding units
Shareholding amount
Appointment date
Resignation date
Board of Director / Management Team flags
other ComRep Person-only fields
```

Shareholding **percentage** may already exist from Manual Add (eligibility). Units/amount/type remain later unless product later decides otherwise.

---

## 10. Identity architecture (implementation gate)

Removing the Send ID gate for people who **already have** an ID (typical CTOS Adopt) is small.

Allowing a **new Person to exist before government ID is known** is the wider change. **Do not implement Manual Add without ID until this section is designed into code.**

### Current USER_ADDED `party_key` strategy

```text
If identity present  → party_key = canonical government ID
If identity absent   → party_key = user:{uuid}
```

`user:` already exists (`USER_GENERATED_PARTY_KEY_PREFIX`). Today it is only reachable for **management-only** people.

Directors / shareholders / board cannot be created without identity:

```text
needsIdentity = director OR shareholder OR board
if needsIdentity && !identityKey → 400 "Identity number is required for this role"
```

Plus `validateIssuerPersonForm` requires IC/passport on create.

### Can OPP exist without government ID today?

```text
Yes, but only management-only rows (party_key = user:{uuid}).
Directors / shareholders / board: No — create is blocked.
```

### Does anything assume `party_key` == government ID?

**Yes, widely, for KYC People.**

| Surface | Today |
|---|---|
| people[] `operationalMatchKeyForMasterParty` | `user:` keys with empty `identity_number` return **null** → Person **excluded** from operational people[] |
| Send / email / supplement lookup | `normalizeDirectorShareholderIdKey(partyKey)` strips non-alphanumerics (`user:abc-def` → `USERABCDEF`) then looks up `party_key = pk` — **misses** the real key |
| Display Send gate | `canSendOnboarding` false when `MISSING_GOVERNMENT_ID` (COD unresolved-EOD rows — do not reuse that bucket for planned pre-ID Manual Add) |
| `buildSafeReferenceId` | strips `:` from `user:` (colon is not `[A-Za-z0-9_-]`) |
| Supplement unique index | `(org, party_key)` |
| CTOS observe / merge | `findExistingPartyForIdentityKey` matches party_key **or** `identity_number`; empty identity + `user:` key **does not** match a later CTOS NRIC → second `EXTERNAL_OBSERVED` row |
| Observe rekey | If `identity_number` is later filled, observe may **rekey `party_key` to NRIC** and desync supplement |
| Legacy `director_kyc_status` | Matches government ID |
| Invitations / `user_id` | Use OPP **id**, not `party_key`. Unchanged. |

### Required architecture (before Manual Add without ID)

```text
party_key = stable internal key user:{uuid}
Later: RegTank APPROVED → populate identity_number / identity_prefix
DO NOT rekey party_key
```

Must explicitly handle:

1. **people[] inclusion for `user:{uuid}`**  
   Operational match key must be the **raw stable `party_key`** (or OPP id), not “canonical ID or skip”. Eligible director / >=5% shareholder rows with empty identity must appear on the KYC People list.

2. **Send lookup**  
   Stop assuming `input.partyKey` is a normalized NRIC. Look up OPP and supplement by **exact `party_key`** (or OPP id). Do not run `normalizeDirectorShareholderIdKey` on `user:` keys.

3. **Supplement lookup**  
   Create/read `CtosPartySupplement` with the same stable `party_key`. Unique `(org, party_key)` stays.

4. **RegTank `referenceId`**  
   Keep `buildSafeReferenceId(orgId, partyKey)`. For `user:{uuid}`, colon is stripped; hyphens remain. That value is stored on supplement JSON. Do not later change `party_key` out from under it.

5. **Webhook matching**  
   Prefer `onboarding_json.requestId`. Secondary match on stored `referenceId`. Org parse from `referenceId` prefix before first `_` remains valid. Do **not** require `party_key == NRIC` for webhooks.

6. **CTOS matching after verified identity arrives**  
   Match on `identity_number` (already supported). **Do not rekey** `user:` `party_key` during observe / `fillEmptyPartyFromCandidate`.

7. **Duplicate / collision handling**  
   If seeded or CTOS identity collides with:
   - another `MASTER_ACTIVE` Person, or
   - an `EXTERNAL_OBSERVED` CTOS row with the same ID  
   → **do not silent-merge, do not silent-rekey.** Treat as Adopt / mismatch. Define the operator path before coding (block seed / surface conflict / require Adopt). A pre-ID Manual Add Person + later CTOS person with the same NRIC is the main collision.

8. **No silent rekey after Send**  
   Rekeying OPP without the supplement, or rekeying after RegTank already stored `referenceId`, is out of bounds.

CTOS Adopt people who already have NRIC `party_key` keep that key. This architecture is required for **new** pre-ID Manual Add People.

---

## 11. Person Email lifecycle (unchanged)

```text
Before Send            → Email editable
IN_PROGRESS            → Email editable; allowed change resets local pipeline/screening
WAIT_FOR_APPROVAL      → locked
KYC APPROVED           → locked
AML terminal           → locked
```

Removing the government-ID Send gate must not change this.

---

## 12. Platform invitation (unchanged)

Person onboarding = identity / KYC / AML.

Platform invitation = CashSouk account / access (`User`, `OrganizationMember`, `Invitation`, `user_id`).

Never auto-link by email. Person Email may still **prefill** a later invite. No changes to those models.

---

## 13. SigningCloud (unchanged)

```text
OPP.email → people[].email → existing signing flow
```

No direct OPP integration into SigningCloud. **SigningCloud changed = No.**

---

## 14. Pre-Send comparison (common rule drives implementation)

| Requirement before Person Send | CTOS Adopt today | Manual Add today | Desired common rule |
|---|---|---|---|
| Name | From CTOS | Required (full form) | **Required** (one full Name) |
| Person Email | Later; required at Send | Optional at create; required at Send | **Required at Send** (and at new Manual Add create) |
| Eligible role | From CTOS | Required | **Required** |
| Shareholding % | From CTOS if shareholder | Required if shareholder (plus units/amount/type) | **Required only if Role includes Shareholder** (eligibility); not full share block |
| Government ID | From CTOS; Send blocked if missing | Required at create **and** Send | **Optional.** Send if present; empty if not |
| Gender / DOB / nationality | Not at Adopt | Required at create | **Not required** before Send |
| Address / state / postcode | Not at Adopt | Required at create | **Not required** before Send |
| Salutation / designation / share type / units / amount / dates | Not at Adopt | Required when role implies them | **Not required** before Send |

---

## 15. Convergence before Send

```text
CTOS Adopt
→ CTOS Name + identity + role
→ issuer Person Email
→ Send

Manual Add
→ Name + Person Email + role
→ shareholding % only if shareholder
→ Send

Both → sendPartyKycAmlOnboarding / sendDirectorCtosPartyOnboarding
```

No separate Manual Add onboarding pipeline.

---

## MANUAL ADD PERSON — NEW FLOW

```text
Initial fields =
  Name
  Person Email
  Role
  Shareholding % only if required (Role includes Shareholder)

Full ComRep profile required before onboarding = No

Government ID required before Send = No

Name model = One full Name field (OrganizationPartyProfile.name)

RegTank forename/surname = Existing splitForenameSurname at Send time

CTOS name behavior changed = No

Fields deferred to RegTank =
  NRIC / Passport (and prefix once inferred)
  Gender (if mapping confirmed)
  Date of Birth
  Nationality (if mapping confirmed)
  Name only if OPP name is still empty (unusual for Manual Add)

Fields completed later in CashSouk =
  Salutation
  Structured address / state / postcode
  Designation (+ Others)
  Share type / units / amount (+ Others)
  Appointment / resignation dates
  Board / Management flags
  other ComRep Person-only fields not returned by RegTank

Stable party_key architecture required = Yes
  party_key = user:{uuid} when government ID is unknown
  identity_number / identity_prefix filled after APPROVED
  never rekey party_key after Send

Person Email lifecycle changed = No

Platform invitation changed = No

SigningCloud changed = No
```

---

## PERSON ONBOARDING CONSISTENCY PLAN

```text
COMMON PRE-SEND REQUIREMENTS
Name = Required (one full Name; no Forename/Surname fields; no "User" fallback for missing name)
Email = Required (Person Email)
Role = Required and eligible: Director, or individual Shareholder >=5%
Government ID = Optional (send if known; empty if not)
Company onboarding status = COMPLETED
Shareholding % = Required only when Role includes Shareholder

CTOS ADOPT
Existing identity preserved = Yes
Send behavior = Same Send function; usually sends existing ID; missing ID no longer a universal block

MANUAL ADD
Initial fields = Name, Person Email, Role, Shareholding % if shareholder
Fields deferred until RegTank = identity, gender, DOB, nationality (fill-empty after query)
Fields completed later in CashSouk = ComRep remainder (address, salutation, designation, share type/units/amount, officer dates, board/management)

REGTANK REQUEST
governmentIdNumber when known = Send OPP identity
governmentIdNumber when unknown = Empty / omitted (same contract as personal org)
forename/surname = splitForenameSurname(OPP.name) — do not change split in this task

AFTER APPROVAL
Query endpoint = GET /v3/onboarding/indv/query?requestId=
Fields available = userProfile (name, gov ID, email, gender, DOB, nationality, country, phone, address string, ID issuing country, kycId, documents/liveness)
OPP seed policy = Fill-empty only; stamp REGTANK; never overwrite CTOS/USER/ADMIN

PARTY KEY / IDENTITY
Current USER_ADDED party_key strategy = Canonical government ID if present; else user:{uuid} (management-only today)
Can Person exist without ID = Yes only for management-only. Directors/shareholders/board cannot today
Can party_key stay stable after verified ID arrives = Yes — and it must, if Send already used that key
Required architecture change = people[] / Send / supplement / referenceId / webhooks / CTOS match on identity_number / collision handling / no rekey after Send

PEOPLE / EMAIL LIFECYCLE
Existing lifecycle preserved = Yes

PLATFORM INVITE
Changed = No

SIGNINGCLOUD
Changed =
MUST BE: No
```

---

## RISKS / BLOCKERS BEFORE IMPLEMENTATION

1. **Stable `party_key` is not wired for KYC People.** A director created as `user:{uuid}` is excluded from people[], broken by ID-normalization on Send, and can duplicate on CTOS observe. Manual Add without ID cannot ship until people[], Send, supplement, and observe-rekey are designed against a stable key.

2. **Rekeying `party_key` to NRIC after approval desyncs supplement + RegTank `referenceId`.** Verified ID must land on `identity_number` / `identity_prefix` only. Observe must not rekey `user:` keys.

3. **Identity collision** with `EXTERNAL_OBSERVED` or another `MASTER_ACTIVE` Person after RegTank returns an NRIC is Adopt/mismatch, not silent merge. Operator path must be specified before coding.

4. **ComRep completeness is deferred, not removed.** Initial Add will not satisfy [05000]/[06000] person columns (identity, gender, DOB, nationality, structured address, designation, share type/units/amount). Export/completeness UX must not assume those exist immediately after create.

---

## FILES / FUNCTIONS (current; for a later implementation)

- Create / schema: `createUserAddedParty`, `createPartySchema`, `validateIssuerPersonForm`, `needsIdentity`
- Keys: `packages/types/src/organization-party-key.ts` (`user:`, `findExistingPartyForIdentityKey`)
- people[]: `operationalMatchKeyForMasterParty`, `mergeMasterPartiesIntoPeopleList`
- Send: `sendDirectorCtosPartyOnboarding` / `sendPartyKycAmlOnboarding`, `splitForenameSurname`, `buildSafeReferenceId`, government-ID throw
- Email: `writeOrganizationPartyEmail`, email lifecycle helpers
- Display Send gate: `buildDirectorShareholderDisplayRowForEmailEligibility` (`canSendOnboarding`)
- Supplement / webhooks: `findCtosPartySupplementForOrg`, `findCtosPartySupplementByOnboardingJsonMatch`
- CTOS: `observeExternalCtosParties`, `fillEmptyPartyFromCandidate` (rekey)
- Query / seed: `queryOnboardingDetails` / `getOnboardingDetails` (used for personal org today, not company Person OPP)
- UI (later phase): issuer/investor Portal People Add, `packages/ui` portal person forms, admin person editor — **not this phase**

---

## FUTURE IMPROVEMENTS / NOTES

Do **not** fix these in this task.

- `splitForenameSurname`: empty name becomes `"User"` / `"."` (must not be used for missing names once Send requires a real Name). Single token → forename + `"."`. Multiple tokens → first token forename, remainder surname. That is a convenience split, not legal-name parsing. Malay / Indian / Chinese / single-word / compound names can be wrong. Do not change CTOS or Send split behavior here.
- `countryOfResidence` / `nationality` / `placeOfBirth` / `idIssuingCountry` are hardcoded `"MY"` and gender `"UNSPECIFIED"` on Person Send. Out of scope unless a later mapping task.
- `idType` is hardcoded `IDENTITY` even when passport is known.
- Unstructured RegTank address / phone have no confirmed OPP mapping.
- Gender mapping from RegTank to SC Male/Female (and never SC Not Applicable for individuals) needs a confirmed mapping before seed.
- Nationality vs Appendix A names needs a confirmed mapping before seed.
- Identity prefix inference (NRIC vs Passport) from returned ID / issuing country must be confirmed before seed.
- Collision UX when a verified ID matches an existing CTOS-observed person is not designed.
- Board/Management Person RegTank eligibility is **not** being introduced.
- Corporate shareholder Manual Add remains a separate, identity-required company flow.
