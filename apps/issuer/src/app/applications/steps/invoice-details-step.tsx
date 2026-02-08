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
  value: number | "";
  maturity_date: string;
  financing_ratio_percent?: number;
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

  /** Get access token for API calls */
  const { getAccessToken } = useAuthToken();

  /**
   * ADD INVOICE ROW
   *
   * Creates a new empty row locally.
   * Not persisted to DB until Save and Continue.
   */
  const addInvoice = () => {
    setInvoices((s) => [
      ...s,
      { id: generateTempId(), number: "", value: "", maturity_date: "", document: null },
    ]);
  };

  /**
   * DELETE INVOICE ROW
   *
   * - If temp ID (not yet persisted): remove locally
   * - If persisted ID: marked for deletion on Save
   */
  const deleteInvoice = (id: string) => {
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
   * isRowEmpty: row has no meaningful data
   * validateRow: row is either empty OR completely filled
   */
  const isRowEmpty = (inv: LocalInvoice) => {
    return !inv.number && (inv.value === "" || inv.value === 0) && !inv.maturity_date && !inv.document;
  };

  const validateRow = (inv: LocalInvoice) => {
    if (isRowEmpty(inv)) return true;
    const hasNumber = Boolean(String(inv.number).trim());
    const hasValue = typeof inv.value === "number" && inv.value > 0;
    const hasDate = Boolean(String(inv.maturity_date).trim());
    const hasDocument = Boolean(inv.document) || Boolean(selectedFiles[inv.id]);
    return hasNumber && hasValue && hasDate && hasDocument;
  };

  /**
   * COMPUTE DERIVED STATE
   *
   * totalFinancingAmount: sum of (value * 0.8) for all rows
   * hasPendingFiles: any files selected but not yet uploaded
   * allRowsValid: all rows pass validation (empty OK, partial NOT OK)
   */
  const totalFinancingAmount = invoices.reduce((acc, inv) => acc + ((typeof inv.value === "number" ? inv.value : 0) * 0.8), 0);
  const hasPendingFiles = Object.keys(selectedFiles).length > 0;
  const allRowsValid = invoices.every((inv) => validateRow(inv));

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
   * 2. Uploads files to S3 (calls uploadFilesToS3)
   * 3. Updates each invoice with S3 keys
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
              document: undefined,
            },
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
     * This ensures number, value, maturity_date, and document are all saved.
     */
    for (const inv of updatedInvoices) {
      if (!isRowEmpty(inv)) {
        try {
          const resp: any = await apiClient.updateInvoice(inv.id, {
            number: inv.number || "",
            value: typeof inv.value === "number" ? inv.value : Number(inv.value) || 0,
            maturity_date: inv.maturity_date || "",
            document: inv.document && inv.document.s3_key
              ? { file_name: inv.document.file_name, file_size: inv.document.file_size, s3_key: inv.document.s3_key }
              : undefined,
          });
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
     * If any files were replaced, delete the old S3 keys.
     */
    const token = await getAccessToken();
    for (const [invoiceId, oldS3Key] of Object.entries(lastS3Keys)) {
      const inv = updatedInvoices.find((i) => i.id === invoiceId);
      if (inv && inv.document?.s3_key !== oldS3Key) {
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
   */
  React.useEffect(() => {
    onDataChange?.({
      invoices,
      totalFinancingAmount,
      isValid: allRowsValid,
      hasPendingChanges: invoices.length > 0 || hasPendingFiles,
      isUploading: uploadingKeys.size > 0,
      saveFunction,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, totalFinancingAmount, hasPendingFiles, allRowsValid, uploadingKeys.size]);

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
            id: it.id,
            number: d.number || "",
            value: typeof d.value === "number" ? d.value : (d.value ? Number(d.value) : ""),
            maturity_date: d.maturity_date || "",
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
                  const invalid = !validateRow(inv);
                  const isUploading = uploadingKeys.has(inv.id);
                  const ratio = inv.financing_ratio_percent || 60;
                  const invoiceValue = typeof inv.value === "number" ? inv.value : 0;
                  const financingAmount = invoiceValue * (ratio / 100);

                  return (
                    <TableRow key={inv.id} className={invalid ? "bg-destructive/10" : ""}>
                      {/* Invoice */}
                      <TableCell>
                        <Input
                          value={inv.number}
                          onChange={(e) => updateInvoiceField(inv.id, "number", e.target.value)}
                          placeholder="#Invoice number"
                          disabled={isUploading}
                        />
                      </TableCell>

                      {/* Maturity Date */}
                      <TableCell>
                        <Input
                          type="date"
                          value={inv.maturity_date}
                          onChange={(e) => updateInvoiceField(inv.id, "maturity_date", e.target.value)}
                          disabled={isUploading}
                        />
                      </TableCell>

                      {/* Invoice Value */}
                      <TableCell>
                        <Input
                          type="number"
                          value={inv.value as any}
                          onChange={(e) =>
                            updateInvoiceField(inv.id, "value", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))
                          }
                          placeholder="0"
                          disabled={isUploading}
                        />
                      </TableCell>

                      {/* Financing Ratio */}
                      <TableCell>
                        <div className="text-sm font-medium">{ratio}%</div>
                      </TableCell>

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
                      <TableCell>
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
                      </TableCell>

                      {/* Action Button */}
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="ghost" onClick={() => deleteInvoice(inv.id)} disabled={isUploading}>
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
      </section>
    </div>
  );
}

// Named export for compatibility
export { InvoiceDetailsStep };

