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
  BuildingOffice2Icon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowLeftIcon,
  ClipboardDocumentCheckIcon,
  XCircleIcon,
  ShieldCheckIcon,
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
          <Badge className="bg-blue-500 text-white">
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 mr-1" />
            Submitted for Review
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
          <Badge className="bg-red-500 text-white">
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
      return parseFloat(contractDetails?.value || contractDetails?.approved_facility || 0);
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
              {/* Header Card */}
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
                            {app.financing_type?.product_name || "Financing Product"}
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

                  {app.status === "SUBMITTED" && (
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        onClick={() => setConfirmAction({ type: "APPROVE", isOpen: true })}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        Approve Application
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2 border-red-200"
                        onClick={() => setConfirmAction({ type: "REJECT", isOpen: true })}
                      >
                        <XCircleIcon className="h-4 w-4" />
                        Reject Application
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Financing Structure Section */}
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <BanknotesIcon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-semibold">Financing Structure</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        <DetailRow
                          label="Structure Type"
                          value={app.contract_id ? "Contract Financing" : "Invoice Financing"}
                        />
                        <DetailRow
                          label="Product"
                          value={app.financing_type?.product_name || "Financing Product"}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Issuer Information */}
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <BuildingOffice2Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-semibold">Issuer Information</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        <DetailRow label="Organization" value={app.issuer_organization.name} />
                        <DetailRow
                          label="Owner Name"
                          value={`${app.issuer_organization.owner.first_name} ${app.issuer_organization.owner.last_name}`}
                        />
                        <DetailRow label="Email Address" value={app.issuer_organization.owner.email} />
                        <DetailRow label="Organization ID" value={app.issuer_organization_id} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Invoices or Contract Details */}
                  {app.invoices && app.invoices.length > 0 ? (
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <DocumentTextIcon className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base font-semibold">Invoice Details</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="divide-y">
                          {app.invoices.map((inv: any, idx: number) => {
                            const details = inv.details as any;
                            return (
                              <div key={inv.id} className="py-4 first:pt-0 last:pb-0">
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-medium text-sm">Invoice #{details?.number || idx + 1}</h4>
                                  <Badge variant="outline">{formatCurrency(parseFloat(details?.value || 0))}</Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground block text-xs">Customer</span>
                                    {details?.customer_name || "N/A"}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-xs">Financing Ratio</span>
                                    {details?.financing_ratio_percent || 80}%
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-xs">Due Date</span>
                                    {details?.due_date ? format(new Date(details.due_date), "dd MMM yyyy") : "N/A"}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ) : app.contract ? (
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <DocumentTextIcon className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base font-semibold">Contract Details</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const details = app.contract.contract_details as any;
                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                              <DetailRow label="Contract Number" value={details?.number || "N/A"} />
                              <DetailRow label="Contract Value" value={details?.value ? formatCurrency(details.value) : "N/A"} />
                              <DetailRow label="Start Date" value={details?.start_date ? format(new Date(details.start_date), "dd MMM yyyy") : "N/A"} />
                              <DetailRow label="End Date" value={details?.end_date ? format(new Date(details.end_date), "dd MMM yyyy") : "N/A"} />
                              <DetailRow label="Description" value={details?.description} />
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>

                <div className="space-y-6">
                  {/* Status & Compliance */}
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheckIcon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base font-semibold">Compliance & Audit</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <DetailRow label="Internal Status" value={app.status} />
                      <DetailRow label="Product Version" value={`v${app.product_version}`} />
                      <DetailRow label="Last Completed Step" value={app.last_completed_step} />
                      <Separator />
                      <div className="text-[10px] text-muted-foreground leading-relaxed">
                        By approving this application, you confirm that all KYC/KYB documents have been verified and the
                        requested facility is within the organization's approved limits.
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
                confirmAction.type === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
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
