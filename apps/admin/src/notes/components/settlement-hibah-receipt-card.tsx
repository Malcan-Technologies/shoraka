"use client";

import { useState } from "react";
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { SettlementHibahReceiptPdfPayload } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { workflowToneToStatusToken, type WorkflowStatusTone } from "@/notes/utils/workflow-status-tokens";
import {
  useDownloadAdminSettlementHibahReceipt,
  useOpenAdminSettlementHibahReceipt,
  useReissueAdminSettlementHibahReceipt,
  useRetryAdminSettlementHibahReceipt,
} from "@/notes/hooks/use-settlement-hibah-receipt";

function statusModel(payload: SettlementHibahReceiptPdfPayload): {
  label: string;
  tone: WorkflowStatusTone;
  emphasize: boolean;
  description: string;
} {
  if (payload.status === "READY") {
    return {
      label: "Ready",
      tone: "success",
      emphasize: false,
      description: "Issuer-copy Settlement & Hibah Receipt for this posted settlement.",
    };
  }
  if (payload.status === "PENDING") {
    return {
      label: "Generating",
      tone: "warning",
      emphasize: false,
      description: "Receipt PDF is being generated. Settlement posting is unchanged.",
    };
  }
  if (payload.status === "FAILED") {
    return {
      label: "Failed",
      tone: "active",
      emphasize: true,
      description:
        payload.generationError ??
        "Receipt generation failed. Settlement remains posted. Retry uses the frozen snapshot.",
    };
  }
  return {
    label: "Not issued",
    tone: "neutral",
    emphasize: false,
    description: "Issued when the financing is fully settled (repaid and servicing settled).",
  };
}

type Props = {
  noteId: string;
  payload: SettlementHibahReceiptPdfPayload;
};

export function SettlementHibahReceiptCard({ noteId, payload }: Props) {
  const model = statusModel(payload);
  const openPdf = useOpenAdminSettlementHibahReceipt(noteId);
  const downloadPdf = useDownloadAdminSettlementHibahReceipt(noteId);
  const retry = useRetryAdminSettlementHibahReceipt(noteId);
  const reissue = useReissueAdminSettlementHibahReceipt(noteId);
  const [reissueOpen, setReissueOpen] = useState(false);
  const showPdfActions = Boolean(payload.viewUrl || payload.downloadUrl);

  return (
    <Card
      data-settlement-hibah-receipt-card
      data-receipt-status={payload.status}
      className={cn("rounded-2xl", model.emphasize && ADMIN_ACTION_SURFACE_CLASS)}
    >
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DocumentTextIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle>Settlement & Hibah Receipt</CardTitle>
              <StatusBadge
                label={model.label}
                status={workflowToneToStatusToken(model.tone)}
              />
              {payload.version && payload.status !== "NONE" ? (
                <span className="text-meta text-muted-foreground">Version {payload.version}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showPdfActions ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    void openPdf.mutateAsync().catch((err) => {
                      toast.error(err instanceof Error ? err.message : "Receipt is not available");
                    });
                  }}
                  disabled={openPdf.isPending || downloadPdf.isPending}
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
                  View
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    void downloadPdf.mutateAsync().catch((err) => {
                      toast.error(err instanceof Error ? err.message : "Receipt is not available");
                    });
                  }}
                  disabled={openPdf.isPending || downloadPdf.isPending}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
                  Download
                </Button>
              </>
            ) : null}
            {payload.canRetry ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  void retry.mutateAsync().catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Retry failed");
                  });
                }}
                disabled={retry.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden />
                Retry
              </Button>
            ) : null}
            {payload.canReissue ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setReissueOpen(true)}
                disabled={reissue.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden />
                Regenerate / Reissue
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-meta text-muted-foreground">{model.description}</p>
      </CardHeader>
      <AlertDialog open={reissueOpen} onOpenChange={setReissueOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate / Reissue receipt?</AlertDialogTitle>
            <AlertDialogDescription>
              Generate a new version using the latest Document Authorisation settings? The existing
              version will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => {
                void reissue.mutateAsync().catch((err) => {
                  toast.error(err instanceof Error ? err.message : "Regenerate / Reissue failed");
                });
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
