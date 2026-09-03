"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { userFacingCompleteness } from "@cashsouk/types";
import { Button } from "./ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function InvestorProfileCompletenessBanner({
  organizationId,
  onboarded,
}: {
  organizationId: string | undefined;
  onboarded: boolean;
}) {
  const { getAccessToken } = useAuthToken();
  const api = createApiClient(API_URL, getAccessToken);
  const query = useQuery({
    queryKey: ["investor", "profile-completeness", organizationId],
    enabled: Boolean(organizationId) && onboarded,
    queryFn: async () => {
      const res = await api.getProfileCompleteness("investor", organizationId!);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  if (!onboarded || !query.data) return null;
  const user = userFacingCompleteness(query.data);
  if (user.complete) return null;

  const remaining = user.missing.length;
  const percent = user.percent;

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-status-action-text/15 bg-[hsl(var(--status-action-bg)/0.45)] px-5 py-5 text-foreground sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-ui font-semibold leading-7">Complete your profile</p>
        <p className="text-ui leading-6 text-muted-foreground">
          {percent}% complete. {remaining} {remaining === 1 ? "item remaining" : "items remaining"}. This does not
          block investing or deposits.
        </p>
      </div>
      <Button asChild className="h-11 shrink-0 gap-2 rounded-xl font-semibold">
        <Link href="/profile/complete">
          Complete profile
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
