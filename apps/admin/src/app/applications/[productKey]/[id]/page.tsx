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
import { useProducts } from "@/hooks/use-products";
import { productName } from "@/app/settings/products/product-utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  XCircleIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && (
        <div className="flex h-5 w-5 items-center justify-center text-muted-foreground shrink-0 mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

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

const REVIEWABLE_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "RESUBMITTED"];

export default function DynamicApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productKey = params.productKey as string;
  const applicationId = params.id as string;

  const { data: app, isLoading, error } = useApplicationDetail(applicationId);
  const approveSection = useApproveReviewSection();
  const rejectSection = useRejectReviewSection();
  const requestAmendment = useRequestAmendmentReviewSection();

  const [noteDialog, setNoteDialog] = React.useState<
    | { open: boolean; action: "reject" | "amend"; section: ReviewSectionId }
    | {
        open: boolean;
        action: "reject" | "amend";
        itemType: "INVOICE" | "DOCUMENT";
        itemId: string;
      }
  >({ open: false, action: "reject", section: "FINANCIAL" });

  const approveItem = useApproveReviewItem();
  const rejectItem = useRejectReviewItem();
  const requestAmendmentItem = useRequestAmendmentReviewItem();

  const { data: productsData } = useProducts({ page: 1, pageSize: 100 });
  const currentProduct = productsData?.products.find((p) => p.id === productKey);
  const currentProductName = currentProduct ? productName(currentProduct) : "Applications";

  const reviewSections = React.useMemo(() => {
    if (!app?.application_reviews?.length) {
      return [
        { section: "FINANCIAL", status: "PENDING" },
        { section: "JUSTIFICATION", status: "PENDING" },
        { section: "DOCUMENTS", status: "PENDING" },
      ];
    }
    return app.application_reviews.map((r: { section: string; status: string }) => ({
      section: r.section,
      status: r.status,
    }));
  }, [app?.application_reviews]);

  const isReviewable = app && REVIEWABLE_STATUSES.includes(app.status);

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
    if (!("itemType" in d)) return;
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
    if (!("itemType" in d)) return;
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
        await rejectSection.mutateAsync({
          applicationId,
          section: d.section,
          note,
        });
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
      ? "Reject document?"
      : "Request amendment for document?";
  const noteDialogDescription = noteDialogIsSection
    ? noteDialog.action === "reject"
      ? "This will reject the application. The issuer will be notified. A remark is required."
            : "Request changes from the issuer. They will need to resubmit. A remark is required."
    : noteDialog?.action === "reject"
      ? "Reject this document. A remark is required."
      : "Request changes for this document. A remark is required.";
  const noteDialogSubmitLabel =
    noteDialog?.action === "reject" ? "Reject" : "Send Amendment Request";
  const noteDialogPending =
    rejectSection.isPending ||
    requestAmendment.isPending ||
    rejectItem.isPending ||
    requestAmendmentItem.isPending;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <Badge className="bg-blue-500 text-white">
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 mr-1" />
            Submitted for Review
          </Badge>
        );
      case "UNDER_REVIEW":
        return (
          <Badge className="bg-secondary text-secondary-foreground">
            <ClockIcon className="h-3.5 w-3.5 mr-1" />
            Under Review
          </Badge>
        );
      case "AMENDMENT_REQUESTED":
        return (
          <Badge className="bg-amber-500 text-white">
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 mr-1" />
            Amendment Requested
          </Badge>
        );
      case "RESUBMITTED":
        return (
          <Badge className="bg-blue-500 text-white">
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 mr-1" />
            Resubmitted
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-500 text-white">
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
      return app.invoices.reduce((sum: number, inv: any) => {
        const details = inv.details as any;
        const invoiceValue = parseFloat(details?.value || 0);
        const financingRatio = parseFloat(details?.financing_ratio_percent || 80);
        return sum + (invoiceValue * financingRatio) / 100;
      }, 0);
    } else if (app.contract?.contract_details) {
      const contractDetails = app.contract.contract_details as any;
      return parseFloat(
        contractDetails?.value || contractDetails?.approved_facility || 0
      );
    }
    return 0;
  }, [app]);

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
            onClick={() =>
              setNoteDialog({ open: true, action: "reject", section })
            }
          >
            <XCircleIcon className="h-4 w-4 mr-2" />
            Reject (leave remark)
          </DropdownMenuItem>
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() =>
              setNoteDialog({ open: true, action: "amend", section })
            }
          >
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            Request amendment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

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
          {isLoading
            ? "Loading..."
            : `Application ${applicationId.slice(-8).toUpperCase()}`}
        </h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
          {isLoading && <PageSkeleton />}

          {error && (
            <div className="py-8 text-center text-destructive">
              Error loading application:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          {app && (
            <>
              <Card className="rounded-2xl">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <BanknotesIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold">
                            {app.financing_type?.product_name || "AR Financing"}
                          </h2>
                          {getStatusBadge(app.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Submitted by {app.issuer_organization.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Requested Facility
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(requestedAmount)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Reference
                      </div>
                      <div className="text-sm font-medium">{app.id}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Submitted At
                      </div>
                      <div className="text-sm font-medium">
                        {app.submitted_at
                          ? format(new Date(app.submitted_at), "PPP p")
                          : "Not submitted"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Last Updated
                      </div>
                      <div className="text-sm font-medium">
                        {format(new Date(app.updated_at), "PPP p")}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ApplicationReviewTabs
                sections={reviewSections}
                defaultSection="FINANCIAL"
              >
                <ApplicationReviewTabContent value="FINANCIAL">
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BanknotesIcon className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base font-semibold">
                            Financial & CashSouk Intel
                          </CardTitle>
                        </div>
                        {sectionActionDropdown("FINANCIAL")}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold mb-2">
                          Financing Structure
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                          <DetailRow
                            label="Structure Type"
                            value={
                              app.contract_id
                                ? "Contract Financing"
                                : "Invoice Financing"
                            }
                          />
                          <DetailRow
                            label="Product"
                            value={
                              app.financing_type?.product_name || "AR Financing"
                            }
                          />
                        </div>
                      </div>
                      {app.company_details && typeof app.company_details === "object" && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">
                            Company Details
                          </h4>
                          <pre className="text-sm bg-muted/50 rounded-xl p-4 overflow-auto max-h-48">
                            {JSON.stringify(app.company_details, null, 2)}
                          </pre>
                        </div>
                      )}
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
                          <CardTitle className="text-base font-semibold">
                            Justification
                          </CardTitle>
                        </div>
                        {sectionActionDropdown("JUSTIFICATION")}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {app.business_details &&
                        typeof app.business_details === "object" && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">
                              About your business & funding
                            </h4>
                            <pre className="text-sm bg-muted/50 rounded-xl p-4 overflow-auto max-h-64">
                              {JSON.stringify(app.business_details, null, 2)}
                            </pre>
                          </div>
                        )}
                      {(!app.business_details ||
                        typeof app.business_details !== "object") && (
                        <p className="text-sm text-muted-foreground">
                          No justification details submitted.
                        </p>
                      )}
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Add Remarks
                        </Label>
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
                          <CardTitle className="text-base font-semibold">
                            Supporting Documents
                          </CardTitle>
                        </div>
                        {sectionActionDropdown("DOCUMENTS")}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {app.supporting_documents &&
                        typeof app.supporting_documents === "object" && (
                          <DocumentList
                            documents={app.supporting_documents}
                            reviewItems={
                              (app.application_review_items as any[]) ?? []
                            }
                            isReviewable={isReviewable}
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
                          />
                        )}
                      {(!app.supporting_documents ||
                        (typeof app.supporting_documents === "object" &&
                          Object.keys(app.supporting_documents).length === 0)) && (
                        <p className="text-sm text-muted-foreground">
                          No supporting documents submitted.
                        </p>
                      )}
                      <div className="mt-6">
                        <Label className="text-xs text-muted-foreground">
                          Add Remarks
                        </Label>
                        <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
                      </div>
                    </CardContent>
                  </Card>
                </ApplicationReviewTabContent>
              </ApplicationReviewTabs>

              <div className="lg:col-span-2 space-y-6">
                <Card className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base font-semibold">
                        Compliance & Audit
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <DetailRow label="Internal Status" value={app.status} />
                    <DetailRow
                      label="Product Version"
                      value={`v${app.product_version}`}
                    />
                    <DetailRow
                      label="Last Completed Step"
                      value={String(app.last_completed_step)}
                    />
                    <Separator />
                    <div className="text-[10px] text-muted-foreground leading-relaxed">
                      By approving sections, you confirm review of the submitted
                      information. Remarks are required for reject and amendment
                      requests.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      <ApplicationReviewRemarkDialog
        open={noteDialog.open}
        onOpenChange={(open) =>
          setNoteDialog((prev) =>
            prev ? { ...prev, open } : ({ open: false, action: "reject", section: "FINANCIAL" })
          )
        }
        title={noteDialogTitle}
        description={noteDialogDescription}
        submitLabel={noteDialogSubmitLabel}
        variant={noteDialog?.action === "reject" ? "destructive" : "default"}
        onConfirm={handleNoteDialogConfirm}
        isPending={noteDialogPending}
      />
    </>
  );
}

function DocumentList({
  documents,
  reviewItems,
  isReviewable,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  isItemActionPending,
}: {
  documents: any;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  isItemActionPending: boolean;
}) {
  const items = React.useMemo(() => {
    const out: { key: string; label: string }[] = [];
    if (typeof documents !== "object") return out;
    const raw = documents?.supporting_documents ?? documents;
    if (Array.isArray(raw)) {
      raw.forEach((d: any, i: number) => {
        out.push({
          key: `doc:${i}:${d?.name ?? d?.title ?? "document"}`,
          label: d?.name ?? d?.title ?? `Document ${i + 1}`,
        });
      });
    } else if (typeof raw === "object") {
      Object.entries(raw).forEach(([k, v]) => {
        const arr = Array.isArray(v) ? v : [v];
        arr.forEach((d: any, i: number) => {
          out.push({
            key: `doc:${k}:${i}:${d?.name ?? d?.title ?? "doc"}`,
            label: d?.name ?? d?.title ?? `${k} ${i + 1}`,
          });
        });
      });
    }
    return out;
  }, [documents]);

  const getItemStatus = (key: string) =>
    reviewItems.find(
      (r) => r.item_type === "DOCUMENT" && r.item_id === key
    )?.status ?? "PENDING";

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No document entries in supporting_documents.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {items.map(({ key, label }) => {
        const status = getItemStatus(key);
        return (
          <div
            key={key}
            className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              <DocumentArrowDownIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
              {status !== "PENDING" && (
                <Badge
                  variant={status === "APPROVED" ? "default" : "secondary"}
                  className={
                    status === "APPROVED"
                      ? "bg-emerald-500 text-white"
                      : ""
                  }
                >
                  {status}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="rounded-lg h-9">
                <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-1" />
                View
              </Button>
              <Button variant="ghost" size="sm" className="rounded-lg h-9">
                <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                Download
              </Button>
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
  );
}
