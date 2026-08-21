/** Small formatting helpers for LO merge fields. */

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"] as const;

/** Convert a non-negative integer (0–999) to lowercase English words. */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  const v = Math.floor(n);
  if (v < 20) return ONES[v] ?? "";
  if (v < 100) {
    const ten = TENS[Math.floor(v / 10)] ?? "";
    const one = v % 10;
    return one === 0 ? ten : `${ten}-${ONES[one]}`;
  }
  if (v < 1000) {
    const hundred = Math.floor(v / 100);
    const rest = v % 100;
    const head = `${ONES[hundred]} hundred`;
    return rest === 0 ? head : `${head} and ${numberToWords(rest)}`;
  }
  return String(v);
}

export function formatRmAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `RM ${Number(value).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatLetterDate(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return "";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

export function formatDisplayDate(isoDate: string | null | undefined): string {
  if (!isoDate?.trim()) return "";
  // Prefer YYYY-MM-DD as-is when already a calendar date string
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return formatLetterDate(isoDate);
}

export function daysPhrase(days: number): string {
  if (!Number.isFinite(days) || days < 0) return "";
  const n = Math.floor(days);
  const words = numberToWords(n);
  return `${words} (${n}) days`;
}

export function formatAddressBlock(parts: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postcode?: string | null;
  state?: string | null;
  country?: string | null;
}): string {
  const line = [parts.line1, parts.line2].filter(Boolean).join(", ");
  const cityLine = [parts.postcode, parts.city, parts.state].filter(Boolean).join(" ");
  return [line, cityLine, parts.country].filter(Boolean).join(", ");
}
