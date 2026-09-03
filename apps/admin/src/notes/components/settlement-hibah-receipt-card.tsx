"use client";

import { useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
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
  useGenerateAdminSettlementHibahReceipt,
  useOpenAdminSettlementHibahReceipt,
  usePublishAdminSettlementHibahReceipt,
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
      label: payload.isCurrent ? "Ready" : "Ready for review",
      tone: "success",
      emphasize: false,
      description: payload.isCurrent
        ? "Issuer-copy Settlement & Hibah Receipt for this posted settlement."
        : "This version is ready. The issuer continues to see the current published version until you publish.",
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
    label: "Not generated",
    tone: "neutral",
    emphasize: false,
    description: payload.canGenerate
      ? "Eligible after the financing is fully settled. Generate V01 using the latest Document Authorisation settings."
      : "Issued when the financing is fully settled (repaid and servicing settled).",
  };
}

type ConfirmAction = "generate" | "regenerate" | "publish";

type Props = {
  noteId: string;
  payload: SettlementHibahReceiptPdfPayload;
};

export function SettlementHibahReceiptCard({ noteId, payload }: Props) {
  const model = statusModel(payload);
  const openPdf = useOpenAdminSettlementHibahReceipt(noteId);
  const downloadPdf = useDownloadAdminSettlementHibahReceipt(noteId);
  const generate = useGenerateAdminSettlementHibahReceipt(noteId);
  const retry = useRetryAdminSettlementHibahReceipt(noteId);
  const reissue = useReissueAdminSettlementHibahReceipt(noteId);
  const publish = usePublishAdminSettlementHibahReceipt(noteId);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const review = payload.reviewVersion;
  const showPdfActions = Boolean(payload.viewUrl || payload.downloadUrl);
  const pendingAny =
    generate.isPending || retry.isPending || reissue.isPending || publish.isPending;

  const confirmCopy =
    confirmAction === "generate"
      ? {
          title: "Generate receipt?",
          description:
            "Create version V01 using the latest Document Authorisation settings. This becomes the current issuer receipt when generation succeeds.",
          confirmLabel: "Generate Receipt",
        }
      : confirmAction === "regenerate"
        ? {
            title: "Regenerate receipt?",
            description:
              "Create a new version using the latest Document Authorisation settings. Financial facts stay frozen from the current version. The issuer continues to see the current version until you publish.",
            confirmLabel: "Regenerate",
          }
        : {
            title: "Publish new version?",
            description:
              "Make the regenerated version the current Settlement & Hibah Receipt. The previous version is kept as history.",
            confirmLabel: "Publish New Version",
          };

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
                    void openPdf.mutateAsync("current").catch((err) => {
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
                    void downloadPdf.mutateAsync("current").catch((err) => {
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
            {payload.canGenerate ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setConfirmAction("generate")}
                disabled={pendingAny}
              >
                <DocumentTextIcon className="h-4 w-4" aria-hidden />
                Generate Receipt
              </Button>
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
                disabled={pendingAny}
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden />
                Retry
              </Button>
            ) : null}
            {payload.canRegenerate ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setConfirmAction("regenerate")}
                disabled={pendingAny}
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden />
                Regenerate
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-meta text-muted-foreground">{model.description}</p>
        {review ? (
          <div
            data-receipt-review-version={review.version}
            className="mt-2 rounded-xl border border-border px-3 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-ui font-medium text-foreground">Version {review.version}</p>
                <StatusBadge
                  label={
                    review.status === "READY"
                      ? "Ready for review"
                      : review.status === "FAILED"
                        ? "Failed"
                        : "Generating"
                  }
                  status={workflowToneToStatusToken(
                    review.status === "READY"
                      ? "success"
                      : review.status === "FAILED"
                        ? "active"
                        : "warning"
                  )}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {review.viewUrl || review.downloadUrl ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        void openPdf.mutateAsync("review").catch((err) => {
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
                        void downloadPdf.mutateAsync("review").catch((err) => {
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
                {review.canRetry ? (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      void retry.mutateAsync().catch((err) => {
                        toast.error(err instanceof Error ? err.message : "Retry failed");
                      });
                    }}
                    disabled={pendingAny}
                  >
                    <ArrowPathIcon className="h-4 w-4" aria-hidden />
                    Retry
                  </Button>
                ) : null}
                {review.canPublish ? (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setConfirmAction("publish")}
                    disabled={pendingAny}
                  >
                    <CheckCircleIcon className="h-4 w-4" aria-hidden />
                    Publish New Version
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </CardHeader>
      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => {
                const action = confirmAction;
                setConfirmAction(null);
                if (action === "generate") {
                  void generate.mutateAsync().catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Generate failed");
                  });
                } else if (action === "regenerate") {
                  void reissue.mutateAsync().catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Regenerate failed");
                  });
                } else if (action === "publish") {
                  void publish.mutateAsync().catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Publish failed");
                  });
                }
              }}
            >
              {confirmCopy.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
