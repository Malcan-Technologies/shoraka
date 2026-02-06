"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, CloudUpload } from "lucide-react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { useApplication } from "@/hooks/use-applications";
import {
  useInvoices,
  useInvoicesByContract,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
} from "@/hooks/use-invoices";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthToken, createApiClient } from "@cashsouk/config";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * INVOICE DETAILS STEP
 *
 * This step collects invoice information and shows a summary of the contract.
 * 1. Contract Summary (read-only)
 * 2. Invoices table with inline editing
 * 3. Total financing calculation
 *
 * Props:
 * - applicationId: ID of the current application
 * - onDataChange: callback to pass invoice data to parent
 */

interface InvoiceDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

export function InvoiceDetailsStep({ applicationId, onDataChange }: InvoiceDetailsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

  // Check if we are using an existing contract
  const financingStructure = application?.financing_structure as any;
  const isExistingContract = financingStructure?.structure_type === "existing_contract";
  const isInvoiceOnly = financingStructure?.structure_type === "invoice_only";
  const existingContractId = financingStructure?.existing_contract_id;

  // Fetch invoices based on mode
  const { data: appInvoicesRaw, isLoading: isLoadingAppInvoices } = useInvoices(applicationId);
  const { data: contractInvoicesRaw, isLoading: isLoadingContractInvoices } =
    useInvoicesByContract(existingContractId);

  const appInvoices = React.useMemo(() => appInvoicesRaw || [], [appInvoicesRaw]);
  const contractInvoices = React.useMemo(() => contractInvoicesRaw || [], [contractInvoicesRaw]);

  const isLoadingInvoices = isLoadingAppInvoices || (isExistingContract && isLoadingContractInvoices);

  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();
  const deleteInvoiceMutation = useDeleteInvoice();
  const { getAccessToken } = useAuthToken();

  const [localInvoices, setInvoices] = React.useState<any[]>([]);
  const [isUploading, setIsUploading] = React.useState<Record<string, boolean>>({});
  const [localValidationError, setLocalValidationError] = React.useState<string | null>(null);

  // Sync local state with server data
  React.useEffect(() => {
    const mappedAppInvoices = appInvoices.map((inv: any) => ({
      ...inv.details,
      id: inv.id,
      status: inv.status,
      isReadOnly: false,
    }));

    const mappedContractInvoices = isExistingContract
      ? contractInvoices.map((inv: any) => ({
          ...inv.details,
          id: inv.id,
          status: inv.status,
          isReadOnly: true,
        }))
      : [];

    // Deduplicate: If an invoice is in both, trust the application version (which is editable)
    const appInvoiceIds = new Set(mappedAppInvoices.map((inv: any) => inv.id));
    const uniqueContractInvoices = mappedContractInvoices.filter(
      (inv: any) => !appInvoiceIds.has(inv.id)
    );

    const allInvoices = [...uniqueContractInvoices, ...mappedAppInvoices];

    // Only update local state if the count changed or if it's the initial load.
    // This prevents losing focus and lag when typing.
    // Individual field changes are handled by local state and synced on blur.
    setInvoices(prev => {
      if (prev.length !== allInvoices.length) return allInvoices;

      // If count is same, only update items that might have changed status or read-only state
      // but keep our local field edits for the items we are likely editing.
      return prev.map(p => {
        const matching = allInvoices.find(a => a.id === p.id);
        if (!matching) return p;
        // Update if status, isReadOnly OR document changed
        const docChanged = JSON.stringify(matching.document) !== JSON.stringify(p.document);
        if (matching.status !== p.status || matching.isReadOnly !== p.isReadOnly || docChanged) {
          return {
            ...p,
            status: matching.status,
            isReadOnly: matching.isReadOnly,
            document: matching.document
          };
        }
        return p;
      });
    });
  }, [appInvoices, contractInvoices, isExistingContract]);

  // Stable reference for onDataChange callback
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // Only use contract details if not invoice_only structure
  const contractDetails = isInvoiceOnly ? {} : (((application as any)?.contract?.contract_details as any) || {});

  const totalFinancingAmount = localInvoices.reduce((acc, inv) => acc + (inv.value || 0) * 0.8, 0);

  // Notify parent on changes
  React.useEffect(() => {
    const approvedFacilityAmt = contractDetails.approved_facility || 0;
    const contractValueAmt = contractDetails.value || 0;

    // Calculate facility updates
    const isValid = localInvoices.length > 0 && localInvoices.every((inv) => inv.number && inv.value > 0);

    // Validation check
    let validationError = null;
    if (!isInvoiceOnly) {
      if (approvedFacilityAmt > 0) {
        if (totalFinancingAmount > approvedFacilityAmt) {
          validationError =
            "Total financing amount exceeds approved facility limit. Please adjust invoice values.";
        }
      } else {
        if (totalFinancingAmount > contractValueAmt) {
          validationError =
            "Total financing amount exceeds contract value. Please adjust invoice values.";
        }
      }
    }

    setLocalValidationError(validationError);

    onDataChangeRef.current?.({
      invoices: localInvoices,
      totalFinancingAmount,
      isValid: isValid && !validationError,
      validationError,
      // Pass the updated facility values if needed elsewhere
      available_facility: contractDetails.available_facility,
      utilized_facility: contractDetails.utilized_facility,
    });
  }, [localInvoices, contractDetails, isInvoiceOnly, totalFinancingAmount]);

  const handleAddInvoice = async () => {
    const newInvoiceDetails = {
      number: "",
      value: 0,
      maturity_date: "",
    };

    // Only pass contractId if not invoice_only structure
    const contractIdToUse = isInvoiceOnly ? undefined : (application as any)?.contract?.id;

    await createInvoiceMutation.mutateAsync({
      applicationId,
      contractId: contractIdToUse,
      details: newInvoiceDetails,
    });
  };

  const handleDeleteInvoice = async (id: string) => {
    const invoice = localInvoices.find((inv) => inv.id === id);
    if (invoice?.status === "APPROVED") return;

    await deleteInvoiceMutation.mutateAsync({ id, applicationId });
  };

  const handleUpdateInvoiceLocal = (id: string, field: string, value: any) => {
    const invoice = localInvoices.find((inv) => inv.id === id);
    if (invoice?.status === "APPROVED") return;

    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv))
    );
  };

  const handleUpdateInvoiceServer = async (id: string, field: string, value: any) => {
    const invoice = localInvoices.find((inv) => inv.id === id);
    if (invoice?.status === "APPROVED") return;

    await updateInvoiceMutation.mutateAsync({
      id,
      applicationId,
      details: { [field]: value },
    });
  };

  const handleFileUpload = async (invoiceId: string, file: File) => {
    try {
      setIsUploading((prev) => ({ ...prev, [invoiceId]: true }));
      const token = await getAccessToken();
      const apiClient = createApiClient(API_URL, () => Promise.resolve(token));

      const response = await apiClient.requestInvoiceUploadUrl(invoiceId, {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });

      if (!response.success) {
        throw new Error(response.error.message);
      }

      const { uploadUrl, s3Key } = response.data;

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to S3");
      }

      const documentData = {
        s3_key: s3Key,
        file_name: file.name,
        file_size: file.size,
      };

      await updateInvoiceMutation.mutateAsync({
        id: invoiceId,
        applicationId,
        details: {
          document: documentData,
        },
      });

      // Update local state immediately so UI switches component
      handleUpdateInvoiceLocal(invoiceId, "document", documentData);

      toast.success("Invoice uploaded successfully");
    } catch (error: any) {
      toast.error("Upload failed", { description: error.message });
    } finally {
      setIsUploading((prev) => ({ ...prev, [invoiceId]: false }));
    }
  };

  const formatCurrency = (value: any) => {
    const num =
      typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0;
    return `RM ${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Status badge component
  const StatusBadge = ({ status }: { status?: string }) => {
    if (!status) return null;

    const colors: Record<string, string> = {
      DRAFT: "bg-slate-100 text-slate-700",
      SUBMITTED: "bg-blue-100 text-blue-700",
      APPROVED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700",
    };

    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider", colors[status] || colors.DRAFT)}>
        {status}
      </span>
    );
  };

  if (isLoadingApp || isLoadingInvoices) {
    return (
      <div className="space-y-12 pb-8">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  // Calculate real-time facility values for display
  const approvedFacilityAmt = contractDetails.approved_facility || 0;
  const displayAvailableFacility =
    approvedFacilityAmt > 0
      ? approvedFacilityAmt - totalFinancingAmount
      : (contractDetails.value || 0) - totalFinancingAmount;

  return (
    <div className="space-y-12 pb-8">
      {/* Contract Summary Section */}
      {!isInvoiceOnly && (
        <section className="space-y-6">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold">Contract</h2>
          <div className="space-y-4 border rounded-xl px-4 py-4 bg-card/50">
            <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
              <div className="text-muted-foreground">Contract title</div>
              <div className="font-medium text-foreground">{contractDetails.title || "-"}</div>
            </div>
            <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
              <div className="text-muted-foreground">Customer</div>
              <div className="font-medium text-foreground">{(application?.contract?.customer_details as any)?.name || "-"}</div>
            </div>
            <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
              <div className="text-muted-foreground">Approved facility</div>
              <span className="font-medium text-foreground">
                {formatCurrency(contractDetails.value)}
              </span>
            </div>
            <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
              <div className="text-muted-foreground">Approved facility</div>
              <div className="font-medium text-foreground">{formatCurrency(contractDetails.approved_facility)}</div>
            </div>
            <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
              <div className="text-muted-foreground">Utilised facility</div>
              <div className="font-medium text-foreground">{formatCurrency(contractDetails.utilized_facility)}</div>
            </div>
            <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
              <div className="text-muted-foreground">Available facility</div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(displayAvailableFacility < 0 && "text-destructive font-bold")}
                >
                  {formatCurrency(displayAvailableFacility)}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Invoices Table Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold">Invoices</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You may include multiple invoices in a single financing request, provided all invoices
              relate to the same underlying contract with the buyer
            </p>
          </div>
          <Button
            onClick={handleAddInvoice}
            disabled={createInvoiceMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" />
            {createInvoiceMutation.isPending ? "Adding..." : "Add invoice"}
          </Button>
        </div>

        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="w-[180px] min-w-[150px]">Invoice</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[180px] min-w-[140px]">Invoice value</TableHead>
                  <TableHead className="w-[180px] min-w-[160px]">Maturity date</TableHead>
                  <TableHead className="min-w-[180px]">Max financing amount (80%)</TableHead>
                  <TableHead className="w-[180px] min-w-[150px]">Documents</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localInvoices.map((invoice) => {
                  const isApproved = invoice.status === "APPROVED";
                  const isDisabled = invoice.isReadOnly || isApproved;
                  const maxFinancing = (invoice.value || 0) * 0.8;

                  return (
                    <TableRow
                      key={invoice.id}
                      className={cn(
                        "border-b last:border-0 h-[72px]",
                        isDisabled && "bg-muted/30 opacity-70"
                      )}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {!isDisabled ? (
                            <Input
                              value={invoice.number}
                              onChange={(e) =>
                                handleUpdateInvoiceLocal(invoice.id, "number", e.target.value)
                              }
                              onBlur={(e) =>
                                handleUpdateInvoiceServer(invoice.id, "number", e.target.value)
                              }
                              className="h-9 rounded-md border border-input bg-background text-foreground"
                              placeholder="#Invoice number"
                            />
                          ) : (
                            <span className="font-medium text-muted-foreground">
                              {invoice.number}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell>
                        {!isDisabled ? (
                          <Input
                            min={0}
                            value={invoice.value || ""}
                            onChange={(e) =>
                              handleUpdateInvoiceLocal(
                                invoice.id,
                                "value",
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            onBlur={(e) =>
                              handleUpdateInvoiceServer(
                                invoice.id,
                                "value",
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            className="h-9 rounded-md border border-input bg-background text-foreground"
                            placeholder="0"
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            {formatCurrency(invoice.value)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isDisabled ? (
                          <Input
                            type="date"
                            value={invoice.maturity_date}
                            onChange={(e) =>
                                handleUpdateInvoiceLocal(invoice.id, "maturity_date", e.target.value)
                            }
                            onBlur={(e) =>
                                handleUpdateInvoiceServer(invoice.id, "maturity_date", e.target.value)
                            }
                            className="h-9 rounded-md border border-input bg-background text-foreground"
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            {invoice.maturity_date
                              ? new Date(invoice.maturity_date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "-"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "font-medium",
                            isDisabled ? "text-muted-foreground" : "text-foreground"
                          )}
                        >
                          {formatCurrency(maxFinancing)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {invoice.document ? (
                            <div
                              className={cn(
                                "inline-flex items-center gap-2 bg-background text-foreground border border-border rounded-md px-2 py-1 max-w-full",
                                isDisabled && "opacity-70 bg-muted/30"
                              )}
                            >
                              <div className="w-4 h-4 rounded-full flex items-center justify-center bg-foreground shrink-0">
                                <CheckIconSolid className="h-3 w-3 text-background" />
                              </div>
                              <span className="text-sm truncate max-w-[120px] sm:max-w-[200px]">
                                {invoice.document.file_name}
                              </span>
                              {!isDisabled && (
                                <button
                                  className="hover:text-destructive transition-colors cursor-pointer shrink-0 ml-1"
                                  type="button"
                                  onClick={() => {
                                    handleUpdateInvoiceLocal(invoice.id, "document", null);
                                    handleUpdateInvoiceServer(invoice.id, "document", null);
                                  }}
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            !isDisabled && (
                              <label className="flex items-center gap-2 text-primary font-medium hover:underline text-sm cursor-pointer">
                                <CloudUpload className="h-5 w-5" />
                                {isUploading[invoice.id] ? "Uploading..." : "Upload file"}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,application/pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(invoice.id, file);
                                  }}
                                  disabled={isUploading[invoice.id]}
                                />
                              </label>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2 pr-2">
                          {!isDisabled && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              disabled={deleteInvoiceMutation.isPending}
                              className="p-1 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Total row */}
                <TableRow className="bg-muted/10 font-bold border-t-2 h-[72px]">
                  <TableCell colSpan={4}></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-foreground">{formatCurrency(totalFinancingAmount)}</div>
                      <div className="text-sm text-muted-foreground font-normal">
                        Total financing amount
                      </div>
                    </div>
                  </TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Validation Error */}
        {localValidationError && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 mt-6">
            <XMarkIcon className="h-5 w-5" />
            {localValidationError}
          </div>
        )}

        <p className="text-right text-sm italic text-muted-foreground mt-4">
          Estimated fees based on 15% p.a. but exact amount will only be decided in offer letter
        </p>
      </section>
    </div>
  );
}
