"use client";

/**
 * Dev-only page: status badge examples, status tokens, and Stage A primitives harness.
 * URL: /dev/status-examples
 */

import * as React from "react";
import { notFound } from "next/navigation";
import {
  getStatusPresentation,
  getStatusPresentationByBadgeKey,
  getOfferAcceptancePhaseBadgeClass,
  getSigningEnvelopeBadgeClass,
  STATUS_BADGE_GROUPS,
  STATUS_EXAMPLE_KEYS,
  OFFER_ACCEPTANCE_EXAMPLE_KEYS,
  SIGNING_ENVELOPE_EXAMPLE_KEYS,
  API_STATUS_TO_BADGE_KEY,
  type StatusBadgeGroup,
} from "@cashsouk/config";
import {
  WithdrawReason,
  getOfferAcceptanceStatusPresentation,
  type OfferAcceptanceStatus,
  type SigningEnvelopeStatus,
} from "@cashsouk/types";
import {
  PageShell,
  ListToolbar,
  ListToolbarFilterTrigger,
  FilterChips,
  DataTable,
  EmptyState,
  LoadingState,
  Pagination,
  StatusBadge,
  STATUS_TOKEN_KEYS,
  DetailHeader,
  DetailSection,
  ConfirmDialog,
  StickyFormFooter,
  KeyValueGrid,
  Button,
  type FilterChip,
  type StatusToken,
} from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUS_PRIORITY } from "@/app/(application-management)/applications/status";

const BADGE_BASE = "inline-flex items-center rounded-full px-3 py-1 text-ui font-normal border";

const ALL_WITHDRAWN_REASONS: (WithdrawReason | undefined)[] = [
  undefined,
  ...Object.values(WithdrawReason),
];

const STATUS_MEANING: Record<StatusToken, string> = {
  action: "Yellow — you must act (issuer/investor) or CashSouk must act (admin)",
  submitted: "Blue — waiting on CashSouk or another party (flips for admin)",
  "in-progress": "Indigo — leftover token; not used on user-portal workflow chips",
  success: "Green — completed / approved / settled",
  active: "Violet — live / in force",
  completed: "Sky — leftover token; user portals use success green",
  rejected: "Red — failed / declined / expired / arrears",
  neutral: "Grey — draft / idle / withdrawn / cancelled",
};

type DemoRow = { id: string; customer: string; amount: string; status: StatusToken };

const DEMO_ROWS: DemoRow[] = [
  { id: "A3F91C2B", customer: "Acme Sdn Bhd", amount: "RM 250,000", status: "success" },
  { id: "C1D88A05", customer: "Perdana Corp", amount: "RM 112,000", status: "in-progress" },
  { id: "B7E02F11", customer: "Sunrise Trading", amount: "RM 48,500", status: "action" },
];

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
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
        {!noDot && <span className={cn("mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />}
        {label}
      </Badge>
      {!noMeta && meta && <span className="font-mono text-meta text-muted-foreground">{meta}</span>}
    </div>
  );
}

function PrimitivesHarness() {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [chipIds, setChipIds] = React.useState<
    Array<{ id: string; label: string }>
  >([
    { id: "status", label: "Status: Offer received" },
    { id: "range", label: "Last 30 days" },
  ]);

  const appliedFilters: FilterChip[] = chipIds.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => setChipIds((prev) => prev.filter((c) => c.id !== chip.id)),
  }));

  return (
    <div className="space-y-6">
      <Section title="Status tokens (StatusBadge)">
        <p className="mb-3 text-sm text-muted-foreground">
          Consumes <code className="text-xs">status.*</code> tokens with light/dark pairs from{" "}
          <code className="text-xs">packages/styles</code>.
        </p>
        <div className="flex flex-wrap gap-3">
          {STATUS_TOKEN_KEYS.map((token) => (
            <div key={token} className="flex flex-col items-start gap-1">
              <StatusBadge status={token} label={token} />
              <span className="max-w-[12rem] text-meta text-muted-foreground">
                {STATUS_MEANING[token]}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            Destructive sample (distinct from primary)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="default" size="sm" className="rounded-xl">
              Apply for financing
            </Button>
            <Button variant="destructive" size="sm" className="rounded-xl">
              Withdraw application
            </Button>
          </div>
        </div>
      </Section>

      <Section title="PageShell">
        <PageShell
          title="Applications"
          description="Track financing requests and respond when an offer needs your attention."
          breadcrumb={<span>Home / Applications</span>}
          action={
            <Button size="sm" className="rounded-xl">
              Apply for financing
            </Button>
          }
        />
      </Section>

      <Section title="ListToolbar + FilterChips">
        <ListToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by ID, customer, invoice…"
          filterGroups={
            <ListToolbarFilterTrigger label="Status" />
          }
          appliedFilters={appliedFilters}
          onClearFilters={() => setChipIds([])}
          onReload={() => undefined}
          countLabel="12 applications"
        />
        <div className="mt-3">
          <FilterChips
            chips={[
              {
                id: "demo",
                label: "Standalone chip",
                onRemove: () => undefined,
              },
            ]}
          />
        </div>
      </Section>

      <Section title="DataTable">
        <DataTable
          rows={DEMO_ROWS}
          getRowKey={(row) => row.id}
          columns={[
            {
              id: "id",
              header: "ID",
              sticky: true,
              cell: (row) => <span className="font-mono text-sm">#{row.id}</span>,
            },
            {
              id: "customer",
              header: "Customer",
              cell: (row) => row.customer,
            },
            {
              id: "amount",
              header: "Amount",
              align: "right",
              cell: (row) => <span className="tabular-nums">{row.amount}</span>,
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => <StatusBadge status={row.status} label={row.status} />,
            },
          ]}
        />
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="EmptyState — no-data">
          <EmptyState
            variant="no-data"
            action={
              <Button size="sm" className="rounded-xl">
                Apply for financing
              </Button>
            }
          />
        </Section>
        <Section title="EmptyState — no-results">
          <EmptyState
            variant="no-results"
            action={
              <Button variant="outline" size="sm" className="rounded-xl">
                Clear filters
              </Button>
            }
          />
        </Section>
      </div>

      <Section title="LoadingState">
        <div className="space-y-6">
          <LoadingState variant="list" rows={2} />
          <LoadingState variant="cards" rows={3} />
        </div>
      </Section>

      <Section title="Pagination">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={48}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="applications"
        />
      </Section>

      <Section title="DetailHeader + DetailSection + KeyValueGrid">
        <DetailHeader
          breadcrumb={<span>Applications › #A3F91C2B</span>}
          title="Application #A3F91C2B"
          status={<StatusBadge status="action" label="Offer received" />}
          facts="Acme Sdn Bhd · Facility financing · submitted 12 Mar 2026"
          actions={
            <>
              <div className="rounded-xl bg-status-action-bg p-0.5">
                <Button size="sm" className="rounded-xl">
                  Review offer
                </Button>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-xl"
                onClick={() => setConfirmOpen(true)}
              >
                Withdraw
              </Button>
            </>
          }
        />
        <div className="mt-6 space-y-6">
          <DetailSection title="Summary" description="Key facts for this application.">
            <KeyValueGrid
              items={[
                { label: "Customer", value: "Acme Sdn Bhd" },
                { label: "Contract value", value: "RM 250,000", tabular: true },
                { label: "Financing applied", value: "RM 200,000", tabular: true },
                { label: "Submitted", value: "12 Mar 2026" },
              ]}
            />
          </DetailSection>
        </div>
      </Section>

      <Section title="StickyFormFooter">
        <div className="relative overflow-hidden rounded-xl border">
          <div className="h-24 bg-muted/30 p-4 text-sm text-muted-foreground">
            Form content (scrollable area)
          </div>
          <StickyFormFooter
            saveState="unsaved"
            back={
              <Button variant="outline" size="sm" className="rounded-xl">
                Back
              </Button>
            }
            primary={
              <Button size="sm" className="rounded-xl">
                Save and continue
              </Button>
            }
          />
        </div>
      </Section>

      <Section title="ConfirmDialog">
        <Button
          variant="destructive"
          size="sm"
          className="rounded-xl"
          onClick={() => setConfirmOpen(true)}
        >
          Open destructive confirm
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          variant="destructive"
          title="Withdraw application?"
          description="This cannot be undone. You will need to submit a new application if you change your mind."
          confirmText="Withdraw application"
          onConfirm={() => setConfirmOpen(false)}
        />
      </Section>
    </div>
  );
}

function envelopeLabel(status: SigningEnvelopeStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function StatusExamplesPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const groupOrder: StatusBadgeGroup[] = [
    "issuer_action",
    "admin_action",
    "completed",
    "expired_closed",
    "neutral",
  ];

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Status Badge &amp; Primitives Reference
          </h1>
          <p className="mt-1 text-ui text-muted-foreground">
            Dev-only. Six viewer-centric tokens (yellow/blue flip by seat). Indigo and sky are leftover CSS — do not use them on issuer/investor workflow chips.
            {" "}
            <code className="text-meta">@cashsouk/ui</code>. Admin: raw labels. Issuer: collapsed (e.g. Facility Pending → Under Review).
          </p>
        </header>

        <PrimitivesHarness />

        <Section title="Colour groups">
          <p className="text-sm text-muted-foreground mb-3">
            All application, offer-acceptance, and signing-envelope badges map to one of these groups.
          </p>
          <div className="flex flex-wrap gap-3">
            {groupOrder.map((group) => {
              const g = STATUS_BADGE_GROUPS[group];
              return (
                <BadgeItem
                  key={group}
                  badgeClass={g.badgeClass}
                  dotClass={g.dotClass}
                  label={g.label}
                  meta={group}
                  noDot
                />
              );
            })}
          </div>
        </Section>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="DB → Display (all)">
            <p className="mb-3 text-sm text-muted-foreground">
              All API statuses. Admin shows these; issuer collapses some.
            </p>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 border-b bg-card text-left">
                    <th className="py-2 font-mono text-xs font-medium">DB</th>
                    <th className="py-2 font-medium">Display</th>
                    <th className="py-2 font-medium font-mono text-xs">Group</th>
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
                        <td className="py-1.5 font-mono text-xs text-muted-foreground">{pres.variant}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="List priority (issuer)">
            <p className="mb-3 text-sm text-muted-foreground">Lower = higher in list.</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(APPLICATION_STATUS_PRIORITY)
                .sort(([, a], [, b]) => a - b)
                .map(([badgeKey, priority]) => (
                  <span
                    key={badgeKey}
                    className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 font-mono text-xs"
                  >
                    <span className="text-muted-foreground">{priority}</span>
                    {badgeKey}
                  </span>
                ))}
            </div>
          </Section>
        </div>

        <Section title="Badges — Admin view (all)">
          <p className="mb-3 text-sm text-muted-foreground">
            Raw labels: Facility Pending, Facility Sent, Invoice Pending, etc.
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
                  meta={`${key} · ${pres.variant}${priority != null ? ` · #${priority}` : ""}`}
                />
              );
            })}
          </div>
        </Section>

        <Section title="Badges — Issuer view (all)">
          <p className="mb-3 text-sm text-muted-foreground">
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
              // Dot/colour must match the collapsed badge, not the raw API status
              // (e.g. CONTRACT_SENT → "Under Review" stays blue, not amber).
              const collapsedStatusForDot =
                badgeKey === "under_review" ? "UNDER_REVIEW" : key;
              const fullPres = getStatusPresentation(
                collapsedStatusForDot,
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
                  meta={`${key} · ${fullPres.variant}${priority != null ? ` · #${priority}` : ""}`}
                />
              );
            })}
          </div>
        </Section>

        <Section title="Offer acceptance phase badges">
          <p className="text-sm text-muted-foreground mb-3">
            Acceptance tab — labels from types; colours from config.
          </p>
          <div className="flex flex-wrap gap-3">
            {OFFER_ACCEPTANCE_EXAMPLE_KEYS.map((status) => {
              const { label } = getOfferAcceptanceStatusPresentation(status as OfferAcceptanceStatus);
              const badgeClass = getOfferAcceptancePhaseBadgeClass(status as OfferAcceptanceStatus);
              return (
                <BadgeItem
                  key={status}
                  badgeClass={badgeClass}
                  dotClass=""
                  label={label}
                  meta={status}
                  noDot
                />
              );
            })}
          </div>
        </Section>

        <Section title="Signing envelope badges">
          <p className="text-sm text-muted-foreground mb-3">
            Signing package panel — shared colour groups.
          </p>
          <div className="flex flex-wrap gap-3">
            {SIGNING_ENVELOPE_EXAMPLE_KEYS.map((status) => {
              const badgeClass = getSigningEnvelopeBadgeClass(status);
              return (
                <BadgeItem
                  key={status}
                  badgeClass={badgeClass}
                  dotClass=""
                  label={envelopeLabel(status)}
                  meta={status}
                  noDot
                />
              );
            })}
          </div>
        </Section>

        <Section title="WITHDRAWN — admin vs issuer (by withdraw_reason)">
          <p className="mb-3 text-sm text-muted-foreground">
            Same DB status; admin keeps long labels. Issuer shows Declined for OFFER_REJECTED, Withdrawn for
            USER_CANCELLED, Offer Expired for OFFER_EXPIRED.
          </p>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Admin</p>
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
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Issuer</p>
              <div className="flex flex-wrap gap-3">
                {ALL_WITHDRAWN_REASONS.map((reason) => {
                  const pres = getStatusPresentation("WITHDRAWN", reason, {
                    issuerWithdrawPresentation: true,
                  });
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
