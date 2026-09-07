"use client";

import { IdentificationIcon } from "@heroicons/react/24/outline";
import { isPaymasterVerified, type PaymasterDetail } from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Card, CardContent } from "@/components/ui/card";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { PaymasterVerificationPanel } from "@/paymasters/components/paymaster-verification-panel";

export function PaymasterVerificationCard({
  paymaster,
  canManage,
}: {
  paymaster: PaymasterDetail;
  canManage: boolean;
}) {
  const verified = isPaymasterVerified(paymaster.verificationStatus);

  return (
    <Card className={cn("rounded-2xl", !verified && ADMIN_ACTION_SURFACE_CLASS)}>
      <AdminDetailCardHeader
        icon={IdentificationIcon}
        title="Identity verification"
        description="Internal Paymaster identity review. This is not an external SSM or CTOS check."
      />
      <CardContent>
        <PaymasterVerificationPanel
          paymaster={paymaster}
          paymasterId={paymaster.id}
          canManage={canManage}
          layout="detail"
        />
      </CardContent>
    </Card>
  );
}
