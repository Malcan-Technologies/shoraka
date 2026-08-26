"use client";

import Link from "next/link";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { FACILITY_FEE_DRAWDOWN_BLOCKED_MESSAGE } from "@/lib/facility-fee-payment-ui";

export function FacilityFeeDrawdownBlockedNotice({
  href,
  id,
}: {
  href: string;
  id?: string;
}) {
  return (
    <aside
      id={id}
      role="status"
      className="rounded-md border border-status-action-text/30 bg-status-action-bg px-4 py-3"
    >
      <div className="flex items-start gap-2">
        <InformationCircleIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-status-action-text"
          aria-hidden
        />
        <p className="text-ui leading-6 text-status-action-text">
          {FACILITY_FEE_DRAWDOWN_BLOCKED_MESSAGE}.{" "}
          <Link href={href} className="font-medium underline underline-offset-4">
            Pay the fee
          </Link>
        </p>
      </div>
    </aside>
  );
}
