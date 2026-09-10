# Admin People Test seed

Local demo organisations for the redesigned Admin Organisation / People & Access UI.

Does not change production business logic, schema, APIs, KYC/AML, RegTank, CTOS, ComRep, invitations, or ownership.

## Command

```bash
pnpm --filter @cashsouk/api seed:admin-people-demo
```

Also runs at the end of `pnpm --filter @cashsouk/api prisma:seed`.

Idempotent: children for these org ids are deleted and recreated. Blocked when `NODE_ENV=production`.

These users follow the existing local seed convention (Cognito `seed_apt_*` placeholders). They do not get a documented shared password.

## Organisations

| Portal | Name | ID | Admin URL |
| --- | --- | --- | --- |
| Issuer company | Admin People Test Sdn Bhd | `seed_admin_people_test_issuer_org` | `/issuers/seed_admin_people_test_issuer_org?tab=people` |
| Investor company | Admin People Test Investor Sdn Bhd | `seed_admin_people_test_investor_org` | `/investors/seed_admin_people_test_investor_org?tab=people` |
| Personal investor | Lina Aziz | `seed_admin_people_test_personal_org` | `/investors/seed_admin_people_test_personal_org` |

No Personal Issuer is seeded.

## Issuer matrix — Admin People Test Sdn Bhd

| Name | Company Role | Platform Access | KYC | AML | CTOS | Master | Special case |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alice Tan | Director | No access | Approved | Approved | Matched | MASTER_ACTIVE | |
| Benjamin Lee | Shareholder 10% | User | Approved | Pending | Matched | MASTER_ACTIVE | Person Email `person.contact@…` ≠ Account Email `login.account@…` |
| Chloe Lim | Director, Shareholder 25% | Admin | Pending approval | Not started | Matched | MASTER_ACTIVE | |
| Daniel Wong | Director | Owner | Approved | Approved | Matched | MASTER_ACTIVE | Owner via `owner_user_id` |
| Finance User | — | User | — | — | — | platform_only | No party |
| Operations Admin | — | Admin | — | — | — | platform_only | No party |
| Evelyn Goh | Director | Invitation sent | In progress | Pending | Matched | MASTER_ACTIVE | Pending invite |
| Farid Ahmad | Shareholder 8% | Invitation expired | Not started | Not started | Matched | MASTER_ACTIVE | Expired invite |
| Grace Ong | Director | — | — | — | Observed only | EXTERNAL_OBSERVED | No master party |
| Henry Teo | Director, Shareholder 20% | No access | Approved | Approved | Differs | MASTER_ACTIVE | CTOS 35% vs master 20% |
| Irene Yap | Director | No access | Expired | Pending | Not found | MASTER_ACTIVE | `absentFromLatestExternal` |
| Jason Ng | Director | No access | Rejected | Rejected | Matched | MASTER_INACTIVE | Inactive, no member |
| Karen Ho | Shareholder 6% | User | Approved | Approved | Matched | MASTER_INACTIVE | Inactive, member kept |
| Legacy Holdings Sdn Bhd | Shareholder 20% | — | — | Approved | Matched | MASTER_ACTIVE | Corporate / KYB AML |
| Nathan Chong | Director | No access | In progress | Not started | Differs | MASTER_ACTIVE | Identity conflict BLOCKED |
| Nathan Chong (CTOS) | Director | — | — | — | Observed only | EXTERNAL_OBSERVED | Conflict twin |
| Olivia Chan | Shareholder 3% | — | — | — | Observed only | EXTERNAL_OBSERVED | Below 5% Adopt gate |
| Peter Lim | Director | No access | Rejected | Rejected | Matched | MASTER_ACTIVE | Active rejected KYC/AML |

## Investor company subset

| Name | Company Role | Platform Access | KYC | AML | CTOS | Special case |
| --- | --- | --- | --- | --- | --- | --- |
| Priya Menon | — | Owner | — | — | — | Owner, no party |
| Raj Kumar | Director | No access | Approved | Approved | Matched | |
| Siti Rahman | Shareholder 12% | User | Approved | Pending | Matched | |
| Wei Ming | Director, Shareholder 18% | No access | Approved | Approved | Differs | CTOS 30% vs 18% |
| Gina Foo | Director | — | — | — | Observed only | |
| Owen Chin | Shareholder 3% | — | — | — | Observed only | Below 5% |
| Apex Nominees Sdn Bhd | Shareholder 15% | — | — | Approved | Matched | Corporate |
| Investor Ops | — | User | — | — | — | Platform-only |

## What to look for on the Organisation page

| Surface | Where |
| --- | --- |
| KYB/AML Screening Result | Issuer + investor company (`kyc_response`) |
| KYC/AML Screening Result | Personal investor Lina Aziz |
| Wealth Declaration, Document Info, Liveness, Compliance | All three orgs |
| CTOS report history (latest + older) | Issuer + investor company |
| PIC “Differs from current contact” | Issuer PIC email; investor PIC position |
| Financials | Issuer unaudited 2024 block |
| Bank account | All three orgs |

## Login emails (local placeholders)

Issuer: `daniel.wong@admin-people-test.example`, `login.account@admin-people-test.example`, `chloe.lim@admin-people-test.example`, `finance.user@admin-people-test.example`, `operations.admin@admin-people-test.example`, `karen.ho@admin-people-test.example`

Investor company: `priya.menon@admin-people-test.example`, `siti.rahman@admin-people-test.example`, `investor.ops@admin-people-test.example`

Personal: `lina.aziz@admin-people-test.example`

## CTOS fixtures reused

Structure adapted from `apps/api/src/ctos-test/output/2026-09-07T13-18-48-048Z_company_200501525124.json` (`company_json.directors` with `party_type` I/C, `nic_brno` / `ic_lcno`, `position` DO/SO/DS, `equity_percentage`, `appoint`). Names and IDs are fictional.

## Unsupported

Case 16 — Michelle Low as a `people_only` unmatched row. With a structured master, `retainMasterActiveOperationalPeople` drops `people[]` rows that are not `MASTER_ACTIVE`. Creating a party would link her. This seed does not change that filter.

Inactive Jason/Karen KYC/AML source data is seeded on supplements. The Admin table may still show `—` for inactive rows because `people[]` merge only includes `MASTER_ACTIVE`.
