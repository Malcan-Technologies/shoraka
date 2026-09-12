"use client";

import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import { cn } from "@/lib/utils";
import { ADMIN_WAITING_SURFACE_CLASS } from "@/lib/admin-status-token";
import type { FacilityFeeUpfrontRail } from "./facility-fee-upfront-rail";

export function StageFacilityFee({
  rail,
  contractHref,
}: {
  rail: FacilityFeeUpfrontRail;
  contractHref?: string | null;
}) {
  return (
    <div className="space-y-4">
      {rail.outstanding > 0 ? (
        <div className={cn("rounded-xl border px-4 py-3.5", ADMIN_WAITING_SURFACE_CLASS)}>
          <p className="text-ui font-semibold text-status-submitted-text">
            Waiting on the issuer to pay the upfront facility fee
          </p>
          <p className="mt-1 text-ui text-status-submitted-text">
            {formatCurrency(rail.outstanding)} is due via the payment gateway. Drawdowns stay
            locked until this is paid.
          </p>
        </div>
      ) : rail.waived ? (
        <p className="text-ui text-muted-foreground">
          The remaining facility fee was waived. Drawdowns are unlocked.
        </p>
      ) : (
        <p className="text-ui text-muted-foreground">
          Upfront facility fee received. Drawdowns are unlocked.
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-meta text-muted-foreground">Requested</dt>
          <dd className="text-ui text-foreground">{formatCurrency(rail.requested)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">Paid</dt>
          <dd className="text-ui text-foreground">{formatCurrency(rail.paidTowardUpfront)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">Outstanding</dt>
          <dd className="text-ui text-foreground">{formatCurrency(rail.outstanding)}</dd>
        </div>
      </dl>

      {contractHref ? (
        <p className="text-ui text-muted-foreground">
          Payment history and waiver live on the{" "}
          <Link href={contractHref} className="font-semibold text-primary underline-offset-4 hover:underline">
            facility record
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
