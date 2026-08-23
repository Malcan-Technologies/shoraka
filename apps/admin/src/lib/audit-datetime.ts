const AUDIT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const AUDIT_DATE_OPTIONS_WITH_SECONDS: Intl.DateTimeFormatOptions = {
  ...AUDIT_DATE_OPTIONS,
  second: "2-digit",
};

export function formatAuditDateTime(
  value: string | Date | null | undefined,
  options: { seconds?: boolean } = {}
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : "—";
  return date.toLocaleString("en-MY", options.seconds ? AUDIT_DATE_OPTIONS_WITH_SECONDS : AUDIT_DATE_OPTIONS);
}
