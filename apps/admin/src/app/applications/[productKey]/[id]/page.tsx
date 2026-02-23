"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  type ReviewSectionId,
} from "@/components/application-review-tabs";
import { ApplicationReviewRemarkDialog } from "@/components/application-review-remark-dialog";
import { ApplicationFinancialReviewContent } from "@/components/application-financial-review-content";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useProducts } from "@/hooks/use-products";
import { productName } from "@/app/settings/products/product-utils";
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
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  XCircleIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency, useAuthToken } from "@cashsouk/config";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SUPPORTING_DOC_CATEGORY_KEYS,
  SUPPORTING_DOC_CATEGORY_LABELS,
} from "@/app/settings/products/workflow-builder/product-form-helpers";

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

  const handleApproveSection = async (section: string) => {
    try {
      await approveSection.mutateAsync({ applicationId, section });
      toast.success("Section approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const handleRejectItem = async (note: string) => {
    const d = noteDialog;
    if (!d || !("itemType" in d)) return;
    try {
      await rejectItem.mutateAsync({
        applicationId,
        itemType: d.itemType,
        itemId: d.itemId,
        note,
      });
      toast.success("Item rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
      throw err;
    }
  };

  const handleRequestAmendmentItem = async (note: string) => {
    const d = noteDialog;
    if (!d || !("itemType" in d)) return;
    try {
      await requestAmendmentItem.mutateAsync({
        applicationId,
        itemType: d.itemType,
        itemId: d.itemId,
        note,
      });
      toast.success("Amendment requested");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request amendment");
      throw err;
    }
  };

  const handleNoteDialogConfirm = async (note: string) => {
    const d = noteDialog;
    if (!d) return;
    if ("section" in d) {
      if (d.action === "reject") {
        await rejectSection.mutateAsync({ applicationId, section: d.section, note });
        toast.success("Section rejected");
      } else {
        await requestAmendment.mutateAsync({
          applicationId,
          section: d.section,
          note,
        });
        toast.success("Amendment requested");
      }
    } else {
      if (d.action === "reject") await handleRejectItem(note);
      else await handleRequestAmendmentItem(note);
    }
  };

  const noteDialogIsSection = noteDialog && "section" in noteDialog;
  const noteDialogTitle = noteDialogIsSection
    ? noteDialog.action === "reject"
      ? `Reject ${noteDialog.section}?`
      : `Request Amendment for ${noteDialog.section}?`
    : noteDialog?.action === "reject"
      ? "Reject item?"
      : "Request amendment?";
  const noteDialogDescription = noteDialogIsSection
    ? noteDialog.action === "reject"
      ? "This will reject the section. A remark is required."
      : "Request changes from the issuer. A remark is required."
    : "A remark is required for this action.";
  const noteDialogSubmitLabel =
    noteDialog?.action === "reject" ? "Reject" : "Send Amendment Request";
  const noteDialogPending =
    rejectSection.isPending ||
    requestAmendment.isPending ||
    rejectItem.isPending ||
    requestAmendmentItem.isPending;

  const sectionActionDropdown = (section: ReviewSectionId) =>
    isReviewable && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
            Action
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => handleApproveSection(section)}
            disabled={approveSection.isPending}
          >
            <CheckCircleIcon className="h-4 w-4 mr-2" />
            Approve
          </DropdownMenuItem>
          <DropdownMenuItem
            className="rounded-lg text-destructive focus:text-destructive"
            onClick={() => setNoteDialog({ open: true, action: "reject", section })}
          >
            <XCircleIcon className="h-4 w-4 mr-2" />
            Reject (leave remark)
          </DropdownMenuItem>
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => setNoteDialog({ open: true, action: "amend", section })}
          >
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            Request amendment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

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

                <ApplicationReviewTabs sections={reviewSections} defaultSection="FINANCIAL">
                    <ApplicationReviewTabContent value="FINANCIAL">
                      <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BanknotesIcon className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base font-semibold">Financial & CashSouk Intel</CardTitle>
                            </div>
                            {sectionActionDropdown("FINANCIAL")}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <ApplicationFinancialReviewContent app={app} />
                          <div>
                            <Label className="text-xs text-muted-foreground">Add Remarks</Label>
                            <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
                          </div>
                        </CardContent>
                      </Card>
                    </ApplicationReviewTabContent>

                    <ApplicationReviewTabContent value="JUSTIFICATION">
                      <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <DocumentTextIcon className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base font-semibold">Justification</CardTitle>
                            </div>
                            {sectionActionDropdown("JUSTIFICATION")}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {app.business_details && typeof app.business_details === "object" ? (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">About your business & funding</h4>
                              <pre className="text-sm bg-muted/50 rounded-xl p-4 overflow-auto max-h-64">
                                {JSON.stringify(app.business_details, null, 2)}
                              </pre>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No justification details submitted.</p>
                          )}
                          <div>
                            <Label className="text-xs text-muted-foreground">Add Remarks</Label>
                            <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
                          </div>
                        </CardContent>
                      </Card>
                    </ApplicationReviewTabContent>

                    <ApplicationReviewTabContent value="DOCUMENTS">
                      <Card className="rounded-2xl">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <DocumentTextIcon className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base font-semibold">Supporting Documents</CardTitle>
                            </div>
                            {sectionActionDropdown("DOCUMENTS")}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {app.supporting_documents && typeof app.supporting_documents === "object" ? (
                            <DocumentList
                              documents={app.supporting_documents}
                              reviewItems={
                                (app.application_review_items as { item_type: string; item_id: string; status: string }[]) ?? []
                              }
                              isReviewable={!!isReviewable}
                              onViewDocument={handleViewDocument}
                              onApproveItem={async (itemId) => {
                                await approveItem.mutateAsync({
                                  applicationId,
                                  itemType: "DOCUMENT",
                                  itemId,
                                });
                                toast.success("Document approved");
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
                              isItemActionPending={approveItem.isPending}
                              isViewDocumentPending={viewDocumentPending}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">No supporting documents submitted.</p>
                          )}
                          <div className="mt-6">
                            <Label className="text-xs text-muted-foreground">Add Remarks</Label>
                            <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
                          </div>
                        </CardContent>
                      </Card>
                    </ApplicationReviewTabContent>
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
                  events={(app.application_review_events as { event_type: string; scope_key: string | null; new_status: string; note: string | null; created_at: string }[]) ?? []}
                  notes={(app.application_review_notes as { scope_key: string; action_type: string; note: string; created_at: string }[]) ?? []}
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

function ReviewSummaryCard({
  sections,
  reviewItems,
}: {
  sections: { section: string; status: string }[];
  reviewItems: { item_type: string; item_id: string; status: string }[];
}) {
  const itemCountByStatus = React.useMemo(() => {
    const m: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, AMENDMENT_REQUESTED: 0 };
    for (const r of reviewItems) {
      m[r.status] = (m[r.status] ?? 0) + 1;
    }
    return m;
  }, [reviewItems]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardDocumentCheckIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Review Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Section Status
          </h4>
          <div className="space-y-1.5">
            {sections.map((s) => (
              <div key={s.section} className="flex items-center justify-between text-sm">
                <span>{s.section}</span>
                <Badge
                  variant="secondary"
                  className={
                    s.status === "APPROVED"
                      ? "bg-primary/10 text-primary"
                      : s.status === "REJECTED" || s.status === "AMENDMENT_REQUESTED"
                        ? "bg-destructive/10 text-destructive"
                        : ""
                  }
                >
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        {reviewItems.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Item Status
            </h4>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(itemCountByStatus)
                .filter(([, c]) => c > 0)
                .map(([status, count]) => (
                  <span key={status} className="text-muted-foreground">
                    {status}: {count}
                  </span>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({
  events,
  notes,
}: {
  events: { event_type: string; scope_key: string | null; new_status: string; note: string | null; created_at: string }[];
  notes: { scope_key: string; action_type: string; note: string; created_at: string }[];
}) {
  const recentActivity = React.useMemo(() => {
    const combined: { type: string; key: string; status?: string; note?: string; created_at: string }[] = [];
    for (const e of events.slice(0, 10)) {
      combined.push({
        type: e.event_type,
        key: e.scope_key ?? "—",
        status: e.new_status,
        note: e.note ?? undefined,
        created_at: e.created_at,
      });
    }
    for (const n of notes.slice(0, 5)) {
      combined.push({
        type: `NOTE:${n.action_type}`,
        key: n.scope_key,
        note: n.note,
        created_at: n.created_at,
      });
    }
    combined.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return combined.slice(0, 8);
  }, [events, notes]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardDocumentCheckIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No review activity yet.</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {recentActivity.map((a, i) => (
              <div key={i} className="text-xs border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <div className="font-medium">{a.type}</div>
                <div className="text-muted-foreground truncate" title={a.key}>
                  {a.key}
                </div>
                {a.status && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px]">
                    {a.status}
                  </span>
                )}
                {a.note && (
                  <p className="mt-1 text-muted-foreground line-clamp-2">{a.note}</p>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {format(new Date(a.created_at), "dd MMM HH:mm")}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type DocItem = { key: string; label: string; s3Key?: string };
type CategoryGroup = { categoryKey: string; categoryLabel: string; items: DocItem[] };

function DocumentList({
  documents,
  reviewItems,
  isReviewable,
  onViewDocument,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  isItemActionPending,
  isViewDocumentPending,
}: {
  documents: unknown;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  onViewDocument?: (s3Key: string) => void;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  isItemActionPending: boolean;
  isViewDocumentPending?: boolean;
}) {
  const categoryGroups = React.useMemo((): CategoryGroup[] => {
    if (typeof documents !== "object") return [];
    const raw = (documents as Record<string, unknown>)?.supporting_documents ?? documents;
    if (Array.isArray(raw)) {
      const items: DocItem[] = raw.map((d: Record<string, unknown>, i: number) => {
        const file = d?.file as { s3_key?: string } | undefined;
        return {
          key: `doc:${i}:${String(d?.name ?? d?.title ?? "document")}`,
          label: String(d?.name ?? d?.title ?? `Document ${i + 1}`),
          s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
        };
      });
      return items.length > 0 ? [{ categoryKey: "others", categoryLabel: "Others", items }] : [];
    }
    if (typeof raw !== "object" || raw === null) return [];

    const cats = (raw as Record<string, unknown>).categories;
    if (Array.isArray(cats)) {
      const labelToKey: Record<string, string> = {};
      SUPPORTING_DOC_CATEGORY_KEYS.forEach((k) => {
        labelToKey[SUPPORTING_DOC_CATEGORY_LABELS[k]] = k;
      });
      const groups: CategoryGroup[] = [];
      cats.forEach((cat: Record<string, unknown>, catIndex: number) => {
        const categoryLabel = String(cat?.name ?? `Category ${catIndex + 1}`);
        const categoryKey = labelToKey[categoryLabel] ?? `cat_${catIndex}`;
        const docList = Array.isArray(cat?.documents) ? cat.documents : [];
        const items: DocItem[] = docList.map((d: Record<string, unknown>, docIndex: number) => {
          const file = d?.file as { file_name?: string; s3_key?: string } | undefined;
          const label =
            String(d?.title ?? file?.file_name ?? d?.name ?? "").trim() ||
            `Document ${docIndex + 1}`;
          const slug = label.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
          return {
            key: `doc:${categoryKey}:${docIndex}:${slug}`,
            label,
            s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
          };
        });
        if (items.length > 0) {
          groups.push({ categoryKey, categoryLabel, items });
        }
      });
      if (groups.length > 0) return groups;
    }

    const groups: CategoryGroup[] = [];
    for (const categoryKey of SUPPORTING_DOC_CATEGORY_KEYS) {
      const val = (raw as Record<string, unknown>)[categoryKey];
      if (val == null) continue;
      const arr = Array.isArray(val) ? val : [val];
      const items: DocItem[] = arr.map((d: Record<string, unknown>, i: number) => {
        const file = d?.file as { s3_key?: string } | undefined;
        return {
          key: `doc:${categoryKey}:${i}:${String(d?.name ?? d?.title ?? "doc")}`,
          label: String(d?.name ?? d?.title ?? `${categoryKey} ${i + 1}`),
          s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
        };
      });
      if (items.length > 0) {
        groups.push({
          categoryKey,
          categoryLabel: SUPPORTING_DOC_CATEGORY_LABELS[categoryKey] ?? categoryKey,
          items,
        });
      }
    }
    return groups;
  }, [documents]);

  const getItemStatus = (key: string) =>
    reviewItems.find((r) => r.item_type === "DOCUMENT" && r.item_id === key)?.status ?? "PENDING";

  const totalItems = categoryGroups.reduce((acc, g) => acc + g.items.length, 0);
  if (totalItems === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No document entries in supporting documents.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {categoryGroups.map(({ categoryKey, categoryLabel, items }) => (
        <Collapsible key={categoryKey} defaultOpen>
          <div className="rounded-xl border">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center gap-2 px-4 py-3 text-left text-base font-semibold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-muted/50 transition-colors rounded-t-xl [&[data-state=open]]:rounded-b-none"
              >
                <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                <DocumentArrowDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                {categoryLabel}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t pl-16 pr-4 py-3 space-y-3">
                {items.map(({ key, label, s3Key }) => {
                  const status = getItemStatus(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-foreground">{label}</span>
                        {status !== "PENDING" && (
                          <Badge
                            variant={status === "APPROVED" ? "default" : "secondary"}
                            className={status === "APPROVED" ? "bg-primary text-primary-foreground" : ""}
                          >
                            {status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {s3Key && onViewDocument && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-9 gap-1 border-0"
                            onClick={() => onViewDocument(s3Key)}
                            disabled={isViewDocumentPending}
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            View
                          </Button>
                        )}
                        {isReviewable && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg h-9 gap-1"
                                disabled={isItemActionPending}
                              >
                                Action
                                <ChevronDownIcon className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem
                                className="rounded-lg"
                                onClick={() => onApproveItem(key)}
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg text-destructive focus:text-destructive"
                                onClick={() => onRejectItem(key)}
                              >
                                <XCircleIcon className="h-4 w-4 mr-2" />
                                Reject (leave remark)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg"
                                onClick={() => onRequestAmendmentItem(key)}
                              >
                                <DocumentTextIcon className="h-4 w-4 mr-2" />
                                Request Amendment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
