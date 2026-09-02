"use client";

import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { NextActionBanner } from "./dashboard/next-action-banner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function IssuerProfileCompletenessBanner({
  organizationId,
  onboarded,
}: {
  organizationId: string | undefined;
  onboarded: boolean;
}) {
  const { getAccessToken } = useAuthToken();
  const api = createApiClient(API_URL, getAccessToken);
  const query = useQuery({
    queryKey: ["issuer", "profile-completeness", organizationId],
    enabled: Boolean(organizationId) && onboarded,
    queryFn: async () => {
      const res = await api.getProfileCompleteness("issuer", organizationId!);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  if (!onboarded || !query.data || query.data.complete) return null;

  return (
    <NextActionBanner
      title="Complete your company profile"
      description="You can create a financing application now, but you cannot submit it until these ComRep fields are complete."
      href="/profile/complete"
      ctaLabel="Complete profile"
    />
  );
}
