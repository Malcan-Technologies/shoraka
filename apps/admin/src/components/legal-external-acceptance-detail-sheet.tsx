"use client";

import * as React from "react";
import { StatusBadge } from "@cashsouk/ui";
import { LEGAL_DOCUMENT_TYPE_LABELS } from "@cashsouk/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useLegalExternalAcceptanceDetail } from "@/hooks/use-legal-external-acceptances";
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

export function LegalExternalAcceptanceDetailSheet({
  acceptanceId,
  open,
  onOpenChange,
}: {
  acceptanceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: acceptance, isLoading, error } = useLegalExternalAcceptanceDetail(
    open ? acceptanceId : null
  );

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
              ? "Read-only evidence that this legal document was opened by an external party."
              : acceptance?.status === "ACCEPTED"
                ? "Read-only evidence that this legal document was accepted by an external party."
                : "Read-only evidence record for this external legal document acceptance."}
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
              <h3 className="text-ui font-semibold">Party</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Party name" value={acceptance.partyName} />
                <DetailField label="Party email" value={acceptance.partyEmail} />
                <DetailField label="Party role" value={acceptance.partyRole} />
                <DetailField label="IC number" value={acceptance.partyIcMasked} />
                <DetailField label="Source type" value={acceptance.sourceType} />
                <DetailField label="Source ID" value={acceptance.sourceId} />
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
              <h3 className="text-ui font-semibold">Linkage</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Organisation" value={acceptance.organizationName} />
                <DetailField label="Organisation ID" value={acceptance.organizationId} />
                <DetailField label="Application" value={acceptance.applicationId} />
                <DetailField label="Envelope" value={acceptance.envelopeId} />
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
