/**
 * Re-exports shared status presentation from @cashsouk/config.
 * Admin ApplicationStatusBadge, ReviewStepStatusBadge use getReviewStatusPresentation.
 */

export type { StatusPresentation } from "@cashsouk/config";
import { getStatusPresentation } from "@cashsouk/config";

export const getReviewStatusPresentation = getStatusPresentation;
