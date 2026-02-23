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
import { useUpdateApplicationStatus } from "@/hooks/use-update-application-status";
import {
  useApproveReviewSection,
  useRejectReviewSection,
  useRequestAmendmentReviewSection,
  useApproveReviewItem,
  useRejectReviewItem,
  useRequestAmendmentReviewItem,
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
  getSectionsInOrder,
  type ReviewSectionId,
} from "@/components/application-review";
import { useProducts } from "@/hooks/use-products";
import { productName, getVisibleSectionIdsFromWorkflow } from "@/app/settings/products/product-utils";
import { format } from "date-fns";
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
import {
  CheckCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency, useAuthToken } from "@cashsouk/config";

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

  // Fetch products to get the current product name
  const { data: productsData } = useProducts({ page: 1, pageSize: 100 });
  const currentProduct = productsData?.products.find(p => p.id === productKey);
  const currentProductName = currentProduct ? productName(currentProduct) : "Applications";

  const [confirmAction, setConfirmAction] = React.useState<{
    type: "APPROVE" | "REJECT";
    isOpen: boolean;
  }>({ type: "APPROVE", isOpen: false });

  const approveSection = useApproveReviewSection();
  const rejectSection = useRejectReviewSection();
  const requestAmendment = useRequestAmendmentReviewSection();
  const approveItem = useApproveReviewItem();
  const rejectItem = useRejectReviewItem();
  const requestAmendmentItem = useRequestAmendmentReviewItem();

  const [noteDialog, setNoteDialog] = React.useState<
    | { open: boolean; action: "reject" | "amend"; section: ReviewSectionId }
    | { open: boolean; action: "reject" | "amend"; itemType: "INVOICE" | "DOCUMENT"; itemId: string }
    | { open: boolean; action: "approve"; section: ReviewSectionId }
    | { open: boolean; action: "approve"; itemType: "INVOICE" | "DOCUMENT"; itemId: string }
  >({ open: false, action: "reject", section: "FINANCIAL" });

  const REVIEWABLE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED", "AMENDMENT_REQUESTED", "REJECTED", "APPROVED"];
  const isReviewable = app && REVIEWABLE_STATUSES.includes(app.status);
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

  const visibleSectionIds = React.useMemo(
    () => getVisibleSectionIdsFromWorkflow(currentProduct?.workflow),
    [currentProduct?.workflow]
  );

  const reviewSections = React.useMemo(() => {
    if (!app?.application_reviews?.length) {
      return [
        { section: "FINANCIAL", status: "PENDING" },
        { section: "JUSTIFICATION", status: "PENDING" },
        { section: "DOCUMENTS", status: "PENDING" },
      ];
    }
    return (app.application_reviews as { section: string; status: string }[]).map((r) => ({
      section: r.section,
      status: r.status,
    }));
  }, [app?.application_reviews]);

  const allSectionsApproved = React.useMemo(
    () =>
      reviewSections.length > 0 && reviewSections.every((s) => s.status === "APPROVED"),
    [reviewSections]
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

  const handleRequestAmendmentItem = async (remark: string) => {
    const d = noteDialog;
    if (!d || !("itemType" in d)) return;
    try {
      await requestAmendmentItem.mutateAsync({
        applicationId,
        itemType: d.itemType,
        itemId: d.itemId,
        remark,
      });
      toast.success("Amendment requested");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request amendment");
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
        await requestAmendment.mutateAsync({
          applicationId,
          section: d.section,
          remark,
        });
        toast.success("Amendment requested");
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
        await handleRequestAmendmentItem(remark);
      }
    }
  };

  const noteDialogIsSection = noteDialog && "section" in noteDialog;
  const noteDialogIsApprove = noteDialog?.action === "approve";
  const noteDialogTitle = noteDialogIsApprove
    ? noteDialogIsSection
      ? `Approve ${noteDialog.section}?`
      : "Approve item?"
    : noteDialogIsSection
      ? noteDialog.action === "reject"
        ? `Reject ${noteDialog.section}?`
        : `Request Amendment for ${noteDialog.section}?`
      : noteDialog?.action === "reject"
        ? "Reject item?"
        : "Request amendment?";
  const noteDialogDescription = noteDialogIsApprove
    ? "Add an optional remark to record your review decision."
    : noteDialogIsSection
      ? noteDialog.action === "reject"
        ? "This will reject the section. A remark is required."
        : "Request changes from the issuer. A remark is required."
      : "A remark is required for this action.";
  const noteDialogSubmitLabel = noteDialogIsApprove
    ? "Approve"
    : noteDialog?.action === "reject"
      ? "Reject"
      : "Send Amendment Request";
  const noteDialogPending =
    approveSection.isPending ||
    approveItem.isPending ||
    rejectSection.isPending ||
    requestAmendment.isPending ||
    rejectItem.isPending ||
    requestAmendmentItem.isPending;

  const handleUpdateStatus = async (status: string) => {
    try {
      await updateStatus.mutateAsync({ id: applicationId, status });
      toast.success(`Application ${status.toLowerCase()} successfully`);
      setConfirmAction((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <Badge className="bg-primary text-primary-foreground">
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 mr-1" />
            Submitted for Review
          </Badge>
        );
      case "UNDER_REVIEW":
        return (
          <Badge variant="secondary">
            <ClockIcon className="h-3.5 w-3.5 mr-1" />
            Under Review
          </Badge>
        );
      case "AMENDMENT_REQUESTED":
        return (
          <Badge className="bg-accent text-accent-foreground">
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 mr-1" />
            Amendment Requested
          </Badge>
        );
      case "RESUBMITTED":
        return (
          <Badge className="bg-primary text-primary-foreground">
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 mr-1" />
            Resubmitted
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-primary text-primary-foreground">
            <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
            Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-destructive text-destructive-foreground">
            <XCircleIcon className="h-3.5 w-3.5 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <ClockIcon className="h-3.5 w-3.5 mr-1" />
            {status}
          </Badge>
        );
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
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              <div className="min-w-0 space-y-6">
                <Card className="rounded-2xl">
                  <CardContent className="pt-6 space-y-4">
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
                        {getStatusBadge(app.status)}
                      </div>
                    </div>

                    <Separator />

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
                  defaultSection={visibleSectionIds[0] ?? "FINANCIAL"}
                  visibleSectionIds={visibleSectionIds.length > 0 ? visibleSectionIds : undefined}
                >
                  {getSectionsInOrder(visibleSectionIds.length > 0 ? visibleSectionIds : undefined).map(({ id }) => (
                    <ApplicationReviewTabContent key={id} value={id}>
                      <SectionContent
                        sectionId={id}
                        app={app}
                        isReviewable={!!isReviewable}
                        approveSectionPending={approveSection.isPending}
                        approveItemPending={approveItem.isPending}
                        viewDocumentPending={viewDocumentPending}
                        onApproveSection={handleApproveSection}
                        onRejectSection={(s) => setNoteDialog({ open: true, action: "reject", section: s })}
                        onRequestAmendmentSection={(s) => setNoteDialog({ open: true, action: "amend", section: s })}
                        onViewDocument={handleViewDocument}
                        onApproveItem={async (itemId) => {
                          setNoteDialog({
                            open: true,
                            action: "approve",
                            itemType: "DOCUMENT",
                            itemId,
                          });
                        }}
                        onRejectItem={(itemId) =>
                          setNoteDialog({
                            open: true,
                            action: "reject",
                            itemType: "DOCUMENT",
                            itemId,
                          })
                        }
                        onRequestAmendmentItem={(itemId) =>
                          setNoteDialog({
                            open: true,
                            action: "amend",
                            itemType: "DOCUMENT",
                            itemId,
                          })
                        }
                      />
                    </ApplicationReviewTabContent>
                  ))}
                </ApplicationReviewTabs>
              </div>

              <div className="space-y-6">
                {isReviewable && (
                  <div className="flex items-center justify-end gap-3">
                    <Button
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      disabled={!allSectionsApproved}
                      onClick={() => setConfirmAction({ type: "APPROVE", isOpen: true })}
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 border-destructive/30"
                      onClick={() => setConfirmAction({ type: "REJECT", isOpen: true })}
                    >
                      <XCircleIcon className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}

                <ReviewSummaryCard
                  sections={reviewSections}
                  reviewItems={(app.application_review_items as { item_type: string; item_id: string; status: string }[]) ?? []}
                />

                <RecentActivityCard
                  events={(app.application_review_events as { event_type: string; scope_key: string | null; new_status: string; remark: string | null; created_at: string }[]) ?? []}
                  remarks={(app.application_review_remarks as { scope_key: string; action_type: string; remark: string; created_at: string }[]) ?? []}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <ApplicationReviewRemarkDialog
        open={noteDialog.open}
        onOpenChange={(open) =>
          setNoteDialog((prev) =>
            prev ? { ...prev, open } : { open: false, action: "reject", section: "FINANCIAL" }
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
