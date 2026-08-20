"use client";

import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import type { UserDetailResponse } from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Card, CardContent } from "@/components/ui/card";
import {
  CopyableField,
  ReadField,
} from "@/organizations/components/organization-profile-helpers";

export function UserAccountIdentityCard({ user }: { user: UserDetailResponse }) {
  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={ShieldCheckIcon}
        title="Identity"
        description="System identifiers and activity totals"
      />
      <CardContent className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
        <CopyableField label="User ID" value={user.user_id} />
        <CopyableField label="Email" value={user.email} />
        <CopyableField label="Cognito Username" value={user.cognito_username} />
        <CopyableField label="Cognito Sub" value={user.cognito_sub} />
        <ReadField label="Investments" value={user.stats.investments} />
        <ReadField label="Loans" value={user.stats.loans} />
        <ReadField label="Investor account flags" value={user.investor_account.length} />
        <ReadField label="Issuer account flags" value={user.issuer_account.length} />
      </CardContent>
    </Card>
  );
}
