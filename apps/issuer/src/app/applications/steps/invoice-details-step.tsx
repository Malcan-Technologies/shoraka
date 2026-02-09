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
import { Trash2 } from "lucide-react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { XMarkIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { Slider } from "@/components/ui/slider";
import { cn } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * AUTH TOKEN HOOK
 *
 * Get the current user's auth token for API requests.
 */

/**
 * LOCAL INVOICE STATE SHAPE
 *
 * Represents an invoice row with optional document.
 * - id: temp ID (inv-*) or persisted ID (cuid)
 * - number, value, maturity_date: user-entered values
 * - document: null until uploaded or loaded
 */
type LocalInvoice = {
  id: string; // UI id OR backend id
  isPersisted: boolean; // ⭐ NEW
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
  /**
   * LOCAL STATE
   *
   * - invoices: array of LocalInvoice (application/draft invoices shown in table)
   * - selectedFiles: Map of invoice ID → File (selected but not yet uploaded)
   * - application: loaded application data
   * - lastS3Keys: Map of invoice ID → last S3 key (for versioning on replace)
   * - deletedInvoices: invoices marked for deletion (only draft/application ones)
   * - initialInvoices: baseline for change detection
   * - contractInvoices: approved/submitted invoices from linked contract (read-only)
   */
  const [invoices, setInvoices] = React.useState<LocalInvoice[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});
  const [application, setApplication] = React.useState<any>(null);
  const [lastS3Keys, setLastS3Keys] = React.useState<Record<string, string>>({});
  const [deletedInvoices, setDeletedInvoices] = React.useState<
    Record<string, { s3_key?: string }>
  >({});
  const [initialInvoices, setInitialInvoices] = React.useState<Record<string, LocalInvoice>>({});
  const [contractInvoices, setContractInvoices] = React.useState<LocalInvoice[]>([]);






  /** Get access token for API calls */
  const { getAccessToken } = useAuthToken();

  /**
   * FETCH APPLICATION DATA
   *
   * Load application and contract details, including approved/submitted invoices
   * from the linked contract (if existing_contract financing structure).
   */
  React.useEffect(() => {
    let mounted = true;
    const loadApplication = async () => {
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        const resp: any = await apiClient.get(`/v1/applications/${applicationId}`);
        if (resp.success && mounted) {
          console.log('hi', resp.data)
          setApplication(resp.data);

          /**
           * LOAD CONTRACT INVOICES
           *
           * If financing structure is existing_contract and contract exists,
           * fetch approved/submitted invoices belonging to that contract.
           */
          const financingStructure = resp.data?.financing_structure;
          const contractId = resp.data?.contract_id;
          const isExistingContract = financingStructure?.structure_type === "existing_contract";

          if (isExistingContract && contractId) {
            try {
              const contractResp: any = await apiClient.get(`/v1/contracts/${contractId}/invoices`);
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

  /**
   * ADD INVOICE ROW
   *
   * Creates a new empty row locally.
   * Not persisted to DB until Save and Continue.
   */
  const addInvoice = () => {
    setInvoices((s) => [
      ...s,
      {
        id: crypto.randomUUID(), // UI-only
        isPersisted: false,       // ⭐
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


  /**
   * UPDATE INVOICE FIELD
   *
   * Updates a specific field on an invoice row.
   */
  const updateInvoiceField = (id: string, field: keyof LocalInvoice, value: any) => {
    setInvoices((s) => s.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
  };

  /**
   * HANDLE FILE CHANGE
   *
   * User selected a file for an invoice.
   * - Store File in memory (not uploaded yet)
   * - Update preview with file name/size
   * - Keep existing s3_key if present (for versioning later)
   */
  const handleFileChange = (
    id: string,
    file: File,
    existingS3Key?: string
  ) => {

    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Invalid file type", { description: "Only PDF files are allowed" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "File size must be less than 5MB" });
      return;
    }

    // Store file for later upload
    setSelectedFiles((p) => ({ ...p, [id]: file }));

    // Update preview with file name

    updateInvoiceField(id, "document", {
      file_name: file.name,
      file_size: file.size,
      s3_key: existingS3Key, // ⭐ PRESERVE THIS
    });




    toast.success("File selected");
  };

  /**
   * VALIDATION HELPERS
   *
   * isRowEmpty: row has no meaningful data (all defaults, untouched)
   * isRowPartial: row has SOME data but not all (user touched it but didn't fill it)
   * validateRow: row is either completely empty OR completely filled
   *
   * Required fields: invoice number, value, maturity date, document
   * Financing ratio is optional (defaults to 60%)
   */
  const isRowEmpty = (inv: LocalInvoice) => {
    return (
      !inv.number &&
      inv.value === "" &&

      !inv.maturity_date &&
      !inv.document
    );
  };

  const isRowPartial = (inv: LocalInvoice) => {
    if (isRowEmpty(inv)) return false; // empty rows are not partial
    const hasNumber = Boolean(String(inv.number).trim());
    const hasValue = inv.value !== "" && Number(inv.value) > 0;

    const hasDate = Boolean(String(inv.maturity_date).trim());
    const hasDocument = Boolean(inv.document) || Boolean(selectedFiles[inv.id]);

    // Count how many fields are filled (4 required: number, value, date, document)
    const filledCount = [hasNumber, hasValue, hasDate, hasDocument].filter(Boolean).length;
    // If any but not all fields are filled, it's partial
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


  /**
   * COMPUTE DERIVED STATE
   *
   * totalFinancingAmount: sum of (value * financing_ratio_percent / 100) for all rows
   * hasPendingFiles: any files selected but not yet uploaded
   * allRowsValid: all rows are either empty or completely filled (no partial rows)
   * hasPartialRows: any row is partial (user touched it but didn't complete it)
   */
  const totalFinancingAmount = invoices.reduce((acc, inv) => {
    const value = inv.value === "" ? 0 : Number(inv.value);
    const ratio = (inv.financing_ratio_percent || 60) / 100;
    return acc + value * ratio;
  }, 0);

  const approvedFacility =
    application?.contract?.contract_details?.approved_facility || 0;

  const contractValue =
    application?.contract?.contract_details?.value || 0;

  console.log(contractValue);

  // =======================
  // Formatting helpers
  // =======================
  const formatRM = (n: number) =>
    `RM ${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;


  // Effective ceiling

  const structureType = application?.financing_structure?.structure_type;

  let facilityLimit = 0;

  if (structureType === "new_contract") {
    facilityLimit = Number(contractValue || 0);
  }

  if (structureType === "existing_contract") {
    facilityLimit = Number(approvedFacility || 0);
  }


  // LIVE available facility (this changes as user types)
  const liveAvailableFacility =
    facilityLimit - totalFinancingAmount;



  const hasPendingFiles = Object.keys(selectedFiles).length > 0;
  /**
   * PARTIAL ROWS CHECK
   *
   * For existing contracts: check both application AND contract invoices for partial data.
   * If ANY row has partial data (user touched but didn't complete), block save.
   */
  const hasPartialRows = invoices.some((inv) => isRowPartial(inv));
  const allRowsValid = invoices.every((inv) => validateRow(inv));

  /**
   * FINANCIAL VALIDATION
   *
   * Validate financing ratios are within 60-80% range and total financing
   * does not exceed approved facility or contract value.
   * 
   * For existing contracts: 
   * - MUST have at least one valid invoice (ALL columns filled: number, value, date, document)
   * - Cannot save without at least one complete invoice
   * 
   * For other structures (new_contract, invoice_only):
   * - Allow empty rows (user can add and leave blank)
   * - Only validate partial rows (if user starts filling, they must complete)
   */
  let validationError = "";

  // For existing contracts ONLY: require at least one FULLY valid invoice
  const isExistingContract = application?.financing_structure?.structure_type === "existing_contract";



  if (isExistingContract) {
    const hasAtLeastOneValidInvoice =
      invoices.some(
        (inv) => !isRowEmpty(inv) && validateRow(inv)
      ) || contractInvoices.length > 0;

    if (!hasAtLeastOneValidInvoice) {
      validationError =
        "Please add at least one valid invoice with all fields filled (invoice number, value, maturity date, document).";
    }
  }


  // Check financing ratios are within valid range (only for non-empty rows)
  const invalidRatioInvoice = invoices.find(
    (inv) => !isRowEmpty(inv) && (inv.financing_ratio_percent! < 60 || inv.financing_ratio_percent! > 80)
  );
  if (invalidRatioInvoice) {
    validationError = "Financing ratio must be between 60% and 80%.";
  }

  // Check if total financing exceeds facility limits
  if (!validationError && totalFinancingAmount > facilityLimit) {
    validationError = `Total financing amount (${formatRM(
      totalFinancingAmount
    )}) exceeds facility limit (${formatRM(facilityLimit)}).`;
  }



  const saveFunction = async () => {
    const apiClient = createApiClient(API_URL, getAccessToken);
    const token = await getAccessToken();

    // 🧨 Commit deletions on Save & Continue
    // 🧨 Commit deletions on Save & Continue
    for (const invoiceId of Object.keys(deletedInvoices)) {
      await apiClient.deleteInvoice(invoiceId);
    }


    for (const inv of invoices) {
      if (isRowEmpty(inv)) continue;

      let invoiceId = inv.id;
      let currentS3Key =
        lastS3Keys[inv.id] ||
        lastS3Keys[invoiceId];



      // 1️⃣ CREATE only if not persisted
      if (!inv.isPersisted) {
        const createResp: any = await apiClient.createInvoice({
          applicationId,
          details: {
            number: inv.number,
            value: Number(inv.value),
            maturity_date: inv.maturity_date,
            financing_ratio_percent: inv.financing_ratio_percent || 60,
          },
        });

        if (!createResp?.success) {
          throw new Error("Failed to create invoice");
        }

        invoiceId = createResp.data.id;
      } else {
        // 2️⃣ UPDATE existing invoice
        await apiClient.updateInvoice(invoiceId, {
          number: inv.number,
          value: Number(inv.value),
          maturity_date: inv.maturity_date,
          financing_ratio_percent: inv.financing_ratio_percent || 60,
        });
      }

      // 3️⃣ Upload document if user selected one
      const file = selectedFiles[inv.id] || selectedFiles[invoiceId];

      if (!file) continue;


      const existingS3Key = currentS3Key;

      const urlResp = await fetch(
        `${API_URL}/v1/invoices/${invoiceId}/upload-url`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
            existingS3Key
          }),
        }
      );


      const urlJson = await urlResp.json();
      if (!urlJson.success) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, s3Key } = urlJson.data;
      currentS3Key = s3Key;

      console.log("VERSION DEBUG", {
        invoiceId: inv.id,
        existingS3Key: inv.document?.s3_key,
      });

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // 4️⃣ Attach document
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
              id: invoiceId,          // in case it was newly created
              isPersisted: true,
              document: {
                file_name: file.name,
                file_size: file.size,
                s3_key: s3Key,         // ⭐ THIS IS THE KEY FIX
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
    // any new non-empty rows
    invoices.some((inv) => !inv.isPersisted && !isRowEmpty(inv)) ||

    // any persisted row modified
    invoices.some((inv) => hasRowChanged(inv)) ||

    // any file selected
    Object.keys(selectedFiles).length > 0 ||

    // any persisted invoice marked for deletion
    Object.keys(deletedInvoices).length > 0;


  /**
   * EFFECT: NOTIFY PARENT OF DATA CHANGES
   *
   * Send current state to parent page so it can decide when to enable Save button.
   * isValid is FALSE if there are any partial rows (user touched but didn't complete them)
   * or if existing contract has no valid invoices.
   */
  React.useEffect(() => {
    onDataChange?.({
      invoices,
      totalFinancingAmount,
      isValid: allRowsValid && !hasPartialRows && !validationError,
      validationError,
      hasPendingChanges: hasUnsavedChanges,
      isUploading: false,
      saveFunction,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    invoices,
    contractInvoices,
    totalFinancingAmount,
    hasPendingFiles,
    allRowsValid,
    hasPartialRows,
    validationError
  ]);


  // Load persisted invoices for this application on mount
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
            id: it.id,                // backend id
            isPersisted: true,        // ⭐
            number: d.number || "",
            status: it.status || "DRAFT",
            value:
              typeof d.value === "number"
                ? d.value.toFixed(2)
                : d.value
                  ? Number(d.value).toFixed(2)
                  : "",
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
    <div className="space-y-6 pb-8">
      {/* Contract Summary */}
      {application?.contract && (
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold">Contract</h2>
          <div className="space-y-3">
            {/* Contract Title */}
            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Contract title</div>
              <div className="text-sm font-medium">{application.contract.contract_details?.title || "-"}</div>
            </div>

            {/* Customer */}
            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Customer</div>
              <div className="text-sm font-medium">{application.contract.customer_details?.name || "-"}</div>
            </div>

            {/* Contract Value */}

            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Contract value</div>
              <div className="text-sm font-medium">
                {application.contract.contract_details?.value
                  ? formatRM(Number(application.contract.contract_details.value))
                  : "-"}

              </div>
            </div>

            {/* Approved Facility */}
            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Approved facility</div>
              <div className="text-sm font-medium">
                {application.contract.contract_details?.approved_facility != null
                  ? formatRM(Number(application.contract.contract_details.approved_facility))
                  : "-"}
              </div>
            </div>

            {/* Utilised Facility */}
            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Utilised facility</div>
              <div className="text-sm font-medium">
                {application.contract.contract_details?.utilised_facility != null
                  ? formatRM(Number(application.contract.contract_details.utilised_facility))
                  : "-"}
              </div>
            </div>


            {/* Available Facility */}
            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Available facility</div>


              <div
                className={cn(
                  "text-sm font-medium",
                  liveAvailableFacility !== null && liveAvailableFacility < 0
                    ? "text-destructive"
                    : ""
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
        </section>
      )}

      {/* Invoices Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-semibold">Invoice details</h2>
            <p className="text-sm text-muted-foreground mt-1">Add invoices below. Rows are local until you Save and Continue.</p>
            {isExistingContract && contractInvoices.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded bg-muted/50"></span>
                Grayed rows are from your existing contract (read-only)
              </p>
            )}
          </div>
          <Button onClick={addInvoice} className="bg-primary text-primary-foreground">Add invoice</Button>
        </div>



        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">

              <TableHeader className="bg-muted/30">
                <TableRow className="border-b">
                  <TableHead className="w-[160px]">Invoice</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[160px]">Maturity Date</TableHead>
                  <TableHead className="w-[160px]">Invoice Value</TableHead>
                  <TableHead className="w-[220px]">Financing Ratio</TableHead>
                  <TableHead className="w-[160px]">Financing Amount</TableHead>
                  <TableHead className="w-[180px]">Documents</TableHead>
                  <TableHead className="w-[60px]"></TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {/* APPLICATION/DRAFT INVOICES */}
                {invoices.map((inv) => {
                  const isDraft = !inv.status || inv.status === "DRAFT";
                  const isTemp = !inv.isPersisted;
                  const canDelete = isDraft || isTemp;

                  const isEditable = isDraft;

                  const isDisabled = !isEditable;


                  const ratio = inv.financing_ratio_percent || 60;
                  const invoiceValue = inv.value === "" ? 0 : Number(inv.value);
                  const financingAmount = invoiceValue * (ratio / 100);


                  return (
                    <TableRow
                      key={inv.id}
                      className="hover:bg-muted/50"
                    >

                      {/* Invoice */}
                      <TableCell>
                        <Input
                          value={inv.number}
                          onChange={(e) => updateInvoiceField(inv.id, "number", e.target.value)}
                          placeholder="#Invoice number"
                          disabled={isDisabled}
                        />
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>


                      {/* Maturity Date */}
                      <TableCell>
                        <Input
                          type="date"
                          value={inv.maturity_date}
                          onChange={(e) => updateInvoiceField(inv.id, "maturity_date", e.target.value)}
                          disabled={isDisabled}
                        />
                      </TableCell>

                      {/* Invoice Value */}
                      <TableCell>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          disabled={isDisabled}
                          value={inv.value}
                          onFocus={() => {
                            // focus
                          }}
                          onBlur={() => {
                            if (inv.value !== "") {
                              const normalized = Number(inv.value).toFixed(2);
                              updateInvoiceField(inv.id, "value", normalized);
                            }
                          }}
                          onChange={(e) => {
                            const raw = e.target.value;

                            // allow empty
                            if (raw === "") {
                              updateInvoiceField(inv.id, "value", "");
                              return;
                            }

                            // allow empty
                            if (raw === "") {
                              updateInvoiceField(inv.id, "value", "");
                              return;
                            }

                            // allow digits + optional decimals
                            if (!/^\d+(\.\d{0,2})?$/.test(raw)) return;

                            // HARD LIMIT: max 12 digits before decimal
                            const [intPart] = raw.split(".");
                            if (intPart.length > 12) return;

                            updateInvoiceField(inv.id, "value", raw);


                            updateInvoiceField(inv.id, "value", raw);
                          }}
                        />
                      </TableCell>

                      {/* Financing Ratio */}
                      <TableCell>
                        <div className="w-[180px] space-y-2">
                          {/* Tooltip */}
                          <div
                            className="relative text-[11px] font-medium text-muted-foreground"
                            style={{
                              left: `${((ratio - 60) / 20) * 100}%`,
                              transform: "translateX(-50%)",
                              width: "fit-content",
                            }}
                          >
                            <div className="rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-black shadow-sm">
                              {ratio}%
                            </div>

                          </div>

                          {/* Slider */}
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
                              [&_[data-orientation=horizontal]>span]:bg-destructive
                              [&_[role=slider]]:h-4
                              [&_[role=slider]]:w-4
                              [&_[role=slider]]:border-2
                              [&_[role=slider]]:border-destructive
                              [&_[role=slider]]:bg-background
                              [&_[role=slider]]:shadow-none
                            "
                          />

                          {/* Min / Max labels */}
                          <div className="flex justify-between text-[12px] font-medium text-muted-foreground">
                            <span>60%</span>
                            <span>80%</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Financing Amount */}
                      <TableCell>
                        <div className="text-sm font-medium whitespace-nowrap tabular-nums">
                          {formatRM(financingAmount)}
                        </div>

                      </TableCell>

                      {/* Documents */}
                      {/* Documents */}
                      <TableCell>
                        <div className="flex justify-end">
                          <div className="flex items-center gap-3">
                            <div className="w-[160px]">
                              {inv.document && !selectedFiles[inv.id] ? (
                                <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] w-full h-6">
                                  {/* check */}
                                  <div className="w-3.5 h-3.5 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                                    <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                                  </div>

                                  {/* filename */}
                                  <span className="text-[14px] font-medium truncate flex-1">
                                    {inv.document.file_name}
                                  </span>

                                  {/* remove */}
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

                                    <XMarkIcon className="h-3.5 w-3.5" />
                                  </button>

                                </div>
                              ) : (
                                <label
                                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-destructive whitespace-nowrap w-full cursor-pointer hover:opacity-80 h-6"
                                >
                                  <CloudArrowUpIcon className="h-4 w-4 shrink-0" />

                                  <span className="truncate">
                                    {selectedFiles[inv.id]
                                      ? selectedFiles[inv.id].name
                                      : "Upload file"}

                                  </span>

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
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Action Button */}
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            onClick={() => deleteInvoice(inv)}
                            disabled={!canDelete}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* CONTRACT INVOICES (READ-ONLY, GRAYED OUT) */}
                {contractInvoices.map((inv) => {
                  const ratio = inv.financing_ratio_percent || 60;
                  const invoiceValue = inv.value === "" ? 0 : Number(inv.value);
                  const financingAmount = invoiceValue * (ratio / 100);

                  return (
                    <TableRow
                      key={`contract-${inv.id}`}
                      className="bg-muted/30 opacity-60 hover:bg-muted/30"
                    >

                      {/* Invoice */}
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {inv.number}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>

                      {/* Maturity Date */}
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {inv.maturity_date}
                        </div>
                      </TableCell>

                      {/* Invoice Value */}
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {inv.value}
                        </div>
                      </TableCell>

                      {/* Financing Ratio */}
                      <TableCell>
                        <div className="w-[180px] space-y-2">
                          <div
                            className="relative text-[11px] font-medium text-muted-foreground"
                            style={{
                              left: `${((ratio - 60) / 20) * 100}%`,
                              transform: "translateX(-50%)",
                              width: "fit-content",
                            }}
                          >
                            <div className="rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-black shadow-sm opacity-60">
                              {ratio}%
                            </div>
                          </div>
                          <div className="flex justify-between text-[12px] font-medium text-muted-foreground">
                            <span>60%</span>
                            <span>80%</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Financing Amount */}
                      <TableCell>
                        <div className="text-sm font-medium whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatRM(financingAmount)}
                        </div>
                      </TableCell>

                      {/* Documents */}
                      <TableCell>
                        <div className="flex justify-end">
                          <div className="flex items-center gap-3">
                            <div className="w-[160px]">
                              {inv.document ? (
                                <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] w-full h-6 opacity-60">
                                  <div className="w-3.5 h-3.5 rounded-sm bg-muted flex items-center justify-center shrink-0">
                                    <CheckIconSolid className="h-2.5 w-2.5 text-muted-foreground" />
                                  </div>
                                  <span className="text-[14px] font-medium truncate flex-1 text-muted-foreground">
                                    {inv.document.file_name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[12px] text-muted-foreground">No document</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Action Button (disabled) */}
                      <TableCell>
                        <div className="flex justify-end">
                          <span className="text-[12px] text-muted-foreground font-medium">From contract</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                <TableRow className="bg-muted/10 font-bold">
                  {/* Skip columns 1–5 */}
                  <TableCell colSpan={5}></TableCell>

                  {/* Financing Amount column */}
                  <TableCell>
                    <div className="text-foreground whitespace-nowrap tabular-nums">
                      {formatRM(totalFinancingAmount)}
                    </div>
                    <div className="text-xs text-muted-foreground font-normal">Total</div>
                  </TableCell>

                  {/* Documents + Actions */}
                  <TableCell colSpan={2}></TableCell>
                </TableRow>


              </TableBody>
            </Table>
          </div>
        </div>

        {/* Validation Error Display */}
        {validationError && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 mt-4">
            <XMarkIcon className="h-5 w-5 shrink-0" />
            {validationError}
          </div>
        )}
      </section>
    </div>
  );
}

// Named export for compatibility
export { InvoiceDetailsStep };


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
