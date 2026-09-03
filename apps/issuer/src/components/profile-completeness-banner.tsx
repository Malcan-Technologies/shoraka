"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { groupIssuerMissingByProfileSection } from "@cashsouk/types";
import { ProfileCompletenessSummary } from "@cashsouk/ui";
import { NextActionBanner } from "./dashboard/next-action-banner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function scrollToProfileSection(href: string) {
  const id = href.startsWith("#") ? href.slice(1) : href;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function IssuerProfileCompletenessBanner({
  organizationId,
  onboarded,
  expandOnPage = false,
  initialExpanded = false,
}: {
  organizationId: string | undefined;
  onboarded: boolean;
  expandOnPage?: boolean;
  initialExpanded?: boolean;
}) {
  const { getAccessToken } = useAuthToken();
  const api = createApiClient(API_URL, getAccessToken);
  const [expanded, setExpanded] = React.useState(initialExpanded);
  const query = useQuery({
    queryKey: ["issuer", "profile-completeness", organizationId],
    enabled: Boolean(organizationId) && onboarded,
    queryFn: async () => {
      const res = await api.getProfileCompleteness("issuer", organizationId!);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  React.useEffect(() => {
    if (initialExpanded) setExpanded(true);
  }, [initialExpanded]);

  if (!onboarded || !query.data || query.data.complete) return null;

  const remaining = query.data.missing.length;
  const percent = query.data.percent;
  const sections = groupIssuerMissingByProfileSection(query.data.missing);

  return (
    <div id="profile-completeness" className="scroll-mt-24 space-y-3">
      <NextActionBanner
        title="Complete your profile"
        description={`${percent}% complete. ${remaining} ${remaining === 1 ? "item remaining" : "items remaining"}. You can create a financing application now, but you cannot submit it until these fields are complete.`}
        href={expandOnPage ? undefined : "/profile?focus=completeness"}
        onClick={expandOnPage ? () => setExpanded((open) => !open) : undefined}
        ctaLabel="Complete profile"
      />
      {expandOnPage && expanded ? (
        <div className="rounded-xl border bg-card p-5">
          <ProfileCompletenessSummary
            percent={percent}
            remaining={remaining}
            sections={sections}
            onSectionClick={(section) => {
              if (section.href) scrollToProfileSection(section.href);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
