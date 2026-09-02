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
import type { InvestmentNoteCertificatePdfPayload } from "@cashsouk/types";
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
  useDownloadAdminInvestmentNoteCertificate,
  useGenerateAdminInvestmentNoteCertificate,
  useOpenAdminInvestmentNoteCertificate,
  usePublishAdminInvestmentNoteCertificate,
  useReissueAdminInvestmentNoteCertificate,
  useRetryAdminInvestmentNoteCertificate,
} from "@/notes/hooks/use-investment-note-certificate";

function statusModel(payload: InvestmentNoteCertificatePdfPayload): {
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
        ? "Issued Islamic Investment Note Certificate for this disbursement."
        : "This version is ready. Users continue to see the current published version until you publish.",
    };
  }
  if (payload.status === "PENDING") {
    return {
      label: "Generating",
      tone: "warning",
      emphasize: false,
      description: "Certificate PDFs are being generated. This does not affect disbursement.",
    };
  }
  if (payload.status === "FAILED") {
    return {
      label: "Failed",
      tone: "active",
      emphasize: true,
      description:
        payload.generationError ??
        "Certificate generation failed. Disbursement is unchanged. Retry uses the frozen snapshot.",
    };
  }
  return {
    label: "Not generated",
    tone: "neutral",
    emphasize: false,
    description: payload.canGenerate
      ? "Eligible after issuer disbursement completed on a funded note. Generate V01 using the latest Document Authorisation settings."
      : "Available after issuer disbursement is completed on a successfully funded note.",
  };
}

type ConfirmAction = "generate" | "regenerate" | "publish";

type Props = {
  noteId: string;
  payload: InvestmentNoteCertificatePdfPayload;
};

export function InvestmentNoteCertificateCard({ noteId, payload }: Props) {
  const model = statusModel(payload);
  const openPdf = useOpenAdminInvestmentNoteCertificate(noteId);
  const downloadPdf = useDownloadAdminInvestmentNoteCertificate(noteId);
  const generate = useGenerateAdminInvestmentNoteCertificate(noteId);
  const retry = useRetryAdminInvestmentNoteCertificate(noteId);
  const reissue = useReissueAdminInvestmentNoteCertificate(noteId);
  const publish = usePublishAdminInvestmentNoteCertificate(noteId);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const review = payload.reviewVersion;
  const showPdfActions = Boolean(payload.viewUrl || payload.downloadUrl);
  const pendingAny =
    generate.isPending || retry.isPending || reissue.isPending || publish.isPending;

  const confirmCopy =
    confirmAction === "generate"
      ? {
          title: "Generate certificate?",
          description:
            "Create version V01 using the latest Document Authorisation settings. This becomes the current certificate for issuers and investors when generation succeeds.",
          confirmLabel: "Generate Certificate",
        }
      : confirmAction === "regenerate"
        ? {
            title: "Regenerate certificate?",
            description:
              "Create a new version using the latest Document Authorisation settings. Financial facts stay frozen from the current version. Users continue to see the current version until you publish.",
            confirmLabel: "Regenerate",
          }
        : {
            title: "Publish new version?",
            description:
              "Make the regenerated version the current certificate. Issuers and investors will receive the new version. The previous version is kept as history.",
            confirmLabel: "Publish New Version",
          };

  return (
    <Card
      data-investment-note-certificate-card
      data-certificate-status={payload.status}
      className={cn("rounded-2xl", model.emphasize && ADMIN_ACTION_SURFACE_CLASS)}
    >
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DocumentTextIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle>Islamic Investment Note Certificate</CardTitle>
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
                      toast.error(err instanceof Error ? err.message : "Certificate is not available");
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
                      toast.error(err instanceof Error ? err.message : "Certificate is not available");
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
                Generate Certificate
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
            data-certificate-review-version={review.version}
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
                          toast.error(
                            err instanceof Error ? err.message : "Certificate is not available"
                          );
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
                          toast.error(
                            err instanceof Error ? err.message : "Certificate is not available"
                          );
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
