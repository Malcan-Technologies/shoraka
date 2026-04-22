/**
 * Tailwind class names for admin KYC/AML screening badges (organization + application guarantor).
 *
 * Status uses one function for every caller: organization onboarding statuses and RegTank
 * guarantor strings share the same palette. Extra branches (e.g. "Score generated", "No match") only
 * apply when that label is present; they do not change colors for typical org statuses.
 */
export function kycAmlScreeningStatusBadgeClass(status: string | undefined): string {
  if (!status) return "bg-muted text-muted-foreground";
  const s = status.toLowerCase();
  if (s === "approved")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (s === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (s.includes("pending"))
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  if (s.includes("positive match") || s.includes("positive_match"))
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (s.includes("no match") || s.includes("no_match"))
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (s.includes("unresolved")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  if (s.includes("score generated") || s.includes("screening in progress"))
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function kycAmlScreeningRiskLevelBadgeClass(riskLevel: string | undefined): string {
  if (!riskLevel) return "bg-muted text-muted-foreground";
  const level = riskLevel.toLowerCase();
  if (level.includes("low"))
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (level.includes("medium"))
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  if (level.includes("high"))
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return "bg-muted text-muted-foreground";
}
