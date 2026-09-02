"use client";

import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { InvestmentNoteCertificatePdfPayload } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";

function statusModel(payload: InvestmentNoteCertificatePdfPayload): {
  label: string;
  status: "success" | "submitted" | "rejected" | "neutral";
  description: string;
} {
  if (payload.status === "READY") {
    return {
      label: "Ready",
      status: "success",
      description: "Issued after successful funding and disbursement.",
    };
  }
  if (payload.status === "PENDING") {
    return {
      label: "Pending",
      status: "submitted",
      description: "Your certificate is being prepared. Refresh this page shortly to download it.",
    };
  }
  if (payload.status === "FAILED") {
    return {
      label: "Failed",
      status: "rejected",
      description: "Certificate generation failed. Disbursement is unchanged. Contact CashSouk if this persists.",
    };
  }
  return {
    label: "Not issued",
    status: "neutral",
    description: "Available after issuer disbursement is completed on a successfully funded note.",
  };
}

type Props = {
  payload: InvestmentNoteCertificatePdfPayload;
  viewPending?: boolean;
  downloadPending?: boolean;
  onView: () => void;
  onDownload: () => void;
};

export function IssuerInvestmentNoteCertificateCard({
  payload,
  viewPending = false,
  downloadPending = false,
  onView,
  onDownload,
}: Props) {
  if (payload.status === "NONE") return null;
  const model = statusModel(payload);
  const busy = viewPending || downloadPending;

  return (
    <div
      data-issuer-investment-note-certificate-card
      data-certificate-status={payload.status}
      className="rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-medium">Investment Note Certificate</div>
        <StatusBadge label={model.label} status={model.status} />
        {payload.version ? (
          <span className="text-xs text-muted-foreground">Version {payload.version}</span>
        ) : null}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{model.description}</div>
      {payload.status === "READY" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onView}
            disabled={busy}
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
            View
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onDownload}
            disabled={busy}
          >
            <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
            Download
          </Button>
        </div>
      ) : null}
    </div>
  );
}
