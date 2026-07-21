export interface ReviewRefreshPolicy {
  refetchOnWindowFocus: true;
  refetchInterval: number | false;
  refetchIntervalInBackground: false;
  staleTime: number;
}

/** Detail views / open offer modal — keep relatively fresh. */
export const reviewDetailRefreshPolicy: ReviewRefreshPolicy = {
  refetchOnWindowFocus: true,
  refetchInterval: 15_000,
  refetchIntervalInBackground: false,
  staleTime: 5_000,
};

/** Application lists — focus refresh + slow interval to avoid list thrash. */
export const reviewListRefreshPolicy: ReviewRefreshPolicy = {
  refetchOnWindowFocus: true,
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  staleTime: 30_000,
};

export function getReviewDetailRefreshPolicy(): ReviewRefreshPolicy {
  return reviewDetailRefreshPolicy;
}

export function getReviewListRefreshPolicy(): ReviewRefreshPolicy {
  return reviewListRefreshPolicy;
}

/** @deprecated Prefer getReviewDetailRefreshPolicy — kept for existing call sites. */
export function getReviewRefreshPolicy(): ReviewRefreshPolicy {
  return reviewDetailRefreshPolicy;
}

/** Poll while any envelope is live; otherwise stop interval polling. */
export function getLiveSigningEnvelopeRefetchInterval(
  envelopes: ReadonlyArray<{ status?: string | null }> | undefined
): number | false {
  if (!envelopes?.length) return false;
  const live = envelopes.some((envelope) => {
    const status = String(envelope.status ?? "").toUpperCase();
    return status === "SENT" || status === "IN_PROGRESS";
  });
  return live ? 15_000 : false;
}
