"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useOrganization, createApiClient, useAuthToken, formatCurrency } from "@cashsouk/config";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailHeader,
  EmptyState,
  KeyValueGrid,
  LoadingState,
  ProductCatalogName,
  StatusBadge,
} from "@cashsouk/ui";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { useInvoice } from "@/hooks/use-invoices";
import { useIssuerProduct } from "@/hooks/use-products";
import { resolveProductImageS3KeyFromWorkflow } from "@cashsouk/types";
import {
  issuerContentMaxWidthClassName,
  issuerMainContentClassName,
  issuerPageGutterClassName,
} from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import { financingOfferHref } from "@/lib/financing-offer-href";
import {
  getIssuerOfferActionCtaFromOfferDetails,
  getOfferStatus,
  shouldShowIssuerReviewOfferCta,
} from "@/lib/offer-utils";
import {
  resolveFundingProgressPercent,
  resolveFundingStatusText,
  resolveIssuerInvoiceDashboardBadge,
} from "@/lib/issuer-dashboard-labels";
import { asInvoiceForModal } from "@/types/issuer-dashboard";
import {
  EM_DASH,
  FundingStatusLine,
  IssuerFinancingStatusBadge,
  displayCell,
  formatDate,
  formatMoney,
} from "@/components/financing/utils";
import { MarketplaceCampaignFacts } from "@/components/financing/marketplace-campaign-facts";
import {
  buildIssuerMarketplaceCampaign,
  issuerCampaignCloseLabel,
  issuerCampaignDaysLeftLabel,
} from "@/components/financing/marketplace-campaign";
import { buildInvoiceFeeDisplay, money } from "@/lib/facility-fee-display";
import { formatInvoiceReference, formatNoteInvestorCount } from "@cashsouk/types";
import { FacilityTiedAnchor } from "@/components/financing/facility-tied-link";
import { resolveIssuerFacilityLink } from "@/components/financing/facility-tied";
import { FacilityImpactSection } from "@/components/financing/facility-impact";

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = typeof params.id === "string" ? params.id : "";
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(
    () => createApiClient(undefined, getAccessToken),
    [getAccessToken]
  );

  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError: dashboardError,
    error: dashboardErr,
  } = useIssuerDashboard(orgId);
  const {
    data: invoiceRecord,
    isLoading: invoiceLoading,
    isError: invoiceError,
    error: invoiceErr,
  } = useInvoice(invoiceId || undefined);

  const row = React.useMemo(
    () => dashboard?.invoices.find((i) => i.id === invoiceId) ?? null,
    [dashboard, invoiceId]
  );

  const modalInvoice = React.useMemo(() => {
    if (row?.invoiceForModal) return asInvoiceForModal(row.invoiceForModal);
    return invoiceRecord ?? null;
  }, [row, invoiceRecord]);

  const offerStatus = modalInvoice ? getOfferStatus(modalInvoice) : null;
  const showReviewOffer = modalInvoice ? shouldShowIssuerReviewOfferCta(modalInvoice) : false;
  const offerActionCta = modalInvoice
    ? getIssuerOfferActionCtaFromOfferDetails(modalInvoice.offer_details, { scope: "invoice" })
    : null;
  const applicationId = row?.applicationId ?? modalInvoice?.application_id ?? "";
  const contractId = row?.contractId ?? modalInvoice?.contract_id ?? null;

  const badgeKind = resolveIssuerInvoiceDashboardBadge(
    row?.note ?? null,
    row?.invoiceStatus ?? modalInvoice?.status ?? ""
  );
  const progress = resolveFundingProgressPercent(row?.note ?? null);
  const fundingLabel = resolveFundingStatusText(row?.note ?? null);

  const invDetails = modalInvoice?.details;
  const offerDetails = (modalInvoice?.offer_details ?? null) as Record<string, unknown> | null;
  const maturityRaw = invDetails?.maturity_date ?? row?.note?.maturityDate ?? null;
  const document = invDetails?.document;

  const relatedContract = React.useMemo(() => {
    if (!contractId || !dashboard) return null;
    return dashboard.contracts.find((c) => c.id === contractId) ?? null;
  }, [contractId, dashboard]);
  const productId = row?.productId ?? relatedContract?.productId ?? "";
  const { data: productRecord } = useIssuerProduct(productId);
  const productImageS3Key = resolveProductImageS3KeyFromWorkflow(productRecord?.workflow);

  const feeDisplay = buildInvoiceFeeDisplay({
    status: row?.note?.noteStatus ?? row?.invoiceStatus ?? modalInvoice?.status,
    offerDetails,
    financingAmount: row?.financingAmount ?? offerDetails?.offered_amount,
    isContractFinancing: Boolean(contractId),
    contractFacilityFeeRatePercent: (
      relatedContract?.contractForModal as {
        contract_details?: { facility_fee_rate_percent?: unknown };
      } | null
    )?.contract_details?.facility_fee_rate_percent,
    contractFacilityFeeCapAmount: relatedContract?.facilityFeeCapAmount,
    contractFacilityFeePaidAmount: relatedContract?.facilityFeePaidAmount,
    actual: row?.note?.disbursementBreakdown,
  });

  const shellClass = cn(
    issuerMainContentClassName,
    issuerPageGutterClassName,
    issuerContentMaxWidthClassName,
    "space-y-6"
  );
  const isLoading = dashboardLoading || invoiceLoading;

  const handleDownloadDocument = async () => {
    if (!document?.s3_key) return;
    try {
      const response = await apiClient.getS3DownloadUrl(document.s3_key);
      if (!response.success || !response.data?.downloadUrl) {
        throw new Error("Could not get download link");
      }
      window.open(response.data.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download document");
    }
  };

  if (!orgId) {
    return (
      <div className={shellClass}>
        <EmptyState
          title="Select an organisation"
          message="Choose an organisation to view this invoice."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={shellClass}>
        <LoadingState variant="detail" />
      </div>
    );
  }

  if ((dashboardError || invoiceError) && !row && !invoiceRecord) {
    return (
      <div className={shellClass}>
        <EmptyState
          title="Could not load invoice"
          message={
            (dashboardErr instanceof Error
              ? dashboardErr.message
              : invoiceErr instanceof Error
                ? invoiceErr.message
                : null) ?? "Unknown error"
          }
          action={
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/financing?tab=invoices">Back to Financing</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!row && !invoiceRecord) {
    return (
      <div className={shellClass}>
        <EmptyState
          title="Invoice not found"
          message="This invoice is not available or you do not have access."
          action={
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/financing?tab=invoices">Back to Financing</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const invoiceBusinessNumber =
    row?.invoiceNumber ?? invDetails?.number ?? null;
  const cashSoukReference = formatInvoiceReference({
    displayReference:
      row?.displayReference ??
      (invoiceRecord as { displayReference?: string | null } | undefined)?.displayReference ??
      (invoiceRecord as { display_reference?: string | null } | undefined)?.display_reference ??
      null,
    businessNumber: invoiceBusinessNumber != null ? String(invoiceBusinessNumber) : null,
    id: invoiceId,
  });
  const facilityLink = resolveIssuerFacilityLink({
    contractId,
    displayReference: relatedContract?.displayReference,
  });
  const customerName = row?.customerName ?? null;
  const campaign = row?.note ? buildIssuerMarketplaceCampaign(row.note) : null;
  const campaignCloseLabel = campaign
    ? issuerCampaignCloseLabel(
        formatDate(campaign.closesAt),
        issuerCampaignDaysLeftLabel(campaign.daysLeft, campaign.raising)
      )
    : EM_DASH;
  const hideFeesBeforeAcceptance = offerStatus === "Offer received";
  const showFeesCard =
    (feeDisplay.phase !== "none" && feeDisplay.phase !== "pending") ||
    offerStatus === "Offer received";

  return (
    <div className={shellClass}>
      <DetailHeader
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/financing?tab=invoices"
              className="hover:text-foreground hover:underline"
            >
              Financing
            </Link>
            <span aria-hidden>›</span>
            <span className="text-foreground">Invoice {displayCell(invoiceBusinessNumber ?? cashSoukReference)}</span>
          </nav>
        }
        title={displayCell(invoiceBusinessNumber ?? cashSoukReference)}
        status={
          <span className="flex flex-wrap items-center gap-2">
            <IssuerFinancingStatusBadge kind={badgeKind} />
            {contractId ? (
              <StatusBadge label="Part of a facility" status="submitted" />
            ) : (
              <StatusBadge label="On its own" status="neutral" />
            )}
            {offerStatus === "Offer expired" ? (
              <StatusBadge label="Offer expired" status="rejected" />
            ) : null}
          </span>
        }
        facts={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {displayCell(customerName)}
              {row?.submissionDate ? ` · submitted ${formatDate(row.submissionDate)}` : ""}
            </span>
            {applicationId ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/applications/${applicationId}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Application
                </Link>
              </>
            ) : null}
            {facilityLink ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={facilityLink.href}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {`Facility: ${facilityLink.label}`}
                </Link>
              </>
            ) : null}
            {row?.note?.id ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/financing/notes/${row.note.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {row.note.noteReference ? `Note: ${row.note.noteReference}` : "Note"}
                </Link>
              </>
            ) : null}
          </span>
        }
        actions={
          <>
            {showReviewOffer && applicationId ? (
              <div className="rounded-xl bg-status-action-bg p-0.5">
                <Button className="rounded-xl" asChild>
                  <Link href={financingOfferHref(applicationId, invoiceId)}>
                    {offerActionCta?.label ?? "Review Invoice Offer"}
                  </Link>
                </Button>
              </div>
            ) : null}
            {applicationId ? (
              <Button variant="outline" className="rounded-xl" asChild>
                <Link href={`/applications/${applicationId}`}>View application</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Key facts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCell
              label="Invoice value"
              value={
                row?.invoiceValue != null
                  ? formatMoney(row.invoiceValue)
                  : invDetails?.value != null
                    ? formatCurrency(invDetails.value)
                    : EM_DASH
              }
            />
            <MetricCell
              label="Financing"
              value={
                row?.financingAmount != null
                  ? formatMoney(row.financingAmount)
                  : offerDetails?.offered_amount != null
                    ? formatCurrency(Number(offerDetails.offered_amount))
                    : EM_DASH
              }
            />
            <MetricCell label="Maturity" value={formatDate(maturityRaw)} />
            <MetricCell
              label="Profit rate"
              value={
                offerDetails?.offered_profit_rate_percent != null
                  ? `${offerDetails.offered_profit_rate_percent}%`
                  : EM_DASH
              }
            />
          </div>
          {contractId ? (
            <FacilityImpactSection
              contractId={contractId}
              displayReference={relatedContract?.displayReference}
              financingAmount={row?.financingAmount ?? offerDetails?.offered_amount}
              invoiceFace={row?.invoiceValue ?? invDetails?.value}
              invoiceStatus={row?.invoiceStatus ?? modalInvoice?.status}
              noteStatus={row?.note?.noteStatus}
              servicingStatus={row?.note?.servicingStatus}
            />
          ) : null}
          <KeyValueGrid
            items={[
              { label: "CashSouk Reference", value: displayCell(cashSoukReference) },
              { label: "Invoice number", value: displayCell(invoiceBusinessNumber) },
              { label: "Customer", value: displayCell(customerName) },
              {
                label: "Product",
                value: (
                  <ProductCatalogName
                    name={relatedContract?.productName}
                    imageS3Key={productImageS3Key}
                    empty={EM_DASH}
                  />
                ),
              },
              { label: "Submission date", value: formatDate(row?.submissionDate) },
              {
                label: "Facility",
                value: facilityLink ? (
                  <FacilityTiedAnchor
                    contractId={contractId}
                    displayReference={relatedContract?.displayReference}
                  />
                ) : (
                  "On its own"
                ),
              },
              {
                label: "Campaign closes",
                value: campaign?.closesAt ? campaignCloseLabel : EM_DASH,
              },
              {
                label: "Min to succeed",
                value: campaign ? `${campaign.minimumPercent}%` : EM_DASH,
              },
              {
                label: "Still open",
                value:
                  campaign?.raising && campaign.remainingCapacity > 0
                    ? formatMoney(campaign.remainingCapacity)
                    : campaign?.raising
                      ? "Fully allocated"
                      : EM_DASH,
              },
              {
                label: "Investors",
                value: row?.note
                  ? formatNoteInvestorCount(row.note.investorCount)
                  : EM_DASH,
              },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Status & funding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <IssuerFinancingStatusBadge kind={badgeKind} />
            {offerStatus === "Offer received" ? (
              <StatusBadge label="Offer received" status="action" />
            ) : null}
          </div>
          {row?.note ? (
            <div className="max-w-lg space-y-3">
              {campaign?.raising ? (
                <MarketplaceCampaignFacts note={row.note} variant="detail" />
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Funding progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-foreground/35 shadow-sm dark:bg-muted">
                    <div
                      className="h-3 rounded-full bg-foreground"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                  <FundingStatusLine text={fundingLabel} />
                </>
              )}
            </div>
          ) : (
            <p className="text-body leading-7 text-muted-foreground">
              No note has been raised for this invoice yet.
            </p>
          )}
        </CardContent>
      </Card>

      {showFeesCard ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Fees</CardTitle>
          </CardHeader>
          <CardContent>
            {hideFeesBeforeAcceptance ? (
              <p className="text-body leading-7 text-muted-foreground">
                Fee amounts are shown after you accept the offer.
              </p>
            ) : (
              <KeyValueGrid
                items={[
                  {
                    label: "Net disbursed",
                    value:
                      feeDisplay.phase === "charged" && feeDisplay.netDisbursementAmount != null
                        ? money(feeDisplay.netDisbursementAmount)
                        : EM_DASH,
                    tabular: true,
                  },
                  {
                    label: "Platform fee",
                    value:
                      feeDisplay.platformFeeAmount != null
                        ? money(feeDisplay.platformFeeAmount)
                        : EM_DASH,
                    tabular: true,
                  },
                  {
                    label: "Facility fee",
                    value:
                      feeDisplay.facilityFeeAmount != null
                        ? `${money(feeDisplay.facilityFeeAmount)}${
                            feeDisplay.facilityFeeFullyCollected &&
                            feeDisplay.facilityFeeAmount === 0
                              ? " (cap reached)"
                              : ""
                          }`
                        : EM_DASH,
                    tabular: true,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {document?.s3_key ? (
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={handleDownloadDocument}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {document.file_name || "Download invoice document"}
            </Button>
          ) : (
            <p className="text-body leading-7 text-muted-foreground">
              No invoice document on file.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
