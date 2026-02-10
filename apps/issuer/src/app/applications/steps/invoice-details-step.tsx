"use client";

/**
 * INVOICE DETAILS STEP
 *
 * - Manages invoice rows (local state until Save and Continue)
 * * - File uploads happen on Save and Continue
* - One document per invoice (no versioning)
 * - Each invoice is persisted individually to DB
 * - Documents are uploaded with version tracking
 * - Returns invoice snapshot for application-level persistence
 */
import * as React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/app/applications/components/date-input";
import { Trash2 } from "lucide-react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { XMarkIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { Slider } from "@/components/ui/slider";
import { cn } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * LOCAL INVOICE STATE SHAPE
 */
type LocalInvoice = {
  id: string;
  isPersisted: boolean;
  number: string;
  value: string;
  maturity_date: string;
  financing_ratio_percent?: number;
  status?: string;
  document?: { file_name: string; file_size: number; s3_key?: string } | null;
};

interface InvoiceDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

export default function InvoiceDetailsStep({ applicationId, onDataChange }: InvoiceDetailsStepProps) {
  const [invoices, setInvoices] = React.useState<LocalInvoice[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});
  const [application, setApplication] = React.useState<any>(null);
  const [lastS3Keys, setLastS3Keys] = React.useState<Record<string, string>>({});
  const [deletedInvoices, setDeletedInvoices] = React.useState<Record<string, { s3_key?: string }>>({});
  const [initialInvoices, setInitialInvoices] = React.useState<Record<string, LocalInvoice>>({});
  const [contractInvoices, setContractInvoices] = React.useState<LocalInvoice[]>([]);

  const { getAccessToken } = useAuthToken();

  React.useEffect(() => {
    let mounted = true;
    const loadApplication = async () => {
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        const resp: any = await apiClient.get(`/v1/applications/${applicationId}`);
        if (resp.success && mounted) {
          setApplication(resp.data);
          const financingStructure = resp.data?.financing_structure;
          const contractId = resp.data?.contract_id;
          const isExistingContract = financingStructure?.structure_type === "existing_contract";
          if (isExistingContract && contractId) {
            try {
              const contractResp: any = await apiClient.get(`/v1/invoices/by-contract/${contractId}`);
              if (contractResp.success) {
                const contractInvoicesList = (contractResp.data || [])
                  .filter((inv: any) => inv.status === "APPROVED" || inv.status === "SUBMITTED")
                  .map((it: any) => {
                    const d = it.details || {};
                    return {
                      id: it.id,
                      isPersisted: true,
                      number: d.number || "",
                      status: it.status || "DRAFT",
                      value: typeof d.value === "number" ? d.value.toFixed(2) : d.value ? Number(d.value).toFixed(2) : "",
                      maturity_date: d.maturity_date || "",
                      financing_ratio_percent: d.financing_ratio_percent || 60,
                      document: d.document
                        ? {
                          file_name: d.document.file_name,
                          file_size: d.document.file_size,
                          s3_key: d.document.s3_key,
                        }
                        : null,
                    };
                  });
                if (mounted) {
                  setContractInvoices(contractInvoicesList);
                }
              }
            } catch (err) {
              console.error("Failed to load contract invoices", err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load application", err);
      }
    };
    loadApplication();
    return () => {
      mounted = false;
    };
  }, [applicationId, getAccessToken]);

  const addInvoice = () => {
    setInvoices((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        isPersisted: false,
        number: "",
        value: "",
        maturity_date: "",
        financing_ratio_percent: 60,
        document: null,
        status: "DRAFT",
      },
    ]);
  };

  const deleteInvoice = (inv: LocalInvoice) => {
    if (inv.isPersisted) {
      setDeletedInvoices((prev) => ({
        ...prev,
        [inv.id]: {
          s3_key: inv.document?.s3_key,
        },
      }));
    }
    setInvoices((prev) => prev.filter((row) => row.id !== inv.id));
    setSelectedFiles((prev) => {
      const copy = { ...prev };
      delete copy[inv.id];
      return copy;
    });
    setLastS3Keys((prev) => {
      const copy = { ...prev };
      delete copy[inv.id];
      return copy;
    });
  };

  const updateInvoiceField = (id: string, field: keyof LocalInvoice, value: any) => {
    setInvoices((s) => s.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
  };

  const handleFileChange = (id: string, file: File, existingS3Key?: string) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Invalid file type", { description: "Only PDF files are allowed" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "File size must be less than 5MB" });
      return;
    }
    setSelectedFiles((p) => ({ ...p, [id]: file }));
    updateInvoiceField(id, "document", {
      file_name: file.name,
      file_size: file.size,
      s3_key: existingS3Key,
    });
    toast.success("File selected");
  };

  const isRowEmpty = (inv: LocalInvoice) => {
    return !inv.number && inv.value === "" && !inv.maturity_date && !inv.document;
  };

  const isRowPartial = (inv: LocalInvoice) => {
    if (isRowEmpty(inv)) return false;
    const hasNumber = Boolean(String(inv.number).trim());
    const hasValue = inv.value !== "" && Number(inv.value) > 0;
    const hasDate = Boolean(String(inv.maturity_date).trim());
    const hasDocument = Boolean(inv.document) || Boolean(selectedFiles[inv.id]);
    const filledCount = [hasNumber, hasValue, hasDate, hasDocument].filter(Boolean).length;
    return filledCount > 0 && filledCount < 4;
  };

  const validateRow = (inv: LocalInvoice) => {
    if (isRowEmpty(inv)) return true;
    const hasNumber = Boolean(String(inv.number).trim());
    const hasValue = inv.value !== "" && Number(inv.value) > 0;
    const hasDate = Boolean(String(inv.maturity_date).trim());
    const hasDocument = Boolean(inv.document) || Boolean(selectedFiles[inv.id]);
    return hasNumber && hasValue && hasDate && hasDocument;
  };

  const hasRowChanged = (inv: LocalInvoice) => {
    if (!inv.isPersisted) return !isRowEmpty(inv);
    const base = initialInvoices[inv.id];
    if (!base) return false;
    return (
      inv.number !== base.number ||
      inv.value !== base.value ||
      inv.maturity_date !== base.maturity_date ||
      inv.financing_ratio_percent !== base.financing_ratio_percent ||
      inv.document?.s3_key !== base.document?.s3_key
    );
  };

  const applicationFinancingAmount = invoices.reduce((acc, inv) => {
    const value = inv.value === "" ? 0 : Number(inv.value);
    const ratio = (inv.financing_ratio_percent || 60) / 100;
    return acc + value * ratio;
  }, 0);

  const contractInvoicesFinancingAmount = contractInvoices.reduce((acc, inv) => {
    const value = inv.value === "" ? 0 : Number(inv.value);
    const ratio = (inv.financing_ratio_percent || 60) / 100;
    return acc + value * ratio;
  }, 0);

  const isExistingContractStructure = application?.financing_structure?.structure_type === "existing_contract";
  const totalFinancingAmount = isExistingContractStructure
    ? applicationFinancingAmount + contractInvoicesFinancingAmount
    : applicationFinancingAmount;

  const approvedFacility = application?.contract?.contract_details?.approved_facility || 0;
  const contractValue = application?.contract?.contract_details?.value || 0;

  const formatRM = (n: number) =>
    `RM ${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const structureType = application?.financing_structure?.structure_type;
  let facilityLimit = 0;
  if (structureType === "new_contract") {
    facilityLimit = Number(contractValue || 0);
  }
  if (structureType === "existing_contract") {
    facilityLimit = Number(approvedFacility || 0);
  }

  const liveAvailableFacility = isExistingContractStructure
    ? approvedFacility - contractInvoicesFinancingAmount - applicationFinancingAmount
    : facilityLimit - totalFinancingAmount;

  const hasPendingFiles = Object.keys(selectedFiles).length > 0;
  const hasPartialRows = invoices.some((inv) => isRowPartial(inv));
  const allRowsValid = invoices.every((inv) => validateRow(inv));

  let validationError = "";
  const isInvoiceOnly = application?.financing_structure?.structure_type === "invoice_only";
  const isExistingContract = application?.financing_structure?.structure_type === "existing_contract";

  if (hasPartialRows) {
    validationError = "Please complete all invoice details. Rows cannot have partial data.";
  }

  if (!validationError && (isInvoiceOnly || isExistingContract)) {
    const hasAtLeastOneValidInvoice =
      invoices.some((inv) => !isRowEmpty(inv) && validateRow(inv)) || (isExistingContract && contractInvoices.length > 0);
    if (!hasAtLeastOneValidInvoice) {
      validationError = "Please add at least one valid invoice with all fields filled (invoice number, value, maturity date, document).";
    }
  }

  if (!isInvoiceOnly && !validationError) {
    const invalidRatioInvoice = invoices.find(
      (inv) => !isRowEmpty(inv) && (inv.financing_ratio_percent! < 60 || inv.financing_ratio_percent! > 80)
    );
    if (invalidRatioInvoice) {
      validationError = "Financing ratio must be between 60% and 80%.";
    }
    if (!validationError && totalFinancingAmount > facilityLimit) {
      validationError = `Total financing amount (${formatRM(totalFinancingAmount)}) exceeds facility limit (${formatRM(facilityLimit)}).`;
    }
  }

  const saveFunction = async () => {
    const apiClient = createApiClient(API_URL, getAccessToken);
    const token = await getAccessToken();

    for (const invoiceId of Object.keys(deletedInvoices)) {
      await apiClient.deleteInvoice(invoiceId);
    }

    for (const inv of invoices) {
      if (isRowEmpty(inv)) continue;

      let invoiceId = inv.id;
      let currentS3Key = lastS3Keys[inv.id] || lastS3Keys[invoiceId];

      if (!inv.isPersisted) {
        const createPayload: any = {
          applicationId,
          details: {
            number: inv.number,
            value: Number(inv.value),
            maturity_date: inv.maturity_date,
            financing_ratio_percent: inv.financing_ratio_percent || 60,
          },
        };

        if (isExistingContract && application?.contract_id) {
          createPayload.contractId = application.contract_id;
        }

        const createResp: any = await apiClient.createInvoice(createPayload);
        if (!createResp?.success) {
          throw new Error("Failed to create invoice");
        }
        invoiceId = createResp.data.id;
      } else {
        await apiClient.updateInvoice(invoiceId, {
          number: inv.number,
          value: Number(inv.value),
          maturity_date: inv.maturity_date,
          financing_ratio_percent: inv.financing_ratio_percent || 60,
        });
      }

      const file = selectedFiles[inv.id] || selectedFiles[invoiceId];
      if (!file) continue;

      const existingS3Key = currentS3Key;
      const urlResp = await fetch(`${API_URL}/v1/invoices/${invoiceId}/upload-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          existingS3Key,
        }),
      });

      const urlJson = await urlResp.json();
      if (!urlJson.success) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, s3Key } = urlJson.data;
      currentS3Key = s3Key;

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await apiClient.updateInvoice(invoiceId, {
        document: {
          file_name: file.name,
          file_size: file.size,
          s3_key: s3Key,
        },
      });
      setLastS3Keys((prev) => ({
        ...prev,
        [invoiceId]: s3Key,
      }));

      setInvoices((prev) =>
        prev.map((row) =>
          row.id === inv.id
            ? {
              ...row,
              id: invoiceId,
              isPersisted: true,
              document: {
                file_name: file.name,
                file_size: file.size,
                s3_key: s3Key,
              },
            }
            : row
        )
      );
    }

    setSelectedFiles({});
    setDeletedInvoices({});
    return { success: true };
  };

  const hasUnsavedChanges =
    invoices.some((inv) => !inv.isPersisted && !isRowEmpty(inv)) ||
    invoices.some((inv) => hasRowChanged(inv)) ||
    Object.keys(selectedFiles).length > 0 ||
    Object.keys(deletedInvoices).length > 0;

  React.useEffect(() => {
    let isValid = !hasPartialRows && !validationError;
    onDataChange?.({
      invoices,
      totalFinancingAmount,
      isValid,
      validationError,
      hasPendingChanges: hasUnsavedChanges,
      isUploading: false,
      saveFunction,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, contractInvoices, totalFinancingAmount, hasPendingFiles, allRowsValid, hasPartialRows, validationError, isInvoiceOnly, isExistingContract]);

  React.useEffect(() => {
    let mounted = true;
    const loadInvoices = async () => {
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        const resp: any = await apiClient.getInvoicesByApplication(applicationId);
        if (!("success" in resp) || !resp.success) return;
        const items: any[] = resp.data || [];
        const mapped: LocalInvoice[] = items.map((it) => {
          const d = it.details || {};
          return {
            id: it.id,
            isPersisted: true,
            number: d.number || "",
            status: it.status || "DRAFT",
            value: typeof d.value === "number" ? d.value.toFixed(2) : d.value ? Number(d.value).toFixed(2) : "",
            maturity_date: d.maturity_date || "",
            financing_ratio_percent: d.financing_ratio_percent || 60,
            document: d.document
              ? {
                file_name: d.document.file_name,
                file_size: d.document.file_size,
                s3_key: d.document.s3_key,
              }
              : null,
          };
        });
        const baseline: Record<string, LocalInvoice> = {};
        mapped.forEach((inv) => {
          baseline[inv.id] = inv;
        });
        setInitialInvoices(baseline);
        if (mounted) {
          setInvoices(mapped);
          const keys: Record<string, string> = {};
          mapped.forEach((inv) => {
            if (inv.document?.s3_key) {
              keys[inv.id] = inv.document.s3_key;
            }
          });
          setLastS3Keys(keys);
        }
      } catch (err) {
        console.error("Failed to load invoices", err);
      }
    };
    loadInvoices();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  return (
    <div className="space-y-10 px-3 max-w-[1200px] mx-auto">
      {/* ================= Contract ================= */}
      {application?.contract && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base sm:text-lg md:text-xl font-semibold">Contract</h3>
            <div className="mt-2 h-px bg-border" />
          </div>

          <div className="space-y-3 mt-4 px-3">
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-y-3">
              <div className="text-xs text-muted-foreground font-medium">Contract title</div>
              <div className="text-xs font-medium">{application.contract.contract_details?.title || "-"}</div>

              <div className="text-xs text-muted-foreground font-medium">Customer</div>
              <div className="text-xs font-medium">{application.contract.customer_details?.name || "-"}</div>

              <div className="text-xs text-muted-foreground font-medium">Contract value</div>
              <div className="text-xs font-medium">
                {application.contract.contract_details?.value
                  ? formatRM(Number(application.contract.contract_details.value))
                  : "-"}
              </div>

              <div className="text-xs text-muted-foreground font-medium">Approved facility</div>
              <div className="text-xs font-medium">
                {application.contract.contract_details?.approved_facility != null
                  ? formatRM(Number(application.contract.contract_details.approved_facility))
                  : "-"}
              </div>

              <div className="text-xs text-muted-foreground font-medium">Available facility</div>
              <div
                className={cn(
                  "text-xs font-medium",
                  liveAvailableFacility < 0 && "text-destructive"
                )}
              >
                {formatRM(Math.max(liveAvailableFacility ?? 0, 0))}
                {!approvedFacility && (
                  <div className="text-xs text-muted-foreground mt-1">
                    * Subject to credit approval
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= Invoice Details ================= */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base sm:text-lg md:text-xl font-semibold">
              Invoice details
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add invoices below. Rows are local until you Save and Continue.
            </p>
          </div>

          <Button onClick={addInvoice} className="bg-primary text-primary-foreground">
            Add invoice
          </Button>
        </div>

        <div className="mt-2 h-px bg-border" />

        {/* ================= Table ================= */}
        <div className="mt-4 px-3">
          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold">Invoice</TableHead>
                    <TableHead className="w-[90px] whitespace-nowrap text-xs font-semibold">Status</TableHead>
                    <TableHead className="w-[130px] whitespace-nowrap text-xs font-semibold">Maturity date</TableHead>
                    <TableHead className="w-[120px] whitespace-nowrap text-xs font-semibold">Value</TableHead>
                    <TableHead className="w-[180px] whitespace-nowrap text-xs font-semibold">Ratio</TableHead>
                    <TableHead className="w-[130px] whitespace-nowrap text-xs font-semibold">Amount</TableHead>
                    <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold">Document</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {/* CONTRACT INVOICES (READ ONLY) */}
                  {contractInvoices.map((inv) => {
                    const ratio = inv.financing_ratio_percent || 60;
                    const value = Number(inv.value || 0);
                    const financingAmount = value * (ratio / 100);

                    return (
                      <TableRow key={`contract-${inv.id}`} className="bg-muted/30 opacity-60">
                        <TableCell className="p-2 text-xs whitespace-nowrap">{inv.number}</TableCell>
                        <TableCell className="p-2"><StatusBadge status={inv.status} /></TableCell>
                        <TableCell className="p-2 text-xs whitespace-nowrap">{inv.maturity_date}</TableCell>
                        <TableCell className="p-2 text-xs whitespace-nowrap">{inv.value}</TableCell>
                        <TableCell className="p-2 text-xs whitespace-nowrap">{ratio}%</TableCell>
                        <TableCell className="p-2 text-xs tabular-nums whitespace-nowrap">
                          {formatRM(financingAmount)}
                        </TableCell>
                        <TableCell className="p-2 text-xs truncate">{inv.document?.file_name || "-"}</TableCell>
                        <TableCell className="p-2" />
                      </TableRow>
                    );
                  })}

                  {/* APPLICATION INVOICES */}
                  {invoices.map((inv) => {
                    const ratio = inv.financing_ratio_percent || 60;
                    const value = Number(inv.value || 0);
                    const financingAmount = value * (ratio / 100);
                    const isDisabled = !!inv.status && inv.status !== "DRAFT";
                    const isEditable = inv.status === "DRAFT" || !inv.status;

                    return (
                      <TableRow key={inv.id} className="hover:bg-muted/40">
                        <TableCell className="p-2">
                          <Input
                            value={inv.number}
                            disabled={isDisabled}
                            onChange={(e) => updateInvoiceField(inv.id, "number", e.target.value)}
                            placeholder="eg. Invoice #"
                            className="h-9 text-xs"
                          />
                        </TableCell>

                        <TableCell className="p-2">
                          <StatusBadge status={inv.status} />
                        </TableCell>

                        <TableCell className="p-2">
                          <DateInput
                            value={inv.maturity_date?.slice(0, 10) || ""}
                            onChange={(v) => updateInvoiceField(inv.id, "maturity_date", v)}
                            placeholder="Enter date"
                            className={isDisabled ? "opacity-60 pointer-events-none" : ""}
                          />
                        </TableCell>

                        <TableCell className="p-2">
                          <Input
                            value={inv.value}
                            disabled={isDisabled}
                            placeholder="0.00"
                            onChange={(e) => updateInvoiceField(inv.id, "value", e.target.value)}
                            onBlur={() => {
                              if (inv.value !== "") {
                                const normalized = Number(inv.value).toFixed(2);
                                updateInvoiceField(inv.id, "value", normalized);
                              }
                            }}
                            className="h-9 text-xs"
                          />
                        </TableCell>

                        <TableCell className="p-2">
                          <div className="space-y-1">
                            <div
                              className="relative text-[10px] font-medium text-muted-foreground"
                              style={{
                                left: `${((ratio - 60) / 20) * 100}%`,
                                transform: "translateX(-50%)",
                                width: "fit-content",
                              }}
                            >
                              <div className="rounded-md border border-border bg-white px-2 py-0.5 text-[10px] font-medium text-black shadow-sm">
                                {ratio}%
                              </div>
                            </div>

                            <Slider
                              min={60}
                              max={80}
                              step={1}
                              value={[ratio]}
                              disabled={isDisabled}
                              onValueChange={(value) =>
                                updateInvoiceField(inv.id, "financing_ratio_percent", value[0])
                              }
                              className="
                                relative
                                [&_[data-orientation=horizontal]]:h-1.5
                                [&_[data-orientation=horizontal]]:bg-muted
                                [&_[data-orientation=horizontal]>span]:bg-primary
                                [&_[role=slider]]:h-4
                                [&_[role=slider]]:w-4
                                [&_[role=slider]]:border-2
                                [&_[role=slider]]:border-primary
                                [&_[role=slider]]:bg-background
                                [&_[role=slider]]:shadow-none
                              "
                            />

                            <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                              <span>60%</span>
                              <span>80%</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="p-2 text-xs tabular-nums whitespace-nowrap">
                          {formatRM(financingAmount)}
                        </TableCell>

                        <TableCell className="p-2">
                          {inv.document ? (
                            <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] w-full h-8">
                              <div className="w-3 h-3 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                                <CheckIconSolid className="h-2 w-2 text-background" />
                              </div>
                              <span className="text-xs font-medium truncate flex-1">
                                {inv.document.file_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (inv.document?.s3_key) {
                                    setLastS3Keys((prev) => ({
                                      ...prev,
                                      [inv.id]: inv.document!.s3_key!,
                                    }));
                                  }
                                  updateInvoiceField(inv.id, "document", null);
                                  setSelectedFiles((prev) => {
                                    const copy = { ...prev };
                                    delete copy[inv.id];
                                    return copy;
                                  });
                                }}
                                className={cn(
                                  "shrink-0",
                                  isEditable
                                    ? "text-muted-foreground hover:text-foreground cursor-pointer"
                                    : "opacity-40 cursor-not-allowed"
                                )}
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <label className="inline-flex items-center gap-1 text-xs font-medium text-primary cursor-pointer hover:opacity-80 h-8">
                              <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">Upload</span>
                              <Input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                disabled={isDisabled}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleFileChange(inv.id, f, inv.document?.s3_key);
                                }}
                              />
                            </label>
                          )}
                        </TableCell>

                        <TableCell className="p-2">
                          <Button variant="ghost" size="sm" onClick={() => deleteInvoice(inv)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* TOTAL */}
                  <TableRow className="bg-muted/10">
                    <TableCell colSpan={5} />
                    <TableCell className="p-2 font-semibold text-xs">
                      {formatRM(totalFinancingAmount)}
                      <div className="text-xs text-muted-foreground font-normal">Total</div>
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* ================= Validation ================= */}
        {validationError && (
          <div className="mx-3 bg-primary/10 border border-primary text-primary px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 mt-4">
            <XMarkIcon className="h-5 w-5" />
            {validationError}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status = "DRAFT" }: { status?: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
    SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200",
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border",
        styles[status] || styles.DRAFT
      )}
    >
      {status}
    </span>
  );
}

export { InvoiceDetailsStep };
