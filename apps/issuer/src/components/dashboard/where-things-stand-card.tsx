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
        title="Where things stand"
        subtitle="Applications still in origination, and whose turn it is"
        action={
          <Link href="/applications" className="text-ui font-medium text-primary hover:text-accent">
            All applications →
          </Link>
        }
      />
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        {visible.length === 0 ? (
          <p className="p-6 text-ui text-muted-foreground">No applications in origination.</p>
        ) : (
          <ul>
            {visible.map((row, index) => {
              const showDivider = index < visible.length - 1 || hiddenCount > 0;
              if (row.kind === "invoice") {
                const invoice = row.item;
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
                  <li
                    key={invoice.id}
                    className={cn("bg-status-action-bg/40 p-5 md:px-6", showDivider && "border-b border-border")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-ui font-semibold">{reference}</span>
                          <StatusBadge label="Your turn" status="action" size="sm" />
                        </div>
                        <p className="mt-1 text-ui text-muted-foreground">
                          {originationKindLabel(kind)} · {action.headline}
                        </p>
                      </div>
                      <Button asChild variant={action.buttonVariant} className="h-10 shrink-0 rounded-xl">
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      {pipeline.steps.map((label, stepIndex) => (
                        <DashboardPipelineStep
                          key={label}
                          label={label}
                          state={states[stepIndex] ?? "upcoming"}
                          yourTurn
                        />
                      ))}
                    </div>
                  </li>
                );
              }

              const app = row.item;
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
              return (
                <li
                  key={app.id}
                  className={cn(
                    "p-5 md:px-6",
                    showDivider && "border-b border-border",
                    yourTurn && "bg-status-action-bg/40"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-ui font-semibold">{reference}</span>
                        <StatusBadge
                          label={yourTurn ? "Your turn" : "With CashSouk"}
                          status={yourTurn ? "action" : "submitted"}
                          size="sm"
                        />
                      </div>
                      <p className="mt-1 text-ui text-muted-foreground">
                        {originationKindLabel(kind)}
                        {amount !== "—" ? ` · ${amount} requested` : ""}
                        {submitted ? ` · submitted ${submitted}` : ""}
                      </p>
                    </div>
                    {action ? (
                      <Button asChild variant={action.buttonVariant} className="h-10 shrink-0 rounded-xl">
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {pipeline.steps.map((label, stepIndex) => (
                      <DashboardPipelineStep
                        key={label}
                        label={label}
                        state={states[stepIndex] ?? "upcoming"}
                        yourTurn={yourTurn}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
            {hiddenCount > 0 ? (
              <li className="px-5 py-3.5 md:px-6">
                <button
                  type="button"
                  className="text-ui font-medium text-primary hover:text-accent"
                  onClick={() => setVisibleCount((current) => nextDashboardVisibleCount(current, ordered.length))}
                >
                  {nextCount === 1 ? "Load 1 more" : `Load ${nextCount} more`}
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </Card>
    </section>
  );
}
