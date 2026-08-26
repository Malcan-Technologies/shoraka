"use client";

import * as React from "react";
import { toast } from "sonner";
import { PortalBadge, StatusBadge } from "@cashsouk/ui";
import { LEGAL_DOCUMENT_TYPE_LABELS } from "@cashsouk/types";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDownloadAcceptedVersion, useLegalDocumentAcceptanceDetail } from "@/hooks/use-legal-document-acceptances";
import { formatLegalFileSize } from "@/lib/legal-documents-admin";
import {
  formatLegalAcceptanceDate,
  legalAcceptanceEventLabel,
  legalAcceptanceStatusLabel,
  legalAcceptanceStatusToken,
} from "@/lib/legal-acceptance-display";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-meta font-medium text-muted-foreground">{label}</p>
      <div className="break-all text-ui">{value ?? "—"}</div>
    </div>
  );
}

export function LegalAcceptanceDetailSheet({
  acceptanceId,
  open,
  onOpenChange,
}: {
  acceptanceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const downloadAcceptedVersion = useDownloadAcceptedVersion();
  const { data: acceptance, isLoading, error } = useLegalDocumentAcceptanceDetail(
    open ? acceptanceId : null
  );
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (!acceptanceId) return;
    setDownloading(true);
    try {
      await downloadAcceptedVersion(acceptanceId);
    } catch (err) {
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : "Could not download PDF",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {acceptance?.status === "OPENED"
              ? "Opened details"
              : acceptance?.status === "ACCEPTED"
                ? "Accepted details"
                : "Acceptance details"}
          </SheetTitle>
          <SheetDescription>
            {acceptance?.status === "OPENED"
              ? "Read-only evidence that this legal document was opened."
              : acceptance?.status === "ACCEPTED"
                ? "Read-only evidence that this legal document was accepted."
                : "Read-only evidence record for this legal document acceptance."}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-6 text-ui text-destructive">
            {error instanceof Error ? error.message : "Failed to load details"}
          </p>
        ) : acceptance ? (
          <div className="mt-6 space-y-8">
            <div className="space-y-4">
              <h3 className="text-ui font-semibold">Overview</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField
                  label="Event"
                  value={legalAcceptanceEventLabel(acceptance.status)}
                />
                <DetailField label="Acceptance ID" value={acceptance.id} />
                <DetailField
                  label="Status"
                  value={
                    <StatusBadge
                      label={legalAcceptanceStatusLabel(acceptance.status)}
                      status={legalAcceptanceStatusToken(acceptance.status)}
                    />
                  }
                />
                <DetailField
                  label="Created at"
                  value={formatLegalAcceptanceDate(acceptance.createdAt)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-ui font-semibold">Open evidence</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField
                  label="Opened at"
                  value={formatLegalAcceptanceDate(acceptance.openedAt)}
                />
                <DetailField label="Open IP" value={acceptance.openedIpAddress} />
                <DetailField label="Open user agent" value={acceptance.openedUserAgent} />
                <DetailField label="Open device" value={acceptance.openedDeviceInfo} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-ui font-semibold">Acceptance evidence</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField
                  label="Accepted at"
                  value={formatLegalAcceptanceDate(acceptance.acceptedAt)}
                />
                <DetailField label="Accept IP" value={acceptance.acceptedIpAddress} />
                <DetailField label="Accept user agent" value={acceptance.acceptedUserAgent} />
                <DetailField label="Accept device" value={acceptance.acceptedDeviceInfo} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-ui font-semibold">Document evidence</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField
                  label="Document type"
                  value={
                    acceptance.documentType
                      ? LEGAL_DOCUMENT_TYPE_LABELS[acceptance.documentType]
                      : acceptance.documentTitle
                  }
                />
                <DetailField
                  label="Version"
                  value={acceptance.versionNumber != null ? `v${acceptance.versionNumber}` : "—"}
                />
                <DetailField label="Version ID" value={acceptance.legalDocumentVersionId} />
                <DetailField label="Document ID" value={acceptance.legalDocumentId} />
                <DetailField label="Hash" value={acceptance.documentHash} />
                <DetailField label="File name" value={acceptance.fileName} />
                <DetailField label="Version status" value={acceptance.versionStatus ?? "—"} />
                <DetailField label="Content type" value={acceptance.contentType} />
                <DetailField
                  label="File size"
                  value={
                    acceptance.fileSize != null ? formatLegalFileSize(acceptance.fileSize) : "—"
                  }
                />
              </div>
              <div className="space-y-1">
                <p className="text-meta font-medium text-muted-foreground">Acknowledgement wording</p>
                <p className="rounded-lg border bg-muted/30 p-3 text-ui">
                  {acceptance.acknowledgementText ?? "—"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-ui font-semibold">User / organization</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="User ID" value={acceptance.userId} />
                <DetailField label="User name snapshot" value={acceptance.userName} />
                <DetailField label="User email snapshot" value={acceptance.userEmail} />
                <DetailField label="Organization ID" value={acceptance.organizationId} />
                <DetailField
                  label="Organization name snapshot"
                  value={acceptance.organizationName}
                />
                <DetailField
                  label="Organization type snapshot"
                  value={acceptance.organizationAccountType}
                />
                <DetailField
                  label="Portal"
                  value={<PortalBadge portal={acceptance.portal} />}
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
              {downloading ? "Preparing download..." : "Download accepted version"}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
