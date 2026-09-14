"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, StatusBadge } from "@cashsouk/ui";
import {
  formatApplicationReference,
  formatInvoiceReference,
  formatNoteDateEnMy,
  getOfferAcceptanceFromOfferDetails,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NormalizedApplication } from "@/app/(application-management)/applications/status";
import { isIssuerApplicationActionable } from "@/app/(application-management)/applications/status";
import {
  applicationHeadlineAmount,
  getApplicationCardPrimaryAction,
} from "@/app/(application-management)/applications/components/application-card-model";
import { isIssuerInvoiceActionable } from "@/lib/issuer-financing-actionable";
import { getInvoiceAttentionAction } from "@/components/financing/invoice-attention-card-model";
import { asInvoiceForModal, type IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { DashboardSectionHeader } from "./dashboard-section-header";
import { DashboardPipelineStep } from "./dashboard-pipeline-step";
import {
  DASHBOARD_LIST_PAGE_SIZE,
  effectiveOriginationKind,
  hasOpenInvoiceOrigination,
  isOfferAccepted,
  nextDashboardVisibleCount,
  originationBadgeFromInvoiceStatus,
  originationKindLabel,
  orderWhereThingsStandItems,
  pipelineStepStates,
  resolveOriginationPipeline,
  shouldShowWhereThingsStandApplication,
  takeDashboardPreview,
  type OriginationKind,
  type PipelineStepState,
} from "./where-things-stand";

function applicationFacilitySigned(app: NormalizedApplication): boolean {
  return (
    app.signedContractOfferLetterAvailable ||
    String(app.contractStatus ?? "").toUpperCase() === "APPROVED"
  );
}

function applicationOfferSigned(app: NormalizedApplication): boolean {
  return app.invoices.some((invoice) => invoice.signedOfferLetterAvailable);
}

function applicationKind(app: NormalizedApplication): OriginationKind {
  return effectiveOriginationKind({
    structureType: app.structureType,
    type: app.type,
    contractId: app.contractId,
    facilitySigned: applicationFacilitySigned(app),
    hasOpenInvoiceOrigination: hasOpenInvoiceOrigination(app.invoices),
  });
}

function invoiceKind(invoice: IssuerDashboardInvoice): OriginationKind {
  return invoice.contractId ? "existing_contract" : "invoice_only";
}

function OriginationItemCard({
  yourTurn,
  reference,
  badgeLabel,
  badgeStatus,
  detail,
  action,
  pipelineSteps,
  pipelineStates,
}: {
  yourTurn: boolean;
  reference: string;
  badgeLabel: string;
  badgeStatus: "action" | "submitted";
  detail: string;
  action: { href: string; label: string; buttonVariant: "default" | "outline" } | null;
  pipelineSteps: readonly string[];
  pipelineStates: PipelineStepState[];
}) {
  return (
    <Card
      className={cn(
        "flex h-full min-w-0 flex-col overflow-hidden rounded-2xl p-5 shadow-sm md:p-6",
        yourTurn && "bg-status-action-bg/40"
      )}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-ui font-semibold">{reference}</span>
            <StatusBadge label={badgeLabel} status={badgeStatus} size="sm" />
          </div>
          <p className="mt-1 text-ui text-muted-foreground">{detail}</p>
        </div>
        {action ? (
          <Button asChild variant={action.buttonVariant} className="h-10 w-fit shrink-0 rounded-xl">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : null}
      </div>
      <div className="mt-auto flex w-full flex-wrap gap-3 pt-5">
        {pipelineSteps.map((label, stepIndex) => (
          <DashboardPipelineStep
            key={label}
            label={label}
            state={pipelineStates[stepIndex] ?? "upcoming"}
            yourTurn={yourTurn}
          />
        ))}
      </div>
    </Card>
  );
}

function InvoiceOriginationCard({ invoice }: { invoice: IssuerDashboardInvoice }) {
  const action = getInvoiceAttentionAction(invoice);
  const kind = invoiceKind(invoice);
  const pipeline = resolveOriginationPipeline({
    kind,
    badgeKey: originationBadgeFromInvoiceStatus(invoice.invoiceStatus),
    offerAccepted: isOfferAccepted(
      getOfferAcceptanceFromOfferDetails(
        asInvoiceForModal(invoice.invoiceForModal)?.offer_details
      )?.status,
      false
    ),
    signed: false,
  });
  const states = pipelineStepStates(pipeline.steps.length, pipeline.currentIndex);
  const reference = formatInvoiceReference({
    displayReference: invoice.displayReference,
    businessNumber: invoice.invoiceNumber,
    id: invoice.id,
  });
  return (
    <OriginationItemCard
      yourTurn
      reference={reference}
      badgeLabel="Your turn"
      badgeStatus="action"
      detail={`${originationKindLabel(kind)} · ${action.headline}`}
      action={{ href: action.href, label: action.label, buttonVariant: action.buttonVariant }}
      pipelineSteps={pipeline.steps}
      pipelineStates={states}
    />
  );
}

function ApplicationOriginationCard({ app }: { app: NormalizedApplication }) {
  const yourTurn = isIssuerApplicationActionable(app);
  const kind = applicationKind(app);
  const signed =
    kind === "invoice_only"
      ? applicationOfferSigned(app)
      : kind === "new_contract"
        ? applicationFacilitySigned(app)
        : false;
  const pipeline = resolveOriginationPipeline({
    kind,
    badgeKey: app.cardStatus.badgeKey,
    offerAccepted: isOfferAccepted(app.offerAcceptanceStatus, signed),
    signed,
  });
  const states = pipelineStepStates(pipeline.steps.length, pipeline.currentIndex);
  const submitted = formatNoteDateEnMy(app.submittedAt);
  const amount = applicationHeadlineAmount(app);
  const action = yourTurn ? getApplicationCardPrimaryAction(app) : null;
  const reference = formatApplicationReference({
    id: app.id,
    displayReference: app.displayReference,
  });
  const detail = [
    originationKindLabel(kind),
    amount !== "—" ? `${amount} requested` : null,
    submitted ? `submitted ${submitted}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <OriginationItemCard
      yourTurn={yourTurn}
      reference={reference}
      badgeLabel={yourTurn ? "Your turn" : "With CashSouk"}
      badgeStatus={yourTurn ? "action" : "submitted"}
      detail={detail}
      action={
        action
          ? { href: action.href, label: action.label, buttonVariant: action.buttonVariant }
          : null
      }
      pipelineSteps={pipeline.steps}
      pipelineStates={states}
    />
  );
}

export function WhereThingsStandCard({
  applications,
  invoices,
}: {
  applications: readonly NormalizedApplication[];
  invoices: readonly IssuerDashboardInvoice[];
}) {
  const [visibleCount, setVisibleCount] = useState(DASHBOARD_LIST_PAGE_SIZE);
  const inFlight = applications.filter((app) =>
    shouldShowWhereThingsStandApplication(app.cardStatus.badgeKey)
  );
  const inFlightIds = new Set(inFlight.map((app) => app.id));
  const extraInvoices = invoices.filter(
    (invoice) => isIssuerInvoiceActionable(invoice) && !inFlightIds.has(invoice.applicationId)
  );
  const ordered = orderWhereThingsStandItems({
    yourTurnApps: inFlight.filter((app) => isIssuerApplicationActionable(app)),
    waitingApps: inFlight.filter((app) => !isIssuerApplicationActionable(app)),
    extraInvoices,
  });
  const { visible, hiddenCount } = takeDashboardPreview(ordered, visibleCount);
  const nextCount = Math.min(DASHBOARD_LIST_PAGE_SIZE, hiddenCount);

  return (
    <section>
      <DashboardSectionHeader
        title="Your applications"
        subtitle="Applications still in origination, and whose turn it is"
        action={
          <Link href="/applications" className="text-ui font-medium text-primary hover:text-accent">
            All applications →
          </Link>
        }
      />
      {visible.length === 0 ? (
        <Card className="rounded-2xl shadow-sm">
          <p className="p-6 text-ui text-muted-foreground">No applications in origination.</p>
        </Card>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visible.map((row) => (
              <li key={`${row.kind}-${row.item.id}`} className="min-w-0">
                {row.kind === "invoice" ? (
                  <InvoiceOriginationCard invoice={row.item} />
                ) : (
                  <ApplicationOriginationCard app={row.item} />
                )}
              </li>
            ))}
          </ul>
          {hiddenCount > 0 ? (
            <div className="mt-3">
              <button
                type="button"
                className="text-ui font-medium text-primary hover:text-accent"
                onClick={() =>
                  setVisibleCount((current) => nextDashboardVisibleCount(current, ordered.length))
                }
              >
                {nextCount === 1 ? "Load 1 more" : `Load ${nextCount} more`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
