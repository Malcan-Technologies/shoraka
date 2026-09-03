"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  latestUnauditedYearKey,
  type ComrepProfileCompleteness,
} from "@cashsouk/types";
import { KeyValueGrid, StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
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
  const completenessQuery = useQuery({
    queryKey: ["issuer", "profile-completeness", organizationId],
    queryFn: async () => {
      const res = await api.getProfileCompleteness("issuer", organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const year = latestUnauditedYearKey(query.data?.financial_statements) ?? String(new Date().getFullYear() - 1);
  const completeness: ComrepProfileCompleteness | undefined = completenessQuery.data;
  const financialStep = completeness?.steps.find((step) => step.id === "financials");
  const complete = financialStep?.complete ?? false;
  const missingCount = financialStep?.missing.length ?? 0;

  return (
    <ProfileCard
      id="profile-financials"
      title="Financials"
      description="Latest issuer financial statements"
      action={
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <a href={complete ? "/profile/complete?step=review" : "/profile/complete?step=financials"}>
            {complete ? "View" : "Complete"}
          </a>
        </Button>
      }
    >
      <KeyValueGrid
        items={[
          { label: "Latest financial year", value: year ? `FY${year}` : "—" },
          {
            label: "Status",
            value: complete ? (
              <StatusBadge status="success" label="Complete" />
            ) : (
              <StatusBadge
                status="action"
                label={missingCount ? `${missingCount} missing fields` : "Missing fields"}
              />
            ),
          },
        ]}
      />
    </ProfileCard>
  );
}
