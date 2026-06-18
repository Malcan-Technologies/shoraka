"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { OfferSigningAdminView, OfferSigningSummary } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";

function formatSigningTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "dd MMM yyyy, HH:mm");
}

function SigningRow({
  label,
  entry,
  onView,
  viewPending,
}: {
  label: string;
  entry: OfferSigningSummary;
  onView: (s3Key: string) => void;
  viewPending: boolean;
}) {
  const s3Key = entry.signedOfferLetterS3Key;
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant={entry.status === "archived" ? "secondary" : "default"}>
            {entry.status === "archived" ? "Archived" : "Active"}
          </Badge>
          {entry.offerVersion != null ? (
            <span className="text-xs text-muted-foreground">v{entry.offerVersion}</span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Signer: {entry.signerEmail ?? "—"} · Signed {formatSigningTimestamp(entry.completedAt)}
          {entry.archivedAt ? ` · Archived ${formatSigningTimestamp(entry.archivedAt)}` : null}
        </p>
      </div>
      {s3Key ? (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() => onView(s3Key)}
          disabled={viewPending}
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          View PDF
        </Button>
      ) : null}
    </div>
  );
}

export function OfferSigningPanel({
  title,
  description,
  signing,
  onResign,
  resignPending,
  canManage = true,
}: {
  title: string;
  description: string;
  signing: OfferSigningAdminView | null | undefined;
  onResign?: () => Promise<void>;
  resignPending?: boolean;
  canManage?: boolean;
}) {
  const { handleViewDocument, viewDocumentPending } = useAdminS3DocumentViewDownload();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const onView = React.useCallback(
    async (s3Key: string) => {
      if (!s3Key) {
        toast.error("Signed document is unavailable");
        return;
      }
      await handleViewDocument(s3Key);
    },
    [handleViewDocument]
  );

  const runResign = async () => {
    if (!onResign) return;
    try {
      await onResign();
      toast.success("Replacement signing requested. The issuer must sign the new offer letter.");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-sign request failed");
    }
  };

  if (!signing?.activeSignedOffer && (signing?.archivedSignedOffers.length ?? 0) === 0) {
    return null;
  }

  return (
    <>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DocumentCheckIcon className="h-4 w-4" />
                {title}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            {signing?.canResign && onResign ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setConfirmOpen(true)}
                disabled={resignPending || !canManage}
                title={!canManage ? "You do not have permission to perform this action." : undefined}
              >
                {resignPending ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowPathIcon className="h-4 w-4" />
                )}
                Request re-sign
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {signing?.activeSignedOffer ? (
            <SigningRow
              label="Current signed offer"
              entry={signing.activeSignedOffer}
              onView={onView}
              viewPending={viewDocumentPending}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No active signed offer yet. The issuer must complete the replacement signing flow.
            </p>
          )}
          {(signing?.archivedSignedOffers.length ?? 0) > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Archived signed versions
              </p>
              {signing!.archivedSignedOffers.map((entry, index) => (
                <SigningRow
                  key={`${entry.signedOfferLetterS3Key ?? "archived"}-${entry.archivedAt ?? index}`}
                  label={`Archived copy ${signing!.archivedSignedOffers.length - index}`}
                  entry={entry}
                  onView={onView}
                  viewPending={viewDocumentPending}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request replacement signing?</AlertDialogTitle>
            <AlertDialogDescription>
              This archives the current signed offer letter and sends the issuer a fresh document to sign with
              the same commercial terms. The previous signed PDF remains available in the archive list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resignPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void runResign();
              }}
              disabled={resignPending}
              className="gap-2"
            >
              {resignPending ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
              Request re-sign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
