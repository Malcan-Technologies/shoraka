 "use client";

/**
 * Invoice Details (mock-first)
 *
 * - Local state only.
 * - Add rows locally with Add invoice; nothing saved to DB until parent calls saveFunction (Save and Continue).
 * - Includes file input (keeps File in memory, no upload).
 * - Validation: empty rows allowed; partially-filled rows are invalid.
 */
import * as React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type LocalInvoice = {
  id: string;
  number: string;
  value: number | "";
  maturity_date: string;
  document?: { file_name: string; file_size: number; s3_key?: string } | null;
};

interface InvoiceDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

function generateTempId() {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function InvoiceDetailsStep({ applicationId, onDataChange }: InvoiceDetailsStepProps) {
  const [invoices, setInvoices] = React.useState<LocalInvoice[]>([]);
  const [pendingFiles, setPendingFiles] = React.useState<Record<string, File>>({});

  const addInvoice = () => {
    setInvoices((s) => [
      ...s,
      { id: generateTempId(), number: "", value: "", maturity_date: "", document: null },
    ]);
  };

  const deleteInvoice = (id: string) => {
    setInvoices((s) => s.filter((i) => i.id !== id));
    setPendingFiles((p) => {
      const copy = { ...p };
      delete copy[id];
      return copy;
    });
  };

  const updateInvoiceField = (id: string, field: keyof LocalInvoice, value: any) => {
    setInvoices((s) => s.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
  };

  const handleFileChange = (id: string, file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") return;
    setPendingFiles((p) => ({ ...p, [id]: file }));
    updateInvoiceField(id, "document", { file_name: file.name, file_size: file.size });
  };

  const isRowEmpty = (inv: LocalInvoice) => {
    return !inv.number && (inv.value === "" || inv.value === 0) && !inv.maturity_date && !inv.document;
  };

  const validateRow = (inv: LocalInvoice) => {
    if (isRowEmpty(inv)) return true;
    const hasNumber = Boolean(String(inv.number).trim());
    const hasValue = typeof inv.value === "number" && inv.value > 0;
    const hasDate = Boolean(String(inv.maturity_date).trim());
    const hasDocument = Boolean(inv.document) || Boolean(pendingFiles[inv.id]);
    return hasNumber && hasValue && hasDate && hasDocument;
  };

  const totalFinancingAmount = invoices.reduce((acc, inv) => acc + ((typeof inv.value === "number" ? inv.value : 0) * 0.8), 0);

  const hasPendingFiles = Object.keys(pendingFiles).length > 0;

  const allRowsValid = invoices.every((inv) => validateRow(inv));

  const { getAccessToken } = useAuthToken();

  const saveFunction = async () => {
    const apiClient = createApiClient(API_URL, getAccessToken);
    const uploadResults: Record<string, { s3_key: string; file_name: string }> = {};
    const updatedInvoices = invoices.map((inv) => ({ ...inv }));

    // First, create invoices that have temp ids
    const idMap: Record<string, string> = {};
    for (const inv of updatedInvoices) {
      if (inv.id.startsWith("inv-")) {
        // create invoice record
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
      }
    }

    // Upload pending files per invoice using invoice upload-url endpoint
    for (const [invoiceId, file] of Object.entries(pendingFiles) as [string, File][]) {
      const currentInvoiceId = idMap[invoiceId] ?? invoiceId;
      const inv = updatedInvoices.find((i) => i.id === currentInvoiceId);
      const existingS3Key = inv?.document?.s3_key;

      const resp: any = await apiClient.requestInvoiceUploadUrl(currentInvoiceId, {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        existingS3Key: existingS3Key || undefined,
      });

      if (!("success" in resp) || !resp.success) {
        throw new Error("Failed to get invoice upload URL");
      }

      const { uploadUrl, s3Key } = resp.data;

      const uploadResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResp.ok) {
        throw new Error("Failed to upload invoice file");
      }

      // Delete old key if replaced
      if (existingS3Key && existingS3Key !== s3Key) {
        try {
          await apiClient.deleteInvoiceDocument(currentInvoiceId, existingS3Key);
        } catch {
          // non-fatal
        }
      }

      // Persist document into invoice.details on the server
      try {
        const updateResp: any = await apiClient.updateInvoice(currentInvoiceId, {
          document: { file_name: file.name, file_size: file.size, s3_key: s3Key },
        });
        if (!("success" in updateResp) || !updateResp.success) {
          // log but do not block (upload succeeded)
          // eslint-disable-next-line no-console
          console.error("Failed to persist invoice document after upload", updateResp);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to call updateInvoice after upload", err);
      }

      uploadResults[currentInvoiceId] = { s3_key: s3Key, file_name: file.name };
    }

    // Merge upload results into invoices
    for (let i = 0; i < updatedInvoices.length; i++) {
      const inv = updatedInvoices[i];
      const r = uploadResults[inv.id];
      if (r) {
        updatedInvoices[i] = {
          ...inv,
          document: { file_name: r.file_name, file_size: pendingFiles[inv.id]?.size || inv.document?.file_size || 0, s3_key: r.s3_key },
        };
      }
    }

    setInvoices(updatedInvoices);
    setPendingFiles({});

    const payload = updatedInvoices
      .filter((inv) => !isRowEmpty(inv))
      .map((inv) => ({
        number: inv.number,
        value: typeof inv.value === "number" ? inv.value : Number(inv.value) || 0,
        maturity_date: inv.maturity_date,
        document: inv.document ? { file_name: inv.document.file_name, file_size: inv.document.file_size, s3_key: inv.document.s3_key } : null,
      }));

    return { invoices: payload };
  };

  React.useEffect(() => {
    onDataChange?.({
      invoices,
      totalFinancingAmount,
      isValid: allRowsValid,
      hasPendingChanges: invoices.length > 0,
      isUploading: hasPendingFiles,
      saveFunction,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, totalFinancingAmount, hasPendingFiles, allRowsValid]);

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
            document: d.document ? { file_name: d.document.file_name, file_size: d.document.file_size, s3_key: d.document.s3_key } : null,
          };
        });
        if (mounted) {
          setInvoices(mapped);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
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
                  <TableHead>Value (RM)</TableHead>
                  <TableHead>Maturity date</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const invalid = !validateRow(inv);
                  return (
                    <TableRow key={inv.id} className={invalid ? "bg-destructive/10" : ""}>
                      <TableCell>
                        <Input value={inv.number} onChange={(e) => updateInvoiceField(inv.id, "number", e.target.value)} placeholder="#Invoice number" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={inv.value as any} onChange={(e) => updateInvoiceField(inv.id, "value", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} placeholder="0" />
                      </TableCell>
                      <TableCell>
                        <Input type="date" value={inv.maturity_date} onChange={(e) => updateInvoiceField(inv.id, "maturity_date", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer text-sm text-destructive">
                            <input type="file" className="hidden" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(inv.id, f); }} />
                            {inv.document ? inv.document.file_name : "Upload PDF"}
                          </label>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="ghost" onClick={() => deleteInvoice(inv.id)}>Remove</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/10 font-bold">
                  <TableCell colSpan={3}></TableCell>
                  <TableCell>
                    <div className="text-foreground">RM {totalFinancingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-xs text-muted-foreground">Total financing amount</div>
                  </TableCell>
                  <TableCell></TableCell>
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

