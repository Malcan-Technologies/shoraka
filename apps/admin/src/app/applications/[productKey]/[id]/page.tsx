"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@cashsouk/ui";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { useApplicationDetail } from "@/hooks/use-application-detail";
import {
  useReopenApplicationForCorrection,
  useUpdateApplicationStatus,
} from "@/hooks/use-update-application-status";
import {
  useApproveReviewSection,
  useRejectReviewSection,
  useResetSectionReviewToPending,
  useResetItemReviewToPending,
  useApproveReviewItem,
  useRejectReviewItem,
  useAddSectionComment,
  useAddPendingAmendment,
  useListPendingAmendments,
  useRemovePendingAmendment,
  useSubmitAmendmentRequest,
  useSendContractOffer,
  useSendInvoiceOffer,
} from "@/hooks/use-application-review-actions";
import {
  ApplicationReviewTabs,
  ApplicationReviewTabContent,
} from "@/components/application-review-tabs";
import { ApplicationReviewRemarkDialog } from "@/components/application-review-remark-dialog";
import {
  SectionContent,
  ReviewSummaryCard,
  RecentActivityCard,
  AmendmentReviewModal,
  type ReviewSectionId,
} from "@/components/application-review";
import { useProducts } from "@/hooks/use-products";
import { productName } from "@/app/settings/products/product-utils";
import {
  getReviewTabDescriptorsFromWorkflow,
  getReviewTabLabel,
  getTabUnlockTooltip,
  isTabUnlocked,
} from "@/components/application-review/review-registry";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency, useAuthToken } from "@cashsouk/config";
import { ApplicationStatusBadge } from "@/components/application-review";

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export default function DynamicApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productKey = params.productKey as string;
  const applicationId = params.id as string;

  const { data: app, isLoading, error } = useApplicationDetail(applicationId);
  const updateStatus = useUpdateApplicationStatus();
  const reopenForCorrection = useReopenApplicationForCorrection();

  // Fetch products to get the current product name
  const { data: productsData } = useProducts({ page: 1, pageSize: 100 });
  const currentProduct = productsData?.products.find(p => p.id === productKey);
  const currentProductName = currentProduct ? productName(currentProduct) : "Applications";

  const invoiceRatioLimits = React.useMemo(() => {
    const workflow = (currentProduct as { workflow?: { id?: string; config?: Record<string, unknown> }[] })?.workflow ?? [];
    const invoiceStep = workflow.find(
      (s: { id?: string; name?: string }) =>
        s.id?.includes?.("invoice_details") || s.name?.toLowerCase?.().includes?.("invoice")
    );
    const config = invoiceStep?.config ?? {};
    const min = typeof config.min_financing_ratio_percent === "number" ? config.min_financing_ratio_percent : 60;
    const max = typeof config.max_financing_ratio_percent === "number" ? config.max_financing_ratio_percent : 80;
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }, [currentProduct]);

  const offerExpiryDays =
    (currentProduct as { offer_expiry_days?: number | null })?.offer_expiry_days ?? 7;

  const [confirmAction, setConfirmAction] = React.useState<{
    type: "APPROVE" | "REJECT";
    isOpen: boolean;
  }>({ type: "APPROVE", isOpen: false });

  const approveSection = useApproveReviewSection();
  const rejectSection = useRejectReviewSection();
  const resetSectionToPending = useResetSectionReviewToPending();
  const resetItemToPending = useResetItemReviewToPending();
  const addPendingAmendment = useAddPendingAmendment();
  const approveItem = useApproveReviewItem();
  const rejectItem = useRejectReviewItem();
  const addSectionComment = useAddSectionComment();
  const { data: pendingAmendments = [] } = useListPendingAmendments(applicationId);
  const removePendingAmendment = useRemovePendingAmendment();
  const submitAmendmentRequest = useSubmitAmendmentRequest();
  const sendContractOffer = useSendContractOffer();
  const sendInvoiceOffer = useSendInvoiceOffer();
  const [amendmentModalOpen, setAmendmentModalOpen] = React.useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = React.useState(false);

  const [noteDialog, setNoteDialog] = React.useState<
    | { open: boolean; action: "reject" | "amend"; section: ReviewSectionId }
    | { open: boolean; action: "reject" | "amend"; itemType: "invoice" | "document"; itemId: string }
    | { open: boolean; action: "approve"; section: ReviewSectionId }
    | { open: boolean; action: "approve"; itemType: "invoice" | "document"; itemId: string }
  >({ open: false, action: "reject", section: "financial" });

  const REVIEWABLE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED", "AMENDMENT_REQUESTED"];
  const isReviewable = !!app && REVIEWABLE_STATUSES.includes(app.status);
  const { getAccessToken } = useAuthToken();
  const [viewDocumentPending, setViewDocumentPending] = React.useState(false);

  const handleViewDocument = React.useCallback(
    async (s3Key: string) => {
      try {
        setViewDocumentPending(true);
        const token = await getAccessToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiUrl}/v1/s3/view-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ s3Key }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error?.message || "Failed to get view URL");
        const viewUrl = result.data?.viewUrl;
        if (viewUrl) window.open(viewUrl, "_blank", "noopener,noreferrer");
        else toast.error("Failed to open document");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open document");
      } finally {
        setViewDocumentPending(false);
      }
    },
    [getAccessToken]
  );

  const tabDescriptors = React.useMemo(
    () => getReviewTabDescriptorsFromWorkflow(currentProduct?.workflow),
    [currentProduct?.workflow]
  );

  const isExistingContract = React.useMemo(
    () =>
      (app?.financing_structure as { structure_type?: string } | undefined)?.structure_type ===
      "existing_contract",
    [app?.financing_structure]
  );

  const reviewSections = React.useMemo(() => {
    const reviewItems =
      (app?.application_review_items as { item_type: string; item_id: string; status: string }[]) ?? [];
    const reviewSectionStatuses =
      (app?.application_reviews as { section: string; status: string }[] | undefined) ?? [];
    const reviewSectionStatusMap = new Map<string, string>();
    for (const review of reviewSectionStatuses) {
      reviewSectionStatusMap.set(review.section, review.status);
    }
    const orderedSections: string[] = tabDescriptors.map((d) => d.reviewSection);
    for (const review of reviewSectionStatuses) {
      if (!orderedSections.includes(review.section)) {
        orderedSections.push(review.section);
      }
    }
    const baseSections = orderedSections.map((section) => {
      let status = reviewSectionStatusMap.get(section) ?? "PENDING";
      if (section === "contract_details" && isExistingContract) {
        status = "APPROVED";
      }
      return { section, status };
    });

    const sectionWithAmendmentFromItems = new Set<string>();
    for (const item of reviewItems) {
      if (item.status === "AMENDMENT_REQUESTED") {
        const section =
          item.item_type === "invoice" ? "invoice_details" : "supporting_documents";
        sectionWithAmendmentFromItems.add(section);
      }
    }

    return baseSections.map((s) => {
      const fromItems = sectionWithAmendmentFromItems.has(s.section);
      const status =
        s.status === "APPROVED" || s.status === "REJECTED"
          ? s.status
          : fromItems
            ? "AMENDMENT_REQUESTED"
            : s.status;
      return { section: s.section, status };
    });
  }, [app?.application_reviews, app?.application_review_items, tabDescriptors, isExistingContract]);

  const sectionStatusMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of reviewSections) {
      m.set(s.section, s.status);
    }
    return m;
  }, [reviewSections]);
  const requiredReviewSections = React.useMemo(() => {
    const fromApi = (app as { required_review_sections?: unknown } | undefined)?.required_review_sections;
    if (Array.isArray(fromApi)) {
      const normalized = fromApi.filter((s): s is string => typeof s === "string");
      if (normalized.length > 0) return normalized;
    }
    return tabDescriptors.map((d) => d.reviewSection);
  }, [app, tabDescriptors]);
  const allSectionsApproved = React.useMemo(
    () =>
      requiredReviewSections.length > 0 &&
      requiredReviewSections.every((section) => sectionStatusMap.get(section) === "APPROVED"),
    [requiredReviewSections, sectionStatusMap]
  );

  const hasRejectedSection = React.useMemo(
    () => requiredReviewSections.some((section) => sectionStatusMap.get(section) === "REJECTED"),
    [requiredReviewSections, sectionStatusMap]
  );
  const availableReviewSections = React.useMemo(
    () => new Set(tabDescriptors.map((d) => d.reviewSection)),
    [tabDescriptors]
  );

  const handleApproveSection = (section: string) => {
    setNoteDialog({ open: true, action: "approve", section: section as ReviewSectionId });
  };

  const handleRejectItem = async (remark: string) => {
    const d = noteDialog;
    if (!d || !("itemType" in d)) return;
    try {
      await rejectItem.mutateAsync({
        applicationId,
        itemType: d.itemType,
        itemId: d.itemId,
        remark,
      });
      toast.success("Item rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
      throw err;
    }
  };

  const handleAddPendingAmendmentItem = async (remark: string) => {
    const d = noteDialog;
    if (!d || !("itemType" in d)) return;
    try {
      await addPendingAmendment.mutateAsync({
        applicationId,
        scope: "item",
        remark,
        itemType: d.itemType,
        itemId: d.itemId,
      });
      toast.success("Added to amendment list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add amendment");
      throw err;
    }
  };

  const handleAddPendingAmendmentSection = async (remark: string) => {
    const d = noteDialog;
    if (!d || !("section" in d)) return;
    try {
      await addPendingAmendment.mutateAsync({
        applicationId,
        scope: "section",
        scopeKey: d.section,
        remark,
      });
      toast.success("Added to amendment list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add amendment");
      throw err;
    }
  };

  const handleNoteDialogConfirm = async (remark: string) => {
    const d = noteDialog;
    if (!d) return;
    if ("section" in d) {
      if (d.action === "approve") {
        try {
          await approveSection.mutateAsync({
            applicationId,
            section: d.section,
            remark: remark || undefined,
          });
          toast.success("Section approved");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to approve");
          throw err;
        }
      } else if (d.action === "reject") {
        await rejectSection.mutateAsync({ applicationId, section: d.section, remark });
        toast.success("Section rejected");
      } else {
        await handleAddPendingAmendmentSection(remark);
      }
    } else if ("itemType" in d) {
      if (d.action === "approve") {
        try {
          await approveItem.mutateAsync({
            applicationId,
            itemType: d.itemType,
            itemId: d.itemId,
            remark: remark || undefined,
          });
          toast.success("Item approved");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to approve");
          throw err;
        }
      } else if (d.action === "reject") {
        await handleRejectItem(remark);
      } else {
        await handleAddPendingAmendmentItem(remark);
      }
    }
  };

  const noteDialogIsSection = noteDialog && "section" in noteDialog;
  const noteDialogIsApprove = noteDialog?.action === "approve";
  const sectionLabel = noteDialogIsSection ? getReviewTabLabel(noteDialog.section) : "";
  const noteDialogTitle = noteDialogIsApprove
    ? noteDialogIsSection
      ? `Approve ${sectionLabel}?`
      : "Approve item?"
    : noteDialogIsSection
      ? noteDialog.action === "reject"
        ? `Reject ${sectionLabel}?`
        : `Request Amendment for ${sectionLabel}?`
      : noteDialog?.action === "reject"
        ? "Reject item?"
        : "Request amendment?";
  const noteDialogDescription = noteDialogIsApprove
    ? "Add an optional remark to record your review decision."
    : noteDialogIsSection
      ? noteDialog.action === "reject"
        ? "This will reject the section. A remark is required."
        : "Add this section to the amendment list. A remark is required. Use the Request Amendment button to review and send all amendments."
      : "Add this item to the amendment list. A remark is required. Use the Request Amendment button to review and send all amendments.";
  const noteDialogSubmitLabel = noteDialogIsApprove
    ? "Approve"
    : noteDialog?.action === "reject"
      ? "Reject"
      : "Add to List";
  const noteDialogPending =
    approveSection.isPending ||
    approveItem.isPending ||
    rejectSection.isPending ||
    addPendingAmendment.isPending ||
    rejectItem.isPending;

  const handleUpdateStatus = async (status: string) => {
    try {
      await updateStatus.mutateAsync({ id: applicationId, status });
      toast.success(`Application ${status.toLowerCase()} successfully`);
      setConfirmAction((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const requestedAmount = React.useMemo(() => {
    if (!app) return 0;
    if (app.invoices && app.invoices.length > 0) {
      return (app.invoices as { details?: Record<string, unknown> }[]).reduce(
        (sum: number, inv) => {
          const details = inv.details as Record<string, unknown> | undefined;
          const invoiceValue = parseFloat(String(details?.value ?? 0));
          const financingRatio = parseFloat(String(details?.financing_ratio_percent ?? 80));
          return sum + (invoiceValue * financingRatio) / 100;
        },
        0
      );
    }
    if (app.contract?.contract_details) {
      const cd = app.contract.contract_details as Record<string, unknown>;
      return parseFloat(String(cd?.value ?? cd?.approved_facility ?? 0));
    }
    return 0;
  }, [app]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/applications/${productKey}`)}
          className="gap-1.5 -ml-1"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {currentProductName}
        </Button>
        <Separator orientation="vertical" className="mx-2 h-4" />
        <h1 className="text-lg font-semibold truncate">
          {isLoading ? "Loading..." : `Application ${applicationId.slice(-8).toUpperCase()}`}
        </h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-4 md:px-6 lg:px-8 py-10 md:py-12 space-y-6">
          {isLoading && <PageSkeleton />}

          {error && (
            <div className="py-8 text-center text-destructive">
              Error loading application:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          {app && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Requested Facility
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(requestedAmount)}
                      </div>
                    </div>
                    <ApplicationStatusBadge status={app.status} size="lg" />
                  </div>
                  {isReviewable ? (
                    <TooltipProvider>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {app.status === "AMENDMENT_REQUESTED" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="outline"
                                  size="default"
                                  className="gap-2"
                                  onClick={async () => {
                                    try {
                                      await updateStatus.mutateAsync({ id: applicationId, status: "UNDER_REVIEW" });
                                      toast.success("Application reset to under review");
                                    } catch (err) {
                                      toast.error(err instanceof Error ? err.message : "Failed to reset status");
                                    }
                                  }}
                                >
                                  <ArrowPathIcon className="h-4 w-4" />
                                  Reset to Under Review
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
                              Clear application status so it can be reviewed again
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={app.status === "AMENDMENT_REQUESTED" || pendingAmendments.length === 0 ? "inline-flex cursor-not-allowed" : "inline-flex"}>
                              <Button
                                variant="outline"
                                size="default"
                                className="gap-2 border-amber-500/30 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
                                disabled={app.status === "AMENDMENT_REQUESTED" || pendingAmendments.length === 0}
                                onClick={() => setAmendmentModalOpen(true)}
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                                Request Amendment
                                {pendingAmendments.length > 0 && (
                                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                                    {pendingAmendments.length}
                                  </Badge>
                                )}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
                            {app.status === "AMENDMENT_REQUESTED"
                              ? "Amendment already requested; issuer must respond first"
                              : pendingAmendments.length === 0
                                ? "Request amendment on at least one section first"
                                : "Review and send amendment request to issuer"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={app.status === "REJECTED" || allSectionsApproved || !hasRejectedSection ? "inline-flex cursor-not-allowed" : "inline-flex"}>
                              <Button
                                variant="outline"
                                size="default"
                                className="gap-2 border-red-500/30 bg-red-500/10 text-red-800 hover:bg-red-500/20 hover:text-red-900 dark:text-red-200 dark:hover:text-red-100"
                                disabled={app.status === "REJECTED" || allSectionsApproved || !hasRejectedSection}
                                onClick={() => setConfirmAction({ type: "REJECT", isOpen: true })}
                              >
                                <XCircleIcon className="h-4 w-4" />
                                Reject
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
                            {app.status === "REJECTED"
                              ? "Application already rejected"
                              : allSectionsApproved
                                ? "Cannot reject when all sections are approved"
                                : !hasRejectedSection
                                  ? "Reject at least one section first"
                                  : "Reject the application and notify the issuer"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={app.status === "APPROVED" || !allSectionsApproved ? "inline-flex cursor-not-allowed" : "inline-flex"}>
                              <Button
                                variant="outline"
                                size="default"
                                className="gap-2 border-green-500/30 bg-green-500/10 text-green-800 hover:bg-green-500/20 hover:text-green-900 dark:text-green-200 dark:hover:text-green-100"
                                disabled={app.status === "APPROVED" || !allSectionsApproved}
                                onClick={() => setConfirmAction({ type: "APPROVE", isOpen: true })}
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                                Approve
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
                            {app.status === "APPROVED"
                              ? "Application already approved"
                              : !allSectionsApproved
                                ? "Approve all sections first"
                                : "Approve the application and move to the next stage"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-sm text-muted-foreground">
                        Review actions are locked for{" "}
                        <span className="font-medium">
                          {app.status.toLowerCase().replace(/_/g, " ")}
                        </span>{" "}
                        applications.
                      </div>
                      {(app.status === "APPROVED" || app.status === "REJECTED") && (
                        <Button
                          variant="outline"
                          size="default"
                          className="gap-2"
                          onClick={() => setReopenDialogOpen(true)}
                        >
                          <ArrowPathIcon className="h-4 w-4" />
                          Reopen for Correction
                        </Button>
                      )}
                    </div>
                  )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(240px,300px)] xl:grid-cols-[1fr_minmax(260px,320px)] gap-6">
                <div className="min-w-0 space-y-6">
                  <Card className="rounded-2xl">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Organization</div>
                        <div className="text-sm font-medium">{app.issuer_organization.name}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Owner</div>
                        <div className="text-sm font-medium">
                          {app.issuer_organization.owner.first_name} {app.issuer_organization.owner.last_name}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Email</div>
                        <div className="text-sm font-medium">{app.issuer_organization.owner.email}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Reference</div>
                        <div className="text-sm font-medium">{app.id}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Submitted At</div>
                        <div className="text-sm font-medium">
                          {app.submitted_at ? format(new Date(app.submitted_at), "PPP p") : "Not submitted"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Last Updated</div>
                        <div className="text-sm font-medium">{format(new Date(app.updated_at), "PPP p")}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <ApplicationReviewTabs
                  sections={reviewSections}
                  tabDescriptors={tabDescriptors}
                  defaultTabId={tabDescriptors[0]?.id}
                >
                  {tabDescriptors.map((descriptor) => {
                    const isContractExistingContract =
                      descriptor.reviewSection === "contract_details" && isExistingContract;
                    const actionLocked = isContractExistingContract
                      ? true
                      : !isTabUnlocked(
                          descriptor.reviewSection,
                          sectionStatusMap,
                          availableReviewSections
                        );
                    const actionLockTooltip = actionLocked
                      ? isContractExistingContract
                        ? "Contract was approved in a prior application"
                        : getTabUnlockTooltip(
                            descriptor.reviewSection,
                            sectionStatusMap,
                            availableReviewSections
                          )
                      : undefined;
                    const sectionStatus = sectionStatusMap.get(descriptor.reviewSection);
                    return (
                    <ApplicationReviewTabContent key={descriptor.id} value={descriptor.id}>
                      <SectionContent
                        descriptor={descriptor}
                        app={app}
                        isReviewable={isReviewable}
                        approveSectionPending={approveSection.isPending}
                        approveItemPending={approveItem.isPending}
                        viewDocumentPending={viewDocumentPending}
                        isActionLocked={actionLocked}
                        actionLockTooltip={actionLockTooltip}
                        sectionStatus={sectionStatus}
                        onResetSectionToPending={async (section) => {
                          try {
                            await resetSectionToPending.mutateAsync({ applicationId, section });
                            toast.success("Section reset to pending");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to reset section");
                          }
                        }}
                        onApproveSection={handleApproveSection}
                        onRejectSection={(s) => setNoteDialog({ open: true, action: "reject", section: s })}
                        onRequestAmendmentSection={(s) => setNoteDialog({ open: true, action: "amend", section: s })}
                        onViewDocument={handleViewDocument}
                        onApproveItem={async (itemId, itemType) => {
                          setNoteDialog({
                            open: true,
                            action: "approve",
                            itemType,
                            itemId,
                          });
                        }}
                        onRejectItem={(itemId, itemType) =>
                          setNoteDialog({
                            open: true,
                            action: "reject",
                            itemType,
                            itemId,
                          })
                        }
                        onRequestAmendmentItem={(itemId, itemType) =>
                          setNoteDialog({
                            open: true,
                            action: "amend",
                            itemType,
                            itemId,
                          })
                        }
                        onResetItemToPending={async (itemId, itemType) => {
                          try {
                            await resetItemToPending.mutateAsync({ applicationId, itemType, itemId });
                            toast.success("Item reset to pending");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to reset item");
                          }
                        }}
                        onAddSectionComment={async (section, comment) => {
                          await addSectionComment.mutateAsync({
                            applicationId,
                            section,
                            comment,
                          });
                          toast.success("Comment posted");
                        }}
                        onSendContractOffer={async ({ offeredFacility }) => {
                          try {
                            const expiresAt = addDays(new Date(), offerExpiryDays).toISOString();
                            await sendContractOffer.mutateAsync({
                              applicationId,
                              offeredFacility,
                              expiresAt,
                            });
                            toast.success("Contract offer sent");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to send contract offer");
                          }
                        }}
                        onSendInvoiceOffer={async ({
                          invoiceId,
                          offeredAmount,
                          offeredRatioPercent,
                          offeredProfitRatePercent,
                        }) => {
                          try {
                            const expiresAt = addDays(new Date(), offerExpiryDays).toISOString();
                            await sendInvoiceOffer.mutateAsync({
                              applicationId,
                              invoiceId,
                              offeredAmount,
                              offeredRatioPercent,
                              offeredProfitRatePercent,
                              expiresAt,
                            });
                            toast.success("Invoice offer sent");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to send invoice offer");
                          }
                        }}
                        sendContractOfferPending={sendContractOffer.isPending}
                        sendInvoiceOfferPending={sendInvoiceOffer.isPending}
                        invoiceRatioLimits={invoiceRatioLimits}
                        offerExpiryDays={offerExpiryDays}
                      />
                    </ApplicationReviewTabContent>
                  );
                  })}
                </ApplicationReviewTabs>
              </div>

              <div className="min-w-0 space-y-6">
                <ReviewSummaryCard
                  sections={reviewSections}
                  reviewItems={(app.application_review_items as { item_type: string; item_id: string; status: string }[]) ?? []}
                />

                <RecentActivityCard
                  events={(app.application_review_events as { event_type: string; scope_key: string | null; new_status: string; remark: string | null; created_at: string }[]) ?? []}
                  remarks={(app.application_review_remarks as { scope_key: string; action_type: string; remark: string; created_at: string }[]) ?? []}
                  applicationId={applicationId}
                />
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      <ApplicationReviewRemarkDialog
        open={noteDialog.open}
        onOpenChange={(open) =>
          setNoteDialog((prev) =>
            prev ? { ...prev, open } : { open: false, action: "reject", section: "financial" }
          )
        }
        title={noteDialogTitle}
        description={noteDialogDescription}
        submitLabel={noteDialogSubmitLabel}
        variant={noteDialog?.action === "reject" ? "destructive" : "default"}
        optional={noteDialog?.action === "approve"}
        onConfirm={handleNoteDialogConfirm}
        isPending={noteDialogPending}
      />

      <ApplicationReviewRemarkDialog
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        title="Reopen Application for Correction"
        description="Provide a reason for reopening this application. This reason is recorded in the activity log."
        remarkLabel="Correction reason (required)"
        remarkPlaceholder="Explain why this approved/rejected application needs to be reopened."
        submitLabel="Reopen Application"
        variant="default"
        onConfirm={async (reason) => {
          await reopenForCorrection.mutateAsync({ id: applicationId, reason });
          toast.success("Application reopened for correction");
        }}
        isPending={reopenForCorrection.isPending}
      />

      <AmendmentReviewModal
        open={amendmentModalOpen}
        onOpenChange={setAmendmentModalOpen}
        items={pendingAmendments}
        onRemove={async (scope, scopeKey) => {
          await removePendingAmendment.mutateAsync({ applicationId, scope, scopeKey });
        }}
        onSubmit={async () => {
          await submitAmendmentRequest.mutateAsync({ applicationId });
          toast.success("Amendment request sent to issuer");
          setAmendmentModalOpen(false);
        }}
        isRemovePending={removePendingAmendment.isPending}
        isSubmitPending={submitAmendmentRequest.isPending}
      />

      <AlertDialog open={confirmAction.isOpen} onOpenChange={(open) => setConfirmAction((prev) => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction.type === "APPROVE" ? "Approve Application?" : "Reject Application?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.type === "APPROVE"
                ? "This will approve the financing application and move it to the next stage in the workflow."
                : "This will reject the application. The issuer will be notified and will need to submit a new application."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={`rounded-xl ${
                confirmAction.type === "APPROVE"
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }`}
              onClick={() => handleUpdateStatus(confirmAction.type === "APPROVE" ? "APPROVED" : "REJECTED")}
            >
              Confirm {confirmAction.type === "APPROVE" ? "Approval" : "Rejection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
