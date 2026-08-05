"use client";

import { OfferReviewPanel, type OfferReviewPanelProps } from "./OfferReviewPanel";

type ReviewOfferModalProps = Omit<OfferReviewPanelProps, "mode" | "className"> & {
  onClose: () => void;
};

export function ReviewOfferModal(props: ReviewOfferModalProps) {
  return <OfferReviewPanel {...props} mode="modal" />;
}
