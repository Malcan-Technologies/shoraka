"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { StatusBadge } from "@cashsouk/ui";
import {
  isPaymasterVerified,
  PAYMASTER_SUBMITTED_IDENTITIES_CONFLICT_MESSAGE,
  type PaymasterSubmittedApplicationIdentity,
} from "@cashsouk/types";
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
import {
  paymasterDetailVerificationBlocked,
  paymasterIdentityToVerify,
} from "@/paymasters/utils/paymaster-verify-identity";

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
  submittedApplicationIdentities,
  canManage,
  layout = "review",
}: {
  paymaster?: ApplicationReviewPaymaster | null;
  paymasterId?: string | null;
  customerDetails?: unknown;
  applicationId?: string;
  submittedApplicationIdentities?: PaymasterSubmittedApplicationIdentity[];
  canManage: boolean;
  layout?: "review" | "detail";
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const verifyPaymaster = useVerifyPaymaster();
  const cust = asRecord(customerDetails);
  const resolvedId = paymaster?.id || paymasterId || (typeof cust?.paymaster_id === "string" ? cust.paymaster_id : "");
  const identityToVerify = paymasterIdentityToVerify({
    applicationId,
    customerDetails,
    paymaster,
  });
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
  const fromApplicationReview = Boolean(applicationId);
  const detailBlocked =
    layout === "detail" && paymasterDetailVerificationBlocked(submittedApplicationIdentities);

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
          Paymaster identity reviewed internally. This is not an external SSM or CTOS check, and it
          does not approve the application.
        </p>
      ) : null}

      {detailBlocked ? (
        <p className="text-ui text-muted-foreground">{PAYMASTER_SUBMITTED_IDENTITIES_CONFLICT_MESSAGE}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {resolvedId && layout !== "detail" ? (
          <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-ui">
            <Link href={paymasterHref(resolvedId)}>View Paymaster</Link>
          </Button>
        ) : null}
        {!verified && canManage && resolvedId && !detailBlocked ? (
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
                  {fromApplicationReview
                    ? "This verifies the identity submitted on this application. It becomes the official Paymaster identity for this SSM. This does not approve the application, invoice, Notice, or MARC assessment."
                    : "Confirm these master identity details are correct. This verifies identity only and does not approve the application, invoice, Notice, or MARC assessment."}
                </p>
                <p className="text-ui font-medium text-foreground">Paymaster Identity to Verify</p>
                <dl className="space-y-1">
                  <div>
                    <dt className="text-meta">Name</dt>
                    <dd className="text-foreground">{text(identityToVerify.name)}</dd>
                  </div>
                  <div>
                    <dt className="text-meta">Entity Type</dt>
                    <dd className="text-foreground">{text(identityToVerify.entity_type)}</dd>
                  </div>
                  <div>
                    <dt className="text-meta">SSM</dt>
                    <dd className="font-mono text-foreground">{text(identityToVerify.ssm_number)}</dd>
                  </div>
                  <div>
                    <dt className="text-meta">Country</dt>
                    <dd className="text-foreground">{text(identityToVerify.country)}</dd>
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
