/**
 * Visual horizontal stepper for the issuer Offer tab.
 * Domain cursor still comes from signing-offer-steps.ts; this only maps it to the mock pipeline.
 */

import type { SigningOfferStepId } from "@/lib/signing-offer-steps";

export type HorizontalOfferStepStatus = "completed" | "current" | "pending" | "blocked";

export type HorizontalOfferStep = {
  id: string;
  label: string;
  hint: string;
  status: HorizontalOfferStepStatus;
  clickable: boolean;
};

export type HorizontalOfferStepperKind = "direct_accept" | "signing";

export type BuildHorizontalOfferStepsInput = {
  kind: HorizontalOfferStepperKind;
  offerType: "contract" | "invoice";
  hasPostDocs: boolean;
  usesAcceptanceFlow: boolean;
  currentSigningStepId: SigningOfferStepId | null;
  isExpired: boolean;
  envelopeCompleted?: boolean;
  /** Domain step ids that the vertical stepper used to treat as completed|current. */
  clickableSigningStepIds?: readonly string[];
};

type PipelineStepDef = {
  id: string;
  label: string;
  hint: string;
  signingStepId?: SigningOfferStepId;
};

const REVIEW_TERMS: PipelineStepDef = {
  id: "review_terms",
  label: "Review terms",
  hint: "Figures & fees",
};

function directAcceptPipeline(): PipelineStepDef[] {
  return [
    REVIEW_TERMS,
    { id: "confirm_accept", label: "Confirm & accept", hint: "Consents + OTP" },
    { id: "listed", label: "Listed to investors", hint: "CashSouk lists the note" },
  ];
}

function signingPipeline(input: {
  offerType: "contract" | "invoice";
  hasPostDocs: boolean;
  usesAcceptanceFlow: boolean;
}): PipelineStepDef[] {
  const completeLabel = input.offerType === "contract" ? "Facility in force" : "Offer complete";
  const completeHint =
    input.offerType === "contract" ? "Ready to draw down" : "Acceptance complete";

  const steps: PipelineStepDef[] = [REVIEW_TERMS];

  if (input.usesAcceptanceFlow) {
    steps.push({
      id: "representatives",
      label: "Representatives",
      hint: "Who signs",
      signingStepId: "representatives",
    });
    if (input.hasPostDocs) {
      steps.push({
        id: "documents",
        label: "Documents",
        hint: "Board resolution",
        signingStepId: "documents",
      });
    }
    steps.push({
      id: "awaiting_review",
      label: "CashSouk review",
      hint: "1 business day",
      signingStepId: "awaiting_review",
    });
  }

  steps.push(
    {
      id: "signing",
      label: "Signing",
      hint: "Secure email links",
      signingStepId: "signing",
    },
    {
      id: "complete",
      label: completeLabel,
      hint: completeHint,
      signingStepId: "complete",
    }
  );

  return steps;
}

function resolveCurrentIndex(
  pipeline: PipelineStepDef[],
  input: Pick<
    BuildHorizontalOfferStepsInput,
    "kind" | "currentSigningStepId" | "envelopeCompleted" | "isExpired"
  >
): number {
  if (input.isExpired) return -1;

  if (input.kind === "direct_accept") {
    return pipeline.findIndex((step) => step.id === "confirm_accept");
  }

  const domainId = input.currentSigningStepId;
  if (domainId === "rejected" || domainId === "declined") {
    const actionIdx = pipeline.findIndex(
      (step) => step.id === "representatives" || step.id === "signing"
    );
    return actionIdx >= 0 ? actionIdx : 1;
  }
  if (domainId === "complete" || input.envelopeCompleted) {
    const completeIdx = pipeline.findIndex((step) => step.id === "complete");
    return completeIdx >= 0 ? completeIdx : pipeline.length - 1;
  }
  const idx = pipeline.findIndex((step) => step.signingStepId === domainId);
  if (idx >= 0) return idx;
  return Math.max(
    1,
    pipeline.findIndex((step) => step.id !== "review_terms")
  );
}

export function buildHorizontalOfferSteps(
  input: BuildHorizontalOfferStepsInput
): HorizontalOfferStep[] {
  const pipeline =
    input.kind === "direct_accept" ? directAcceptPipeline() : signingPipeline(input);
  const envelopeCompleted = input.envelopeCompleted === true;
  const currentIdx = resolveCurrentIndex(pipeline, {
    kind: input.kind,
    currentSigningStepId: input.currentSigningStepId,
    envelopeCompleted,
    isExpired: input.isExpired,
  });
  const clickableIds = new Set(input.clickableSigningStepIds ?? []);

  return pipeline.map((step, index) => {
    let status: HorizontalOfferStepStatus;
    if (input.isExpired && index === 1) {
      status = "blocked";
    } else if (input.isExpired) {
      status = "pending";
    } else if (step.id === "complete" && envelopeCompleted) {
      status = "completed";
    } else if (index < currentIdx) {
      status = "completed";
    } else if (index === currentIdx) {
      status = "current";
    } else {
      status = "pending";
    }

    const signingId = step.signingStepId;
    const clickable =
      input.kind === "signing" &&
      signingId != null &&
      clickableIds.has(signingId) &&
      (status === "completed" || status === "current");

    return {
      id: signingId ?? step.id,
      label: step.label,
      hint: step.hint,
      status,
      clickable,
    };
  });
}
