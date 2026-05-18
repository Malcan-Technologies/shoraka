import React from "react";
import { Badge } from "@/components/ui/badge";
import { formatMoneyDisplay } from "@cashsouk/ui";
import {
  getIssuerFinancingStatusPresentation,
  type IssuerFinancingStatusKind,
} from "@/lib/issuer-dashboard-labels";

export const EM_DASH = "\u2014";

export function displayCell(value: unknown): string {
  if (value === null || value === undefined) return EM_DASH;
  const s = String(value).trim();
  if (s === "" || s === "-" || s === "NA" || s.toUpperCase() === "N/A") return EM_DASH;
  return s;
}

export function formatMoney(value: unknown) {
  return formatMoneyDisplay(value, EM_DASH);
}

export function formatDate(value: unknown) {
  if (value === null || value === undefined) return EM_DASH;
  let d: Date | null = null;
  if (value instanceof Date) d = value;
  else if (typeof value === "number") d = new Date(value);
  else if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) d = new Date(Number(trimmed));
    else {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) d = new Date(parsed);
      else {
        const alt = trimmed.replace(/-/g, "/");
        const parsed2 = Date.parse(alt);
        if (!Number.isNaN(parsed2)) d = new Date(parsed2);
      }
    }
  } else {
    d = new Date(String(value));
  }
  if (!d || Number.isNaN(d.getTime())) return EM_DASH;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function LabelValue({
  label,
  children,
  tabular,
}: {
  label: string;
  children: React.ReactNode;
  tabular?: boolean;
}) {
  return (
    <p className="text-[17px] leading-7 text-foreground">
      <span className="font-normal text-muted-foreground">{label}: </span>
      <span
        className={
          tabular
            ? "font-medium tabular-nums text-foreground"
            : "font-medium text-foreground"
        }
      >
        {children}
      </span>
    </p>
  );
}

export function IssuerFinancingStatusBadge({ kind }: { kind: IssuerFinancingStatusKind }) {
  const p = getIssuerFinancingStatusPresentation(kind);
  return (
    <Badge variant={p.variant} className={p.className}>
      {p.label}
    </Badge>
  );
}

const FUNDING_STATUS_PREFIX = "Funding status ";

export function FundingStatusLine({ text }: { text: string }) {
  const m = text.match(/^Funding status \((.+)\)$/);
  if (m) {
    return (
      <p className="text-[17px] leading-7 text-foreground">
        <span className="font-medium">{FUNDING_STATUS_PREFIX}</span>
        <span className="text-sm font-normal leading-6 text-muted-foreground">({m[1]})</span>
      </p>
    );
  }
  if (text.startsWith(FUNDING_STATUS_PREFIX)) {
    const suffix = text.slice(FUNDING_STATUS_PREFIX.length);
    return (
      <p className="text-[17px] leading-7 text-foreground">
        <span className="font-medium">{FUNDING_STATUS_PREFIX}</span>
        <span className="text-sm font-normal leading-6 text-muted-foreground">{suffix}</span>
      </p>
    );
  }
  return <p className="text-[17px] font-medium leading-7 text-foreground">{text}</p>;
}
