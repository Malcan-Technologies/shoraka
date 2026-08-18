"use client";

import * as React from "react";
import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import { formatContractReference } from "@cashsouk/types";
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
import {
  formatContractFacilityNoteCount,
  getContractUtilizationAccentClass,
  getContractUtilizationProgressClass,
  parseFacilityAmount,
  resolveContractFacilityMetrics,
} from "@/contracts/utils/contract-facility-metrics";
import {
  getContractHeaderMetrics,
  resolveContractHeaderDescription,
} from "@/contracts/utils/contract-header-metrics";
import {
  isContractDetailTabId,
  resolveContractActivityTabToken,
  resolveContractApplicationsTabToken,
  resolveContractDetailNextAction,
  resolveContractDocumentsTabToken,
  resolveContractFacilityOfferTabToken,
  resolveContractNotesTabToken,
  resolveContractOverviewTabToken,
  type ContractDetailTabId,
} from "@/contracts/utils/contract-detail-next-action";
import { adminTabStatusLabel } from "@/lib/admin-status-token";

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
  "facility_fee_rate_percent",
  "facility_fee_paid_amount",
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
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

export function ContractDetailView({ contractId }: { contractId: string }) {
  const { data, isLoading, error } = useContractDetail(contractId);
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
    const activityToken = resolveContractActivityTabToken(data.activity, data.status);
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
        label: "Notes",
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
        statusToken: activityToken,
        statusLabel: adminTabStatusLabel(activityToken),
      },
    ];
  }, [data]);

  if (isLoading) return <ContractDetailSkeleton />;

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-ui text-destructive">
        {error instanceof Error ? error.message : "Failed to load contract details"}
      </div>
    );
  }

  if (!data) return null;

  const contractDetails = data.contractDetails;
  const customerDetails = data.customerDetails;
  const contractReference = formatContractReference({
    displayReference: data.displayReference,
    businessNumber: data.contractNumber,
    id: data.id,
  });
  const facility = resolveContractFacilityMetrics(data);
  const facilityFeeRatePercent = parseFacilityAmount(contractDetails?.facility_fee_rate_percent);
  const facilityFeePaidAmount = parseFacilityAmount(contractDetails?.facility_fee_paid_amount);
  const facilityFeeCap =
    facilityFeeRatePercent != null ? facility.approved * (facilityFeeRatePercent / 100) : null;
  const facilityFeeCollectedDisplay =
    facilityFeeRatePercent != null &&
    facilityFeeRatePercent > 0 &&
    facilityFeePaidAmount != null &&
    facilityFeeCap != null
      ? `${formatCurrency(facilityFeePaidAmount)} / ${formatCurrency(facilityFeeCap)} cap`
      : null;
  const headerMetrics = getContractHeaderMetrics(contractDetails);
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
        backHref="/contracts"
        backLabel="Contracts"
        eyebrow="Contract detail"
        title={data.title?.trim() || "Untitled contract"}
        subtitle={
          <>
            <span className="font-mono">{contractReference}</span>
            {" · "}
            {data.issuerOrganizationId ? (
              <Link
                href={`/organizations/issuer/${encodeURIComponent(data.issuerOrganizationId)}`}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {data.issuerOrganizationName ?? "Unnamed organization"}
              </Link>
            ) : (
              (data.issuerOrganizationName ?? "Unknown issuer")
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
                label={`Contract no. ${data.contractNumber}`}
                status="neutral"
                showDot={false}
              />
            ) : null}
          </>
        }
        metrics={headerMetrics}
        visualization={
          <AdminMetricProgress
            percent={facility.utilizationPercent ?? 0}
            leftLabel="Utilized"
            leftValue={formatCurrency(facility.utilized)}
            leftHint={
              facility.approved > 0
                ? `of ${formatCurrency(facility.approved)} approved`
                : "No approved facility"
            }
            rightLabel="Available"
            rightValue={formatCurrency(facility.available)}
            rightHint={
              facility.utilizationPercent == null
                ? undefined
                : `${facility.utilizationPercent.toFixed(1)}% drawn`
            }
            barClassName={getContractUtilizationProgressClass(
              facility.utilizationPercent,
              facility.approved > 0
            )}
            accentClassName={getContractUtilizationAccentClass(
              facility.utilizationPercent,
              facility.approved > 0
            )}
            footer={formatContractFacilityNoteCount(data.notes.length)}
          />
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
              description="Remaining fields exactly as submitted on the contract and customer records."
              icon={QueueListIcon}
            >
              <div className="grid gap-x-8 sm:grid-cols-2">
                {contractExtraKeys.length > 0 ? (
                  <div>
                    <p className="text-meta font-medium uppercase tracking-wider text-muted-foreground">
                      Contract
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
          <ContractFieldsCard
            title="Facility"
            description="Approved line, utilization, and facility fee."
            icon={BanknotesIcon}
          >
            <div>
              <ContractDetailRow
                label="Approved facility"
                value={formatCurrency(facility.approved)}
              />
              <ContractDetailRow
                label="Utilized facility"
                value={formatCurrency(facility.utilized)}
              />
              <ContractDetailRow
                label="Available facility"
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
                label="Facility fee rate"
                value={
                  facilityFeeRatePercent == null
                    ? CONTRACT_EMPTY_LABEL
                    : formatContractFieldValue(
                        "facility_fee_rate_percent",
                        facilityFeeRatePercent
                      )
                }
              />
              <ContractDetailRow
                label="Facility fee collected"
                value={facilityFeeCollectedDisplay ?? CONTRACT_EMPTY_LABEL}
              />
            </div>
          </ContractFieldsCard>

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
          <Card className="rounded-2xl">
            <AdminDetailCardHeader
              icon={ClipboardDocumentListIcon}
              title="Applications"
              description={
                data.applications.length === 0
                  ? "No linked applications yet"
                  : `${data.applications.length} ${data.applications.length === 1 ? "application" : "applications"} drawn against this facility`
              }
            />
            <CardContent className={data.applications.length === 0 ? undefined : "p-0"}>
              <ContractApplicationsTable applications={data.applications} />
            </CardContent>
          </Card>
        </AdminDetailTabPanel>

        <AdminDetailTabPanel value="notes">
          <Card className="rounded-2xl">
            <AdminDetailCardHeader
              icon={DocumentDuplicateIcon}
              title="Notes"
              description={
                data.notes.length === 0
                  ? "No notes have used this line of credit"
                  : `${data.notes.length} ${data.notes.length === 1 ? "note" : "notes"} issued from invoices under this contract`
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
              description="Evidence uploaded with the contract submission."
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
