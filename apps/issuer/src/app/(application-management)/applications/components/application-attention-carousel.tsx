"use client";

import * as React from "react";
import type { NormalizedApplication } from "../status";
import { AttentionSnapCarousel } from "@/components/attention-snap-carousel";
import { ApplicationAttentionCard } from "./application-attention-card";

export function ApplicationAttentionCarousel({
  applications,
  onViewSignedContractOffer,
  onCancelApplication,
  onDeleteDraft,
  isCancelApplicationPending,
}: {
  applications: NormalizedApplication[];
  onViewSignedContractOffer?: (signedOfferLetterS3Key: string) => Promise<void>;
  onCancelApplication?: (applicationId: string) => void;
  onDeleteDraft?: (applicationId: string) => void;
  isCancelApplicationPending?: boolean;
}) {
  return (
    <div data-testid="applications-attention-carousel">
      <AttentionSnapCarousel
        ariaLabel="Applications that need your attention"
        previousLabel="Previous application"
        nextLabel="Next application"
        items={applications.map((application) => ({
          key: application.id,
          node: (
            <ApplicationAttentionCard
              application={application}
              onViewSignedContractOffer={onViewSignedContractOffer}
              onCancelApplication={onCancelApplication}
              onDeleteDraft={onDeleteDraft}
              isCancelApplicationPending={isCancelApplicationPending}
            />
          ),
        }))}
      />
    </div>
  );
}
