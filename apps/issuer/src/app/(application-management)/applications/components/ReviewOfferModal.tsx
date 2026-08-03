"use client";

/**
 * Modal wrapper around OfferReviewPanel for financing pages (Stage D will navigate instead).
 * eKYC / SigningCloud behaviour lives in OfferReviewPanel unchanged.
 */

import {
  OfferReviewPanel,
  type OfferReviewPanelProps,
} from "./OfferReviewPanel";

type ReviewOfferModalProps = Omit<OfferReviewPanelProps, "mode" | "className"> & {
  onClose: () => void;
};

export function ReviewOfferModal(props: ReviewOfferModalProps) {
  return <OfferReviewPanel {...props} mode="modal" />;
}
