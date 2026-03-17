export interface ReviewRefreshPolicy {
  refetchOnWindowFocus: true;
  refetchInterval: number;
  refetchIntervalInBackground: false;
  staleTime: number;
}

export const reviewRefreshPolicy: ReviewRefreshPolicy = {
  refetchOnWindowFocus: true,
  refetchInterval: 15_000,
  refetchIntervalInBackground: false,
  staleTime: 5_000,
};

export function getReviewRefreshPolicy(): ReviewRefreshPolicy {
  return reviewRefreshPolicy;
}
