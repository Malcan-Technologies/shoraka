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
import type {
  AdminInvestmentSettlementConfirmationItem,
  AdminInvestmentSettlementConfirmationsPayload,
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
  type WorkflowStatusTone,
} from "@/notes/utils/workflow-status-tokens";
import {
  useDownloadAdminInvestmentSettlementConfirmation,
  useGenerateAdminInvestmentSettlementConfirmation,
  useGenerateAllAdminInvestmentSettlementConfirmations,
  useOpenAdminInvestmentSettlementConfirmation,
  usePublishAdminInvestmentSettlementConfirmation,
  useReissueAdminInvestmentSettlementConfirmation,
  useRetryAdminInvestmentSettlementConfirmation,
} from "@/notes/hooks/use-investment-settlement-confirmation";
import { OfficialDocumentWorkflowPanel } from "@/notes/components/official-document-workflow-panel";

function overallModel(payload: AdminInvestmentSettlementConfirmationsPayload): {
  label: string;
  tone: WorkflowStatusTone;
  description: string;
} {
  const reviewStatuses = payload.confirmations.map((row) => row.reviewVersion?.status ?? null);
  if (payload.expectedCount === 0 && payload.confirmations.length === 0) {
    return {
      label: "Not generated",
      tone: "neutral",
      description: "Issued to each investor after settlement is posted and wallets are credited.",
    };
  }
  if (payload.failedCount > 0 || reviewStatuses.includes("FAILED")) {
    return {
      label: "Failed",
      tone: "danger",
      description:
        payload.failedCount > 0
          ? `${payload.failedCount} investor confirmation${payload.failedCount === 1 ? "" : "s"} failed. Settlement and wallet credits are unchanged. Retry uses the frozen snapshot.`
          : "A confirmation reissue failed. Settlement and wallet credits are unchanged. Retry uses the frozen snapshot.",
    };
  }
  if (payload.pendingCount > 0 || reviewStatuses.includes("PENDING")) {
    return {
      label: "Generating",
      tone: "active",
      description: "Investor confirmation PDFs are being generated. Settlement posting is unchanged.",
    };
  }
  if (reviewStatuses.includes("READY")) {
    return {
      label: "Awaiting publish",
      tone: "active",
      description:
        "A new confirmation version is generated. Investors continue to see the current published version until you publish.",
    };
  }
  if (payload.confirmations.some((row) => row.canGenerate || row.status === "NONE")) {
    return {
      label: "Not generated",
      tone: payload.canGenerateAll || payload.confirmations.some((row) => row.canGenerate)
        ? "active"
        : "neutral",
      description: "Generate a confirmation for each eligible investor after settlement is posted.",
    };
  }
  return {
    label: "Generated",
    tone: "success",
    description: `${payload.readyCount} investor confirmation${payload.readyCount === 1 ? "" : "s"} generated for this posted settlement.`,
  };
}

function rowStatusLabel(row: AdminInvestmentSettlementConfirmationItem): string {
  return officialDocumentWorkflowLabel({
    status: row.status,
    reviewStatus: row.isCurrent ? null : row.status === "READY" ? "READY" : null,
  });
}

type ConfirmAction =
  | { type: "generate-all" }
  | { type: "generate"; investorOrganizationId: string }
  | { type: "reissue"; investorOrganizationId: string }
  | { type: "publish"; investorOrganizationId: string };

type Props = {
  noteId: string;
  payload: AdminInvestmentSettlementConfirmationsPayload;
  canManage: boolean;
};

export function InvestmentSettlementConfirmationCard({ noteId, payload, canManage }: Props) {
  const model = overallModel(payload);
  const openPdf = useOpenAdminInvestmentSettlementConfirmation(noteId);
  const downloadPdf = useDownloadAdminInvestmentSettlementConfirmation(noteId);
  const generate = useGenerateAdminInvestmentSettlementConfirmation(noteId);
  const generateAll = useGenerateAllAdminInvestmentSettlementConfirmations(noteId);
  const retry = useRetryAdminInvestmentSettlementConfirmation(noteId);
  const reissue = useReissueAdminInvestmentSettlementConfirmation(noteId);
  const publish = usePublishAdminInvestmentSettlementConfirmation(noteId);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const pendingAny =
    generate.isPending ||
    generateAll.isPending ||
    retry.isPending ||
    reissue.isPending ||
    publish.isPending;
  const showFooter = payload.canGenerateAll && canManage;

  const confirmCopy =
    confirmAction?.type === "generate-all"
      ? {
          title: "Generate all confirmations?",
          description:
            "Create V01 for each investor that does not yet have a confirmation. Successful first versions become current for those investors.",
          confirmLabel: "Generate All",
        }
      : confirmAction?.type === "generate"
        ? {
            title: "Generate confirmation?",
            description:
              "Create version V01 for this investor. This becomes the current confirmation when generation succeeds.",
            confirmLabel: "Generate",
          }
        : confirmAction?.type === "reissue"
          ? {
              title: "Reissue confirmation?",
              description:
                "Create a new version from the frozen settlement facts. The investor continues to see the current version until you publish.",
              confirmLabel: "Reissue",
            }
          : {
              title: "Publish new version?",
              description:
                "Make the reissued version the current confirmation for this investor. The previous version is kept as history.",
              confirmLabel: "Publish New Version",
            };

  return (
    <>
      <OfficialDocumentWorkflowPanel
        data-investment-settlement-confirmation-card
        data-confirmation-ready={payload.readyCount}
        data-confirmation-failed={payload.failedCount}
        title="Investment Settlement Confirmations"
        completeLabel="Investment Settlement Confirmations generated"
        description={model.description}
        tone={model.tone}
        badgeLabel={model.label}
        actions={
          showFooter ? (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmAction({ type: "generate-all" })}
              disabled={pendingAny}
            >
              <DocumentTextIcon className="h-4 w-4" aria-hidden />
              Generate All
            </Button>
          ) : null
        }
      >
        {payload.confirmations.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {payload.confirmations.map((row) => {
              const rowTone = officialDocumentWorkflowTone({
                status: row.status,
                canGenerate: row.canGenerate,
                reviewStatus: row.reviewVersion?.status ?? null,
              });
              return (
                <li
                  key={row.investorOrganizationId}
                  className={cn(
                    "space-y-2 rounded-xl border px-3 py-2",
                    rowTone === "success" || rowTone === "neutral"
                      ? "border-border/60 bg-muted/30"
                      : workflowTaskSurfaceClass(rowTone)
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-ui font-medium text-foreground">{row.investorReference}</p>
                      <p className="text-meta text-muted-foreground">
                        {rowStatusLabel(row)}
                        {row.version && row.status !== "NONE" ? ` · Version ${row.version}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {row.status === "READY" && (row.viewUrl || row.downloadUrl) ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5"
                            onClick={() => {
                              void openPdf
                                .mutateAsync({
                                  investorOrganizationId: row.investorOrganizationId,
                                  target: "current",
                                })
                                .catch((err) => {
                                  toast.error(
                                    err instanceof Error ? err.message : "Confirmation is not available"
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
                              void downloadPdf
                                .mutateAsync({
                                  investorOrganizationId: row.investorOrganizationId,
                                  target: "current",
                                })
                                .catch((err) => {
                                  toast.error(
                                    err instanceof Error ? err.message : "Confirmation is not available"
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
                      {row.canGenerate && canManage ? (
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            setConfirmAction({
                              type: "generate",
                              investorOrganizationId: row.investorOrganizationId,
                            })
                          }
                          disabled={pendingAny}
                        >
                          <DocumentTextIcon className="h-4 w-4" aria-hidden />
                          Generate
                        </Button>
                      ) : null}
                      {row.canRetry && canManage ? (
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            void retry.mutateAsync(row.investorOrganizationId).catch((err) => {
                              toast.error(err instanceof Error ? err.message : "Retry failed");
                            });
                          }}
                          disabled={pendingAny}
                        >
                          <ArrowPathIcon className="h-4 w-4" aria-hidden />
                          Retry
                        </Button>
                      ) : null}
                      {row.canRegenerate && canManage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() =>
                            setConfirmAction({
                              type: "reissue",
                              investorOrganizationId: row.investorOrganizationId,
                            })
                          }
                          disabled={pendingAny}
                        >
                          <ArrowPathIcon className="h-4 w-4" aria-hidden />
                          Reissue
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {row.reviewVersion ? (
                    <div
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
                        workflowTaskSurfaceClass(
                          officialDocumentReviewTone(row.reviewVersion.status)
                        )
                      )}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="text-ui text-foreground">Version {row.reviewVersion.version}</p>
                        <StatusBadge
                          label={officialDocumentReviewLabel(row.reviewVersion.status)}
                          status={workflowToneToStatusToken(
                            officialDocumentReviewTone(row.reviewVersion.status)
                          )}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {row.reviewVersion.viewUrl || row.reviewVersion.downloadUrl ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              onClick={() => {
                                void openPdf
                                  .mutateAsync({
                                    investorOrganizationId: row.investorOrganizationId,
                                    target: "review",
                                  })
                                  .catch((err) => {
                                    toast.error(
                                      err instanceof Error
                                        ? err.message
                                        : "Confirmation is not available"
                                    );
                                  });
                              }}
                              disabled={openPdf.isPending || downloadPdf.isPending}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              onClick={() => {
                                void downloadPdf
                                  .mutateAsync({
                                    investorOrganizationId: row.investorOrganizationId,
                                    target: "review",
                                  })
                                  .catch((err) => {
                                    toast.error(
                                      err instanceof Error
                                        ? err.message
                                        : "Confirmation is not available"
                                    );
                                  });
                              }}
                              disabled={openPdf.isPending || downloadPdf.isPending}
                            >
                              Download
                            </Button>
                          </>
                        ) : null}
                        {row.reviewVersion.canRetry && canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              void retry.mutateAsync(row.investorOrganizationId).catch((err) => {
                                toast.error(err instanceof Error ? err.message : "Retry failed");
                              });
                            }}
                            disabled={pendingAny}
                          >
                            Retry
                          </Button>
                        ) : null}
                        {row.reviewVersion.canPublish && canManage ? (
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5"
                            onClick={() =>
                              setConfirmAction({
                                type: "publish",
                                investorOrganizationId: row.investorOrganizationId,
                              })
                            }
                            disabled={pendingAny}
                          >
                            <CheckCircleIcon className="h-4 w-4" aria-hidden />
                            Publish New Version
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
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
                if (action?.type === "generate-all") {
                  void generateAll.mutateAsync().catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Generate failed");
                  });
                } else if (action?.type === "generate") {
                  void generate.mutateAsync(action.investorOrganizationId).catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Generate failed");
                  });
                } else if (action?.type === "reissue") {
                  void reissue.mutateAsync(action.investorOrganizationId).catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Reissue failed");
                  });
                } else if (action?.type === "publish") {
                  void publish.mutateAsync(action.investorOrganizationId).catch((err) => {
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
