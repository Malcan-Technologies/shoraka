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
import {
  SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE,
  SHORAKA_SIGNING_PERSON_REQUIRED_MESSAGE,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
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
import {
  officialDocumentReviewLabel,
  officialDocumentReviewTone,
  officialDocumentWorkflowLabel,
  officialDocumentWorkflowTone,
  workflowTaskSurfaceClass,
  workflowToneToStatusToken,
} from "@/notes/utils/workflow-status-tokens";
import {
  useDownloadAdminInvestmentNoteCertificate,
  useGenerateAdminInvestmentNoteCertificate,
  useOpenAdminInvestmentNoteCertificate,
  usePublishAdminInvestmentNoteCertificate,
  useReissueAdminInvestmentNoteCertificate,
  useRetryAdminInvestmentNoteCertificate,
} from "@/notes/hooks/use-investment-note-certificate";
import {
  DocumentSigningPersonFields,
  useDocumentSigningPersonSelection,
} from "@/notes/components/document-signing-person-fields";
import { OfficialDocumentWorkflowPanel } from "@/notes/components/official-document-workflow-panel";

function statusModel(payload: InvestmentNoteCertificatePdfPayload) {
  const reviewStatus = payload.reviewVersion?.status ?? null;
  const tone = officialDocumentWorkflowTone({
    status: payload.status,
    canGenerate: payload.canGenerate,
    reviewStatus,
  });
  const label = officialDocumentWorkflowLabel({
    status: payload.status,
    reviewStatus,
  });
  if (payload.status === "READY" && !reviewStatus) {
    return {
      label,
      tone,
      description: payload.isCurrent
        ? "Issued Islamic Investment Note Certificate for this disbursement."
        : "This version is generated. Users continue to see the current published version until you publish.",
    };
  }
  if (payload.status === "PENDING" || reviewStatus === "PENDING") {
    return {
      label,
      tone,
      description: "Certificate PDFs are being generated. This does not affect disbursement.",
    };
  }
  if (payload.status === "FAILED" || reviewStatus === "FAILED") {
    return {
      label,
      tone,
      description:
        payload.generationError ??
        payload.reviewVersion?.generationError ??
        "Certificate generation failed. Disbursement is unchanged. Retry uses the frozen snapshot.",
    };
  }
  if (reviewStatus === "READY") {
    return {
      label,
      tone,
      description:
        "A new version is generated. Users continue to see the current published version until you publish.",
    };
  }
  return {
    label,
    tone,
    description: payload.canGenerate
      ? "Eligible after issuer disbursement completed on a funded note. Generate V01 using the selected Shoraka signing person and company stamp."
      : "Available after issuer disbursement is completed on a successfully funded note.",
  };
}

type ConfirmAction = "generate" | "reissue" | "publish";

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
  const signing = useDocumentSigningPersonSelection(payload.signingOptions);
  const review = payload.reviewVersion;
  const showPdfActions = Boolean(payload.viewUrl || payload.downloadUrl);
  const pendingAny =
    generate.isPending || retry.isPending || reissue.isPending || publish.isPending;
  const showFooter =
    showPdfActions || payload.canGenerate || payload.canRetry || payload.canRegenerate;

  const confirmCopy =
    confirmAction === "generate"
      ? {
          title: "Generate certificate?",
          description:
            "Create version V01 using the selected Shoraka signing person and company stamp. This becomes the current certificate for issuers and investors when generation succeeds.",
          confirmLabel: "Generate Certificate",
        }
      : confirmAction === "reissue"
        ? {
            title: "Reissue certificate?",
            description:
              "Create a new version using the selected Shoraka signing person and company stamp. Financial facts stay frozen from the current version. Users continue to see the current version until you publish.",
            confirmLabel: "Reissue",
          }
        : {
            title: "Publish new version?",
            description:
              "Make the reissued version the current certificate. Issuers and investors will receive the new version. The previous version is kept as history.",
            confirmLabel: "Publish New Version",
          };

  return (
    <>
      <OfficialDocumentWorkflowPanel
        data-investment-note-certificate-card
        data-certificate-status={payload.status}
        title="Islamic Investment Note Certificate"
        completeLabel="Islamic Investment Note Certificate generated"
        description={model.description}
        tone={model.tone}
        badgeLabel={model.label}
        version={payload.version && payload.status !== "NONE" ? payload.version : null}
        actions={
          showFooter ? (
            <>
              {showPdfActions ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      void openPdf.mutateAsync("current").catch((err) => {
                        toast.error(
                          err instanceof Error ? err.message : "Certificate is not available"
                        );
                      });
                    }}
                    disabled={openPdf.isPending || downloadPdf.isPending}
                  >
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
                    View
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      void downloadPdf.mutateAsync("current").catch((err) => {
                        toast.error(
                          err instanceof Error ? err.message : "Certificate is not available"
                        );
                      });
                    }}
                    disabled={openPdf.isPending || downloadPdf.isPending}
                  >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden />
                    Download
                  </Button>
                </>
              ) : null}
              {payload.canGenerate ? (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (!signing.selectedId) {
                      toast.error(SHORAKA_SIGNING_PERSON_REQUIRED_MESSAGE);
                      return;
                    }
                    if (!signing.canSubmit) {
                      toast.error(SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE);
                      return;
                    }
                    setConfirmAction("generate");
                  }}
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
                  className="h-8 gap-1.5"
                  onClick={() => {
                    if (!signing.selectedId) {
                      toast.error(SHORAKA_SIGNING_PERSON_REQUIRED_MESSAGE);
                      return;
                    }
                    if (!signing.canSubmit) {
                      toast.error(SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE);
                      return;
                    }
                    setConfirmAction("reissue");
                  }}
                  disabled={pendingAny}
                >
                  <ArrowPathIcon className="h-4 w-4" aria-hidden />
                  Reissue
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {payload.canGenerate || payload.canRegenerate ? (
          <DocumentSigningPersonFields
            options={payload.signingOptions}
            selectedId={signing.selectedId}
            onSelectedIdChange={signing.setSelectedId}
            disabled={pendingAny}
          />
        ) : null}
        {review ? (
          <div
            data-certificate-review-version={review.version}
            className={cn(
              "mt-2 rounded-xl border px-3 py-3",
              workflowTaskSurfaceClass(officialDocumentReviewTone(review.status))
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-ui font-medium text-foreground">Version {review.version}</p>
                <StatusBadge
                  label={officialDocumentReviewLabel(review.status)}
                  status={workflowToneToStatusToken(officialDocumentReviewTone(review.status))}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {review.viewUrl || review.downloadUrl ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => {
                        void openPdf.mutateAsync("review").catch((err) => {
                          toast.error(
                            err instanceof Error ? err.message : "Certificate is not available"
                          );
                        });
                      }}
                      disabled={openPdf.isPending || downloadPdf.isPending}
                    >
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden />
                      View
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => {
                        void downloadPdf.mutateAsync("review").catch((err) => {
                          toast.error(
                            err instanceof Error ? err.message : "Certificate is not available"
                          );
                        });
                      }}
                      disabled={openPdf.isPending || downloadPdf.isPending}
                    >
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden />
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
      </OfficialDocumentWorkflowPanel>
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
                  void generate
                    .mutateAsync({ signingPersonId: signing.selectedId })
                    .catch((err) => {
                      toast.error(err instanceof Error ? err.message : "Generate failed");
                    });
                } else if (action === "reissue") {
                  void reissue
                    .mutateAsync({ signingPersonId: signing.selectedId })
                    .catch((err) => {
                      toast.error(err instanceof Error ? err.message : "Reissue failed");
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
    </>
  );
}
