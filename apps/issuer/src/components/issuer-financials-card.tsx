"use client";

import * as React from "react";
import { issuerFinancialProfileEntries } from "@cashsouk/types";
import { ProfileFinancialHistory } from "@cashsouk/ui";
import { useIssuerOrganizationLatestFinancialStatements } from "@/hooks/use-applications";
import { ProfileCard } from "./profile-card";

export function IssuerFinancialsCard({ organizationId }: { organizationId: string }) {
  const query = useIssuerOrganizationLatestFinancialStatements(organizationId);

  const years = issuerFinancialProfileEntries(query.data?.submitted_financial_years);

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
