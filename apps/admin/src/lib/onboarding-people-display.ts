/**
 * Shared rules for admin people[] from onboarding / application detail:
 * - Hide shareholder-only when known holding &lt; 5%
 * - When director + shareholder ≥5%, show "DIRECTOR, SHAREHOLDER (10%)"
 */

export type PeopleRolesRowInput = {
  roles: string[];
  sharePercentage: number | null;
};

export function filterVisiblePeopleRows<T extends PeopleRolesRowInput>(peopleRows: T[]): T[] {
  return peopleRows
    .map((p) => {
      const roles = Array.isArray(p.roles) ? p.roles : [];
      const hasDirector = roles.includes("DIRECTOR");
      const hasShareholder = roles.includes("SHAREHOLDER");
      const sharePct = p.sharePercentage;
      const shareholderAllowed =
        !hasShareholder || sharePct === null || typeof sharePct !== "number" || sharePct >= 5;

      const nextRoles = roles.filter((role) => {
        if (role === "DIRECTOR") return true;
        if (role === "SHAREHOLDER") return shareholderAllowed;
        return true;
      });

      if (!hasDirector && hasShareholder && !shareholderAllowed) return null;
      if (nextRoles.length === 0) return null;

      return { ...p, roles: nextRoles };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

export function formatPeopleRolesLine(p: PeopleRolesRowInput): string {
  const upper = p.roles.map((r) => r.toUpperCase());
  const hasDirector = upper.includes("DIRECTOR");
  const hasShareholder = upper.includes("SHAREHOLDER");
  const pctRaw = p.sharePercentage;
  const pctLabel =
    typeof pctRaw === "number" && Number.isFinite(pctRaw)
      ? `${Number.isInteger(pctRaw) ? pctRaw : Number(pctRaw.toFixed(2))}%`
      : null;

  if (hasDirector && hasShareholder) {
    return pctLabel ? `DIRECTOR, SHAREHOLDER (${pctLabel})` : "DIRECTOR, SHAREHOLDER";
  }
  if (hasShareholder && !hasDirector) {
    return pctLabel ? `SHAREHOLDER (${pctLabel})` : "SHAREHOLDER";
  }
  if (hasDirector) {
    return "DIRECTOR";
  }
  return upper.join(", ");
}
