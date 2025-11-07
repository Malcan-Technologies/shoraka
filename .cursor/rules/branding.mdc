# Shoraka Web Platform — Brand & UI Implementation Guide (Cursor Prompt)

---

## 0) Context & Goals
- Brand: **Shoraka** (use only the logo palette provided by the client as brand colors).
- Frontends: **User Portal**, **Investor Portal**, **Admin Portal** — same codebase, themed by CSS variables.
- Feel: **modern, premium, highly readable**. Typography slightly larger than default (but not oversized). Strong contrast, clean spacing, rounded corners.
- Tech: Next.js + Tailwind + **shadcn/ui**.
- Deliverables:
  1) Color tokens mapped to the logo palette
  2) CSS variables wired into **shadcn/ui** tokens
  3) Tailwind theme extension
  4) Typography scale & spacing rules
  5) Portal‑specific theme variants
  6) Component guidelines (buttons, inputs, cards, tables, nav)
  7) Lintable code changes with example usage

---

## 1) Brand Palette → Design Tokens
Use **only** the logo palette as primary/brand colors; pair with neutral grayscale for backgrounds, borders, text.

| Role | Hex | HSL (for shadcn variables) | Notes |
|---|---|---|---|
| **Primary / Brand** | `#8A0304` | `359.6 95.7% 27.6%` | Deep corporate red — main brand color for actions & highlights. |
| **Primary Accent** | `#CE2922` | `2.4 71.7% 47.1%` | Brighter red accent (hover, subtle accents, charts). |
| **Earth Brown** | `#6F4924` | `29.6 51.0% 28.8%` | Rich brown for headings accents, dividers in premium contexts. |
| **Sand Taupe** | `#BAA38B` | `30.6 25.4% 63.7%` | Soft premium accent (badges, subtle fills); avoid as body text on white. |

> Contrast guidance (vs white background): `#8A0304` = **10.0:1**, `#CE2922` = **5.3:1**, `#6F4924` = **7.9:1**, `#BAA38B` = **2.4:1`** → taupe is for fills/accents, not small text on white.

Neutrals (grayscale): use Tailwind’s zinc/neutral scale for backgrounds, borders, and long‑form text (keeps UI legible and modern).

---

## 2) Wire brand into shadcn/ui CSS Variables
**Edit** `app/globals.css` (or your global stylesheet) and define the tokens below. Keep HSL values; shadcn expects `h s% l%` triplets.

```css
/* Brand tokens + shadcn variables */
:root {
  /* Core surfaces */
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;

  /* Brand */
  --primary: 359.6 95.7% 27.6%;           /* #8A0304 */
  --primary-foreground: 0 0% 100%;

  /* Accents */
  --secondary: 30.6 25.4% 63.7%;          /* taupe: #BAA38B */
  --secondary-foreground: 0 0% 15%;

  --accent: 2.4 71.7% 47.1%;              /* bright red accent: #CE2922 */
  --accent-foreground: 0 0% 100%;

  /* UI system */
  --muted: 210 20% 96%;
  --muted-foreground: 215 16% 45%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 47.4% 11.2%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 47.4% 11.2%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 359.6 95.7% 42.6%;              /* primary lightened ~+15% L */
  --radius: 0.8rem;                        /* rounded-xl look */

  /* Optional semantic roles mapped to brand where sensible */
  --destructive: 359.6 95.7% 27.6%;
  --destructive-foreground: 0 0% 100%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;

  --primary: 359.6 95.7% 47%;              /* slightly lighter in dark for contrast */
  --primary-foreground: 0 0% 100%;

  --secondary: 30.6 25.4% 43%;             /* taupe darker on dark bg */
  --secondary-foreground: 0 0% 100%;

  --accent: 2.4 71.7% 56%;                 /* brighten for dark mode */
  --accent-foreground: 0 0% 100%;

  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --border: 217.2 32.6% 22%;
  --input: 217.2 32.6% 22%;
  --ring: 359.6 95.7% 62%;                 /* lighter ring on dark */
}
```

---

## 3) Tailwind Theme Extension
**Edit** `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss"
import { fontFamily } from "tailwindcss/defaultTheme"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", ...fontFamily.sans],
      },
      boxShadow: {
        brand: "0 10px 20px -10px rgba(138, 3, 4, 0.35)" /* #8A0304 */,
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
```

> **Font**: Prefer `Inter` (fallbacks provided). If the repo already has a preferred sans, keep it, but enforce the size rules below.

---

## 4) Typography & Spacing
- **Base body**: `text-[17px]` with `leading-7`. (Slightly larger, highly readable.)
- **Headings**: weight 700 for `h1/h2`, 600 for `h3/h4`.
- **Tracking**: slight `tracking-tight` on display headings only.
- **Max measure**: prose text containers `max-w-[70ch]`.
- **Whitespace**: default section padding `py-10 md:py-12`, card padding `p-6 md:p-8`, grid gaps `gap-6`.
- **Radii**: use `rounded-xl`+ globally via `--radius: 0.8rem` (cards/buttons/inputs).

Add/confirm these in `globals.css`:

```css
html { scroll-behavior: smooth; }
body { @apply text-base leading-7 text-foreground bg-background antialiased; }
h1 { @apply text-3xl md:text-4xl font-bold tracking-tight; }
h2 { @apply text-2xl md:text-3xl font-bold tracking-tight; }
h3 { @apply text-xl md:text-2xl font-semibold; }
h4 { @apply text-lg md:text-xl font-semibold; }
p, li { @apply text-[17px] leading-7; }
small { @apply text-sm leading-6; }
```

---

## 5) Three Portal Theme Variants
We use **CSS variable scopes** to theme by portal. Wrap each portal layout root with a class: `.theme-user`, `.theme-investor`, `.theme-admin`.

```css
/* USER PORTAL — friendly, brand‑forward */
.theme-user {
  --primary: 359.6 95.7% 27.6%; /* deep red */
  --accent: 2.4 71.7% 47.1%;    /* bright red for hovers/badges */
  --secondary: 30.6 25.4% 63.7%;/* taupe accents */
}

/* INVESTOR PORTAL — premium, conservative accents */
.theme-investor {
  --primary: 359.6 95.7% 27.6%;
  --accent: 30.6 25.4% 63.7%;   /* taupe as primary accent */
  --secondary: 29.6 51.0% 28.8%;/* earth brown for headings/dividers */
}

/* ADMIN PORTAL — neutral, utilitarian */
.theme-admin {
  --primary: 359.6 95.7% 27.6%;
  --accent: 217.2 32.6% 22%;    /* keep accents neutral/dark */
  --secondary: 210 20% 96%;     /* light gray fills */
}
```

**Next.js example** (`app/(user)/layout.tsx` etc.):

```tsx
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="theme-user">{children}</div>
}
```

---

## 6) Component Guidelines (shadcn/ui)

### Buttons
- **Primary**: brand red bg, white text, bold label, soft shadow.
- **Secondary**: taupe fill or outline with brand ring on focus.
- **Ghost**: minimal text button; hover uses `accent` underline/fg.

```tsx
import { Button } from "@/components/ui/button"

/* tailwind classes for variants (if extending) */
const primary = "bg-primary text-primary-foreground shadow-brand hover:opacity-95"
const secondary = "bg-secondary text-secondary-foreground hover:opacity-95"
const outline = "border border-input bg-background hover:bg-muted"
const ghost = "hover:bg-muted"

<Button className={primary}>Continue</Button>
<Button className={secondary}>Later</Button>
<Button variant="outline" className={outline}>Details</Button>
<Button variant="ghost" className={ghost}>Learn more</Button>
```

### Inputs / Selects / Textareas
- Height `h-11`, padding `px-4`, radius `rounded-xl`.
- Focus ring uses brand: `focus-visible:ring-2 focus-visible:ring-primary`.

```tsx
<input className="h-11 px-4 rounded-xl border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
```

### Cards
- Padding `p-6 md:p-8`, radius `rounded-2xl`, subtle shadow `shadow-sm md:shadow`.
- Headers may use earth‑brown divider: `border-b border-[hsl(29.6_51%_28.8%/0.12)]`.

### Tables
- Dense but readable: `text-[15px]` body; header `text-sm font-semibold`.
- Zebra rows: `odd:bg-muted/40` and `hover:bg-muted`.
- Numeric columns right‑aligned; status chips use `accent` or `secondary` fills.

### Navigation
- Topbar height `h-16`; logo left, actions right.
- Active state: underline + `text-primary` or bottom bar `bg-primary` 2px.

### Badges/Chips
- Default fill taupe (`bg-secondary text-secondary-foreground`).
- For notices: use `accent` with white text; avoid overusing bright reds for non‑critical info.

---

## 7) Example: Navbar + Page Shell
```tsx
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="h-16 border-b">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="size-9 rounded-md bg-primary/90" />
            <span className="text-lg font-bold">Shoraka</span>
          </div>
          <nav className="flex items-center gap-6">
            <a className="text-[15px] hover:text-primary">Dashboard</a>
            <a className="text-[15px] hover:text-primary">Portfolio</a>
            <a className="text-[15px] hover:text-primary">Settings</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10 md:py-12">{children}</main>
    </div>
  )
}
```

---

## 8) Accessibility & Quality
- Minimum color contrast **AA** for text (brand red on white is safe; avoid taupe on white for small text).
- Targets ≥ 44×44px; focus ring always visible (`--ring`).
- Motion: prefer subtle transitions (150–200ms, `ease-out`).

```css
* { @apply transition-[color,background,border,opacity,transform] duration-200 ease-out; }
```

---

## 9) Apply Changes — Checklist for Cursor
1. Update `app/globals.css` with the **:root**, `.dark`, and theme classes.
2. Update `tailwind.config.ts` with color maps, fonts, radii, and shadows.
3. Ensure `Inter` is installed or use an existing sans fallback.
4. Sweep components to:
   - Replace hard‑coded colors with `bg-primary`, `text-foreground`, etc.
   - Enforce input/button heights & radii.
   - Use `accent`/`secondary` fills for badges and highlights.
5. Add portal wrappers (`.theme-user`, `.theme-investor`, `.theme-admin`) to their layouts.
6. Run type‑check & lint; fix any classname conflicts.
7. Produce example pages for each portal demonstrating the styles.

---

## 10) Quick Demo Snippets

**Badge**
```tsx
<span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
  New
</span>
```

**CTA**
```tsx
<Button className="bg-primary text-primary-foreground shadow-brand hover:opacity-95">
  Get started
</Button>
```

**Investor tone block**
```tsx
<div className="theme-investor rounded-2xl border bg-card p-8">
  <h3 className="text-2xl font-semibold">Q4 Performance</h3>
  <p className="mt-2 text-[17px] leading-7 text-muted-foreground">
    Year‑to‑date returns are above benchmark; see the full report.
  </p>
  <div className="mt-6 flex gap-3">
    <Button className="bg-primary text-primary-foreground">View report</Button>
    <Button variant="outline" className="border-input">Download</Button>
  </div>
</div>
```

---

## 11) Notes & Constraints
- Keep the UI **color economy** tight: red(s) + taupe + neutrals. Introduce additional colors only for data viz when strictly necessary.
- Use brand color for **links on hover** (not always on default) to reduce visual noise.
- Admin pages should lean on neutrals; reserve red for confirmations/errors.
- Respect the brand logo clear‑space and do not alter/crop the logo files.

---

## 12) What to Commit
- `app/globals.css`
- `tailwind.config.ts`
- Any component overrides created/updated
- A short `BRANDING.md` summarizing the tokens and how to apply portal themes
