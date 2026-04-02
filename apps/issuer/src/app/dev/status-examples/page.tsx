"use client";

/**
 * Dev-only page: status badge examples and reference.
 * URL: /dev/status-examples
 */

import { notFound } from "next/navigation";
import {
  getStatusPresentation,
  getStatusPresentationByBadgeKey,
  STATUS_EXAMPLE_KEYS,
  API_STATUS_TO_BADGE_KEY,
} from "@cashsouk/config";
import { WithdrawReason } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUS_PRIORITY } from "@/app/(application-management)/applications/status";

const BADGE_BASE = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border";

const ALL_WITHDRAWN_REASONS: (WithdrawReason | undefined)[] = [
  undefined,
  ...Object.values(WithdrawReason),
];

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function BadgeItem({
  badgeClass,
  dotClass,
  label,
  meta,
  noDot,
  noMeta,
}: {
  badgeClass: string;
  dotClass: string;
  label: string;
  meta?: string;
  noDot?: boolean;
  noMeta?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant="outline" className={cn(BADGE_BASE, badgeClass)}>
        {!noDot && <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full shrink-0", dotClass)} aria-hidden />}
        {label}
      </Badge>
      {!noMeta && meta && <span className="text-[10px] font-mono text-muted-foreground">{meta}</span>}
    </div>
  );
}

export default function StatusExamplesPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Status Badge Reference</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Dev-only. Admin: raw labels. Issuer: collapsed (e.g. Contract Pending → Under Review). Archived never shown in admin or issuer listing.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="DB → Display (all)">
            <p className="text-sm text-muted-foreground mb-3">
              All API statuses. Admin shows these; issuer collapses some.
            </p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left sticky top-0 bg-card">
                    <th className="py-2 font-medium font-mono text-xs">DB</th>
                    <th className="py-2 font-medium">Display</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_EXAMPLE_KEYS.map((key) => {
                    const pres = getStatusPresentation(
                      key,
                      key === "WITHDRAWN" ? WithdrawReason.USER_CANCELLED : undefined
                    );
                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-1.5 font-mono text-xs text-muted-foreground">{key}</td>
                        <td className="py-1.5">{pres.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="List priority (issuer)">
            <p className="text-sm text-muted-foreground mb-3">
              Lower = higher in list.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(APPLICATION_STATUS_PRIORITY)
                .sort(([, a], [, b]) => a - b)
                .map(([badgeKey, priority]) => (
                  <span
                    key={badgeKey}
                    className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-xs font-mono"
                  >
                    <span className="text-muted-foreground">{priority}</span>
                    {badgeKey}
                  </span>
                ))}
            </div>
          </Section>
        </div>

        <Section title="Badges — Admin view (all)">
          <p className="text-sm text-muted-foreground mb-3">
            Raw labels: Contract Pending, Contract Sent, Invoice Pending, etc.
          </p>
          <div className="flex flex-wrap gap-3">
            {STATUS_EXAMPLE_KEYS.map((key) => {
              const pres = getStatusPresentation(
                key,
                key === "WITHDRAWN" ? WithdrawReason.USER_CANCELLED : undefined
              );
              const badgeKey = API_STATUS_TO_BADGE_KEY[key] ?? key.toLowerCase();
              const priority = APPLICATION_STATUS_PRIORITY[badgeKey];
              return (
                <BadgeItem
                  key={key}
                  badgeClass={pres.badgeClass}
                  dotClass={pres.dotClass}
                  label={pres.label}
                  meta={`${key}${priority != null ? ` · #${priority}` : ""}`}
                />
              );
            })}
          </div>
        </Section>

        <Section title="Badges — Issuer view (all)">
          <p className="text-sm text-muted-foreground mb-3">
            DB received → issuer shows. CONTRACT_PENDING, CONTRACT_SENT, etc. → Under Review.
          </p>
          <div className="flex flex-wrap gap-3">
            {STATUS_EXAMPLE_KEYS.map((key) => {
              const badgeKey = API_STATUS_TO_BADGE_KEY[key] ?? key.toLowerCase();
              const pres = getStatusPresentationByBadgeKey(
                badgeKey,
                key === "WITHDRAWN" ? WithdrawReason.USER_CANCELLED : undefined,
                { issuerWithdrawPresentation: true }
              );
              const fullPres = getStatusPresentation(
                key,
                key === "WITHDRAWN" ? WithdrawReason.USER_CANCELLED : undefined,
                { issuerWithdrawPresentation: true }
              );
              const priority = APPLICATION_STATUS_PRIORITY[badgeKey];
              return (
                <BadgeItem
                  key={key}
                  badgeClass={pres.color}
                  dotClass={fullPres.dotClass}
                  label={pres.label}
                  meta={`${key}${priority != null ? ` · #${priority}` : ""}`}
                />
              );
            })}
          </div>
        </Section>

        <Section title="WITHDRAWN — admin vs issuer (by withdraw_reason)">
          <p className="text-sm text-muted-foreground mb-3">
            Same DB status; admin keeps long labels. Issuer shows Declined for OFFER_REJECTED, Withdrawn for
            USER_CANCELLED, Offer Expired for OFFER_EXPIRED.
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Admin</p>
              <div className="flex flex-wrap gap-3">
                {ALL_WITHDRAWN_REASONS.map((reason) => {
                  const pres = getStatusPresentation("WITHDRAWN", reason);
                  const rkey = reason ?? "default";
                  const meta = reason ? `WITHDRAWN + ${reason}` : "WITHDRAWN (default)";
                  return (
                    <BadgeItem
                      key={`admin-${rkey}`}
                      badgeClass={pres.badgeClass}
                      dotClass={pres.dotClass}
                      label={pres.label}
                      meta={meta}
                    />
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Issuer</p>
              <div className="flex flex-wrap gap-3">
                {ALL_WITHDRAWN_REASONS.map((reason) => {
                  const pres = getStatusPresentation("WITHDRAWN", reason, { issuerWithdrawPresentation: true });
                  const rkey = reason ?? "default";
                  const meta = reason ? `WITHDRAWN + ${reason}` : "WITHDRAWN (default)";
                  return (
                    <BadgeItem
                      key={`issuer-${rkey}`}
                      badgeClass={pres.badgeClass}
                      dotClass={pres.dotClass}
                      label={pres.label}
                      meta={meta}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
