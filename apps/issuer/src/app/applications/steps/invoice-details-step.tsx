"use client";

/**
 * INVOICE DETAILS STEP
 *
 * - Manages invoice rows (local state until Save and Continue)
 * - File uploads to S3 with versioning (like supporting-documents-step)
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
  id: string;
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

/**
 * HELPER: Generate temporary invoice ID
 * Format: inv-{timestamp}-{random}
 */
function generateTempId() {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function InvoiceDetailsStep({ applicationId, onDataChange }: InvoiceDetailsStepProps) {
  /**
   * LOCAL STATE
   *
   * Manages invoice rows and pending operations.
   * - invoices: array of LocalInvoice (shown in table)
   * - selectedFiles: Map of invoice ID → File (selected but not yet uploaded)
   * - uploadingKeys: Set of invoice IDs currently uploading
   * - lastS3Keys: Map of invoice ID → last S3 key (for versioning on replace)
   */
  const [invoices, setInvoices] = React.useState<LocalInvoice[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});
  const [uploadingKeys, setUploadingKeys] = React.useState<Set<string>>(new Set());
  const [lastS3Keys, setLastS3Keys] = React.useState<Record<string, string>>({});
  const [deletedInvoiceIds, setDeletedInvoiceIds] = React.useState<Set<string>>(new Set());
  const [application, setApplication] = React.useState<any>(null);

  /** Get access token for API calls */
  const { getAccessToken } = useAuthToken();

  /**
   * FETCH APPLICATION DATA
   *
   * Load application and contract details for Contract Summary display
   */
  React.useEffect(() => {
    let mounted = true;
    const loadApplication = async () => {
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        const resp: any = await apiClient.get(`/v1/applications/${applicationId}`);
        if (resp.success && mounted) {
          setApplication(resp.data);
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
      { id: generateTempId(), number: "", value: "", maturity_date: "", financing_ratio_percent: 60, document: null, status: "DRAFT" },
    ]);
  };

  /**
   * DELETE INVOICE ROW
   *
   * - If temp ID (not yet persisted): remove locally
   * - If persisted ID: marked for deletion on Save
   */
  /**
   * DELETE INVOICE
   *
   * Mark invoice for deletion and remove from local state.
   * If invoice has a real ID (not temp), track it for DB deletion.
   */
  const deleteInvoice = (id: string) => {
      const inv = invoices.find((i) => i.id === id);
  if (inv?.status !== "DRAFT") return
    // If this is a persisted invoice (not temp), mark it for deletion
    if (!id.startsWith("inv-")) {
      setDeletedInvoiceIds((prev) => new Set([...prev, id]));
    }

    // If invoice has S3 document, track it for deletion
    if (inv?.document?.s3_key) {
      setLastS3Keys((prev) => ({ ...prev, [id]: inv.document!.s3_key! }));
    }

    // Remove from local state
    setInvoices((s) => s.filter((i) => i.id !== id));
    setSelectedFiles((p) => {
      const copy = { ...p };
      delete copy[id];
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
  const handleFileChange = (id: string, file?: File) => {
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
    const inv = invoices.find((i) => i.id === id);
    const existingS3Key = inv?.document?.s3_key;
    updateInvoiceField(
      id,
      "document",
      existingS3Key
        ? { file_name: file.name, file_size: file.size, s3_key: existingS3Key }
        : { file_name: file.name, file_size: file.size }
    );

    toast.success("File selected");
  };

  /**
   * REMOVE DOCUMENT
   *
   * - If pending upload: remove from selectedFiles
   * - If persisted: save the s3_key for deletion on next Save
   * - Clear document from row
   */
  const handleRemoveDocument = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;

    // If file is still pending (not uploaded yet), just remove it
    if (selectedFiles[id]) {
      setSelectedFiles((p) => {
        const c = { ...p };
        delete c[id];
        return c;
      });
      updateInvoiceField(id, "document", null);
      return;
    }

    // If persisted invoice with document, save s3_key for deletion on Save
    if (inv.document?.s3_key) {
      setLastS3Keys((d) => ({ ...d, [id]: inv.document!.s3_key! }));
    }
    updateInvoiceField(id, "document", null);
    toast.success("File removed");
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

  const hasPendingFiles = Object.keys(selectedFiles).length > 0;
  const hasPartialRows = invoices.some((inv) => isRowPartial(inv));
  const allRowsValid = invoices.every((inv) => validateRow(inv));

  /**
   * FINANCIAL VALIDATION
   *
   * Validate financing ratios are within 60-80% range and total financing
   * does not exceed approved facility or contract value.
   */
  let validationError = "";

  // Check financing ratios are within valid range
  const invalidRatioInvoice = invoices.find(
    (inv) => !isRowEmpty(inv) && (inv.financing_ratio_percent! < 60 || inv.financing_ratio_percent! > 80)
  );
  if (invalidRatioInvoice) {
    validationError = "Financing ratio must be between 60% and 80%.";
  }

  // Check if total financing exceeds facility limits
  if (!validationError && application?.contract?.contract_details) {
    const approvedFacility = application.contract.contract_details.approved_facility || 0;
    const contractValue = application.contract.contract_details.value || 0;
    const facilityLimit = approvedFacility > 0 ? approvedFacility : contractValue;

    if (facilityLimit > 0 && totalFinancingAmount > facilityLimit) {
      validationError = `Total financing amount (RM ${totalFinancingAmount.toFixed(2)}) exceeds facility limit (RM ${facilityLimit.toFixed(2)}).`;
    }
  }

  /**
   * UPLOAD FILES TO S3
   *
   * Called by handleSaveAndContinue via saveFunction.
   * Follows the same pattern as supporting-documents-step:
   * 1. For each selected file, request upload URL with existingS3Key (for versioning)
   * 2. Upload file to S3 via presigned URL
   * 3. Update invoice with new S3 key
   * 4. Delete old S3 key if replaced
   * 5. Return updated invoice data
   */
  const uploadFilesToS3 = React.useCallback(async () => {
    if (!applicationId || Object.keys(selectedFiles).length === 0) {
      return null;
    }

    const uploadResults = new Map<string, { s3_key: string; file_name: string }>();

    for (const [invoiceId, typedFile] of Object.entries(selectedFiles) as [string, File][]) {
      try {
        setUploadingKeys((prev) => new Set(prev).add(invoiceId));

        // Get existing S3 key for versioning (from lastS3Keys if we're replacing)
        const existingS3Key = lastS3Keys[invoiceId];

        const token = await getAccessToken();

        /**
         * REQUEST UPLOAD URL
         *
         * Pass existingS3Key so backend can increment version while keeping CUID.
         * This is how versioning is tracked.
         */
        const urlResponse = await fetch(`${API_URL}/v1/invoices/${invoiceId}/upload-url`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: typedFile.name,
            contentType: typedFile.type,
            fileSize: typedFile.size,
            existingS3Key: existingS3Key || undefined,
          }),
        });

        const urlResult = await urlResponse.json();
        if (!urlResult.success) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadUrl, s3Key } = urlResult.data;

        /**
         * UPLOAD TO S3
         *
         * Use presigned URL provided by backend.
         */
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: typedFile,
          headers: {
            "Content-Type": typedFile.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file");
        }

        /**
         * DELETE OLD S3 KEY IF REPLACED
         *
         * If we're uploading a new version, delete the old one.
         */
        if (existingS3Key && existingS3Key !== s3Key) {
          try {
            await fetch(`${API_URL}/v1/applications/${applicationId}/document`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ s3Key: existingS3Key }),
            });
          } catch (deleteError) {
            console.warn("Error deleting old file:", deleteError);
          }
        }

        uploadResults.set(invoiceId, {
          s3_key: s3Key,
          file_name: typedFile.name,
        });

        // Save new S3 key for next versioning
        setLastS3Keys((prev: any) => ({ ...prev, [invoiceId]: s3Key }));
      } catch (error) {
        toast.error(`Failed to upload ${typedFile.name}`);
        throw error;
      } finally {
        setUploadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(invoiceId);
          return next;
        });
      }
    }

    /**
     * MERGE UPLOAD RESULTS INTO LOCAL STATE
     *
     * Update each invoice with uploaded S3 key.
     */
    const updatedInvoices = invoices.map((inv) => {
      const result = uploadResults.get(inv.id);
      if (result) {
        return {
          ...inv,
          document: {
            file_name: result.file_name,
            file_size: selectedFiles[inv.id]?.size || inv.document?.file_size || 0,
            s3_key: result.s3_key,
          },
        };
      }
      return inv;
    });

    setInvoices(updatedInvoices);
    setSelectedFiles({});

    return updatedInvoices;
  }, [applicationId, selectedFiles, invoices, lastS3Keys, getAccessToken]);

  /**
   * SAVE FUNCTION
   *
   * Called by parent page when user clicks "Save and Continue".
   * This function:
   * 1. Creates new invoices for temp IDs
   * 1.5. Deletes marked invoices
   * 2. Uploads files to S3 (calls uploadFilesToS3)
   * 3. Updates each invoice with S3 keys and financing_ratio_percent
   * 4. Deletes old S3 keys if replaced
   * 5. Returns invoice snapshot for application-level persistence
   */
  const saveFunction = async () => {
    const apiClient = createApiClient(API_URL, getAccessToken);
    const updatedInvoices = invoices.map((inv) => ({ ...inv }));

    /**
     * STEP 1: CREATE INVOICES WITH TEMP IDS
     *
     * For any row with temp ID (inv-*), create the invoice in DB first.
     * Map temp IDs to real IDs so we can update them.
     */
    const idMap: Record<string, string> = {};
    for (const inv of updatedInvoices) {
      if (inv.id.startsWith("inv-")) {
        try {
          const resp: any = await apiClient.createInvoice({
            applicationId,
            contractId: undefined,
            details: {
              number: inv.number || "",
              value: typeof inv.value === "number" ? inv.value : Number(inv.value) || 0,
              maturity_date: inv.maturity_date || "",
              financing_ratio_percent: inv.financing_ratio_percent || 60,
              document: undefined,
            } as any,
          });
          if (!("success" in resp) || !resp.success) {
            throw new Error("Failed to create invoice");
          }
          const created = resp.data;
          idMap[inv.id] = created.id;
          inv.id = created.id;
        } catch (err) {
          console.error("Failed to create invoice", err);
          throw err;
        }
      }
    }

    /**
     * STEP 1.5: DELETE MARKED INVOICES
     *
     * Delete any invoices that were marked for deletion.
     */
    for (const invoiceId of deletedInvoiceIds) {
      try {
        await apiClient.deleteInvoice(invoiceId);
      } catch (err) {
        console.error("Failed to delete invoice", invoiceId, err);
        throw err;
      }
    }
    // Clear deletion tracking after saving
    setDeletedInvoiceIds(new Set());

    /**
     * STEP 2: UPLOAD PENDING FILES
     *
     * Upload any files that were selected.
     * This will also update S3 keys on the invoices.
     */
    if (Object.keys(selectedFiles).length > 0) {
      const updatedAfterUpload = await uploadFilesToS3();
      if (updatedAfterUpload) {
        for (let i = 0; i < updatedInvoices.length; i++) {
          const uploaded = updatedAfterUpload.find((inv) => inv.id === updatedInvoices[i].id);
          if (uploaded) {
            updatedInvoices[i] = uploaded;
          }
        }
      }
    }

    /**
     * STEP 3: PERSIST INVOICE DETAILS
     *
     * For each invoice, update the DB with final details.
     * This ensures number, value, maturity_date, financing_ratio_percent, and document are all saved.
     */
    for (const inv of updatedInvoices) {
        if (inv.status === "APPROVED") continue;
      
      if (!isRowEmpty(inv)) {
        try {
          const resp: any = await apiClient.updateInvoice(inv.id, {
            number: inv.number || "",
            value: typeof inv.value === "number" ? inv.value : Number(inv.value) || 0,
            maturity_date: inv.maturity_date || "",
            financing_ratio_percent: inv.financing_ratio_percent || 60,
            document: inv.document && inv.document.s3_key
              ? { file_name: inv.document.file_name, file_size: inv.document.file_size, s3_key: inv.document.s3_key }
              : undefined,
          } as any);
          if (!("success" in resp) || !resp.success) {
            throw new Error("Failed to persist invoice");
          }
        } catch (err) {
          console.error("Failed to update invoice", err);
          throw err;
        }
      }
    }

    /**
     * STEP 4: DELETE OLD S3 KEYS
     *
     * If any files were replaced or invoices deleted, delete the old S3 keys.
     */
    const token = await getAccessToken();
    for (const [invoiceId, oldS3Key] of Object.entries(lastS3Keys)) {
      const inv = updatedInvoices.find((i) => i.id === invoiceId);
      const isDeleted = deletedInvoiceIds.has(invoiceId);
      
      // Delete S3 key if invoice was deleted OR if document S3 key changed
      if ((isDeleted || !inv) || (inv && inv.document?.s3_key !== oldS3Key)) {
        try {
          await fetch(`${API_URL}/v1/applications/${applicationId}/document`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ s3Key: oldS3Key }),
          });
        } catch {
          // non-fatal
        }
      }
    }

    /**
     * STEP 5: RETURN INVOICE SNAPSHOT
     *
     * Build array of invoices (excluding empty rows) for application-level persistence.
     * This snapshot is used to update application.supporting_documents so that
     * the application row reflects changes to invoices (for versioning purposes).
     */
    const payload = updatedInvoices
      .filter((inv) => !isRowEmpty(inv))
      .map((inv) => ({
        number: inv.number,
        value: typeof inv.value === "number" ? inv.value : Number(inv.value) || 0,
        maturity_date: inv.maturity_date,
        financing_ratio_percent: inv.financing_ratio_percent || 60,
        document: inv.document
          ? { file_name: inv.document.file_name, file_size: inv.document.file_size, s3_key: inv.document.s3_key }
          : null,
      }));

    const invoiceSnapshot = updatedInvoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      s3_key: inv.document?.s3_key ?? null,
    }));

    return {
      invoices: payload,
      supporting_documents: {
        invoice_documents: invoiceSnapshot,
      },
    };
  };

  /**
   * EFFECT: NOTIFY PARENT OF DATA CHANGES
   *
   * Send current state to parent page so it can decide when to enable Save button.
   * isValid is FALSE if there are any partial rows (user touched but didn't complete them).
   */
  React.useEffect(() => {
    onDataChange?.({
      invoices,
      totalFinancingAmount,
      isValid: allRowsValid && !hasPartialRows && !validationError,
      validationError,
      hasPendingChanges: invoices.length > 0 || hasPendingFiles || deletedInvoiceIds.size > 0,
      isUploading: uploadingKeys.size > 0,
      saveFunction,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, totalFinancingAmount, hasPendingFiles, allRowsValid, uploadingKeys.size, hasPartialRows, deletedInvoiceIds.size, validationError]);

  // Load persisted invoices for this application on mount
  React.useEffect(() => {
    let mounted = true;
    const loadInvoices = async () => {
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        const resp: any = await apiClient.getInvoicesByApplication(applicationId);
        if (!("success" in resp) || !resp.success) return;
        const items: any[] = resp.data || [];
        console.log(items)
        const mapped: LocalInvoice[] = items.map((it) => {
          const d = it.details || {};
          return {
            id: it.id,
            number: d.number || "",
            // value: typeof d.value === "number" ? d.value : (d.value ? Number(d.value) : ""),
              status: it.status || "Draft",
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
        if (mounted) {
          setInvoices(mapped);
          // Pre-populate lastS3Keys so we can track versions on updates
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
              <div className="text-sm font-medium">{application.contract.contract_details?.value || "-"}</div>
            </div>

            {/* Approved Facility */}
            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Approved facility</div>
              <div className="text-sm font-medium">{application.contract.contract_details?.approved_facility || "-"}</div>
            </div>

            {/* Utilised Facility */}
            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Utilised facility</div>
              <div className="text-sm font-medium">{application.contract.contract_details?.utilised_facility || "-"}</div>
            </div>

            {/* Available Facility */}
            <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] gap-2 md:gap-4">
              <div className="text-sm text-muted-foreground">Available facility</div>
              <div className="text-sm font-medium">
                {(() => {
                  const approved = application.contract.contract_details?.approved_facility || 0;
                  const utilised = application.contract.contract_details?.utilised_facility || 0;
                  const contractValue = application.contract.contract_details?.value || 0;
                  const available = approved > 0 ? approved - utilised : contractValue - utilised;
                  return available || "-";
                })()}
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
          </div>
          <Button onClick={addInvoice} className="bg-primary text-primary-foreground">Add invoice</Button>
        </div>



        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b">
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Maturity Date</TableHead>
                  <TableHead>Invoice Value</TableHead>
                  <TableHead>Financing Ratio</TableHead>
                  <TableHead>Financing Amount</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const isUploading = uploadingKeys.has(inv.id);
                    const isDraft = !inv.status || inv.status === "DRAFT";
  const isTemp = inv.id.startsWith("inv-");
  const isEditable = isDraft;
  const canDelete = isDraft || isTemp;

  const isDisabled = !isEditable || isUploading;


                  const ratio = inv.financing_ratio_percent || 60;
                  const invoiceValue = inv.value === "" ? 0 : Number(inv.value);
                  const financingAmount = invoiceValue * (ratio / 100);


                  return (
                    // <TableRow key={inv.id} className={invalid ? "bg-destructive/10" : ""}>
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
{/* <TableCell>
  <span className="text-sm font-medium text-muted-foreground">
    {inv.status || "Draft"}
  </span>
</TableCell> */}
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

                            // allow digits + optional dot + max 2 decimals
                            if (!/^\d+(\.\d{0,2})?$/.test(raw)) return;

                            updateInvoiceField(inv.id, "value", raw);
                          }}
                        />
                      </TableCell>


                      {/* Financing Ratio */}
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



                      {/* <TableCell>
                        <div className="space-y-2">
                          <div className="text-xs font-medium">{ratio}%</div>
                          <input
                            type="range"
                            min="60"
                            max="80"
                            step="1"
                            value={ratio}
                            onChange={(e) =>
                              updateInvoiceField(inv.id, "financing_ratio_percent", Number(e.target.value))
                            }
                            disabled={isUploading}
                            className="w-full"
                          />
                        </div>
                      </TableCell> */}

                      {/* Financing Amount */}
                      <TableCell>
                        <div className="text-sm font-medium">
                          RM {financingAmount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </TableCell>

                      {/* Documents */}
                      {/* Documents */}
                      <TableCell>
                        <div className="flex justify-end">
                          <div className="flex items-center gap-3">
                            <div className="w-[160px]">
                              {inv.document && !selectedFiles[inv.id] && !isUploading ? (
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
  onClick={() => handleRemoveDocument(inv.id)}
  disabled={!isEditable || isUploading}
  className={cn(
    "shrink-0",
    isEditable
      ? "text-muted-foreground hover:text-foreground cursor-pointer"
      : "opacity-40 cursor-not-allowed"
  )}
>
  <XMarkIcon className="h-3.5 w-3.5" />
</button>

                                  {/* <button
                                    type="button"
                                    onClick={() => handleRemoveDocument(inv.id)}
                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                    disabled={isDisabled}
                                  >
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                  </button> */}
                                </div>
                              ) : (
                                <label
                                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-destructive whitespace-nowrap w-full cursor-pointer hover:opacity-80 h-6"
                                >
                                  <CloudArrowUpIcon className="h-4 w-4 shrink-0" />

                                  <span className="truncate">
                                    {isUploading
                                      ? "Uploading…"
                                      : selectedFiles[inv.id]
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
                                      if (f) handleFileChange(inv.id, f);
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-[260px]">
                            {inv.document && !selectedFiles[inv.id] ? (
                              <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] w-full h-6">
                                <span className="text-[14px] font-medium truncate flex-1">{inv.document.file_name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDocument(inv.id)}
                                  className="text-muted-foreground hover:text-foreground shrink-0"
                                  disabled={isUploading}
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <label className="cursor-pointer text-sm text-destructive inline-flex items-center gap-2">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="application/pdf"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) {
                                      handleFileChange(inv.id, f);
                                    }
                                  }}
                                  disabled={isUploading}
                                />
                                <span>
                                  {isUploading ? "Uploading…" : selectedFiles[inv.id] ? selectedFiles[inv.id].name : "Upload PDF"}
                                </span>
                              </label>
                            )}
                          </div>
                        </div>
                      </TableCell> */}

                      {/* Action Button */}
                      <TableCell>
                        <div className="flex justify-end">
                            <Button
  variant="ghost"
  onClick={() => deleteInvoice(inv.id)}
  disabled={!canDelete || isUploading}
>

                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/10 font-bold">
                  <TableCell colSpan={4}></TableCell>
                  <TableCell>
                    <div className="text-foreground">
                      RM{" "}
                      {totalFinancingAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground font-normal">Total</div>
                  </TableCell>
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
