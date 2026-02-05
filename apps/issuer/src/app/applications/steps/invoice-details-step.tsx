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

  // Sync local state with server data
  React.useEffect(() => {
    const mappedAppInvoices = appInvoices.map((inv: any) => ({
      ...inv.details,
      id: inv.id,
      isReadOnly: false,
    }));

    const mappedContractInvoices = isExistingContract
      ? contractInvoices.map((inv: any) => ({
          ...inv.details,
          id: inv.id,
          isReadOnly: true,
        }))
      : [];

    setInvoices([...mappedContractInvoices, ...mappedAppInvoices]);
  }, [appInvoices, contractInvoices, isExistingContract]);

  // Stable reference for onDataChange callback
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // Notify parent on changes
  React.useEffect(() => {
    const totalFinancingAmount = localInvoices.reduce(
      (acc, inv) => acc + (inv.value || 0) * 0.8,
      0
    );
    onDataChangeRef.current?.({
      invoices: localInvoices,
      totalFinancingAmount,
      isValid:
        localInvoices.length > 0 && localInvoices.every((inv) => inv.number && inv.value > 0),
      hasPendingChanges: false, // Since each action is immediate via API
    });
  }, [localInvoices]);

  const handleAddInvoice = async () => {
    const newInvoiceDetails = {
      number: "",
      value: 0,
      maturity_date: "",
      status: "DRAFT",
    };

    await createInvoiceMutation.mutateAsync({
      applicationId,
      contractId: application?.contract?.id,
      details: newInvoiceDetails,
    });
  };

  const handleDeleteInvoice = async (id: string) => {
    const invoice = localInvoices.find((inv) => inv.id === id);
    if (invoice?.status === "APPROVED") return;

    await deleteInvoiceMutation.mutateAsync({ id, applicationId });
  };

  const handleUpdateInvoice = async (id: string, field: string, value: any) => {
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

      await updateInvoiceMutation.mutateAsync({
        id: invoiceId,
        applicationId,
        details: {
          document: {
            s3_key: s3Key,
            file_name: file.name,
            file_size: file.size,
          },
        },
      });

      toast.success("Invoice uploaded successfully");
    } catch (error: any) {
      toast.error("Upload failed", { description: error.message });
    } finally {
      setIsUploading((prev) => ({ ...prev, [invoiceId]: false }));
    }
  };

  const totalFinancingAmount = localInvoices.reduce((acc, inv) => acc + (inv.value || 0) * 0.8, 0);
  const contractDetails = (application?.contract?.contract_details as any) || {};

  const formatCurrency = (value: any) => {
    const num =
      typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0;
    return `RM ${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (isLoadingApp || isLoadingInvoices) {
    return (
      <div className="space-y-12 pb-8">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-8">
      {/* Contract Summary Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold">Contract</h2>
        <div className="space-y-4 border rounded-xl p-6 bg-card/50">
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Contract title</span>
            <span>{contractDetails.title || "-"}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Customer</span>
            <span>{(application?.contract?.customer_details as any)?.name || "-"}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Contract value</span>
            <span className="font-medium text-foreground">
              {formatCurrency(contractDetails.value)}
            </span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Approved facility</span>
            <span>{formatCurrency(contractDetails.approved_facility)}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Utilised facility</span>
            <span>{formatCurrency(contractDetails.utilized_facility)}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Available facility</span>
            <span>{formatCurrency(contractDetails.available_facility)}</span>
          </div>
        </div>
      </section>

      {/* Invoices Table Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold">Invoices</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You may include multiple invoices in a single financing request, provided all invoices
              relate to the same underlying contract with the buyer
            </p>
          </div>
          <Button
            onClick={handleAddInvoice}
            disabled={createInvoiceMutation.isPending}
            className="bg-[#800000] hover:bg-[#600000] text-white rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center"
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
                  <TableHead className="w-[200px] min-w-[150px]">Invoice value</TableHead>
                  <TableHead className="w-[200px] min-w-[180px]">Maturity date</TableHead>
                  <TableHead className="min-w-[200px]">Max financing amount (80%)</TableHead>
                  <TableHead className="w-[180px] min-w-[150px]">Documents</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
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
                        {!isDisabled ? (
                          <Input
                            value={invoice.number}
                            onChange={(e) =>
                              handleUpdateInvoice(invoice.id, "number", e.target.value)
                            }
                            className="h-9 rounded-md"
                            placeholder="#Invoice number"
                          />
                        ) : (
                          <span className="font-medium text-muted-foreground">
                            {invoice.number}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isDisabled ? (
                          <Input
                            type="number"
                            value={invoice.value || ""}
                            onChange={(e) =>
                              handleUpdateInvoice(
                                invoice.id,
                                "value",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-9 rounded-md"
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
                              handleUpdateInvoice(invoice.id, "maturity_date", e.target.value)
                            }
                            className="h-9 rounded-md"
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
                                "inline-flex items-center gap-2 bg-background text-foreground border border-border rounded-sm px-2 py-1 max-w-full",
                                isDisabled && "opacity-70 bg-muted/30"
                              )}
                            >
                              <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground shrink-0">
                                <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                              </div>
                              <span className="text-sm truncate max-w-[120px] sm:max-w-[200px]">
                                {invoice.document.file_name}
                              </span>
                              {!isDisabled && (
                                <button
                                  className="hover:text-destructive transition-colors cursor-pointer shrink-0 ml-1"
                                  type="button"
                                  onClick={() => handleUpdateInvoice(invoice.id, "document", null)}
                                >
                                  <XMarkIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            !isDisabled && (
                              <label className="flex items-center gap-2 text-[#800000] font-medium hover:underline text-sm cursor-pointer">
                                <CloudUpload className="h-4 w-4" />
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
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md transition-colors"
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
                  <TableCell colSpan={3}></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-foreground">{formatCurrency(totalFinancingAmount)}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
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
        <p className="text-center text-sm italic text-muted-foreground mt-4">
          Estimated fees based on 15% p.a. but exact amount will only be decided in offer letter
        </p>
      </section>
    </div>
  );
}
