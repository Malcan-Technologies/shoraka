"use client";

import { ArrowPathIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { SettlementHibahReceiptPdfPayload } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { workflowToneToStatusToken, type WorkflowStatusTone } from "@/notes/utils/workflow-status-tokens";
import {
  useOpenAdminSettlementHibahReceipt,
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
  const retry = useRetryAdminSettlementHibahReceipt(noteId);

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
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {payload.status === "READY" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void openPdf.mutateAsync().catch((err) => {
                    toast.error(err instanceof Error ? err.message : "Receipt is not available");
                  });
                }}
                disabled={openPdf.isPending}
              >
                View Receipt
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
                disabled={retry.isPending}
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden />
                Retry
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-meta text-muted-foreground">{model.description}</p>
      </CardHeader>
    </Card>
  );
}
