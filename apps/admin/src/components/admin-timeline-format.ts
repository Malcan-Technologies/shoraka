import { format } from "date-fns";

export type AdminTimelineDetail = {
  key?: string;
  label: string;
  value: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2})/;
const ACRONYMS = new Set(["AML", "KYC", "KYB", "TNC", "SSM", "PDF", "CSV", "API", "ID"]);

export function humanizeAdminTimelineToken(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes(" → ")) {
    return trimmed
      .split(" → ")
      .map((part) => humanizeAdminTimelineToken(part.trim()))
      .join(" → ");
  }
  if (!/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(trimmed)) return value;
  if (ACRONYMS.has(trimmed)) return trimmed;
  return trimmed
    .split("_")
    .map((word) => (ACRONYMS.has(word) ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(" ");
}

export function formatAdminTimelineValue(value: string): string {
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  if (ISO_DATE.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const isDateOnly = /T00:00:00/.test(value);
    if (isDateOnly) {
      const [year, month, day] = value.slice(0, 10).split("-").map(Number);
      return format(new Date(year, month - 1, day), "d MMM yyyy");
    }

    return format(date, "d MMM yyyy, h:mm a");
  }

  return humanizeAdminTimelineToken(value);
}
