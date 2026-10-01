"use client";

/**
 * SECTION: Offer & acceptance tab — resubmit Before/After comparison
 * WHY: The comparison modal mirrors the live merged tab: same stage cards and order, data stages only.
 * INPUT: Merged tab descriptor, before/after review apps, document view/download handlers
 * OUTPUT: Read-only stage cards with Before/After rows (no actions, next-action banner, switcher, comments);
 *         new_contract invoices as the live non-embedded "Invoice" card after the rail
 * WHERE USED: SectionContent `offer_acceptance` case when sectionComparison is set (ResubmitComparisonModal)
 */

import * as React from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import {
  OFFER_ACCEPTANCE_COMPARISON_INVOICES_STAGE_ID,
  projectOfferAcceptanceComparison,
} from "@/lib/resubmit-comparison/offer-acceptance-projection";
import type { ComparisonStage } from "@/lib/resubmit-comparison/projection-types";
import { resubmitTabSections } from "@/lib/resubmit-comparison/modal-tabs";
import { ComparisonProjectedRow } from "../comparison-document-pair";
import { ReviewFieldBlock } from "../review-field-block";
import { ReviewSectionCard } from "../review-section-card";
import { comparisonRowListClass, reviewEmptyStateClass } from "../review-section-styles";
import type { ReviewTabDescriptor } from "../review-registry";
import type { ReviewApplicationView } from "../section-content";
import type { OfferAcceptanceStage, OfferAcceptanceStageId } from "./offer-acceptance-stages";
import { OfferAcceptanceStageCard } from "./stage-card";

type ComparedSection = "contract_details" | "invoice_details";

/** Facility stages always carry Evidence, so only Customer review and invoice stages can be empty. */
function emptyStageCopy(section: ComparedSection): string {
  return section === "invoice_details"
    ? "No invoices submitted."
    : "No customer details submitted.";
}

/** Rail card chrome for a data stage (the new_contract invoices stage renders as its own card). */
function toCardStage(stage: ComparisonStage, section: ComparedSection): OfferAcceptanceStage {
  return {
    id: stage.id as OfferAcceptanceStageId,
    section,
    title: stage.title,
    tag: "",
    tone: "wait",
    summary: "",
    kind: stage.id === "facility_reference" ? "reference" : "workflow",
  };
}

/** Projected blocks as live ReviewFieldBlocks; per-invoice blocks carry the invoice label badge. */
function ComparisonBlocks({
  blocks,
  blockAsides,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  blocks: ComparisonStage["blocks"];
  blockAsides: Record<string, string>;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  return (
    <>
      {blocks.map((block) => {
        const aside = blockAsides[block.id];
        return (
          <ReviewFieldBlock
            key={block.id}
            title={block.title}
            // Per-invoice blocks share a heading; name the region with the invoice label for assistive tech.
            ariaLabel={aside ? `${block.title} — ${aside}` : undefined}
            titleAside={
              aside ? (
                <StatusBadge label={aside} status="neutral" size="sm" showDot={false} />
              ) : undefined
            }
          >
            <div className={comparisonRowListClass}>
              {block.rows.map((row) => (
                <ComparisonProjectedRow
                  key={row.key}
                  row={row}
                  onViewDocument={onViewDocument}
                  onDownloadDocument={onDownloadDocument}
                  viewDocumentPending={viewDocumentPending}
                />
              ))}
            </div>
          </ReviewFieldBlock>
        );
      })}
    </>
  );
}

export function OfferAcceptanceComparison({
  descriptor,
  beforeApp,
  afterApp,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending,
}: {
  descriptor: ReviewTabDescriptor;
  beforeApp: ReviewApplicationView;
  afterApp: ReviewApplicationView;
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const projection = React.useMemo(
    () => projectOfferAcceptanceComparison(beforeApp, afterApp),
    [beforeApp, afterApp]
  );

  const cards = React.useMemo(() => {
    const merged = resubmitTabSections({
      reviewSection: descriptor.reviewSection,
      mergedSections: descriptor.mergedSections,
    });
    // Contract stages precede invoice stages for every structure (new_contract: Send offer, then the Invoice card).
    const sections: ComparedSection[] = (["contract_details", "invoice_details"] as const).filter(
      (section) => merged.includes(section)
    );
    return sections.flatMap((section) =>
      projection[section].map((stage) => ({ key: `${section}:${stage.id}`, stage, section }))
    );
  }, [descriptor.mergedSections, descriptor.reviewSection, projection]);

  // Live: new_contract invoices are a separate "Invoice" card after the rail, omitted when empty.
  // Only rail stages are valid OfferAcceptanceStageIds, so the invoices stage is split off before toCardStage.
  const railCards = cards
    .filter((card) => card.stage.id !== OFFER_ACCEPTANCE_COMPARISON_INVOICES_STAGE_ID)
    .map((card) => ({ ...card, cardStage: toCardStage(card.stage, card.section) }));
  const invoicesStage =
    cards.find((card) => card.stage.id === OFFER_ACCEPTANCE_COMPARISON_INVOICES_STAGE_ID)?.stage ??
    null;
  const showInvoicesCard = invoicesStage != null && invoicesStage.blocks.length > 0;

  const workflowKeys = railCards
    .filter((card) => card.cardStage.kind === "workflow")
    .map((card) => card.key);
  const lastWorkflowKey = workflowKeys[workflowKeys.length - 1] ?? null;

  const [collapsedKeys, setCollapsedKeys] = React.useState<Set<string>>(() => new Set());

  if (cards.length === 0) {
    // Acceptance-only merged tab: acceptance stages are workflow progress, not compared data.
    return (
      <p className={reviewEmptyStateClass}>
        Acceptance and signing are not part of the resubmission comparison.
      </p>
    );
  }

  if (railCards.length === 0 && !showInvoicesCard) {
    // Invoice-only tab on new_contract with no invoices either side: nothing else to show.
    return <p className={reviewEmptyStateClass}>{emptyStageCopy("invoice_details")}</p>;
  }

  return (
    <div className="space-y-4">
      {railCards.length > 0 ? (
        <div className="flex flex-col">
          {railCards.map(({ key, stage, cardStage, section }) => {
            const workflowNumber = workflowKeys.indexOf(key) + 1;
            return (
              <OfferAcceptanceStageCard
                key={key}
                stage={cardStage}
                workflowNumber={workflowNumber > 0 ? workflowNumber : null}
                isCurrent={false}
                isLastWorkflow={key === lastWorkflowKey}
                open={!collapsedKeys.has(key)}
                onOpenChange={(open) => {
                  setCollapsedKeys((prev) => {
                    const next = new Set(prev);
                    if (open) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }}
                readOnly
              >
                {stage.blocks.length === 0 ? (
                  <p className={reviewEmptyStateClass}>{emptyStageCopy(section)}</p>
                ) : (
                  <div className="space-y-8">
                    <ComparisonBlocks
                      blocks={stage.blocks}
                      blockAsides={projection.blockAsides}
                      onViewDocument={onViewDocument}
                      onDownloadDocument={onDownloadDocument}
                      viewDocumentPending={viewDocumentPending}
                    />
                  </div>
                )}
              </OfferAcceptanceStageCard>
            );
          })}
        </div>
      ) : null}

      {showInvoicesCard && invoicesStage ? (
        <ReviewSectionCard title={invoicesStage.title} icon={DocumentTextIcon} isReviewable={false}>
          <ComparisonBlocks
            blocks={invoicesStage.blocks}
            blockAsides={projection.blockAsides}
            onViewDocument={onViewDocument}
            onDownloadDocument={onDownloadDocument}
            viewDocumentPending={viewDocumentPending}
          />
        </ReviewSectionCard>
      ) : null}
    </div>
  );
}
