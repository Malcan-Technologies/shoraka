"use client";

import type { OrganizationDetailResponse } from "@cashsouk/types";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { ProfileFinancialHistory } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Card, CardContent } from "@/components/ui/card";

export function OrganizationFinancialsPanel({
  org,
}: {
  org: OrganizationDetailResponse;
  organizationId: string;
}) {
  const years = org.issuerFinancials?.years ?? [];

  return (
    <Card id="profile-financials" className="rounded-2xl">
      <AdminDetailCardHeader
        icon={BanknotesIcon}
        title="Financial Statements"
        description="Read-only history from submitted financing applications."
      />
      <CardContent className="space-y-4">
        <ProfileFinancialHistory years={years} />
      </CardContent>
    </Card>
  );
}
