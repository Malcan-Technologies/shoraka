import React from "react";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { formatNoteInvestorCommitment } from "@cashsouk/types";
import { StatusBadge, formatMoneyDisplay } from "@cashsouk/ui";
import {
  getIssuerFinancingStatusPresentation,
  financingKindToStatusToken,
  type IssuerFinancingStatusKind,
} from "@/lib/issuer-dashboard-labels";

export { financingKindToStatusToken };

export const EM_DASH = "\u2014";

/** Soft surface for financing cards that need issuer action (yellow wash, not full badge fill). */
export const FINANCING_ATTENTION_SURFACE =
  "border-status-action-text/15 bg-[hsl(var(--status-action-bg)/0.45)]";
/** Soft red wash for notes in arrears — stronger urgency than amber attention. */
export const FINANCING_ARREARS_SURFACE =
  "border-status-rejected-text/25 bg-[hsl(var(--status-rejected-bg)/0.55)]";
/** @deprecated Alias — offers use the same action (yellow) surface as amendments. */
export const FINANCING_OFFER_ATTENTION_SURFACE = FINANCING_ATTENTION_SURFACE;

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

export function InvestorCommitmentLine({
  fundedAmount,
  investorCount,
}: {
  fundedAmount: unknown;
  investorCount: number;
}) {
  return (
    <p className="flex items-start gap-2 text-ui text-foreground">
      <UserGroupIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>
        {formatNoteInvestorCommitment(formatMoney(fundedAmount), investorCount)}
      </span>
    </p>
  );
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
    <p className="flex items-center text-ui leading-6 text-foreground">
      <span className="font-normal text-muted-foreground">{label}:&nbsp;</span>
      <span
        className={
          tabular
            ? "min-w-0 font-medium tabular-nums text-foreground"
            : "min-w-0 font-medium text-foreground"
        }
      >
        {children}
      </span>
    </p>
  );
}

export function IssuerFinancingStatusBadge({ kind }: { kind: IssuerFinancingStatusKind }) {
  const p = getIssuerFinancingStatusPresentation(kind);
  return <StatusBadge label={p.label} status={financingKindToStatusToken(kind)} />;
}

const FUNDING_STATUS_PREFIX = "Funding status ";

export function FundingStatusLine({ text }: { text: string }) {
  const m = text.match(/^Funding status \((.+)\)$/);
  if (m) {
    return (
      <p className="text-ui leading-6 text-foreground">
        <span className="font-medium">{FUNDING_STATUS_PREFIX}</span>
        <span className="text-ui font-normal leading-6 text-muted-foreground">({m[1]})</span>
      </p>
    );
  }
  if (text.startsWith(FUNDING_STATUS_PREFIX)) {
    const suffix = text.slice(FUNDING_STATUS_PREFIX.length);
    return (
      <p className="text-ui leading-6 text-foreground">
        <span className="font-medium">{FUNDING_STATUS_PREFIX}</span>
        <span className="text-ui font-normal leading-6 text-muted-foreground">{suffix}</span>
      </p>
    );
  }
  return <p className="text-ui font-medium leading-6 text-foreground">{text}</p>;
}
