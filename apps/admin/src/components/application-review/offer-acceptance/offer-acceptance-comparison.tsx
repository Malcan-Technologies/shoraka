"use client";

/**
 * SECTION: Offer & acceptance tab — resubmit Before/After comparison
 * WHY: The comparison modal mirrors the live merged tab: same stage cards and order, data stages only.
 * INPUT: Merged tab descriptor, before/after review apps, document view/download handlers
 * OUTPUT: Read-only stage cards with Before/After rows (no actions, next-action banner, switcher, comments)
 * WHERE USED: SectionContent `offer_acceptance` case when sectionComparison is set (ResubmitComparisonModal)
 */

import * as React from "react";
import {
  OFFER_ACCEPTANCE_COMPARISON_INVOICES_STAGE_ID,
  projectOfferAcceptanceComparison,
} from "@/lib/resubmit-comparison/offer-acceptance-projection";
import type { ComparisonStage } from "@/lib/resubmit-comparison/projection-types";
import { resubmitTabSections } from "@/lib/resubmit-comparison/modal-tabs";
import { ComparisonProjectedRow } from "../comparison-document-pair";
import { ReviewFieldBlock } from "../review-field-block";
import { reviewEmptyStateClass } from "../review-section-styles";
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

/** Card chrome only: the new_contract invoice block is invoice review content shown off-rail. */
function toCardStage(stage: ComparisonStage, section: ComparedSection): OfferAcceptanceStage {
  const isInvoicesBlock = stage.id === OFFER_ACCEPTANCE_COMPARISON_INVOICES_STAGE_ID;
  const isReference = isInvoicesBlock || stage.id === "facility_reference";
  return {
    id: (isInvoicesBlock ? "invoice_review" : stage.id) as OfferAcceptanceStageId,
    section,
    title: stage.title,
    tag: "",
    tone: "wait",
    summary: "",
    kind: isReference ? "reference" : "workflow",
  };
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
    // Contract stages precede invoice stages for every structure (new_contract: Send offer before Invoices).
    const sections: ComparedSection[] = (["contract_details", "invoice_details"] as const).filter(
      (section) => merged.includes(section)
    );
    return sections.flatMap((section) =>
      projection[section].map((stage) => ({
        key: `${section}:${stage.id}`,
        stage,
        cardStage: toCardStage(stage, section),
        section,
      }))
    );
  }, [descriptor.mergedSections, descriptor.reviewSection, projection]);

  const workflowKeys = cards
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

  return (
    <div className="flex flex-col">
      {cards.map(({ key, stage, cardStage, section }) => {
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
              <div className="space-y-6">
                {stage.blocks.map((block) => (
                  <ReviewFieldBlock key={block.id} title={block.title}>
                    <div className="space-y-2">
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
                ))}
              </div>
            )}
          </OfferAcceptanceStageCard>
        );
      })}
    </div>
  );
}
