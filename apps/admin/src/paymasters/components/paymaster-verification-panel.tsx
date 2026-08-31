"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { StatusBadge } from "@cashsouk/ui";
import { isPaymasterVerified } from "@cashsouk/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { paymasterHref } from "@/lib/admin-directory-hrefs";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import {
  reviewLabelClass,
  reviewRowGridClass,
  reviewValueClass,
} from "@/components/application-review/review-section-styles";
import { useVerifyPaymaster } from "@/paymasters/hooks/use-paymasters";

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
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const verifyPaymaster = useVerifyPaymaster();
  const cust = asRecord(customerDetails);
  const resolvedId = paymaster?.id || paymasterId || (typeof cust?.paymaster_id === "string" ? cust.paymaster_id : "");
  const legalName = text(paymaster?.legalName ?? paymaster?.legal_name ?? cust?.name);
  const registrationNumber = text(
    paymaster?.registrationNumber ?? paymaster?.registration_number ?? cust?.ssm_number
  );
  const country = text(
    paymaster?.registrationCountry ?? paymaster?.registration_country ?? cust?.country
  );
  const entityType = text(paymaster?.entityType ?? paymaster?.entity_type ?? cust?.entity_type);
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

  if (!resolvedId && !paymaster) {
    return layout === "detail" ? (
      <p className="text-ui text-muted-foreground">No Paymaster identity is linked yet.</p>
    ) : null;
  }

  const onConfirm = async () => {
    if (!resolvedId) return;
    try {
      await verifyPaymaster.mutateAsync({
        paymasterId: resolvedId,
        applicationId,
      });
      toast.success("Paymaster identity reviewed");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify Paymaster");
    }
  };

  return (
    <div className="space-y-4">
      <div className={layout === "review" ? reviewRowGridClass : "grid gap-4 sm:grid-cols-2"}>
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

      <p className="text-meta text-muted-foreground">
        Paymaster identity reviewed internally. This is not an external SSM or CTOS check, and it
        does not approve the application.
      </p>

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
            disabled={verifyPaymaster.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            Verify Paymaster
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Verify Paymaster identity?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-ui text-muted-foreground">
                <p>
                  Confirm these master identity details are correct. This verifies identity only and
                  does not approve the application, invoice, Notice, or MARC assessment.
                </p>
                <dl className="space-y-1">
                  <div>
                    <dt className="text-meta">Legal Name</dt>
                    <dd className="text-foreground">{legalName}</dd>
                  </div>
                  <div>
                    <dt className="text-meta">Registration Number</dt>
                    <dd className="font-mono text-foreground">{registrationNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-meta">Country</dt>
                    <dd className="text-foreground">{country}</dd>
                  </div>
                  <div>
                    <dt className="text-meta">Entity Type</dt>
                    <dd className="text-foreground">{entityType}</dd>
                  </div>
                </dl>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={verifyPaymaster.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={verifyPaymaster.isPending}
              onClick={(event) => {
                event.preventDefault();
                void onConfirm();
              }}
            >
              {verifyPaymaster.isPending ? "Verifying…" : "Verify Paymaster"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
