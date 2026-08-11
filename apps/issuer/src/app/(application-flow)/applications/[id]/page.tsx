"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowDownTrayIcon, EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DetailHeader,
  EmptyState,
  KeyValueGrid,
  LoadingState,
  StatusBadge,
} from "@cashsouk/ui";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import {
  createApiClient,
  formatCurrency,
  useAuthToken,
  useOrganization,
} from "@cashsouk/config";
import { filterVisiblePeopleRows } from "@cashsouk/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  issuerContentMaxWidthClassName,
  issuerMainContentClassName,
  issuerPageGutterClassName,
} from "@/lib/issuer-layout";
import { DirectorShareholderAlertCard } from "@/components/director-shareholder-alert-card";
import { areDirectorShareholdersReadyForApplicationSubmit } from "@/lib/director-shareholder-onboarding-ui";
import {
  useApplication,
  useCancelApplication,
  useDeleteDraftApplication,
  useWithdrawInvoice,
} from "@/hooks/use-applications";
import { useApplicationLogs } from "@/hooks/use-application-logs";
import {
  prepareApplication,
  type ApiApplication,
} from "@/app/(application-management)/applications/use-applications-data";
import type { NormalizedInvoice } from "@/app/(application-management)/applications/status";
import { ScrollableInvoiceTable } from "@/app/(application-management)/applications/components/scrollable-invoice-table";
import { OfferReviewPanel } from "@/app/(application-management)/applications/components/OfferReviewPanel";
import { collectApplicationDocuments } from "@/app/(application-management)/applications/components/collect-application-documents";
import { buildApplicationTimeline } from "@/app/(application-management)/applications/components/application-timeline";
import {
  badgeKeyToStatusToken,
  countInvoicesNeedingAction,
  formatApplicationDisplayId,
  getIssuerPlainStatusLabel,
} from "@/app/(application-management)/applications/components/issuer-status-display";

const DETAIL_TABS = ["summary", "offer", "invoices", "documents", "timeline"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

function isDetailTab(value: string | null): value is DetailTab {
  return !!value && (DETAIL_TABS as readonly string[]).includes(value);
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = typeof params.id === "string" ? params.id : "";

  const { data: rawApplication, isLoading, error } = useApplication(applicationId);
  const application = React.useMemo(
    () => (rawApplication ? prepareApplication(rawApplication as ApiApplication) : null),
    [rawApplication]
  );

  const { data: logs, isLoading: logsLoading } = useApplicationLogs(
    applicationId && application?.status !== "draft" ? applicationId : null
  );

  const cancelApplication = useCancelApplication();
  const deleteDraftApplication = useDeleteDraftApplication();
  const withdrawInvoice = useWithdrawInvoice();
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = React.useMemo(
    () => createApiClient(undefined, getAccessToken),
    [getAccessToken]
  );

  const [deleteDraftOpen, setDeleteDraftOpen] = React.useState(false);
  const [withdrawAppOpen, setWithdrawAppOpen] = React.useState(false);
  const [withdrawInvoicePayload, setWithdrawInvoicePayload] = React.useState<{
    invoiceId: string;
    applicationId: string;
    organizationId?: string;
  } | null>(null);
  const [selectedOfferInvoice, setSelectedOfferInvoice] = React.useState<NormalizedInvoice | null>(
    null
  );
  /** Set when URL had a non-reviewable invoiceId and nothing else can be shown. */
  const [staleOfferUnavailable, setStaleOfferUnavailable] = React.useState(false);

  const tabFromUrl = searchParams.get("tab");
  const invoiceIdFromUrl = searchParams.get("invoiceId");

  const hasOffer =
    !!application &&
    (application.cardStatus.showReviewOffer ||
      application.contractStatus === "OFFER_SENT" ||
      application.invoices.some((inv) => inv.status === "OFFER_SENT" || inv.canReviewOffer) ||
      application.signedContractOfferLetterAvailable ||
      application.invoices.some((inv) => inv.signedOfferLetterAvailable));

  const pendingOfferCount = application
    ? (application.contractStatus === "OFFER_SENT" ? 1 : 0) +
      application.invoices.filter((inv) => inv.status === "OFFER_SENT" || inv.canReviewOffer).length
    : 0;

  const [activeTab, setActiveTab] = React.useState<DetailTab>(() =>
    isDetailTab(tabFromUrl) ? tabFromUrl : "summary"
  );

  const replaceQuery = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(
        qs ? `/applications/${applicationId}?${qs}` : `/applications/${applicationId}`,
        { scroll: false }
      );
    },
    [applicationId, router, searchParams]
  );

  const setTab = React.useCallback(
    (tab: DetailTab) => {
      setActiveTab(tab);
      replaceQuery((next) => {
        next.set("tab", tab);
      });
    },
    [replaceQuery]
  );

  const selectOfferInvoice = React.useCallback(
    (invoice: NormalizedInvoice | null) => {
      setSelectedOfferInvoice(invoice);
      setActiveTab("offer");
      replaceQuery((next) => {
        next.set("tab", "offer");
        if (invoice) {
          next.set("invoiceId", invoice.id);
        } else {
          next.delete("invoiceId");
        }
      });
    },
    [replaceQuery]
  );

  // URL → tab state (explicit tab in query wins).
  React.useEffect(() => {
    if (isDetailTab(tabFromUrl)) {
      if (tabFromUrl === "offer" && !hasOffer) {
        setActiveTab("summary");
        return;
      }
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, hasOffer]);

  // When application loads with no tab query, open Offer once if review is needed.
  React.useEffect(() => {
    if (!application) return;
    if (tabFromUrl != null) return;
    if (!application.cardStatus.showReviewOffer || !hasOffer) return;
    setActiveTab("offer");
    replaceQuery((next) => {
      next.set("tab", "offer");
    });
  }, [application, hasOffer, tabFromUrl, replaceQuery]);

  // URL → invoice offer selection. Absent invoiceId means contract offer (when available).
  // Keep OFFER_SENT invoices mounted through PENDING_ADMIN_REVIEW (canReviewOffer is false then).
  React.useEffect(() => {
    if (!application) return;

    const isOfferInvoice = (inv: NormalizedInvoice) =>
      inv.status === "OFFER_SENT" || inv.canReviewOffer;
    const firstInvoiceOffer = application.invoices.find(isOfferInvoice) ?? null;
    const contractOfferAvailable = application.contractStatus === "OFFER_SENT";

    if (invoiceIdFromUrl) {
      const inv = application.invoices.find((i) => i.id === invoiceIdFromUrl) ?? null;
      if (inv && isOfferInvoice(inv)) {
        setStaleOfferUnavailable(false);
        setSelectedOfferInvoice(inv);
        return;
      }

      // Stale or unknown invoiceId — clear URL and fall back.
      if (contractOfferAvailable) {
        setStaleOfferUnavailable(false);
        setSelectedOfferInvoice(null);
        replaceQuery((next) => {
          next.delete("invoiceId");
        });
        return;
      }
      if (firstInvoiceOffer) {
        setStaleOfferUnavailable(false);
        setSelectedOfferInvoice(firstInvoiceOffer);
        replaceQuery((next) => {
          next.set("invoiceId", firstInvoiceOffer.id);
        });
        return;
      }
      setStaleOfferUnavailable(true);
      setSelectedOfferInvoice(null);
      replaceQuery((next) => {
        next.delete("invoiceId");
      });
      return;
    }

    if (contractOfferAvailable) {
      setStaleOfferUnavailable(false);
      setSelectedOfferInvoice(null);
      return;
    }
    if (firstInvoiceOffer) {
      setStaleOfferUnavailable(false);
    }
    setSelectedOfferInvoice(firstInvoiceOffer);
  }, [application, invoiceIdFromUrl, replaceQuery]);

  const handleDocumentDownload = React.useCallback(
    async (s3Key: string) => {
      try {
        const resp = await apiClient.getS3DownloadUrl(s3Key);
        if (!resp.success || !resp.data?.downloadUrl) {
          toast.error("Could not get download link");
          return;
        }
        window.open(resp.data.downloadUrl, "_blank");
      } catch {
        toast.error("Could not get download link");
      }
    },
    [apiClient]
  );

  const { activeOrganization } = useOrganization();
  const visiblePeopleForDsGating = React.useMemo(
    () => filterVisiblePeopleRows(activeOrganization?.people ?? []),
    [activeOrganization?.people]
  );
  const dsOnboardingPending =
    activeOrganization?.type === "COMPANY" &&
    visiblePeopleForDsGating.length > 0 &&
    !areDirectorShareholdersReadyForApplicationSubmit({ people: visiblePeopleForDsGating });

  if (isLoading) {
    return (
      <div className={cn(issuerMainContentClassName, issuerPageGutterClassName, issuerContentMaxWidthClassName)}>
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className={cn(issuerMainContentClassName, issuerPageGutterClassName, issuerContentMaxWidthClassName)}>
        <EmptyState
          variant="no-data"
          title="Application not found"
          message="This application may have been removed, or you may not have access."
          action={
            <Button asChild className="rounded-xl">
              <Link href="/applications">Back to applications</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const displayId = formatApplicationDisplayId(application.id, application.displayReference);
  const isDraft = application.status === "draft";
  const hasContract = application.type === "Contract financing";
  const statusLabel = getIssuerPlainStatusLabel(
    application.cardStatus.badgeKey,
    application.cardStatus.badgeKey === "withdrawn" ||
      application.cardStatus.badgeKey === "declined" ||
      application.cardStatus.badgeKey === "offer_expired"
      ? application.withdrawReason
      : undefined
  );

  const showViewSignedContract =
    application.signedContractOfferLetterAvailable && !!application.signedContractOfferLetterS3Key;
  const withdrawDisabled = cancelApplication.isPending || showViewSignedContract;

  const isMountedOfferInvoice = (inv: NormalizedInvoice) =>
    inv.status === "OFFER_SENT" || inv.canReviewOffer;

  const reviewableSelectedInvoice =
    selectedOfferInvoice && isMountedOfferInvoice(selectedOfferInvoice)
      ? selectedOfferInvoice
      : null;

  const offerType: "contract" | "invoice" = reviewableSelectedInvoice
    ? "invoice"
    : application.contractStatus === "OFFER_SENT"
      ? "contract"
      : application.invoices.some(isMountedOfferInvoice)
        ? "invoice"
        : "contract";

  const offerInvoice =
    offerType === "invoice"
      ? reviewableSelectedInvoice ??
        application.invoices.find(isMountedOfferInvoice) ??
        null
      : null;

  const canShowContractOfferPanel = application.contractStatus === "OFFER_SENT";
  const canShowInvoiceOfferPanel = offerInvoice?.status === "OFFER_SENT";
  const staleInvoiceIdInUrl =
    !!invoiceIdFromUrl &&
    !application.invoices.some((i) => i.id === invoiceIdFromUrl && isMountedOfferInvoice(i));
  const showStaleOfferUnavailable =
    staleOfferUnavailable ||
    (staleInvoiceIdInUrl &&
      !canShowContractOfferPanel &&
      !application.invoices.some(isMountedOfferInvoice));
  const offerPanelKey =
    offerType === "contract"
      ? `contract-${application.contractId ?? application.id}`
      : `invoice-${offerInvoice?.id ?? "none"}`;

  const documents = collectApplicationDocuments(application, rawApplication as ApiApplication);
  const timeline = buildApplicationTimeline(logs, application);
  const invoicesNeedingAction = countInvoicesNeedingAction(application.invoices);

  if (isDraft) {
    return (
      <div className={cn(issuerMainContentClassName, issuerPageGutterClassName, issuerContentMaxWidthClassName)}>
        {activeOrganization?.type === "COMPANY" && dsOnboardingPending ? (
          <DirectorShareholderAlertCard
            visiblePeople={visiblePeopleForDsGating}
            enabled={activeOrganization.onboardingStatus === "COMPLETED"}
            stickyTop
            className="mb-4"
          />
        ) : null}
        <DetailHeader
          breadcrumb={
            <Link href="/applications" className="hover:text-foreground hover:underline">
              Applications
            </Link>
          }
          title={`Application ${displayId}`}
          status={
            <StatusBadge
              label={statusLabel}
              status={badgeKeyToStatusToken(application.cardStatus.badgeKey)}
            />
          }
          facts="This draft is not submitted yet. Continue editing when you are ready."
          actions={
            <>
              <Button className="rounded-xl" asChild>
                <Link href={`/applications/${application.id}/edit`}>Continue editing</Link>
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => setDeleteDraftOpen(true)}
              >
                Delete draft
              </Button>
            </>
          }
        />
        <Card className="mt-8 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">What&apos;s filled in so far</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValueGrid
              items={[
                { label: "Customer", value: application.customer },
                {
                  label: "Financing type",
                  value: application.type === "Generic" ? "Not chosen yet" : application.type,
                },
                {
                  label: "Contract title",
                  value: application.contractTitle ?? "—",
                },
                {
                  label: "Invoices added",
                  value: String(application.invoices.length),
                },
                {
                  label: "Last updated",
                  value: format(new Date(application.updatedAt), "d MMM yyyy, h:mm a"),
                },
              ]}
            />
          </CardContent>
        </Card>

        <ConfirmDialog
          open={deleteDraftOpen}
          onOpenChange={setDeleteDraftOpen}
          title="Delete draft?"
          description="Are you sure you want to delete this draft? This cannot be undone."
          confirmText="Delete"
          variant="destructive"
          isLoading={deleteDraftApplication.isPending}
          onConfirm={async () => {
            await deleteDraftApplication.mutateAsync(application.id);
            toast.success("Draft application deleted");
            router.push("/applications");
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName, issuerContentMaxWidthClassName)}>
      {activeOrganization?.type === "COMPANY" && dsOnboardingPending ? (
        <DirectorShareholderAlertCard
          visiblePeople={visiblePeopleForDsGating}
          enabled={activeOrganization.onboardingStatus === "COMPLETED"}
          stickyTop
          className="mb-4"
        />
      ) : null}

      <DetailHeader
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-1.5">
            <Link href="/applications" className="hover:text-foreground hover:underline">
              Applications
            </Link>
            <span aria-hidden>›</span>
            <span className="text-foreground">{displayId}</span>
          </nav>
        }
        title={`Application ${displayId}`}
        status={
          <StatusBadge
            label={statusLabel}
            status={badgeKeyToStatusToken(application.cardStatus.badgeKey)}
          />
        }
        facts={
          <span>
            {application.customer}
            {application.type !== "Generic" ? ` · ${application.type}` : ""}
            {application.submittedAt
              ? ` · submitted ${format(new Date(application.submittedAt), "d MMM yyyy")}`
              : ""}
          </span>
        }
        actions={
          <>
            {application.cardStatus.showReviewOffer && hasOffer ? (
              <div className="rounded-xl bg-status-action-bg p-0.5">
                <Button className="rounded-xl" onClick={() => setTab("offer")}>
                  Review offer
                </Button>
              </div>
            ) : null}
            {application.cardStatus.showMakeAmendments ? (
              <div className="rounded-xl bg-status-action-bg p-0.5">
                <Button className="rounded-xl" asChild>
                  <Link href={`/applications/${application.id}/edit`}>Make amendments</Link>
                </Button>
              </div>
            ) : null}
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={withdrawDisabled}
              onClick={() => setWithdrawAppOpen(true)}
            >
              Withdraw
            </Button>
            {withdrawDisabled && showViewSignedContract ? (
              <p className="basis-full text-[13px] leading-5 text-muted-foreground sm:basis-auto sm:max-w-[16rem]">
                Withdraw is not available while a signed offer letter is on file.
              </p>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  aria-label="More actions"
                >
                  <EllipsisVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                {showViewSignedContract ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() =>
                      void handleDocumentDownload(application.signedContractOfferLetterS3Key!)
                    }
                  >
                    View signed offer
                  </DropdownMenuItem>
                ) : null}
                {hasOffer ? (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => setTab("offer")}>
                    Open offer
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem className="cursor-pointer" onClick={() => setTab("documents")}>
                  View documents
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link href="/applications">Back to applications</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if (isDetailTab(v)) setTab(v);
        }}
        className="mt-6"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          <TabsTrigger value="summary" className="rounded-lg">
            Summary
          </TabsTrigger>
          {hasOffer ? (
            <TabsTrigger value="offer" className="gap-1.5 rounded-lg">
              Offer
              {pendingOfferCount > 0 ? (
                <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                  {pendingOfferCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="invoices" className="gap-1.5 rounded-lg">
            Invoices
            {invoicesNeedingAction > 0 ? (
              <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                {invoicesNeedingAction}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-lg">
            Documents
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-lg">
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Application summary</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValueGrid
                items={[
                  ...(hasContract && application.contractTitle
                    ? [{ label: "Contract title", value: application.contractTitle }]
                    : []),
                  { label: "Customer", value: application.customer },
                  {
                    label: "Contract value",
                    value:
                      application.contractValue != null
                        ? formatCurrency(application.contractValue)
                        : "—",
                  },
                  {
                    label: "Financing applied",
                    value:
                      application.facilityApplied != null
                        ? formatCurrency(application.facilityApplied)
                        : "—",
                  },
                  {
                    label: "Approved facility",
                    value:
                      application.approvedFacilityAmount != null
                        ? application.approvedFacility
                        : "—",
                  },
                  {
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        Facility fee rate
                        <InfoTooltip
                          content="Facility fee is deducted from each invoice financing disbursement under this contract."
                          iconClassName="h-3.5 w-3.5 shrink-0"
                        />
                      </span>
                    ),
                    value:
                      application.approvedFacilityAmount != null &&
                      application.facilityFeeRatePercent != null &&
                      application.facilityFeeRatePercent > 0
                        ? `${application.facilityFeeRatePercent}%`
                        : "—",
                  },
                  {
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        Facility fee cap
                        <InfoTooltip
                          content="Maximum total facility fee that can be collected for this contract."
                          iconClassName="h-3.5 w-3.5 shrink-0"
                        />
                      </span>
                    ),
                    value:
                      application.approvedFacilityAmount != null &&
                      application.facilityFeeCapAmount != null
                        ? formatCurrency(application.facilityFeeCapAmount)
                        : "—",
                  },
                  {
                    label: "Submitted",
                    value: application.submittedAt
                      ? format(new Date(application.submittedAt), "d MMM yyyy, h:mm a")
                      : "—",
                  },
                  {
                    label: "Last updated",
                    value: format(new Date(application.updatedAt), "d MMM yyyy, h:mm a"),
                  },
                ]}
              />
              {application.contractId ? (
                <div className="mt-4">
                  <Button variant="link" className="h-auto px-0" asChild>
                    <Link href={`/financing/contracts/${application.contractId}`}>
                      View contract in Financing
                    </Link>
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {hasOffer ? (
          <TabsContent value="offer" className="mt-6">
            {(() => {
              const reviewableInvoices = application.invoices.filter((i) => i.canReviewOffer);
              const showOfferSwitcher = pendingOfferCount > 1;
              const offerPanel =
                (offerType === "contract" && canShowContractOfferPanel) ||
                (offerType === "invoice" && canShowInvoiceOfferPanel) ? (
                  <OfferReviewPanel
                    key={offerPanelKey}
                    mode="inline"
                    type={offerType}
                    applicationId={application.id}
                    issuerOrganizationId={application.issuerOrganizationId}
                    contractId={
                      offerType === "contract"
                        ? application.contractId ?? undefined
                        : offerInvoice?.contractId ?? application.contractId ?? undefined
                    }
                    invoice={offerType === "invoice" ? offerInvoice : undefined}
                    requiresInvoiceSigning
                    className={showOfferSwitcher ? "mx-0 max-w-none" : undefined}
                    onClose={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ["application", applicationId],
                      });
                      void queryClient.invalidateQueries({ queryKey: ["applications"] });
                    }}
                  />
                ) : showStaleOfferUnavailable ? (
                  <EmptyState
                    variant="no-data"
                    className="bg-card"
                    title="This offer is no longer available"
                    message="The selected offer may have already been accepted, declined, or expired."
                  />
                ) : showViewSignedContract ||
                  application.invoices.some((i) => i.signedOfferLetterAvailable) ? (
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-xl sm:text-2xl">Signed offer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[15px] leading-6 text-muted-foreground">
                        There is no offer waiting for a response. You can download signed offer
                        letters from Documents.
                      </p>
                      <Button className="mt-4 rounded-xl" onClick={() => setTab("documents")}>
                        Go to documents
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <EmptyState
                    variant="no-data"
                    className="bg-card"
                    title="No offer to review"
                    message="When CashSouk sends an offer, you can review and respond here."
                  />
                );

              if (!showOfferSwitcher) {
                return offerPanel;
              }

              const contractSelected = offerType === "contract";

              return (
                <div className="grid gap-4 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)] lg:items-start">
                  <aside className="rounded-2xl border border-border bg-card p-2 shadow-sm">
                    <p className="px-3 pb-2 pt-1 text-[13px] font-medium text-muted-foreground">
                      Offers to review
                    </p>
                    <nav className="flex flex-col gap-1" aria-label="Select offer">
                      {application.contractStatus === "OFFER_SENT" ? (
                        <button
                          type="button"
                          onClick={() => selectOfferInvoice(null)}
                          className={cn(
                            "rounded-xl px-3 py-3 text-left transition-colors",
                            contractSelected
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted/60"
                          )}
                          aria-current={contractSelected ? "true" : undefined}
                        >
                          <span className="block text-sm font-semibold">Contract offer</span>
                          <span
                            className={cn(
                              "mt-0.5 block text-[13px] leading-5",
                              contractSelected ? "text-primary/80" : "text-muted-foreground"
                            )}
                          >
                            Facility financing
                          </span>
                        </button>
                      ) : null}
                      {reviewableInvoices.map((inv) => {
                        const selected = selectedOfferInvoice?.id === inv.id;
                        return (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => selectOfferInvoice(inv)}
                            className={cn(
                              "rounded-xl px-3 py-3 text-left transition-colors",
                              selected
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-muted/60"
                            )}
                            aria-current={selected ? "true" : undefined}
                          >
                            <span className="block text-sm font-semibold">
                              Invoice {inv.number}
                            </span>
                            <span
                              className={cn(
                                "mt-0.5 block text-[13px] leading-5",
                                selected ? "text-primary/80" : "text-muted-foreground"
                              )}
                            >
                              {inv.appliedFinancing != null
                                ? formatCurrency(inv.appliedFinancing)
                                : "Invoice financing"}
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </aside>
                  <div className="min-w-0">{offerPanel}</div>
                </div>
              );
            })()}
          </TabsContent>
        ) : null}

        <TabsContent value="invoices" className="mt-6 min-w-0">
          {application.invoices.length === 0 ? (
            <EmptyState
              variant="no-data"
              className="bg-card"
              title="No invoices"
              message="Invoices linked to this application will appear here."
            />
          ) : (
            <Card className="min-w-0 overflow-hidden rounded-2xl">
              <CardContent className="p-0 pt-0">
                <ScrollableInvoiceTable
                  application={application}
                  onDocumentDownload={handleDocumentDownload}
                  onViewSignedInvoiceOffer={handleDocumentDownload}
                  onWithdrawInvoice={(invoiceId, appId, organizationId) => {
                    setWithdrawInvoicePayload({ invoiceId, applicationId: appId, organizationId });
                  }}
                  isWithdrawInvoicePending={withdrawInvoice.isPending}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          {documents.length === 0 ? (
            <EmptyState
              variant="no-data"
              className="bg-card"
              title="No documents yet"
              message="Uploaded invoices, supporting files, and signed offers will show here."
            />
          ) : (
            <Card className="overflow-hidden rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">Documents</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border border-t border-border">
                  {documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium text-foreground">
                          {doc.name}
                        </p>
                        <p className="text-[13px] text-muted-foreground">{doc.source}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => void handleDocumentDownload(doc.s3Key)}
                      >
                        <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          {logsLoading ? (
            <Card className="rounded-2xl">
              <CardContent className="py-6">
                <LoadingState variant="list" />
              </CardContent>
            </Card>
          ) : timeline.length === 0 ? (
            <EmptyState
              variant="no-data"
              className="bg-card"
              title="No timeline events yet"
              message="Updates will appear here as this application moves forward."
            />
          ) : (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-0">
                  {timeline.map((item, index) => {
                    const isLast = index === timeline.length - 1;
                    return (
                      <li key={item.id} className="flex gap-4">
                        <div className="relative flex w-3 shrink-0 flex-col items-center">
                          <span
                            className="mt-[0.4375rem] size-2.5 shrink-0 rounded-full bg-primary"
                            aria-hidden
                          />
                          {!isLast ? (
                            <span
                              className="mt-1 w-px flex-1 bg-border"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                        <div className={cn("min-w-0 flex-1", !isLast && "pb-6")}>
                          <p className="text-[15px] font-medium leading-6 text-foreground">
                            {item.label}
                          </p>
                          {item.description ? (
                            <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                              {item.description}
                            </p>
                          ) : null}
                          {item.at ? (
                            <p className="mt-1 text-[13px] text-muted-foreground">
                              {format(new Date(item.at), "d MMM yyyy, h:mm a")}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={withdrawAppOpen}
        onOpenChange={setWithdrawAppOpen}
        title="Withdraw application?"
        description="Are you sure you want to withdraw this application? This action cannot be undone."
        confirmText="Withdraw"
        variant="destructive"
        isLoading={cancelApplication.isPending}
        onConfirm={async () => {
          await cancelApplication.mutateAsync(application.id);
          toast.success("Application withdrawn");
          setWithdrawAppOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!withdrawInvoicePayload}
        onOpenChange={(open) => {
          if (!open) setWithdrawInvoicePayload(null);
        }}
        title="Withdraw invoice?"
        description="Are you sure you want to withdraw this invoice? This action cannot be undone."
        confirmText="Withdraw"
        variant="destructive"
        isLoading={withdrawInvoice.isPending}
        onConfirm={async () => {
          if (!withdrawInvoicePayload) return;
          await withdrawInvoice.mutateAsync(withdrawInvoicePayload);
          toast.success("Invoice withdrawn");
          setWithdrawInvoicePayload(null);
        }}
      />
    </div>
  );
}
