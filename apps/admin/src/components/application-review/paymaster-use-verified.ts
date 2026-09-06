export function paymasterUseVerifiedDisabled(params: {
  isReviewable: boolean;
  isActionLocked?: boolean;
  sectionStatus?: string;
}): boolean {
  if (!params.isReviewable || params.isActionLocked) return true;
  const status = (params.sectionStatus ?? "PENDING").toUpperCase();
  return status !== "PENDING" && status !== "AMENDMENT_REQUESTED";
}
