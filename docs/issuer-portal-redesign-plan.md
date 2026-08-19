# Issuer Portal — UI/UX Redesign Plan

**Status:** Proposed · **Scope:** `apps/issuer` (+ shared tokens in `packages/styles`, shared primitives in `packages/ui`)
**Delivery model:** Big-bang redesign on a single branch
**Companion doc:** [BRANDING.md](../BRANDING.md) — updated as part of this plan (see §3)

> This is a **plan only**. No code is written until it is approved.

---

## 0. Decisions taken

| # | Decision | Choice |
|---|---|---|
| 1 | Applications list format | **Keep cards, slimmed down** — summary + status + one primary action; detail moves to a per-application page |
| 2 | Information architecture | **Merge Financing + Notes → "Portfolio"**; Activity folds into a Dashboard tab |
| 3 | Offer review surface | **Section on the application detail page** (replaces the 1,100-line modal) |
| 4 | Rollout | **Big-bang** — one coordinated branch, no interim inconsistency |

Decision 4 has a consequence the plan is built around: because there is no shippable midpoint, **correctness is enforced by the action inventory in §6**, not by incremental release. Nothing merges until every row in that table is ticked.

---

## 1. Diagnosis — what is actually wrong

Grounded in the current code, not impressions.

### 1.1 The applications page does everything

[`app/(application-management)/applications/page.tsx`](../apps/issuer/src/app/(application-management)/applications/page.tsx) is **1,260 lines** and is simultaneously: a list, a filter bar, a paginator, a detail view (expand/collapse), a 10-column invoice sub-table, three confirmation dialogs, an offer-review modal host, a signing-return handler, and a dev debug panel.

Concrete symptoms:

- **No addressable application.** There is no `/applications/[id]`. Deep-linking is faked with a query param — `?applicationIds=app_1,app_2` filters the list ([page.tsx:594-605](../apps/issuer/src/app/(application-management)/applications/page.tsx#L594-L605)). You cannot send a colleague a link to *one* application.
- **Nesting depth of five.** Page → `bg-muted/30` panel → `Card` → expanded region → horizontally-scrolling table with two sticky columns → `FileDisplayBadge` inside a cell. [`scrollable-invoice-table.tsx`](../apps/issuer/src/app/(application-management)/applications/components/scrollable-invoice-table.tsx) needs 100 lines of width arithmetic (`COL_MIN`, `COL_STICKY`, `getFlexColWidth`) to survive that nesting.
- **Actions hidden in kebabs.** "Withdraw Application", "View Signed Offer", "Delete Draft", "View reason", "Withdraw Invoice" are all behind `⋮`. Two of them are conditionally disabled with the explanation only in a `title` tooltip ([page.tsx:305-309](../apps/issuer/src/app/(application-management)/applications/page.tsx#L305-L309)).
- **Dialog-open races patched with timers.** `setTimeout(..., 150)` and `queueMicrotask` guards exist purely to stop a dropdown and a dialog fighting ([page.tsx:493-501](../apps/issuer/src/app/(application-management)/applications/page.tsx#L493-L501), [545-551](../apps/issuer/src/app/(application-management)/applications/page.tsx#L545-L551)). That is a symptom of actions living in the wrong place.
- **One badge for three statuses.** `getCardStatus` collapses application + contract + N invoice statuses into a single badge by priority ([status.ts:281-356](../apps/issuer/src/app/(application-management)/applications/status.ts#L281-L356)). The file opens with 88 lines of comments explaining the collapse. Information is genuinely lost: an application showing "Under Review" may contain an invoice needing action.

### 1.2 Three lists describe the same money

A financed invoice appears in **Applications** (as a row in the sub-table), in **Portfolio→Invoices** (as `DashboardInvoiceCard`), and in **Notes** (as the note raised against it). Each uses a different card, a different filter idiom, and a different vocabulary. Only contracts have a detail page (`/financing/contracts/[id]`); invoices never do.

### 1.3 Every list is built differently

| | Applications | Financing | Notes | Activity |
|---|---|---|---|---|
| Filter idiom | `DropdownMenu` + hand-drawn radio dots | dedicated `filter-toolbars.tsx` | `DropdownMenuCheckboxItem` | shared `ActivityToolbar` |
| Reload button | ✗ | ✓ | ✓ | ✓ |
| Pagination | ✓ (4/8/12) | ✗ | ✗ | ✓ (fixed 10) |
| Empty state | centred text | dashed panel | dashed panel | centred text |
| Loading | skeleton cards | `"Loading financing..."` | `"Loading notes..."` | skeleton rows |
| Count display | `h-11` badge styled as a button | `h-11` badge | `h-11` badge | small badge |

Four screens, four answers to the same four questions. The `h-11` count badge is the clearest tell — it is a non-interactive element built to look exactly like the buttons beside it.

### 1.4 Every page has two titles

`layout.tsx` renders `<Header />`, which shows a title from `useHeader()` context. Then every page *also* calls `setTitle(...)` **and** renders its own `<h1>`. So `/applications` shows "Applications" in the header bar and "Applications" again 24px below it. Same on Dashboard, Financing, Notes, Profile, Activity.

### 1.5 Colour semantics are broken

- **Destructive is indistinguishable from primary.** [`packages/styles/globals.css:24`](../packages/styles/globals.css#L24) sets `--destructive: 359.6 95.7% 27.6%` — byte-identical to `--primary`. "Withdraw Application" and "Apply for financing" render the same red. This is the single highest-risk visual bug in the portal, and BRANDING.md §2 actively prescribes it.
- **Two hardcoded hex button variants.** `reviewOffer: bg-[#15803d]` and `makeAmendments: bg-[#ca8a04]` in [`button.tsx:24-29`](../apps/issuer/src/components/ui/button.tsx#L24-L29) — outside the token system, invisible to dark mode, undocumented in BRANDING.md.
- **A good token system nobody was told about.** `packages/styles/tailwind.config.ts` defines `status.{action,submitted,in-progress,success,completed,rejected,neutral}` with bg/text pairs. BRANDING.md never mentions it, so pages keep inventing `border-amber-500/30 bg-amber-50 text-amber-800` by hand ([recent-applications-card.tsx:22-26](../apps/issuer/src/components/dashboard/recent-applications-card.tsx#L22-L26)).
- **Raw hex in the offer modal.** `bg-[#f9e2e2]`, `text-[#CE2922]`, `bg-[#e9edf2]`, `bg-[#f9fafb]`, `bg-green-600` — the highest-stakes screen in the product is the least tokenised.

### 1.6 Onboarding gating reads as breakage

Locked nav items are `opacity-50 cursor-not-allowed` with a tooltip. The dashboard renders a **greyed-out preview of fake-looking empty data** behind `inert` ([page.tsx:243-249](../apps/issuer/src/app/page.tsx#L243-L249)). A new user's first impression is a broken app rather than a clear "here's what's next".

### 1.7 Account vs Profile is unexplained

`/profile` = the **organisation** (members, banking, addresses, documents). `/account` = the **user login** (email, password, marketing). The names do not convey that, `/account` is hidden in the avatar menu, and so is `/notifications` — which also has a bell in the header, giving it two entry points and zero sidebar presence.

---

## 2. Target information architecture

### 2.1 Sidebar

```
BEFORE                          AFTER
──────────────────              ────────────────────────────
Dashboard                       Dashboard
Applications          ┐         Applications
Financing             │         Portfolio
Notes                 ├──▸        ├ Contracts
Activity              │           ├ Invoices
Profile               ┘           └ Notes
Help                            ─────────────
                                Organisation   (was "Profile")
                                My account     (was hidden in avatar menu)
                                Help
```

Two groups separated by a rule: **Work** (Dashboard, Applications, Portfolio) and **Settings** (Organisation, My account, Help). Activity becomes a Dashboard tab. Notifications keeps its header bell as the single entry point, plus a link from the Dashboard activity tab.

### 2.2 Route map

| Route | State | Purpose |
|---|---|---|
| `/` | reshaped | Dashboard, tabs: **Overview** \| **Activity** |
| `/applications` | reshaped | Slim card list + action queue |
| `/applications/[id]` | **new** | Application detail — the centrepiece of this redesign |
| `/applications/new` | kept | Wizard step 1 (financing type) |
| `/applications/[id]/edit` | **moved** from `/applications/[id]/edit` | Wizard steps 2–n + amendment mode |
| `/applications/sign/contract/[contractId]` | kept | SigningCloud handoff |
| `/applications/sign/invoice/[invoiceId]` | kept | SigningCloud handoff |
| `/portfolio` | **new** | Tabs: Contracts \| Invoices \| Notes (`?tab=`) |
| `/portfolio/contracts/[id]` | **moved** from `/financing/contracts/[id]` | Contract detail |
| `/portfolio/invoices/[id]` | **new** | Invoice detail — closes the gap where invoices had no page |
| `/portfolio/notes/[id]` | **moved** from `/notes/[id]` | Note detail |
| `/profile` | kept, retitled | "Organisation" |
| `/account` | kept, retitled | "My account" |
| `/notifications` | kept | Notification list |
| `/help`, `/help/[slug]` | kept | Help content |
| `/onboarding/*`, `/onboarding-start`, `/accept-invitation` | kept | Onboarding flow |
| `/activity` | **redirect** → `/?tab=activity` | |
| `/financing` | **redirect** → `/portfolio?tab=contracts` | |
| `/financing/contracts/[id]` | **redirect** → `/portfolio/contracts/[id]` | |
| `/notes`, `/notes/[id]` | **redirect** → `/portfolio?tab=notes`, `/portfolio/notes/[id]` | |
| `/applications/[id]/edit` | **redirect** → `/applications/[id]/edit` | |

All redirects are permanent `next.config.mjs` entries. **Required**, not optional: emails, help articles and admin-side links point at the old URLs.

### 2.3 Cross-linking

The current portal has almost no lateral navigation. Every detail page gains a breadcrumb and outbound links to its related objects:

```
Application #A3F91C2B
  └─▸ Contract CTR-2291        (/portfolio/contracts/…)
        └─▸ Invoice INV-0043   (/portfolio/invoices/…)
              └─▸ Note NOTE-118 (/portfolio/notes/…)
                    └─▸ back to Application #A3F91C2B
```

---

## 3. Changes to BRANDING.md

BRANDING.md is currently written as a **one-shot Cursor prompt** ("Deliverables", "Apply Changes — Checklist for Cursor", "What to Commit"). It describes work that has already happened, names portals that do not exist (`User Portal` — the repo has `issuer`), and points at file paths that are wrong for this monorepo (`app/globals.css` → actually `packages/styles/globals.css`).

It gets rewritten as a **living reference**. Changes, in priority order:

### 3.1 Fix `--destructive` (blocking)

BRANDING.md §2 currently prescribes `--destructive: 359.6 95.7% 27.6%`, identical to `--primary`. Replace with a distinct red aligned to the existing `status.rejected` token:

```css
--destructive: 0 72% 51%;          /* #DC2626 — distinct from brand #8A0304 */
--destructive-foreground: 0 0% 100%;
```

Add a rule: *brand red asserts, destructive red warns; they must never be the same value. Any button that deletes, withdraws, declines or revokes uses `destructive` and must be preceded by a confirmation dialog.*

### 3.2 Document the status token system (new §)

Promote `status.{action,submitted,in-progress,success,completed,rejected,neutral}` from an undocumented tailwind entry to a first-class, documented scale with a mapping table from domain status → token, and a stated rule: **never hand-write `bg-amber-50 text-amber-800`; always use a status token.**

Retire the hardcoded `reviewOffer` / `makeAmendments` button variants in favour of `variant="primary"` + a status-toned context, so dark mode works and the palette stays closed.

### 3.3 Add `.theme-issuer` (correctness)

`packages/styles/globals.css` defines `.theme-issuer` and `apps/issuer/src/app/layout.tsx` applies it. BRANDING.md §5 documents only `.theme-user`, `.theme-investor`, `.theme-admin`. Add the issuer variant and drop the phantom "User Portal".

### 3.4 Add a type-density scale (new §)

BRANDING.md mandates 17px body text. The data screens use 15px (tables), 13px (fee sub-lines), 12px (stepper labels) — all reasonable, none documented, so each new screen re-litigates it. Codify three registers:

| Register | Size | Where |
|---|---|---|
| Prose | 17px / `leading-7` | page copy, descriptions, help, empty states |
| Data | 15px / `leading-6` | tables, card fields, list rows, form values |
| Meta | 13px / `leading-5` | timestamps, fee breakdowns, hints, badges |

### 3.5 Add missing pattern sections (new §§)

BRANDING.md documents buttons, inputs, cards, tables, nav, badges. The portal needs eight more patterns that are currently reinvented per page: **page shell**, **list toolbar**, **empty state**, **loading/skeleton**, **pagination**, **detail page layout**, **destructive confirmation**, **sticky wizard footer**. Each gets a canonical spec plus the shared component that implements it (§4).

### 3.6 Add a surface-nesting rule (new §)

The current applications page nests five surfaces deep. Add: *maximum two nested surfaces. `page → card` or `page → panel → row`. A card never contains another card. A table is never inside a card that is inside a panel — promote it to the page.*

### 3.7 Reframe the document

Replace §0 "Context & Goals", §9 "Apply Changes — Checklist for Cursor" and §12 "What to Commit" with: scope, correct monorepo file paths (`packages/styles/globals.css`, `packages/styles/tailwind.config.ts`), the four real portals, and a "how to extend this" note. Keep §1 palette, §4 typography, §8 accessibility largely intact — they are sound.

---

## 4. Shared primitives to build

Built once in `packages/ui`, consumed by every issuer screen. These replace the per-page reimplementations catalogued in §1.3.

| Component | Replaces | Notes |
|---|---|---|
| `PageShell` | `issuerMainContentClassName` + `issuerPageGutterClassName` + hand-rolled `<h1>` blocks | Owns title, description, breadcrumb, primary action slot. **Ends the double-title bug** by being the single title authority — `<Header/>` shows breadcrumb context only |
| `ListToolbar` | applications' dropdown-with-fake-radios, `filter-toolbars.tsx`, notes' checkbox menu, `ActivityToolbar` | Search + filter groups + active-filter chips + clear + reload + count. One idiom, four call sites |
| `FilterChips` | *(nothing — new)* | Applied filters shown as removable chips. Currently filters are invisible once a menu closes |
| `DataTable` | `scrollable-invoice-table.tsx` (100 lines of width maths), activity's hand-built grid | Column defs, sticky columns, responsive collapse-to-rows below `md` |
| `EmptyState` | 6 divergent implementations | Icon + message + optional action; `variant="no-data" \| "no-results"` |
| `LoadingState` | 4 divergent implementations | Skeleton shapes matching the real layout |
| `Pagination` | applications' inline block, activity's inline block | Page size, range label, prev/next |
| `StatusBadge` | 3 near-duplicate local `StatusBadge`s + `BADGE_BASE`/`BADGE_FALLBACK` constants | Consumes status tokens (§3.2) |
| `DetailHeader` | *(nothing — new)* | Breadcrumb, title, status, key facts, action cluster. Used by all 4 detail pages |
| `DetailSection` | ad-hoc `<h2>` + card wrappers | Titled section with optional action |
| `ConfirmDialog` (destructive) | exists in issuer, promote to `packages/ui` | Enforces §3.1 rule |
| `StickyFormFooter` | wizard's inline `<footer>` | Back / primary / unsaved indicator |
| `KeyValueGrid` | `grid-cols-[auto_1fr] gap-x-3` repeated ~15× | Label/value pairs with numeric alignment |

---

## 5. Screen-by-screen specification

### 5.1 Dashboard `/`

Two tabs: **Overview** (default) and **Activity**.

**Overview**, in order:

1. **Next action banner** — replaces the greyed-out `inert` preview (§1.6). States what to do now and why, with one button. Onboarding incomplete → the current step. Offers waiting → "2 offers awaiting your response". Amendments requested → "1 application needs changes". Nothing pending → hidden.
2. **Onboarding progress** — kept for incomplete orgs, restyled as a horizontal stepper. The disabled "Get Financed" button becomes an enabled button on the *current* step.
3. **KPI row** — `AccountOverviewCard` + `RepaymentPerformanceCard` merged into one 5-tile row: success rate, active financing, past financing, active notes, on-time repayment. Past-due count becomes a status-toned annotation on the on-time tile rather than its own number.
4. **Recent applications / Recent portfolio activity** — the three existing "recent" cards reduced to two, using shared list-row styling. Rows link to the **new detail pages**, not to the list.

**Activity tab** — the entire current `/activity` page, using shared `ListToolbar` + `DataTable` + `Pagination`. Same filters (search, domain, date range), same behaviour.

**Onboarding-incomplete rule:** show the banner and progress stepper only. Do **not** render greyed-out KPI tiles. Locked sidebar items get a small lock glyph and a tooltip naming the unlocking step, not `opacity-50`.

### 5.2 Applications `/applications`

Per decision 1: **cards, slimmed down**.

```
┌──────────────────────────────────────────────────────────────┐
│ Applications                          [+ Apply for financing]│
│ ────────────────────────────────────────────────────────────│
│ [🔍 ID, customer, invoice…]  [Status ▾] [Filters ▾] [↻] 12  │
│ ⌗ Status: Offer received ✕   ⌗ Last 30 days ✕      Clear all │
└──────────────────────────────────────────────────────────────┘

NEEDS YOUR ATTENTION ─────────────────────────────── 2 items
┌──────────────────────────────────────────────────────────────┐
│ ● Offer received   #A3F91C2B · Acme Sdn Bhd · Contract      │
│   RM 250,000 · expires in 5 days          [Review offer →]  │
└──────────────────────────────────────────────────────────────┘

ALL APPLICATIONS ─────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ #C1D88A05 · Perdana Corp              ○ Under review        │
│ Contract financing · RM 112,000 · submitted 4 Mar 2026       │
│ 3 invoices · 1 needs action                              ⋮   │
│                                          [View application →]│
└──────────────────────────────────────────────────────────────┘
```

Each card carries: display ID, customer, financing type, headline amount, submitted date, **primary status badge**, a **sub-status line** (`3 invoices · 1 needs action` — this is where §1.1's lost information is restored), one primary action, and a kebab for secondary actions.

**Removed from the card:** the expand/collapse toggle and the entire embedded invoice table. Both move to the detail page. This alone removes ~350 lines and the sticky-column width arithmetic.

The "Needs your attention" group is derived from existing `cardStatus.showReviewOffer` / `showMakeAmendments` — no new backend work. The `?applicationIds=` deep-link filter is kept for backwards compatibility (admin links use it) and rendered as a removable filter chip.

Pagination is retained; default page size raised 4 → 10 now that cards are ~⅓ the height.

### 5.3 Application detail `/applications/[id]` — **new**

The centrepiece. Everything the list card no longer does happens here.

```
Applications  ›  #A3F91C2B
─────────────────────────────────────────────────────────────────
Application #A3F91C2B                        ● Offer received
Acme Sdn Bhd · Contract financing · submitted 12 Mar 2026
                            [Review offer]  [Withdraw]  [ ⋮ ]
─────────────────────────────────────────────────────────────────
[Summary]  [Offer ①]  [Invoices ③]  [Documents]  [Timeline]
```

**Summary** — contract title, customer, contract value, financing applied, approved facility, facility fee rate + cap (keeping the existing `InfoTooltip` copy verbatim), submitted/updated dates. Links out to the contract in Portfolio.

**Offer** — per decision 3, the `ReviewOfferModal` becomes an inline section. Terms table (offered amount, profit rate, platform fee, facility fee, expiry), "Download offer letter", and **Accept & sign** / **Decline**. Decline expands the reason `Select` + context textarea + "Confirm decline" in place. The eKYC sub-flow (IC lookup → name confirm → QR scan) stays a modal launched from Accept, because it is a genuinely modal identity ceremony and it already works. Tab is hidden when no offer exists; badge shows the count when one is pending.

**Invoices** — the existing 10-column table, now at full page width using shared `DataTable`. No sticky-column arithmetic, because there is no longer a card and panel constraining it. Below `md` each row collapses to a stacked block. Per-invoice actions (Review offer, Make amendments, View signed offer, View reason, Withdraw, download document) move from a cramped 72px sticky cell to a proper row action menu plus an inline primary button.

**Documents** — every document attached to the application and its invoices in one place, with download. Today these are only reachable one-at-a-time from inside table cells.

**Timeline** — *new, low cost, high value.* Submitted → under review → amendment requested → resubmitted → offer sent → accepted → disbursed, from data already in `activity` + application/contract/invoice status fields. This is the honest answer to §1.1's one-badge problem: the badge shows *now*, the timeline shows *how we got here*.

**Draft applications** open a reduced version: summary of what's filled in, plus **Continue editing** and **Delete draft**.

### 5.4 Application wizard `/applications/new` + `/applications/[id]/edit`

**Deliberately conservative.** The wizard encodes product workflow logic, amendment flagging, version guards, unsaved-navigation guards and processing-fee callbacks. A visual redesign is in scope; a behavioural rewrite is not.

- Restyle `ProgressIndicator` using tokens instead of `bg-foreground`/`bg-destructive` literals. Keep every state: completed, active, flagged, acknowledged, locked-future, disabled.
- Extract the sticky footer into shared `StickyFormFooter`.
- Split `edit/[id]/page.tsx` (**2,091 lines**) into one file per step, with the page reduced to a step router. **Pure mechanical extraction** — no logic changes, so a step-by-step diff review is possible.
- Unify form-field chrome via the tokens in §3, retiring the ad-hoc `bg-[#f9fafb]` / `focus:ring-4 focus:ring-primary/10` used in the offer flow.
- Amendment mode keeps its red flagged steps, remark cards, read-only banners and invoice error cards, restyled onto `status.action` / `status.rejected` tokens.
- Add a persistent "Draft saved" indicator in the footer — currently saving is silent, which reads as data loss on a long form.

### 5.5 Portfolio `/portfolio`

Three tabs (`?tab=contracts|invoices|notes`), one shared `ListToolbar`, one shared `EmptyState`, one shared `Pagination`. The three existing filter implementations collapse into one; existing filter *semantics* in [`components/financing/filters.ts`](../apps/issuer/src/components/financing/filters.ts) are reused as-is.

- **Contracts** — restyled `DashboardContractCard`; "View detail" → `/portfolio/contracts/[id]`.
- **Invoices** — restyled `DashboardInvoiceCard`; row → **`/portfolio/invoices/[id]` (new)**.
- **Notes** — restyled note card, keeping the target/funded/risk-rating trio and the settlement summary block; "View Note" → `/portfolio/notes/[id]`.

Each detail page uses shared `DetailHeader` + `DetailSection`, with breadcrumbs and cross-links per §2.3. Note detail keeps all existing sections (settlement payment, disbursement breakdown, payout summary, late fee info, ledger panel) — restyle only.

Offer review from a Portfolio card **navigates to the owning application's Offer tab** rather than opening a modal, so there is exactly one place in the product where an offer is accepted.

### 5.6 Organisation `/profile` and My account `/account`

Both promoted into the sidebar under a **Settings** group. Content and every action unchanged; only naming, grouping and chrome change.

- **Organisation** — tabs kept (Profile, Banking, Documents), with **Members** promoted from a buried section to its own tab. Inline edit/save/cancel per section is retained; edit affordances move from hover-only to always-visible for admins. The `?focus=directors&person=` deep link is preserved (the director/shareholder alert depends on it).
- **My account** — Account information, Email, Password & security, Marketing notifications, restyled as sections rather than four full-width cards.

### 5.7 Chrome — sidebar, header, footer

- **Sidebar** — two groups per §2.1. Locked items get a lock glyph + explanatory tooltip. The pending-offer count badge on Applications is kept.
- **Header** — stops duplicating the page title (§1.4). Becomes: sidebar trigger · breadcrumb · (spacer) · notification bell · avatar menu. The organisation switcher sits in the sidebar below the logo, with the menu opening to the right.
- **Avatar menu** — reduced to Switch to Investor Portal and Log out, since Account and Notifications now have real homes.

---

## 6. Action inventory — nothing may be lost

The contract for this redesign. Every interactive affordance in the portal today, and where it lives after. **A row without a destination is a blocker, not a trade-off.**

### 6.1 Applications list

| # | Action today | Destination |
|---|---|---|
| 1 | Search (ID / customer / invoice no.) | `ListToolbar` search — same 3 fields |
| 2 | Status multi-filter | `ListToolbar` filter group + chips |
| 3 | Filters → Financing structure | `ListToolbar` filter group + chip |
| 4 | Filters → Submitted in (all/7/30/90d) | `ListToolbar` filter group + chip |
| 5 | Filters → Offer expiring (all/3/7/14d) | `ListToolbar` filter group + chip |
| 6 | Clear filters | `ListToolbar` "Clear all" |
| 7 | `?applicationIds=` deep-link filter | Kept; rendered as a removable chip |
| 8 | "Clear filter" for the above | The chip's ✕ |
| 9 | Count badge | `ListToolbar` count (as text, not a fake button) |
| 10 | Rows per page 4/8/12 | `Pagination`, options 10/25/50 |
| 11 | Prev / next page | `Pagination` |
| 12 | Status badge + withdraw-reason variants | `StatusBadge`; all reason variants preserved |
| 13 | Make Amendments → edit | Card primary action + detail header |
| 14 | Review Contract Financing Offer | Card primary action → detail **Offer** tab |
| 15 | "Offer valid until …" caption | Card sub-line + Offer tab |
| 16 | ⋮ Edit Application (draft) | Card primary action "Continue editing" |
| 17 | ⋮ Delete Draft | Card ⋮ + detail header ⋮ (destructive + confirm) |
| 18 | ⋮ View Signed Offer | Detail **Documents** tab + Offer tab |
| 19 | ⋮ Withdraw Application | Detail header (destructive + confirm) |
| 20 | Withdraw disabled when signed offer on file | Preserved — reason shown as visible helper text, not a `title` |
| 21 | View details / Hide details | Replaced by "View application →" |
| 22 | Dev Debug Panel (skeleton / mock / reset) | Kept, dev-only, restyled |
| 23 | Signing return | `/signing/return` → `/v1/signing/return/:id/confirm` |
| 24 | Director/shareholder sticky alert | Kept on list and detail |

### 6.2 Invoice sub-table → detail Invoices tab

| # | Action today | Destination |
|---|---|---|
| 25 | 10 columns (number, maturity, value, applied financing, documents, financing offered, fees, profit rate, status, action) | All 10 preserved in `DataTable` |
| 26 | Fees / Profit-rate header tooltips | Preserved verbatim |
| 27 | Document download (per invoice) | Row action + Documents tab |
| 28 | Review Offer (per invoice) | Row primary action → Offer tab |
| 29 | "Offer valid until …" (per invoice) | Row sub-line |
| 30 | Make Amendments (per invoice) | Row primary action |
| 31 | ⋮ View Signed Offer | Row menu + Documents tab |
| 32 | ⋮ View reason (rejected/declined) | Row menu → dialog (unchanged) |
| 33 | ⋮ Withdraw Invoice | Row menu (destructive + confirm) |
| 34 | Withdraw disabled reasons (approved/rejected/withdrawn/pending/signed) | All preserved as visible helper text |
| 35 | Horizontal scroll + sticky Status/Action | Sticky retained in `DataTable`; collapses to stacked rows below `md` |

### 6.3 Offer review (modal → detail Offer tab)

| # | Action today | Destination |
|---|---|---|
| 36 | View offer terms (amount, rate, platform fee, facility fee, expiry) | Offer tab terms table |
| 37 | Download offer letter | Offer tab |
| 38 | Accept and sign offer / Accept offer | Offer tab primary |
| 39 | Accept without signing (dev override) | Kept, dev-only |
| 40 | Decline offer → reason select | Inline expansion |
| 41 | Decline → additional context + char count | Inline expansion |
| 42 | Confirm decline | Inline expansion |
| 43 | "Respond by …" deadline copy | Offer tab header |
| 44 | eKYC: Back to offer | Modal (retained) |
| 45 | eKYC: IC number input | Modal |
| 46 | eKYC: Look up my details | Modal |
| 47 | eKYC: confirm full name | Modal |
| 48 | eKYC: Continue to QR scan | Modal |
| 49 | eKYC: QR scan + verified/failed states | Modal |
| 50 | eKYC: Edit MyKad details | Modal |

### 6.4 Wizard

| # | Action today | Destination |
|---|---|---|
| 51 | Select financing type / product | `/applications/new` — restyled |
| 52 | Progress indicator + step click nav | Restyled; all states preserved |
| 53 | Back (navigation-guarded) | `StickyFormFooter` |
| 54 | Save and Continue | `StickyFormFooter` |
| 55 | Unsaved-changes modal | Kept |
| 56 | Version-mismatch modal + Refresh products | Kept |
| 57 | All 9 steps (company, business, contract, invoice, financing structure, financial statements, supporting docs, declarations, review) | Kept — extracted to one file per step |
| 58 | Amendment mode: flagged steps, remark cards, read-only banners, invoice error cards | Kept, restyled to tokens |
| 59 | Processing-fee step + callback route | Kept |
| 60 | Dev tools panel | Kept, dev-only |
| 61 | Directors/shareholders alert → `/profile?focus=directors&person=` | Kept |

### 6.5 Financing / Notes → Portfolio

| # | Action today | Destination |
|---|---|---|
| 62 | Tabs Contracts / Invoices (`?tab=`) | Portfolio tabs (+ Notes) |
| 63 | Per-tab search | `ListToolbar` |
| 64 | Contract filter toolbar (status, product, date, customer) | `ListToolbar` — same semantics |
| 65 | Invoice filter toolbar | `ListToolbar` — same semantics |
| 66 | Clear / Reload / count badge | `ListToolbar` |
| 67 | Contract "View detail" | `/portfolio/contracts/[id]` |
| 68 | Contract "Review Offer" | → owning application's Offer tab |
| 69 | Invoice "Review Offer" | → owning application's Offer tab |
| 70 | Invoice row (no detail today) | **New** `/portfolio/invoices/[id]` |
| 71 | Empty state → Apply for financing | `EmptyState` action |
| 72 | Contract detail "Back to Financing" | Breadcrumb |
| 73 | Notes filter (All / Active excl. settled) | `ListToolbar` |
| 74 | Notes search / Clear / Reload / count | `ListToolbar` |
| 75 | Note card: target, funded %, risk rating + tooltip | Preserved |
| 76 | Note card settlement summary block | Preserved |
| 77 | "View Note" | `/portfolio/notes/[id]` |
| 78 | Note detail: settlement payment, disbursement breakdown, payout summary, late fee info, ledger panel | All preserved — restyle only |

### 6.6 Activity → Dashboard tab

| # | Action today | Destination |
|---|---|---|
| 79 | Debounced search | Activity tab `ListToolbar` |
| 80 | Domain filters | Activity tab `ListToolbar` |
| 81 | Date range filter | Activity tab `ListToolbar` |
| 82 | Clear filters / Reload | Activity tab `ListToolbar` |
| 83 | Pagination (10/page) | `Pagination` |
| 84 | Activity rows (domain, time) | `DataTable` |

### 6.7 Organisation / My account / chrome

| # | Action today | Destination |
|---|---|---|
| 85 | Profile tabs (Profile / Banking / Documents) | Kept + **Members** tab |
| 86 | Refresh | `PageShell` action |
| 87 | Edit / Save / Cancel — personal info, PIC | Kept per section |
| 88 | Edit / Save / Cancel — address(es) | Kept |
| 89 | Edit / Save / Cancel — contact details | Kept |
| 90 | Edit / Save / Cancel — banking details | Kept |
| 91 | Invite member | Members tab |
| 92 | Transfer ownership | Members tab (destructive + confirm) |
| 93 | Member row actions (role change, remove) | Members tab (remove = destructive + confirm) |
| 94 | Invitation resend / revoke | Members tab |
| 95 | Document download | Documents tab |
| 96 | 4 confirm dialogs | Shared `ConfirmDialog` |
| 97 | Dev "view as member" toggle | Removed |
| 98 | `?focus=directors&person=` deep link | Kept |
| 99 | Account info / Email / Password / Marketing | `/account`, restyled |
| 100 | Change-password dialog | Kept |
| 101 | Organisation switcher (+ add organisation) | Sidebar, below the logo |
| 102 | Sidebar collapse / rail | Kept |
| 103 | Nav item disabled states + tooltips | Kept; lock glyph replaces `opacity-50` |
| 104 | Pending-offer count badge | Kept |
| 105 | Notification bell | Kept in header |
| 106 | Avatar → Account | Sidebar (Settings group) |
| 107 | Avatar → Notifications | Header bell |
| 108 | Avatar → Switch to Investor Portal | Kept in avatar menu |
| 109 | Avatar → Log out | Kept in avatar menu |
| 110 | Portal footer | Kept |
| 111 | Onboarding: account / terms / fee / verify | Kept — restyled only |
| 112 | Onboarding fee + processing fee return dialogs & listeners | Kept |
| 113 | Payment-under-review notice | Kept |
| 114 | Accept invitation | Kept |
| 115 | Name entry dialog | Kept |
| 116 | Help index + articles | Kept |
| 117 | Not-found page | Restyled |
| 118 | `/dev/status-examples` | Kept, dev-only; extended with new tokens |

**118 actions. 0 removed. 3 added** (invoice detail page, application timeline, draft-saved indicator).

---

## 7. Build sequence

One branch, but internally ordered so each stage compiles and the app runs. Merge happens once, at the end.

**Stage A — Foundations**
1. `packages/styles/globals.css` — fix `--destructive`, add status token vars for dark mode.
2. `packages/styles/tailwind.config.ts` — extend status tokens with dark-mode pairs.
3. Rewrite `BRANDING.md` per §3.
4. `packages/ui` — build all §4 primitives with a rendering harness under `/dev/status-examples`.
5. Retire `reviewOffer` / `makeAmendments` hardcoded button variants.

**Stage B — Routing skeleton**
6. Create `/applications/[id]`, `/applications/[id]/edit`, `/portfolio/*` route files (placeholders).
7. Add all §2.2 redirects to `next.config.mjs`.
8. Rebuild sidebar + header per §5.7; remove the double-title mechanism.

**Stage C — Applications** *(largest stage)*
9. Application detail page: Summary, Invoices, Documents, Timeline tabs.
10. Port `ReviewOfferModal` → Offer tab; keep eKYC as a modal.
11. Rebuild the list with slim cards + action queue.
12. Delete the old expand/collapse + embedded table path.

**Stage D — Portfolio**
13. `/portfolio` with three tabs on shared toolbar/empty/pagination.
14. Port contract detail; build invoice detail; port note detail.

**Stage E — Dashboard, settings, wizard**
15. Dashboard Overview + Activity tabs; next-action banner; merged KPI row.
16. Organisation (+ Members tab) and My account.
17. Wizard: extract steps to one file per step; restyle stepper; sticky footer; draft-saved indicator.

**Stage F — Verification**
18. Walk the §6 inventory, all 118 rows, in a running app.
19. Responsive pass (360 / 768 / 1024 / 1440).
20. Accessibility pass: focus order, visible focus rings, 44px targets, contrast, `aria-label`s on icon-only buttons.
21. Update `e2e/` specs (`home.spec.ts`, `notes.spec.ts`, `organization.spec.ts`) for new routes; add specs for application detail and offer accept/decline.
22. Dark-mode pass — currently untested on issuer screens; the hardcoded hex values were silently breaking it.

---

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Big-bang has no shippable midpoint** | A regression is found only at the end | §6 inventory is the acceptance test; stages A–E each keep the app running locally |
| **Offer accept/decline is money-moving** | Wrong behaviour = financial harm | Port the modal's logic verbatim into the Offer tab; change presentation only. eKYC and SigningCloud handoff untouched |
| **Wizard extraction touches 2,091 lines** | Silent breakage in amendment mode | Mechanical extraction only, no logic edits; review step-file diffs against the original |
| **Old URLs live in emails and admin links** | Broken inbound links | Permanent redirects are a Stage B deliverable, not a follow-up |
| **`--destructive` change is portal-wide** | Admin/investor visuals shift | Intentional and correct; flag to those portals' owners before merge |
| **Shared `packages/ui` changes affect 3 portals** | Cross-portal regressions | New components are additive; existing ones changed only where already issuer-specific |
| **Dark mode may be broken today** | Redesign appears to cause it | Screenshot dark mode *before* Stage A to establish the baseline |

---

## 9. Open items

1. **Portfolio naming** — "Portfolio" is investor vocabulary. "My financing" or "Facilities" may read better to a Malaysian SME issuer. Worth a check with a real user before Stage B.
2. **Timeline data source** — §5.3 assumes `activity` records plus status fields suffice. Needs a 30-minute spike against `apps/api/src/modules/issuer-dashboard` in Stage C; if events are missing, the timeline degrades to the status milestones it *can* prove rather than acquiring backend scope.
3. **Mobile usage share** — the invoice table's `md` collapse is designed blind. If issuers are largely desktop, this can be simplified.
4. **`/dev/status-examples`** — worth promoting into a real internal design-system page, given the tokens now have documented meaning.
