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

/** Width of the hero top-right rail (KPI wells + actions). Must not shrink-wrap to a button. */
export function heroAsideClusterClass(cardCount: number): string {
  const n = Math.min(Math.max(cardCount, 1), HERO_SUMMARY_CARD_LIMIT);
  return cn(
    "flex w-full shrink-0 flex-col gap-3",
    n <= 1 && "lg:min-w-[20rem] lg:w-auto",
    n === 2 && "lg:w-[41rem] lg:max-w-[min(41rem,calc(100%-12rem))]",
    n >= 3 && "lg:w-[62rem] lg:max-w-[min(62rem,calc(100%-12rem))]"
  );
}

/** Layout for hero KPI wells inside the aside rail. */
export function heroSummaryClusterClass(count: number): string {
  const n = Math.max(0, Math.min(count, HERO_SUMMARY_CARD_LIMIT));
  return cn(
    "grid w-full items-stretch gap-3",
    n <= 1 ? "grid-cols-1 lg:min-w-[20rem]" : n === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"
  );
}
