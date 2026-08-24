"use client";

import * as React from "react";
import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import { formatContractReference, resolveProductImageS3KeyFromWorkflow } from "@cashsouk/types";
import { useProduct } from "@/app/settings/products/hooks/use-products";
import { productName } from "@/app/settings/products/product-utils";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import {
  AdminCollapsibleCard,
  AdminDetailCardHeader,
  AdminDetailTabPanel,
  AdminDetailTabs,
  AdminEntityHeader,
  AdminEntitySummaryCard,
  AdminProductIdentity,
  AdminMetricProgress,
  AdminNextActionBanner,
  useAdminDetailTabState,
  type AdminDetailTab,
} from "@/components/admin-detail";
import { ApplicationStatusBadge } from "@/components/application-review";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useContractDetail } from "@/contracts/hooks/use-contract-detail";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import {
  CONTRACT_EMPTY_LABEL,
  ContractDetailRow,
  ContractDynamicRows,
  contractDynamicKeys,
  contractFileLabel,
  formatContractFieldValue,
  hasContractOfferData,
  type ContractFileDoc,
} from "./contract-detail-fields";
import { ContractActivityPanel } from "./contract-activity-panel";
import { ContractApplicationsTable } from "./contract-applications-table";
import { ContractNotesTable } from "./contract-notes-table";
import { ContractFacilityFeePanel } from "./contract-facility-fee-panel";
import { ContractFacilitySummary } from "@/components/application-review/contract-facility-summary";
import {
  formatContractFacilityNoteCount,
  getContractUtilizationAccentClass,
  getContractUtilizationProgressClass,
  parseFacilityAmount,
  resolveContractFacilityFeeLedger,
  resolveContractFacilityFeeWaitingNote,
  resolveContractFacilityMetrics,
} from "@/contracts/utils/contract-facility-metrics";
import {
  compactRemainingAllocationLine,
  compactReservedLine,
  CONTRACT_ALLOCATION_HELPER,
  CREDIT_FACILITY_HELPER,
  OVER_LIMIT_LABEL,
  REMAINING_ALLOCATION_LABEL,
  REMAINING_CREDIT_LABEL,
} from "@/lib/facility-capacity-display";
import {
  getContractHeaderEndDate,
  getContractHeaderMetrics,
  resolveContractHeaderDescription,
} from "@/contracts/utils/contract-header-metrics";
import {
  CONTRACT_REFERENCE_TAB_TOKEN,
  isContractDetailTabId,
  resolveContractApplicationsTabToken,
  resolveContractDetailNextAction,
  resolveContractDocumentsTabToken,
  resolveContractFacilityOfferTabToken,
  resolveContractNotesTabToken,
  resolveContractOverviewTabToken,
  type ContractDetailTabId,
} from "@/contracts/utils/contract-detail-next-action";
import {
  ADMIN_WAITING_SURFACE_CLASS,
  adminTabStatusLabel,
  getAdminStatusToken,
} from "@/lib/admin-status-token";
import { orgHref } from "@/lib/admin-directory-hrefs";
import { usePermissions } from "@/hooks/use-permissions";

const CONTRACT_CURATED_KEYS = [
  "title",
  "description",
  "number",
  "value",
  "financing",
  "start_date",
  "end_date",
  "approved_facility",
  "utilized_facility",
  "available_facility",
  "pending_facility",
  "repaid_facility",
  "lifetime_cap",
  "lifetime_used",
  "lifetime_remaining",
  "facility_fee_rate_percent",
  "facility_fee_paid_amount",
  "facility_fee_total_amount",
  "facility_fee_upfront_amount",
  "facility_fee_waived",
  "facility_fee_waived_amount",
  "facility_fee_waived_at",
  "facility_fee_waived_by_user_id",
  "facility_fee_waived_reason",
  "facility_enabled",
  "facility_disabled_reason",
  "facility_disabled_at",
  "facility_disabled_by_user_id",
  "document",
];

const CUSTOMER_CURATED_KEYS = [
  "name",
  "entity_type",
  "ssm_number",
  "country",
  "is_related_party",
  "document",
];

const OFFER_CURATED_KEYS = [
  "version",
  "sent_at",
  "expires_at",
  "offer_acceptance",
  "responded_at",
  "requested_facility",
  "offered_facility",
  "facility_fee_rate_percent",
  "facility_fee_upfront_collect_amount",
  "sent_by_user_id",
  "responded_by_user_id",
];

function ContractFieldsCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader icon={icon} title={title} description={description} />
      <CardContent className="pt-0">
        <div className="grid gap-x-8 sm:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  );
}

function ContractEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-4">
      <p className="text-ui font-medium">{title}</p>
      <p className="mt-1 text-meta text-muted-foreground">{description}</p>
    </div>
  );
}

function ContractDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-72 max-w-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
            </div>
          </div>
          <Skeleton className="mt-6 h-28 w-full rounded-xl" />
        </div>
        <div className="border-t px-6 py-4 md:px-8">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

export function ContractDetailView({ contractId }: { contractId: string }) {
  const { can } = usePermissions();
  const canViewOrganizations = can("organizations.view");
  const canManageFacility = can("contracts.manage");
  const { data, isLoading, error } = useContractDetail(contractId);
  const catalogProductId =
    data?.applications.find((application) => application.kind === "facility" && application.productId)
      ?.productId ??
    data?.applications.find((application) => application.productId)?.productId ??
    null;
  const { data: catalogProduct } = useProduct(catalogProductId);
  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();

  const nextAction = React.useMemo(
    () => (data ? resolveContractDetailNextAction(data) : null),
    [data]
  );
  const { activeTab, setActiveTab } = useAdminDetailTabState<ContractDetailTabId>({
    isValidTab: isContractDetailTabId,
    computedTab: data ? "overview" : null,
  });
  const resolvedTab: ContractDetailTabId = activeTab ?? "overview";

  const tabs = React.useMemo<AdminDetailTab<ContractDetailTabId>[]>(() => {
    if (!data) return [];
    const overviewToken = resolveContractOverviewTabToken(data.status);
    const facilityToken = resolveContractFacilityOfferTabToken(data);
    const applicationsToken = resolveContractApplicationsTabToken(data.applications);
    const notesToken = resolveContractNotesTabToken(data.notes);
    const document = data.contractDetails?.document as { s3_key?: string } | undefined;
    const documentsToken = resolveContractDocumentsTabToken(Boolean(document?.s3_key));
    return [
      {
        id: "overview",
        label: "Overview",
        statusToken: overviewToken,
        statusLabel: adminTabStatusLabel(overviewToken),
      },
      {
        id: "facility-offer",
        label: "Facility & Offer",
        statusToken: facilityToken,
        statusLabel: adminTabStatusLabel(facilityToken),
      },
      {
        id: "applications",
        label: "Applications",
        statusToken: applicationsToken,
        statusLabel: adminTabStatusLabel(applicationsToken),
      },
      {
        id: "notes",
        label: "Drawdowns",
        statusToken: notesToken,
        statusLabel: adminTabStatusLabel(notesToken),
      },
      {
        id: "documents",
        label: "Documents",
        statusToken: documentsToken,
        statusLabel: adminTabStatusLabel(documentsToken),
      },
      {
        id: "activity",
        label: "Activity",
        statusToken: CONTRACT_REFERENCE_TAB_TOKEN,
      },
    ];
  }, [data]);

  if (isLoading) return <ContractDetailSkeleton />;

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-ui text-destructive">
        {error instanceof Error ? error.message : "Failed to load facility details"}
      </div>
    );
  }

  if (!data) return null;
  const catalogName = catalogProduct ? productName(catalogProduct) : null;
  const catalogProductLabel = catalogName && catalogName !== "—" ? catalogName : null;

  const facilityApplications = data.applications.filter((application) => application.kind === "facility");
  const invoiceApplications = data.applications.filter((application) => application.kind === "invoice");

  const contractDetails = data.contractDetails;
  const customerDetails = data.customerDetails;
  const contractReference = formatContractReference({
    displayReference: data.displayReference,
    businessNumber: data.contractNumber,
    id: data.id,
  });
  const facility = resolveContractFacilityMetrics(data);
  const facilityFeeRatePercent = parseFacilityAmount(contractDetails?.facility_fee_rate_percent);
  const facilityFeeLedger = resolveContractFacilityFeeLedger({
    approved: facility.approved,
    contractDetails,
  });
  const facilityFeeWaitingNote = resolveContractFacilityFeeWaitingNote(facilityFeeLedger);
  const headerMetrics = getContractHeaderMetrics(contractDetails, {
    approvedFacility: facility.approved,
  });
  const headerDescription = resolveContractHeaderDescription({
    title: data.title,
    description: data.description,
    contractDetails,
  });

  const contractExtraKeys = contractDynamicKeys(contractDetails, CONTRACT_CURATED_KEYS);
  const customerExtraKeys = contractDynamicKeys(customerDetails, CUSTOMER_CURATED_KEYS);
  const hasExtraFields = contractExtraKeys.length > 0 || customerExtraKeys.length > 0;

  const contractDocument = (contractDetails?.document ?? undefined) as ContractFileDoc | undefined;
  const offerAcceptance = data.offerDetails?.offer_acceptance as
    | { acceptance_expires_at?: string | null; signing_expires_at?: string | null }
    | undefined;

  return (
    <div className="space-y-6">
      <AdminEntityHeader
        variant="hero"
        tone={getAdminStatusToken(data.status)}
        backHref="/contracts"
        backLabel="Facilities"
        eyebrow="Facility detail"
        title={data.title?.trim() || "Untitled facility"}
        identityExtra={
          <AdminProductIdentity
            name={catalogProductLabel}
            imageS3Key={resolveProductImageS3KeyFromWorkflow(catalogProduct?.workflow)}
          />
        }
        subtitle={
          <>
            <span className="font-mono">{contractReference}</span>
            {" · "}
            {data.issuerOrganizationId && canViewOrganizations ? (
              <Link
                href={orgHref("issuer", data.issuerOrganizationId)}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {data.issuerOrganizationName ?? "Unnamed organization"}
              </Link>
            ) : (
              (data.issuerOrganizationName ??
                (data.issuerOrganizationId ? "Unnamed organization" : "Unknown issuer"))
            )}
            {headerDescription ? (
              <>
                <br />
                {headerDescription}
              </>
            ) : null}
          </>
        }
        icon={DocumentTextIcon}
        chips={
          <>
            <ApplicationStatusBadge status={data.status} />
            {/* The reference falls back to the contract number, so only chip it when it adds something. */}
            {data.contractNumber && data.contractNumber !== contractReference ? (
              <StatusBadge
                label={`Facility no. ${data.contractNumber}`}
                status="neutral"
                showDot={false}
              />
            ) : null}
          </>
        }
        summaryCards={[
          <AdminEntitySummaryCard
            key="end-date"
            label="End date"
            value={getContractHeaderEndDate(contractDetails)}
          />,
          <AdminEntitySummaryCard
            key="notes"
            label="Drawdowns"
            value={
              <button
                type="button"
                className="appearance-none bg-transparent p-0 text-inherit underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => setActiveTab("notes")}
                aria-label={formatContractFacilityNoteCount(data.notes.length)}
              >
                {data.notes.length}
              </button>
            }
          />,
        ]}
        metrics={headerMetrics}
        visualization={
          <div className="space-y-3">
            {facility.isOverLimit ? (
              <StatusBadge label={OVER_LIMIT_LABEL} status="rejected" />
            ) : null}
            <AdminMetricProgress
              variant="hero"
              percent={facility.utilizationPercent ?? 0}
              leftLabel="Utilized + reserved"
              leftValue={formatCurrency(facility.occupied)}
              leftHint={
                facility.approved > 0
                  ? `of ${formatCurrency(facility.approved)} approved. ${CREDIT_FACILITY_HELPER}`
                  : "No approved facility"
              }
              rightLabel={REMAINING_CREDIT_LABEL}
              rightValue={formatCurrency(facility.available)}
              rightHint={
                compactReservedLine(facility.pending, formatCurrency) ??
                (facility.utilizationPercent == null
                  ? undefined
                  : `${facility.utilizationPercent.toFixed(1)}% drawn`)
              }
              barClassName={getContractUtilizationProgressClass(
                facility.utilizationPercent,
                facility.approved > 0
              )}
              accentClassName={getContractUtilizationAccentClass(
                facility.utilizationPercent,
                facility.approved > 0
              )}
              footer={
                compactRemainingAllocationLine(facility, formatCurrency) ??
                (facility.lifetimeCap > 0 ? CONTRACT_ALLOCATION_HELPER : undefined)
              }
            />
            {facility.lifetimeCap > 0 ? (
              <AdminMetricProgress
                variant="hero"
                percent={facility.allocationPercent ?? 0}
                leftLabel="Allocation used"
                leftValue={formatCurrency(facility.lifetimeUsed)}
                leftHint={`of ${formatCurrency(facility.lifetimeCap)} contract value. ${CONTRACT_ALLOCATION_HELPER}`}
                rightLabel={REMAINING_ALLOCATION_LABEL}
                rightValue={formatCurrency(facility.lifetimeRemaining)}
                barClassName={getContractUtilizationProgressClass(
                  facility.allocationPercent,
                  facility.lifetimeCap > 0
                )}
                accentClassName={getContractUtilizationAccentClass(
                  facility.allocationPercent,
                  facility.lifetimeCap > 0
                )}
              />
            ) : null}
          </div>
        }
      />

      {nextAction ? (
        <AdminNextActionBanner
          title={nextAction.title}
          description={nextAction.description}
          ctaLabel={nextAction.ctaLabel}
          onClick={() => setActiveTab(nextAction.tabId)}
        />
      ) : null}
      {facilityFeeWaitingNote ? (
        <AdminNextActionBanner
          title={facilityFeeWaitingNote.title}
          description={facilityFeeWaitingNote.description}
          ctaLabel="Open Facility & Offer"
          onClick={() => setActiveTab("facility-offer")}
          tone="neutral"
          className={ADMIN_WAITING_SURFACE_CLASS}
        />
      ) : null}

      <AdminDetailTabs tabs={tabs} value={resolvedTab} onValueChange={setActiveTab}>
        <AdminDetailTabPanel value="overview">
          <ContractFieldsCard
            title="Customer information"
            description="Entity on record for this facility."
            icon={BuildingOffice2Icon}
          >
            <div>
              <ContractDetailRow
                label="Customer name"
                value={formatContractFieldValue("name", customerDetails?.name)}
              />
              <ContractDetailRow
                label="Entity type"
                value={formatContractFieldValue("entity_type", customerDetails?.entity_type)}
              />
              <ContractDetailRow
                label="SSM number"
                value={formatContractFieldValue("ssm_number", customerDetails?.ssm_number)}
              />
            </div>
            <div>
              <ContractDetailRow
                label="Country"
                value={formatContractFieldValue("country", customerDetails?.country)}
              />
              <ContractDetailRow
                label="Related party"
                value={
                  typeof customerDetails?.is_related_party === "boolean"
                    ? formatContractFieldValue(
                        "is_related_party",
                        customerDetails.is_related_party
                      )
                    : CONTRACT_EMPTY_LABEL
                }
              />
            </div>
          </ContractFieldsCard>

          {hasExtraFields ? (
            <AdminCollapsibleCard
              title="Additional fields"
              description="Remaining fields exactly as submitted on the facility and customer records."
              icon={QueueListIcon}
            >
              <div className="grid gap-x-8 sm:grid-cols-2">
                {contractExtraKeys.length > 0 ? (
                  <div>
                    <p className="text-meta font-medium uppercase tracking-wider text-muted-foreground">
                      Facility
                    </p>
                    <ContractDynamicRows
                      data={contractDetails}
                      exclude={CONTRACT_CURATED_KEYS}
                    />
                  </div>
                ) : null}
                {customerExtraKeys.length > 0 ? (
                  <div>
                    <p className="text-meta font-medium uppercase tracking-wider text-muted-foreground">
                      Customer
                    </p>
                    <ContractDynamicRows
                      data={customerDetails}
                      exclude={CUSTOMER_CURATED_KEYS}
                    />
                  </div>
                ) : null}
              </div>
            </AdminCollapsibleCard>
          ) : null}
        </AdminDetailTabPanel>

        <AdminDetailTabPanel value="facility-offer">
          <ContractFacilitySummary
            contractFacility={facility.approved}
            availableFacility={facility.available}
            utilizedFacility={facility.utilized}
            pendingFacility={facility.pending}
            lifetimeCap={facility.lifetimeCap}
            lifetimeUsed={facility.lifetimeUsed}
            lifetimeRemaining={facility.lifetimeRemaining}
          />
          <ContractFieldsCard
            title="Line of credit"
            description="Approved line, live utilization, and reserved invoices."
            icon={BanknotesIcon}
          >
            <div>
              <ContractDetailRow
                label="Approved facility"
                value={formatCurrency(facility.approved)}
              />
              <ContractDetailRow
                label="Utilized (live)"
                value={formatCurrency(facility.utilized)}
              />
              <ContractDetailRow
                label="Reserved"
                value={formatCurrency(facility.pending)}
              />
              <ContractDetailRow
                label={REMAINING_CREDIT_LABEL}
                value={formatCurrency(facility.available)}
              />
            </div>
            <div>
              <ContractDetailRow
                label="Utilization"
                value={
                  facility.utilizationPercent == null
                    ? "No approved facility"
                    : `${facility.utilizationPercent.toFixed(1)}%`
                }
              />
              <ContractDetailRow
                label={REMAINING_ALLOCATION_LABEL}
                value={
                  facility.lifetimeCap > 0
                    ? formatCurrency(facility.lifetimeRemaining)
                    : CONTRACT_EMPTY_LABEL
                }
              />
            </div>
          </ContractFieldsCard>
          <ContractFacilityFeePanel
            contractId={data.id}
            facilityFeeRatePercent={facilityFeeRatePercent}
            ledger={facilityFeeLedger}
            canManage={canManageFacility}
          />

          <Card className="rounded-2xl">
            <AdminDetailCardHeader
              icon={PaperAirplaneIcon}
              title="Offer"
              description="Facility offers are sent from the linked application review, then tracked here."
            />
            <CardContent className="pt-0">
              {!hasContractOfferData(data.offerDetails) ? (
                <ContractEmptyState
                  title="No offer sent yet"
                  description="Facility offers are sent from the linked application review, then tracked here."
                />
              ) : (
                <>
                  <div className="grid gap-x-8 sm:grid-cols-2">
                    <div>
                      <ContractDetailRow
                        label="Sent at"
                        value={formatContractFieldValue("sent_at", data.offerDetails?.sent_at)}
                      />
                      <ContractDetailRow
                        label="Sent by"
                        value={data.offerSentByUserName ?? CONTRACT_EMPTY_LABEL}
                      />
                      <ContractDetailRow
                        label="Accept by"
                        value={
                          offerAcceptance?.acceptance_expires_at
                            ? formatContractFieldValue(
                                "acceptance_expires_at",
                                offerAcceptance.acceptance_expires_at
                              )
                            : CONTRACT_EMPTY_LABEL
                        }
                      />
                      <ContractDetailRow
                        label="Complete signing by"
                        value={
                          offerAcceptance?.signing_expires_at
                            ? formatContractFieldValue(
                                "signing_expires_at",
                                offerAcceptance.signing_expires_at
                              )
                            : CONTRACT_EMPTY_LABEL
                        }
                      />
                    </div>
                    <div>
                      <ContractDetailRow
                        label="Requested facility"
                        value={formatContractFieldValue(
                          "requested_facility",
                          data.offerDetails?.requested_facility
                        )}
                      />
                      <ContractDetailRow
                        label="Offered facility"
                        value={formatContractFieldValue(
                          "offered_facility",
                          data.offerDetails?.offered_facility
                        )}
                      />
                      <ContractDetailRow
                        label="Facility fee rate"
                        value={formatContractFieldValue(
                          "facility_fee_rate_percent",
                          data.offerDetails?.facility_fee_rate_percent
                        )}
                      />
                      <ContractDetailRow
                        label="Upfront via payment gateway"
                        value={formatContractFieldValue(
                          "facility_fee_upfront_collect_amount",
                          data.offerDetails?.facility_fee_upfront_collect_amount ?? 0
                        )}
                      />
                      <ContractDetailRow
                        label="Responded at"
                        value={
                          data.offerDetails?.responded_at
                            ? formatContractFieldValue(
                                "responded_at",
                                data.offerDetails.responded_at
                              )
                            : "No response yet"
                        }
                      />
                      <ContractDetailRow
                        label="Responded by"
                        value={data.offerRespondedByUserName ?? "No response yet"}
                      />
                    </div>
                  </div>
                  <ContractDynamicRows data={data.offerDetails} exclude={OFFER_CURATED_KEYS} />
                </>
              )}
            </CardContent>
          </Card>
        </AdminDetailTabPanel>

        <AdminDetailTabPanel value="applications">
          <div className="space-y-6">
            <Card className="rounded-2xl">
              <AdminDetailCardHeader
                icon={BanknotesIcon}
                title="Facility application"
                description="The application that set up this facility and its credit limit."
              />
              <CardContent className={facilityApplications.length === 0 ? undefined : "p-0"}>
                <ContractApplicationsTable
                  applications={facilityApplications}
                  requestedColumnLabel="Requested facility"
                  emptyTitle="No facility application"
                  emptyDescription="The originating application for this facility is not linked yet."
                />
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <AdminDetailCardHeader
                icon={ClipboardDocumentListIcon}
                title="Invoice applications"
                description="Invoice financing drawn against this facility after it was approved."
              />
              <CardContent className={invoiceApplications.length === 0 ? undefined : "p-0"}>
                <ContractApplicationsTable
                  applications={invoiceApplications}
                  requestedColumnLabel="Requested financing"
                  emptyTitle="No invoice applications"
                  emptyDescription="Invoice applications drawn against this facility will appear here once the issuer submits them."
                />
              </CardContent>
            </Card>
          </div>
        </AdminDetailTabPanel>

        <AdminDetailTabPanel value="notes">
          <Card className="rounded-2xl">
            <AdminDetailCardHeader
              icon={DocumentDuplicateIcon}
              title="Drawdowns"
              description={
                data.notes.length === 0
                  ? "No drawdowns have used this line of credit"
                  : `${data.notes.length} ${data.notes.length === 1 ? "drawdown" : "drawdowns"} issued from invoices under this facility`
              }
            />
            <CardContent className={data.notes.length === 0 ? undefined : "p-0"}>
              <ContractNotesTable notes={data.notes} />
            </CardContent>
          </Card>
        </AdminDetailTabPanel>

        <AdminDetailTabPanel value="documents">
          <Card className="rounded-2xl">
            <AdminDetailCardHeader
              icon={PaperClipIcon}
              title="Documents"
              description="Evidence uploaded with the facility submission."
            />
            <CardContent className="pt-0">
              {contractDocument?.s3_key ? (
                <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-ui font-medium">Contract document</p>
                    <p className="truncate text-meta text-muted-foreground">
                      {contractFileLabel(contractDocument)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => void handleViewDocument(contractDocument.s3_key as string)}
                      disabled={viewDocumentPending}
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        void handleDownloadDocument(
                          contractDocument.s3_key as string,
                          contractDocument.file_name
                        )
                      }
                      disabled={viewDocumentPending}
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              ) : (
                <ContractEmptyState
                  title="No contract document"
                  description="The signed contract document will appear here once it is uploaded with the submission."
                />
              )}
            </CardContent>
          </Card>
        </AdminDetailTabPanel>

        <AdminDetailTabPanel value="activity">
          <ContractActivityPanel contract={data} />
        </AdminDetailTabPanel>
      </AdminDetailTabs>
    </div>
  );
}
