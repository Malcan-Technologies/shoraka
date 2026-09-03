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
  useDownloadAdminInvestmentSettlementConfirmation,
  useGenerateAdminInvestmentSettlementConfirmation,
  useGenerateAllAdminInvestmentSettlementConfirmations,
  useOpenAdminInvestmentSettlementConfirmation,
  usePublishAdminInvestmentSettlementConfirmation,
  useReissueAdminInvestmentSettlementConfirmation,
  useRetryAdminInvestmentSettlementConfirmation,
} from "@/notes/hooks/use-investment-settlement-confirmation";

function overallModel(payload: AdminInvestmentSettlementConfirmationsPayload): {
  label: string;
  tone: WorkflowStatusTone;
  emphasize: boolean;
  description: string;
} {
  if (payload.expectedCount === 0 && payload.confirmations.length === 0) {
    return {
      label: "Not generated",
      tone: "neutral",
      emphasize: false,
      description: "Issued to each investor after settlement is posted and wallets are credited.",
    };
  }
  if (payload.failedCount > 0) {
    return {
      label: "Failed",
      tone: "active",
      emphasize: true,
      description: `${payload.failedCount} investor confirmation${payload.failedCount === 1 ? "" : "s"} failed. Settlement and wallet credits are unchanged. Retry uses the frozen snapshot.`,
    };
  }
  if (payload.pendingCount > 0) {
    return {
      label: "Generating",
      tone: "warning",
      emphasize: false,
      description: "Investor confirmation PDFs are being generated. Settlement posting is unchanged.",
    };
  }
  if (payload.confirmations.some((row) => row.canGenerate || row.status === "NONE")) {
    return {
      label: "Not generated",
      tone: "neutral",
      emphasize: false,
      description: "Generate a confirmation for each eligible investor after settlement is posted.",
    };
  }
  return {
    label: "Ready",
    tone: "success",
    emphasize: false,
    description: `${payload.readyCount} investor confirmation${payload.readyCount === 1 ? "" : "s"} ready for this posted settlement.`,
  };
}

function rowStatusLabel(row: AdminInvestmentSettlementConfirmationItem): string {
  if (row.status === "NONE") return "Not generated";
  if (row.status === "PENDING") return "Generating";
  if (row.status === "FAILED") return "Failed";
  return row.isCurrent ? "Ready" : "Ready for review";
}

type ConfirmAction =
  | { type: "generate-all" }
  | { type: "generate"; investorOrganizationId: string }
  | { type: "regenerate"; investorOrganizationId: string }
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
        : confirmAction?.type === "regenerate"
          ? {
              title: "Regenerate confirmation?",
              description:
                "Create a new version from the frozen settlement facts. The investor continues to see the current version until you publish.",
              confirmLabel: "Regenerate",
            }
          : {
              title: "Publish new version?",
              description:
                "Make the regenerated version the current confirmation for this investor. The previous version is kept as history.",
              confirmLabel: "Publish New Version",
            };

  return (
    <Card
      data-investment-settlement-confirmation-card
      data-confirmation-ready={payload.readyCount}
      data-confirmation-failed={payload.failedCount}
      className={cn("rounded-2xl", model.emphasize && ADMIN_ACTION_SURFACE_CLASS)}
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DocumentTextIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle>Investment Settlement Confirmations</CardTitle>
              <StatusBadge label={model.label} status={workflowToneToStatusToken(model.tone)} />
            </div>
          </div>
          {payload.canGenerateAll && canManage ? (
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
          ) : null}
        </div>
        <p className="text-meta text-muted-foreground">{model.description}</p>
        {payload.confirmations.length > 0 ? (
          <ul className="space-y-2">
            {payload.confirmations.map((row) => (
              <li
                key={row.investorOrganizationId}
                className="space-y-2 rounded-xl border border-border px-3 py-2"
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
                          className="gap-1.5"
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
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
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
                          <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
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
                        className="gap-1.5"
                        onClick={() =>
                          setConfirmAction({
                            type: "regenerate",
                            investorOrganizationId: row.investorOrganizationId,
                          })
                        }
                        disabled={pendingAny}
                      >
                        <ArrowPathIcon className="h-4 w-4" aria-hidden />
                        Regenerate
                      </Button>
                    ) : null}
                  </div>
                </div>
                {row.reviewVersion ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="text-ui text-foreground">Version {row.reviewVersion.version}</p>
                      <StatusBadge
                        label={
                          row.reviewVersion.status === "READY"
                            ? "Ready for review"
                            : row.reviewVersion.status === "FAILED"
                              ? "Failed"
                              : "Generating"
                        }
                        status={workflowToneToStatusToken(
                          row.reviewVersion.status === "READY"
                            ? "success"
                            : row.reviewVersion.status === "FAILED"
                              ? "active"
                              : "warning"
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
                            className="gap-1.5"
                            onClick={() => {
                              void openPdf
                                .mutateAsync({
                                  investorOrganizationId: row.investorOrganizationId,
                                  target: "review",
                                })
                                .catch((err) => {
                                  toast.error(
                                    err instanceof Error ? err.message : "Confirmation is not available"
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
                            className="gap-1.5"
                            onClick={() => {
                              void downloadPdf
                                .mutateAsync({
                                  investorOrganizationId: row.investorOrganizationId,
                                  target: "review",
                                })
                                .catch((err) => {
                                  toast.error(
                                    err instanceof Error ? err.message : "Confirmation is not available"
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
            ))}
          </ul>
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
                if (action?.type === "generate-all") {
                  void generateAll.mutateAsync().catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Generate failed");
                  });
                } else if (action?.type === "generate") {
                  void generate.mutateAsync(action.investorOrganizationId).catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Generate failed");
                  });
                } else if (action?.type === "regenerate") {
                  void reissue.mutateAsync(action.investorOrganizationId).catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Regenerate failed");
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
    </Card>
  );
}
