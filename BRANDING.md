# CashSouk — Brand & UI Reference

Living reference for the CashSouk design system. Read this before adding a screen; extend it when you establish a new pattern.

**Applies to:** `apps/issuer`, `apps/investor`, `apps/admin`, `apps/landing` — one codebase, themed by CSS variables.
**Source of truth:** `packages/styles/globals.css` (tokens) and `packages/styles/tailwind.config.ts` (theme). Per-app overrides live in `apps/<app>/src/app/globals.css`.
**Stack:** Next.js + Tailwind + shadcn/ui.
**Feel:** modern, premium, highly readable. Strong contrast, generous spacing, rounded corners.

---


## 1. Brand palette

Only the logo palette supplies brand colour. Everything else is neutral grayscale.

| Role | Hex | HSL | Notes |
|---|---|---|---|
| **Primary / Brand** | `#8A0304` | `359.6 95.7% 27.6%` | Deep corporate red — primary actions, active nav, key highlights |
| **Primary Accent** | `#CE2922` | `2.4 71.7% 47.1%` | Brighter red — charts / rare emphasis; **not** issuer page chrome (use whisper-red `--accent`) |
| **Earth Brown** | `#6F4924` | `29.6 51.0% 28.8%` | Heading accents, dividers in premium contexts |
| **Sand Taupe** | `#BAA38B` | `30.6 25.4% 63.7%` | Soft accent — badges, subtle fills |

Contrast vs white: `#8A0304` = **10.0:1** · `#CE2922` = **5.3:1** · `#6F4924` = **7.9:1** · `#BAA38B` = **2.4:1**.
Taupe is for fills and accents only — **never small text on white**.

Neutrals use Tailwind's zinc/neutral scale for backgrounds, borders and long-form text.

**Colour economy:** reds + taupe + neutrals + the status scale (§3). Introduce nothing else except where data visualisation strictly requires it.

---

## 2. Core tokens

Defined in `packages/styles/globals.css`. shadcn expects `h s% l%` triplets.

```css
:root {
  /* Surfaces */
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 47.4% 11.2%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 47.4% 11.2%;

  /* Brand */
  --primary: 359.6 95.7% 27.6%;           /* #8A0304 */
  --primary-foreground: 0 0% 100%;
  --secondary: 30.6 25.4% 63.7%;          /* taupe #BAA38B */
  --secondary-foreground: 0 0% 15%;
  /* Default fallback; portals override --accent to a soft hover/selection fill (see §5) */
  --accent: 2.4 71.7% 47.1%;              /* Primary Accent #CE2922 — not for issuer hover chrome */
  --accent-foreground: 0 0% 100%;

  /* System */
  --muted: 210 20% 96%;
  --muted-foreground: 215 16% 45%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 359.6 95.7% 42.6%;
  --radius: 0.8rem;

  /* Destructive — MUST NOT equal --primary. See §2.1 */
  --destructive: 0 72% 51%;               /* #DC2626 — live in packages/styles/globals.css */
  --destructive-foreground: 0 0% 100%;
}
```

Dark mode lightens brand and destructive for contrast; see `globals.css` for the full `.dark` block. Destructive dark is lightened independently of primary so the two stay distinct.

### 2.1 Destructive is not the brand colour

`--destructive` was historically set to the same value as `--primary`. That makes **"Withdraw application"** and **"Apply for financing"** render identically — the most dangerous action and the most desirable one, indistinguishable.

> **Rule.** Brand red *asserts*. Destructive red *warns*. They must never share a value.
>
> Any control that deletes, withdraws, declines, revokes or transfers ownership uses `variant="destructive"` **and** is preceded by a confirmation dialog naming the consequence.

Changing this token affects all four apps. Coordinate before shipping.

---

## 3. Status colour scale

Defined in `packages/styles/tailwind.config.ts` under `colors.status`. Consumed via `packages/config/src/status-badges.ts`.

| Token | bg | text | Meaning (viewer-centric) |
|---|---|---|---|
| `status-action` | `#FEFCE8` | `#854D0E` | Yellow — pending **your** response (offers, amendments) |
| `status-submitted` | `#EFF6FF` | `#1E40AF` | Blue — pending the **other side** (CashSouk, trustee, counterpart) |
| `status-in-progress` | `#EEF2FF` | `#3730A3` | Indigo — leftover CSS; **do not** use on issuer/investor workflow chips |
| `status-success` | `#D1FAE5` | `#065F46` | Green — finished / approved / completed / settled |
| `status-active` | `#F5F3FF` | `#5B21B6` | Violet — live / in force |
| `status-completed` | `#E0F2FE` | `#075985` | Sky — leftover CSS; user portals use `success` green for completed |
| `status-rejected` | `#FEF2F2` | `#991B1B` | Red — bad / failed / declined / expired / arrears |
| `status-neutral` | `#F1F5F9` | `#334155` | Grey — draft / idle / cancelled / withdrawn |

> **Rule.** Never hand-write `bg-amber-50 text-amber-800` for a status. Always use a status token, so the meaning stays consistent and dark mode keeps working.

Status is **meaning-first, not colour-first**: pick the token by what the state means to the user, not by the colour you had in mind. A new domain status maps onto an existing token. `active` (violet) exists so live/in-force does not share green with completed.

Issuer and investor portals keep this **viewer-centric** map (yellow = you must act, blue = waiting on CashSouk). Admin uses the same idea from the operator’s seat — see §3.2.

Application / offer / envelope group tables: [docs/guides/status-badges.md](docs/guides/status-badges.md).

### 3.1 No hardcoded action colours

Hardcoded hex button variants (`reviewOffer`, `makeAmendments`) are retired. Use a standard button variant (`default` / `action`) placed in a status-toned context — e.g. `bg-status-action-bg` for review-offer and amendments (both need issuer action). The surrounding badge and section carry the meaning; the button does not need raw hex.

### 3.2 Admin portal status badges

Admin is an operations console: **yellow** = CashSouk must act; **blue** = waiting on the issuer, investor, signers, or another party; **violet** = live / in force; **green** = finished. Draft stays grey. Arrears stays red. Do not paint every in-flight status yellow.

Use `StatusBadge` from `@cashsouk/ui`. Map domain strings with `getAdminStatusToken` (`apps/admin/src/lib/admin-status-token.ts`). Do not invent a one-off `Badge` + utility class for a workflow status. List rows whose primary (or action-needed) badge is yellow (`action`) use `adminActionRowClass` — a 45% wash of `status-action-bg`, same as dashboard next-to-do tiles. Arrears rows use `adminRejectedRowClass` — the same 45% wash of `status-rejected-bg`.

**Chrome (same size everywhere)**

| | Rule |
|---|---|
| Shape | `rounded-full` |
| Type | `text-ui font-normal` (compact steppers: `text-meta px-1.5 py-0`). Do not bold badge labels. Contrast comes from the darker status **text** tokens, not weight. |
| Padding | `px-2.5 py-0.5` |
| Workflow status | Colour **dot + label** |
| Type / identity | Text only, **no dot**. Company = blue (`submitted`), Personal = grey (`neutral`). **Portal:** `PortalBadge` — Investor = earth brown, Issuer = brand red. Account portal access uses `access` (circled check in brand colour / muted X). **User role Admin:** purple (`violet`) chip, same chrome, no portal token |

**Colours**

| Token | Colour | Meaning | Examples |
|---|---|---|---|
| `action` | Yellow | Admin must act | Submitted, under review, pending approval, contract/invoice pending, gateway Paid, awaiting disbursement |
| `submitted` | Blue | Waiting on someone else | Offer sent, waiting for issuer to accept, amendment requested, funding open, submitted to trustee |
| `active` | Violet | Live / in force | Active · servicing, Active · advance paid, investment Confirmed |
| `success` | Green | Finished / approved | Completed, approved, settled, repaid, signed, legal Published, prospectus Approved |
| `neutral` | Grey | Idle / closed without failure | Draft, cancelled, unpublished, refunded, not started |
| `rejected` | Red | Failed or negative | Rejected, failed, withdrawn, expired, void, defaulted, arrears |

Exceptions: legal **Published** stays green (`legalStatusToken`). Note **Active · late** stays yellow (admin monitoring); **Active · partial** is blue (waiting on remaining payment); **Active · servicing** is violet (`active`). Category chips (currency, Required/Optional, event types) are not workflow status. User portal roles use `UserRoleBadges`: Investor/Issuer via `PortalBadge`; Admin stays purple (identity chip, no status dot).

Issuer `NoteStatusBadge` keeps icons. Admin notes use `marker="dot"`.

### 3.3 Issuer and investor portals

Same six tokens as admin; **yellow/blue flip with the seat**. Map with `badgeKeyToStatusToken`, `getUserPortalStatusToken`, `onboardingStatusToToken`, or domain helpers — not `getAdminStatusToken`.

| Token | Colour | Meaning | Examples |
|---|---|---|---|
| `action` | Yellow | You must act | Offer sent, amendment requested, late repayment, onboarding amendment |
| `submitted` | Blue | Waiting on CashSouk or another party | Submitted, under review, funding open, pending approval, awaiting disbursement |
| `active` | Violet | Live / in force | Active · servicing, investment Confirmed |
| `success` | Green | Finished | Completed, approved, settled, signed, Verified, Required |
| `neutral` | Grey | Idle / closed without failure | Draft, cancelled, withdrawn |
| `rejected` | Red | Failed or negative | Declined, expired, arrears, funding failed |

Do not use indigo (`in-progress`) or sky (`completed` token) on user-portal workflow chips. Compact steppers: `StatusBadge` `size="sm"` (`text-meta`). Call sites must not pass `text-[Npx]` or `font-semibold` on chips. Primary buttons stay portal-themed (issuer red, investor earth brown).

---

## 4. Typography

Font: **Inter**, with `system-ui, arial` fallbacks.

Headings: `h1` `text-3xl md:text-4xl font-bold tracking-tight` · `h2` `text-2xl md:text-3xl font-bold tracking-tight` · `h3` `text-xl md:text-2xl font-semibold` · `h4` `text-lg md:text-xl font-semibold`.
`tracking-tight` on display headings only. Prose containers cap at `max-w-[70ch]`.

### 4.1 Three density registers

Portal screens are denser than marketing pages. Pick a register and stay in it — don't invent a size. Tokens: `--text-body`, `--text-ui`, `--text-meta` in `packages/styles`. Prefer `typeScale` from `@cashsouk/ui`.

| Register | Token | Size | Where |
|---|---|---|---|
| **Body** | `text-body` (`text-base`) | 16px / `leading-7` | page copy, descriptions, help, empty states |
| **UI** | `text-ui` (`text-sm`) | 14px | tables, labels, buttons, card fields, form values, status badges |
| **Meta** | `text-meta` (`text-xs`) | 12px | timestamps, hints, compact chips |

Title roles: `text-page-title`, `text-section-title`, `text-card-title`, `text-dialog-title`. Do not use `text-[Npx]`.

Numeric columns use `tabular-nums` and right-align. Currency shows the symbol left-aligned and the amount right-aligned within the cell so decimal points line up down the column.

### 4.2 Spacing

Section padding `py-10 md:py-12` · card padding `p-6 md:p-8` · grid gaps `gap-6` · radii `rounded-xl` and up, from `--radius: 0.8rem`.

---

## 5. Portal themes

Each portal layout root carries a theme class that re-scopes accent variables.

```css
.theme-issuer {
  --primary: brand red;                 /* CTAs / key asserts only */
  --accent: 8 14% 94.5%;                /* whisper-red hover/selection — matches sidebar-accent */
  --accent-foreground: warm near-black; /* readable on soft fill */
  --background: 8 10% 98%;              /* near-neutral warm canvas (header uses this too) */
}
.theme-investor {
  --primary: 29.6 51% 28.8%;           /* earth brown #6F4924 — CTAs, active nav, focus */
  --secondary: 30.6 25.4% 63.7%;       /* sand taupe */
  --accent: 34 12% 94.5%;              /* whisper-cream hover/selection */
  --background: 36 10% 98%;            /* near-neutral warm canvas */
  --card: 0 0% 100%;
  --shadow-brand: earth-brown glow;    /* not brand-red */
}
.theme-admin {
  --primary: brand red;               /* CTAs / key asserts only */
  --accent: 8 14% 94.5%;              /* whisper-red hover/selection */
  --background: 8 10% 98%;            /* near-neutral warm canvas */
  --card: 0 0% 100%;
}
.theme-user     { --primary: brand red; /* landing; may diverge from issuer accent treatment */ }
```

All three portals share the same nesting: **tinted canvas (`--background`) + pure white cards (`--card`)**. Header and sidebar sit on the tinted chrome; chip-style header controls (notifications) use `bg-card`. The organisation switcher sits in the sidebar below the logo and also uses `bg-card`. The header avatar fills its allocated space with no card chrome. Investor **does not use brand red for UI chrome** — only the logo and `destructive` / status-rejected keep warning reds.

**Portal chrome rule:** Canvas, header (`bg-background`), and sidebar use **low-saturation “whisper” tints** (issuer warm red, investor cream, admin whisper-red) — never strong washes. `--accent` / `--sidebar-accent` stay in the same family for hover/selection. Solid primary colours are for CTAs and asserts, not page chrome.

| Class | Applied by |
|---|---|
| `.theme-issuer` | `apps/issuer` |
| `.theme-investor` | `apps/investor` |
| `.theme-admin` | `apps/admin` |
| `.theme-user` | `apps/landing` — currently identical to `.theme-issuer` accents; kept separate so the public site can diverge |

```tsx
// apps/issuer/src/app/layout.tsx
<html lang="en" className="theme-issuer">
```

Issuer is brand-forward and friendly (red asserts on CTAs; whisper-red chrome). Investor is premium and conservative (earth-brown CTAs; whisper-cream chrome). Admin is utilitarian (brand-red CTAs; whisper-red chrome so white cards lift off the canvas). Across all three, page chrome stays subtle; reserve saturated colour for actions, not canvas/sidebar/header.

---

## 6. Component guidelines

### Buttons
- **Primary** — `bg-primary text-primary-foreground shadow-brand hover:opacity-95` (issuer: brand red; investor: earth brown)
- **Secondary** — taupe fill (`bg-secondary`), or outline with a focus ring
- **Outline** — `border border-input bg-card hover:bg-accent`
- **Ghost** — minimal; hover uses `accent`
- **Destructive** — `bg-destructive`; always paired with confirmation (§2.1). Never restyle destructive to match portal primary.

Sizes are the same in admin, issuer, and investor: default `h-10 px-4` + `text-ui` (primary/action `font-semibold`); sm `h-8 px-3` still `text-ui`; lg and page-toolbar next to `h-11` inputs `h-11`; icon `h-10 w-10`. Radius `rounded-xl`. Do not override labels with `text-xs` / `text-meta` or a one-off `h-9`.

One primary button per view. If two things look equally primary, neither is.

### Inputs, selects, textareas
Height `h-11`, padding `px-4`, `rounded-xl`, focus `focus-visible:ring-2 focus-visible:ring-primary`. Labels sit above; helper and error text below at Meta size. **Disabled controls state why** — visible helper text, not a `title` attribute (`title` is invisible to touch and to screen readers).

### Cards
Padding `p-6 md:p-8`, `rounded-2xl`, `shadow-sm md:shadow`. Header dividers may use earth brown at low alpha: `border-b border-[hsl(29.6_51%_28.8%/0.12)]`.

### Tables
Data register (§4.1); header `text-sm font-semibold`. Zebra `odd:bg-muted/40`, `hover:bg-muted`. Numeric right-aligned. Status chips use status tokens. Below `md`, collapse rows to stacked blocks rather than forcing horizontal scroll.

### Navigation
Topbar `h-16`, logo left, actions right. Active state: `text-primary` plus a 2px `bg-primary` bottom bar. Sidebar groups get a labelled separator once there are more than five items.

### Badges & chips
Default fill taupe (`bg-secondary text-secondary-foreground`). **Workflow status** uses `StatusBadge` and §3 / §3.2 — never `accent`, never raw amber/emerald/red utilities. Reserve bright red for genuinely critical information.

**A badge is not a button.** List-toolbar counts use the same `h-11` / `rounded-xl` chrome as filter controls, with a muted grey fill and no pointer events so they do not look clickable.

---

## 7. Layout patterns

Each has one shared implementation. Use it rather than rebuilding.

| Pattern | Rule |
|---|---|
| **Page shell** | Owns title, description, breadcrumb, primary action. **One title per page** — if the chrome header shows it, the body must not repeat it |
| **Content width** | Centered (non-full-bleed) pages use `portalContentMaxWidthClassName` from `@cashsouk/ui` — `max-w-6xl`. Help Center is a full-bleed docs shell (sidebar + scrollable main). Full-bleed lists, dashboards, and wide tables stay full width. |
| **List toolbar** | Search · filter groups · applied-filter chips · clear · refresh · count. Same order everywhere. Filter/refresh controls use `bg-card` (white) so they lift off the tinted canvas. Applied filters stay visible as chips after the menu closes |
| **Empty state** | Icon + one sentence + one action. `no-data` ("nothing yet, here's how to start") and `no-results` ("filters matched nothing, clear them") are different messages |
| **Loading** | Skeletons shaped like the real content. Never a bare `"Loading…"` string |
| **Pagination** | Page size, `Showing X–Y of Z`, prev/next. Same component on every list |
| **Detail page** | Breadcrumb › title + status › key facts › action cluster › tabbed sections |
| **Entity hero** | Admin entity-detail card in `AdminEntityHeader` (`variant="hero"`). Back link, then a card tinted with a 35% wash of the status-badge fill (`tone` / `adminHeroTintClass`) — lighter than the chip. Identity + up to 3 top-right summary cards, optional progress bar below, facts strip. Used on notes, facilities, issuers, investors, and user accounts — do not rebuild per page |
| **Destructive confirm** | Names the object and the consequence; confirm button is `destructive`; irreversible actions say so |
| **Sticky form footer** | Back left, primary right, save state in between. Never scrolls away on long forms |

### 7.1 Surface nesting

> **Rule.** Maximum two nested surfaces: `page → card`, or `page → panel → row`.
>
> A card never contains another card. A table is never inside a card inside a panel — promote it to the page.

Deep nesting is what forces sticky-column width arithmetic and horizontal scrollbars inside cards. If a table doesn't fit, the problem is usually the wrappers, not the table.

---

## 8. Accessibility & motion

- **AA contrast minimum** for text. Brand red on white is safe; taupe on white is not.
- Touch targets ≥ 44×44px.
- Focus ring always visible, driven by `--ring`. Never `outline: none` without a replacement.
- Icon-only buttons need `aria-label`.
- Disabled reasons are visible text, not tooltips.
- Colour is never the only signal — pair it with a label, icon or position.
- Motion: 150–200ms `ease-out`. Transition colour, background, border and opacity; avoid transitioning `transform` globally (it fights popover and tooltip animations).

```css
* { @apply transition-[color,background,border,opacity] duration-200 ease-out; }
```

---

## 9. Examples

**Status badge (admin)**
```tsx
import { StatusBadge } from "@cashsouk/ui";
import { getAdminStatusToken } from "@/lib/admin-status-token";

<StatusBadge label="Under review" status={getAdminStatusToken("UNDER_REVIEW")} />
```

**Type chip (admin, no dot)**
```tsx
<OrganizationTypeBadge type="COMPANY" />
<PortalBadge portal="investor" />
<PortalBadge portal="issuer" access />
<UserRoleBadges roles={user.roles} />
```

**Primary CTA**
```tsx
<Button className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground shadow-brand hover:opacity-95">
  Apply for financing
</Button>
```

**Destructive with confirmation**
```tsx
<Button variant="destructive" onClick={() => setConfirmOpen(true)}>
  Withdraw application
</Button>

<ConfirmDialog
  open={confirmOpen}
  title="Withdraw application?"
  description="This cannot be undone. The application and any pending offer will be closed."
  confirmText="Withdraw"
  variant="destructive"
/>
```

**Investor tone block**
```tsx
<div className="theme-investor rounded-2xl border bg-card p-8">
  <h3 className="text-2xl font-semibold">Q4 performance</h3>
  <p className="mt-2 text-body text-muted-foreground">
    Year-to-date returns are above benchmark; see the full report.
  </p>
  <div className="mt-6 flex gap-3">
    <Button className="shadow-brand">View report</Button>
    <Button variant="secondary">Download</Button>
  </div>
</div>
```

---

## 10. Extending this document

1. Prefer an existing token over a new one. Reach for raw hex only when nothing fits — then add a token instead.
2. When you establish a pattern a second screen will need, document it in §7 and build it in `packages/ui`.
3. Changing a token in `packages/styles` affects four apps. Say so in the PR description.
4. Do not alter or crop the logo files, and respect their clear space.

**Related:** [docs/guides/status-badges.md](docs/guides/status-badges.md) — application / offer / envelope colour groups. [docs/issuer-portal-redesign-plan.md](docs/issuer-portal-redesign-plan.md) — issuer portal redesign plan.
