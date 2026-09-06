"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@cashsouk/ui";
import { isPaymasterVerified } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { paymasterHref } from "@/lib/admin-directory-hrefs";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import {
  reviewLabelClass,
  reviewRowGridClass,
  reviewValueClass,
} from "@/components/application-review/review-section-styles";
import { PaymasterOfficialIdentityDialog } from "@/paymasters/components/paymaster-official-identity-dialog";

export type ApplicationReviewPaymaster = {
  id?: string | null;
  legal_name?: string | null;
  legalName?: string | null;
  registration_number?: string | null;
  registrationNumber?: string | null;
  registration_country?: string | null;
  registrationCountry?: string | null;
  entity_type?: string | null;
  entityType?: string | null;
  verification_status?: string | null;
  verificationStatus?: string | null;
  verified_at?: string | Date | null;
  verifiedAt?: string | null;
  verified_by_user_id?: string | null;
  verifiedByUserId?: string | null;
  verifiedByName?: string | null;
};

function text(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function PaymasterVerificationPanel({
  paymaster,
  paymasterId,
  customerDetails,
  applicationId,
  canManage,
  layout = "review",
}: {
  paymaster?: ApplicationReviewPaymaster | null;
  paymasterId?: string | null;
  customerDetails?: unknown;
  applicationId?: string;
  canManage: boolean;
  layout?: "review" | "detail";
}) {
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const cust = asRecord(customerDetails);
  const resolvedId =
    paymaster?.id || paymasterId || (typeof cust?.paymaster_id === "string" ? cust.paymaster_id : "");
  const verificationStatus = String(
    paymaster?.verificationStatus ?? paymaster?.verification_status ?? "UNVERIFIED"
  ).toUpperCase();
  const verified = isPaymasterVerified(verificationStatus);
  const verifiedAtRaw = paymaster?.verifiedAt ?? paymaster?.verified_at ?? null;
  const verifiedAt =
    verifiedAtRaw instanceof Date
      ? format(verifiedAtRaw, "dd MMM yyyy, h:mm a")
      : typeof verifiedAtRaw === "string" && verifiedAtRaw
        ? format(new Date(verifiedAtRaw), "dd MMM yyyy, h:mm a")
        : "—";
  const verifiedBy = text(paymaster?.verifiedByName, "—");
  const dialogPaymaster = {
    ...paymaster,
    id: resolvedId || paymaster?.id,
  };

  if (!resolvedId && !paymaster) {
    return layout === "detail" ? (
      <p className="text-ui text-muted-foreground">No Paymaster identity is linked yet.</p>
    ) : null;
  }

  return (
    <div className="space-y-4">
      <div className={layout === "review" ? reviewRowGridClass : "grid gap-4"}>
        {layout === "review" ? (
          <>
            <Label className={reviewLabelClass}>Status</Label>
            <div className={reviewValueClass}>
              <StatusBadge
                label={verified ? "Verified" : "Unverified"}
                status={getAdminStatusToken(verificationStatus)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <div className="text-meta text-muted-foreground">Status</div>
              <StatusBadge
                label={verified ? "Verified" : "Unverified"}
                status={getAdminStatusToken(verificationStatus)}
              />
            </div>
            <div className="space-y-1">
              <div className="text-meta text-muted-foreground">Verified by</div>
              <div className="text-ui font-medium">{verified ? verifiedBy : "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-meta text-muted-foreground">Verified at</div>
              <div className="text-ui font-medium">{verified ? verifiedAt : "—"}</div>
            </div>
          </>
        )}
      </div>

      {layout === "review" ? (
        <p className="text-meta text-muted-foreground">
          Official Paymaster identity is confirmed on the Paymaster master. This is not an external
          SSM or CTOS check, and it does not approve the application.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {resolvedId && layout !== "detail" ? (
          <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-ui">
            <Link href={paymasterHref(resolvedId)}>View Paymaster</Link>
          </Button>
        ) : null}
        {!verified && canManage && resolvedId ? (
          <Button
            size="sm"
            className="h-8 rounded-lg text-ui"
            onClick={() => setVerifyOpen(true)}
          >
            Verify Paymaster
          </Button>
        ) : null}
      </div>

      <PaymasterOfficialIdentityDialog
        mode="verify"
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        paymaster={dialogPaymaster}
        applicationId={applicationId}
      />
    </div>
  );
}
