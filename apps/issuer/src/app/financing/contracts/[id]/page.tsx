"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, MoreVertical } from "lucide-react";
import { useParams } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import { useHeader } from "@cashsouk/ui";
import { useIssuerDashboardContract } from "@/hooks/use-issuer-dashboard";
import { FilterButton, DashboardInvoiceCard } from "@/components/dashboard/financing-section";
import { ReviewOfferModal } from "@/components/review-offer-modal";
import { getOfferStatus } from "@/lib/offer-utils";
import { formatStatus } from "@/lib/issuer-dashboard-labels";
import { asInvoiceForModal } from "@/types/issuer-dashboard";
import type { Invoice } from "@cashsouk/types";

export default function ContractDetailsPage() {
  const params = useParams();
  const contractId = params.id as string;
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const { setTitle } = useHeader();
  const [offerModalContext, setOfferModalContext] = useState<Parameters<typeof ReviewOfferModal>[0]["context"]>(null);

  useEffect(() => {
    setTitle("Contract");
  }, [setTitle]);

  const { data, isLoading, isError, error } = useIssuerDashboardContract(orgId, contractId);

  const row = data?.contract ?? null;
  const invoices = data?.invoices ?? [];

  const approved = row?.approvedFacilityAmount != null ? Number(row.approvedFacilityAmount) : 0;
  const utilised = row?.utilizedFacilityAmount != null ? Number(row.utilizedFacilityAmount) : 0;
  const utilisationPct = approved > 0 ? Math.round((utilised / approved) * 100) : 0;

  if (!orgId) {
    return (
      <div className="flex-1 px-8 pt-6 pb-12">
        <p className="text-muted-foreground">Select an organization to view this contract.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 px-8 pt-6 pb-12 flex items-center justify-center min-h-[240px] text-muted-foreground">
        Loading contract…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 px-8 pt-6 pb-12">
        <p className="text-destructive font-medium">Could not load contract</p>
        <p className="text-sm text-muted-foreground mt-2">{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="flex-1 px-8 pt-6 pb-12">
        <p className="text-muted-foreground">Contract not found or you do not have access.</p>
      </div>
    );
  }

  const stats = row.invoiceStats;

  return (
    <div className="flex-1 px-8 pt-6 pb-12 space-y-8">
      <ReviewOfferModal
        open={offerModalContext !== null}
        onOpenChange={(open) => !open && setOfferModalContext(null)}
        context={offerModalContext}
      />
      <Card className="rounded-xl border border-gray-200 shadow-sm">
        <div className="px-8 py-7 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <p className="text-[15px] font-medium">
                Contract : <span className="font-semibold">{row.title}</span>
              </p>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                {formatStatus(row.contractStatus)}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Product : <span className="text-foreground font-medium">Contract Financing</span>
              </p>
              <p>
                Customer : <span className="text-foreground font-medium">{row.customerName ?? "-"}</span>
              </p>
              <p>
                Contract period :{" "}
                <span className="text-foreground font-medium">
                  {row.contractStartDate && row.contractEndDate
                    ? `${row.contractStartDate} to ${row.contractEndDate}`
                    : "-"}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-right text-muted-foreground">
                Available facility :{" "}
                {row.availableFacilityAmount != null ? `RM ${row.availableFacilityAmount}` : "-"}
              </p>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-2 bg-foreground rounded-full" style={{ width: `${utilisationPct}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">{utilised}</p>
                  <p className="text-xs text-muted-foreground">(Utilized facility)</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{approved}</p>
                  <p className="text-xs text-muted-foreground">(Approved facility)</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Total no. of invoices : {stats.total}</p>
              <div className="grid grid-cols-3 gap-4">
                <MetricBox label="Approved" value={`${stats.approved}`} />
                <MetricBox label="Rejected" value={`${stats.rejected}`} />
                <MetricBox label="Unfinanced" value={`${stats.unfinanced}`} />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Breakdown of approved invoices</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs text-muted-foreground">
                <BreakdownItem label="Funding in progress" value={`${stats.fundingInProgress}`} />
                <BreakdownItem label="Active notes" value={`${stats.activeNotes}`} />
                <BreakdownItem label="Completed notes" value={`${stats.completedNotes}`} />
                <BreakdownItem label="Unsuccessful raise" value={`${stats.unsuccessfulRaise}`} />
                <BreakdownItem
                  label="Disputed notes"
                  value={stats.disputedNotes == null ? "Not available" : `${stats.disputedNotes}`}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">Invoices</h3>
          <div className="flex items-center gap-3">
            <FilterButton label="Status" />
            <FilterButton label="Submission date" />
          </div>
        </div>

        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices for this contract.</p>
        ) : (
          invoices.map((inv) => {
            const modalInvoice = asInvoiceForModal(inv.invoiceForModal) as Invoice;
            return (
              <DashboardInvoiceCard
                key={inv.id}
                row={inv}
                offerStatus={getOfferStatus(modalInvoice)}
                onReviewOffer={() =>
                  setOfferModalContext({
                    type: "invoice",
                    applicationId: inv.applicationId,
                    invoiceId: inv.id,
                    invoice: modalInvoice,
                  })
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-foreground shrink-0">{value}</span>
    </div>
  );
}
