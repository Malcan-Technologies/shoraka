import { cn } from "@/lib/utils";
import { adminHeroTintClass } from "@/lib/admin-status-token";
import type { StatusToken } from "@cashsouk/ui";

export const HERO_SUMMARY_CARD_LIMIT = 3;

export const ADMIN_HERO_SURFACE_CLASS = "admin-hero-surface";
export const ADMIN_HERO_PATTERN_CLASS = "admin-hero-pattern";

/** Issuer uses brand red; investor uses portal earth brown; status follows the badge. */
export type AdminHeroTint = "status" | "issuer" | "investor";

export function adminHeroTintModifierClass(
  heroTint: AdminHeroTint,
  tone?: StatusToken
): string | null {
  if (heroTint === "issuer") return "admin-hero-tint-issuer";
  if (heroTint === "investor") return "admin-hero-tint-investor";
  return tone ? adminHeroTintClass(tone) : null;
}

/**
 * Width of the hero top-right rail (KPI wells + actions).
 * Side-by-side only from `xl` so identity (title, financing type) stays readable
 * next to the admin sidebar. Multi-card rails cap at ~half width instead of
 * reserving 20rem per well, which crushed labels at laptop widths.
 */
export function heroAsideClusterClass(cardCount: number): string {
  const n = Math.min(Math.max(cardCount, 1), HERO_SUMMARY_CARD_LIMIT);
  return cn(
    "flex w-full flex-col gap-3",
    n <= 1 && "xl:w-[20rem] xl:shrink-0",
    n >= 2 && "min-w-0 xl:shrink-0",
    n === 2 && "xl:w-[min(28rem,48%)]",
    n >= 3 && "xl:w-[min(36rem,52%)]"
  );
}

/** Layout for hero KPI wells inside the aside rail. */
export function heroSummaryClusterClass(count: number): string {
  const n = Math.max(0, Math.min(count, HERO_SUMMARY_CARD_LIMIT));
  return cn(
    "grid w-full items-stretch gap-3",
    n <= 1
      ? "grid-cols-1"
      : n === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3"
  );
}
