"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { unauditedYearEntries } from "@cashsouk/types";
import { ProfileFinancialHistory } from "@cashsouk/ui";
import { ProfileCard } from "./profile-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function IssuerFinancialsCard({ organizationId }: { organizationId: string }) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const query = useQuery({
    queryKey: ["issuer", "latest-financials", organizationId],
    queryFn: async () => {
      const res = await api.getIssuerLatestFinancialStatements(organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const years = unauditedYearEntries(query.data?.financial_statements);

  return (
    <ProfileCard
      id="profile-financials"
      title="Financial Statements"
      description="Financial history from submitted financing applications."
    >
      <ProfileFinancialHistory years={years} />
    </ProfileCard>
  );
}
