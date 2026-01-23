"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { Save } from "lucide-react";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";
import { useS3Upload } from "@/hooks/use-s3-upload";
import { toast } from "sonner";
import { format, parse, isValid } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface InvoiceRow {
  id: string;
  invoice: string;
  invoiceValue: string;
  maturityDate: string;
  duration: string;
  maxFinancingAmount: string;
  estimatedFees: string;
  documents: { fileName: string; s3Key: string } | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPE = "application/pdf";

function formatDate(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    if (isValid(date)) {
      return format(date, "d MMM, yyyy");
    }
    const date2 = new Date(dateString);
    if (isValid(date2)) {
      return format(date2, "d MMM, yyyy");
    }
    return dateString;
  } catch {
    try {
      const date = new Date(dateString);
      if (isValid(date)) {
        return format(date, "d MMM, yyyy");
      }
    } catch {
      return dateString;
    }
    return dateString;
  }
}


function EditableCell({
  isEditing,
  value,
  placeholder,
  onChange,
  displayValue,
}: {
  isEditing: boolean;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  displayValue: string;
}) {
  const [isFocused, setIsFocused] = React.useState(false);
  const showPlaceholder = !value && !isFocused;

  if (!isEditing) {
    return <div className="text-[17px] leading-7 text-foreground text-left break-words whitespace-normal" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{displayValue || "-"}</div>;
  }

  return (
    <div className="absolute inset-0 w-full h-full flex items-center">
      {showPlaceholder && (
        <span className="absolute inset-0 flex items-center justify-start text-muted-foreground pointer-events-none text-sm text-left px-6">
          {placeholder}
        </span>
      )}
      <Input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="absolute inset-0 w-full h-full px-6 py-4 !border-0 hover:!border hover:!border-primary rounded-none focus:outline-none focus:ring-0 focus:!border focus:!border-primary text-foreground bg-transparent shadow-none text-[17px] leading-7 text-left"
      />
    </div>
  );
}

function DateCell({
  isEditing,
  value,
  placeholder,
  onChange,
  displayValue,
}: {
  isEditing: boolean;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  displayValue: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isEditing) {
    return <div className="text-[17px] leading-7 text-foreground text-left break-words whitespace-normal" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>{displayValue || "-"}</div>;
  }

  return (
    <div className="absolute inset-0 w-full h-full flex items-center">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute inset-0 w-full h-full px-6 py-4 flex items-center justify-start text-left font-normal !border-0 hover:!border hover:!border-primary rounded-none focus:outline-none focus:ring-0 focus:!border focus:!border-primary text-foreground hover:text-foreground bg-transparent shadow-none hover:bg-transparent"
          >
            {value ? (
              <span className="text-sm text-left">{formatDate(value)}</span>
            ) : (
              <span className="text-muted-foreground text-sm text-left">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? parse(value, "yyyy-MM-dd", new Date()) : undefined}
            onSelect={(date) => {
              if (date && isValid(date)) {
                onChange(format(date, "yyyy-MM-dd"));
                setIsOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function InvoiceDetailsStep({
  applicationId,
  onDataChange,
}: StepComponentProps) {
  const { data: application } = useApplication(applicationId);
  const { uploadFile, isUploading } = useS3Upload(applicationId);

  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([
    {
      id: "1",
      invoice: "#3066",
      invoiceValue: "10,000",
      maturityDate: "2025-01-06",
      duration: "60 days",
      maxFinancingAmount: "8,000",
      estimatedFees: "XXX",
      documents: { fileName: "Invoice.pdf", s3Key: "invoice-1" },
    },
    {
      id: "2",
      invoice: "#3065",
      invoiceValue: "20,000",
      maturityDate: "2025-02-12",
      duration: "90 days",
      maxFinancingAmount: "16,000",
      estimatedFees: "XXX",
      documents: { fileName: "Invoice.pdf", s3Key: "invoice-2" },
    },
    {
      id: "3",
      invoice: "#3064",
      invoiceValue: "30,000",
      maturityDate: "2025-07-29",
      duration: "120 days",
      maxFinancingAmount: "24,000",
      estimatedFees: "XXX",
      documents: null,
    },
  ]);

  const [editingIds, setEditingIds] = React.useState<Set<string>>(new Set());
  const [tempValues, setTempValues] = React.useState<Record<string, Partial<InvoiceRow>>>({});
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  React.useEffect(() => {
    if (application?.invoiceDetails) {
      const data = application.invoiceDetails as InvoiceRow[];
      if (Array.isArray(data)) {
        setInvoices(data);
      }
    }
  }, [application]);

  const handleStartEdit = (id: string) => {
    const invoice = invoices.find((inv) => inv.id === id);
    if (invoice) {
      setEditingIds((prev) => new Set(prev).add(id));
      setTempValues((prev) => ({
        ...prev,
        [id]: {
          invoiceValue: invoice.invoiceValue,
          maturityDate: invoice.maturityDate,
          duration: invoice.duration,
          maxFinancingAmount: invoice.maxFinancingAmount,
          estimatedFees: invoice.estimatedFees,
        },
      }));
    }
  };

  const handleCancelEdit = (id: string) => {
    setEditingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setTempValues((prev) => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  };

  const handleSaveEdit = (id: string) => {
    const tempValue = tempValues[id];
    if (tempValue) {
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, ...tempValue } : inv))
      );
    }
    handleCancelEdit(id);
  };

  const handleTempChange = (id: string, field: keyof InvoiceRow, value: string) => {
    setTempValues((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleFileUpload = async (id: string, file: File) => {
    if (file.type !== ALLOWED_FILE_TYPE) {
      toast.error("Only PDF files are allowed");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be under 5MB");
      return;
    }

    const fileKey = `invoice-${id}-${Date.now()}`;
    const result = await uploadFile(file, fileKey);

    if (result) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id
            ? {
                ...inv,
                documents: {
                  fileName: result.file_name,
                  s3Key: result.s3_key,
                },
              }
            : inv
        )
      );
      toast.success("File uploaded successfully");
    }
  };

  const handleFileInputChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(id, file);
    }
    if (fileInputRefs.current[id]) {
      fileInputRefs.current[id]!.value = "";
    }
  };

  const handleRemoveFile = (id: string) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, documents: null } : inv))
    );
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  const isInvoiceComplete = (invoice: InvoiceRow, tempValue?: Partial<InvoiceRow>): boolean => {
    const value = { ...invoice, ...tempValue };
    return !!(
      value.invoiceValue &&
      value.maturityDate &&
      value.duration &&
      value.maxFinancingAmount &&
      value.estimatedFees &&
      value.documents
    );
  };

  const handleAddInvoice = () => {
    const newId = Date.now().toString();
    const newInvoice: InvoiceRow = {
      id: newId,
      invoice: `#${newId.slice(-4)}`,
      invoiceValue: "",
      maturityDate: "",
      duration: "",
      maxFinancingAmount: "",
      estimatedFees: "",
      documents: null,
    };
    
    setInvoices((prev) => [...prev, newInvoice]);
    
    setEditingIds((prev) => new Set(prev).add(newId));
    
    setTempValues((prev) => ({
      ...prev,
      [newId]: {
        invoiceValue: "",
        maturityDate: "",
        duration: "",
        maxFinancingAmount: "",
        estimatedFees: "",
      },
    }));
  };

  React.useEffect(() => {
    if (onDataChange) {
      onDataChange({
        invoiceDetails: invoices,
      });
    }
  }, [invoices, onDataChange]);

  const totalFinancing = invoices.reduce((sum, inv) => {
    const amount = parseFloat(inv.maxFinancingAmount.replace(/,/g, "")) || 0;
    return sum + amount;
  }, 0);

  return (
    <div className="space-y-12">
      <div>
        <div className="flex justify-between items-center border-b border-border pb-2 mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="font-semibold text-xl">Invoices</h3>
            <p className="text-sm text-muted-foreground mt-1 break-words">
              You may include multiple invoices in a single financing request, provided all invoices relate to the same underlying contract with the buyer
            </p>
          </div>
          <Button
            variant="default"
            onClick={handleAddInvoice}
            className="text-[17px] leading-7"
          >
            <PlusIcon className="h-4 w-4" />
            Add invoice
          </Button>
        </div>
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden mt-6">
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-[17px] leading-7 table-auto">
              <thead className="[&_tr]:border-b">
                <tr className="border-b bg-muted/50">
                  <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[10%]">Invoice</th>
                  <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[12%]">Invoice value</th>
                  <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[12%]">Maturity date</th>
                  <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[10%]">Duration</th>
                  <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[15%]">Max financing amount (80%)</th>
                  <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[15%]">Estimated Fees</th>
                  <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[26%]">Documents</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {invoices.map((invoice) => {
                  const isEditing = editingIds.has(invoice.id);
                  const tempValue = tempValues[invoice.id] || {};
                  const isUploadingFile = isUploading(`invoice-${invoice.id}`);
                  const cellClassName = isEditing
                    ? "p-0 relative overflow-visible"
                    : "px-6 py-4 align-middle text-left text-[17px] leading-7 text-foreground break-words";

                  return (
                    <tr
                      key={invoice.id}
                      className={`border-b transition-colors ${isEditing ? "bg-muted/30" : "hover:bg-muted/50"}`}
                    >
                      <td className="px-6 py-4 align-middle text-left font-semibold text-[17px] leading-7 text-foreground break-words">
                        {invoice.invoice}
                      </td>
                      <td className={cellClassName}>
                        <EditableCell
                          isEditing={isEditing}
                          value={tempValue.invoiceValue || ""}
                          placeholder="Enter invoice value"
                          onChange={(value) => handleTempChange(invoice.id, "invoiceValue", value)}
                          displayValue={invoice.invoiceValue}
                        />
                      </td>
                      <td className={cellClassName}>
                        <DateCell
                          isEditing={isEditing}
                          value={tempValue.maturityDate || ""}
                          placeholder="Enter date"
                          onChange={(value) => handleTempChange(invoice.id, "maturityDate", value)}
                          displayValue={invoice.maturityDate ? formatDate(invoice.maturityDate) : ""}
                        />
                      </td>
                      <td className={cellClassName}>
                        <EditableCell
                          isEditing={isEditing}
                          value={tempValue.duration || ""}
                          placeholder="Enter duration"
                          onChange={(value) => handleTempChange(invoice.id, "duration", value)}
                          displayValue={invoice.duration}
                        />
                      </td>
                      <td className={cellClassName}>
                        <EditableCell
                          isEditing={isEditing}
                          value={tempValue.maxFinancingAmount || ""}
                          placeholder="Enter financing amount"
                          onChange={(value) => handleTempChange(invoice.id, "maxFinancingAmount", value)}
                          displayValue={invoice.maxFinancingAmount}
                        />
                      </td>
                      <td className={cellClassName}>
                        <EditableCell
                          isEditing={isEditing}
                          value={tempValue.estimatedFees || ""}
                          placeholder="Enter fees"
                          onChange={(value) => handleTempChange(invoice.id, "estimatedFees", value)}
                          displayValue={invoice.estimatedFees}
                        />
                      </td>
                      <td className="px-6 py-4 align-middle text-left">
                        {isEditing ? (
                          <div className="flex items-center gap-3">
                            {invoice.documents && !isUploadingFile ? (
                              <div className="flex items-center gap-2 bg-background text-foreground border border-border text-[17px] leading-7 rounded-sm px-2 py-1 h-8 max-w-[200px] min-w-0 flex-1">
                                <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground flex-shrink-0">
                                  <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                                </div>
                                <span className="text-foreground truncate">{invoice.documents.fileName}</span>
                                <button
                                  onClick={() => handleRemoveFile(invoice.id)}
                                  className="hover:text-destructive transition-colors cursor-pointer flex-shrink-0"
                                  type="button"
                                  aria-label="Remove file"
                                >
                                  <XMarkIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <label
                                htmlFor={`file-input-${invoice.id}`}
                                className="flex items-center gap-1.5 text-primary font-medium cursor-pointer hover:underline h-8 text-[17px] leading-7"
                              >
                                <CloudArrowUpIcon className="h-4 w-4" />
                                {isUploadingFile ? "Uploading..." : "Upload file"}
                                <input
                                  ref={(el) => {
                                    fileInputRefs.current[invoice.id] = el;
                                  }}
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  onChange={(e) => handleFileInputChange(invoice.id, e)}
                                  className="hidden"
                                  id={`file-input-${invoice.id}`}
                                  disabled={isUploadingFile}
                                />
                              </label>
                            )}
                            <div className="flex items-center gap-2 flex-shrink-0 w-[72px] justify-end">
                              {isInvoiceComplete(invoice, tempValue) && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteInvoice(invoice.id)}
                                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                                    title="Delete invoice"
                                    aria-label="Delete invoice"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSaveEdit(invoice.id)}
                                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                                    title="Save"
                                    aria-label="Save invoice"
                                  >
                                    <Save className="h-4 w-4" strokeWidth={1.5} />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ) : invoice.documents ? (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-background text-foreground border border-border text-[17px] leading-7 rounded-sm px-2 py-1 h-8 max-w-[200px] min-w-0 flex-1">
                              <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground flex-shrink-0">
                                <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                              </div>
                              <span className="text-foreground truncate">{invoice.documents.fileName}</span>
                              <button
                                onClick={() => handleRemoveFile(invoice.id)}
                                className="hover:text-destructive transition-colors cursor-pointer flex-shrink-0"
                                type="button"
                                aria-label="Remove file"
                              >
                                <XMarkIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 w-[72px] justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteInvoice(invoice.id)}
                                className="text-muted-foreground hover:text-destructive h-8 w-8"
                                title="Delete invoice"
                                aria-label="Delete invoice"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(invoice.id)}
                                className="text-muted-foreground hover:text-foreground h-8 w-8"
                                title="Edit"
                                aria-label="Edit invoice"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <label
                              htmlFor={`file-input-${invoice.id}`}
                              className="flex items-center gap-1.5 text-primary font-medium cursor-pointer hover:underline h-8 text-[17px] leading-7"
                            >
                              <CloudArrowUpIcon className="h-4 w-4" />
                              Upload file
                              <input
                                ref={(el) => {
                                  fileInputRefs.current[invoice.id] = el;
                                }}
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => {
                                  if (!isEditing) {
                                    handleStartEdit(invoice.id);
                                  }
                                  handleFileInputChange(invoice.id, e);
                                }}
                                className="hidden"
                                id={`file-input-${invoice.id}`}
                              />
                            </label>
                            <div className="flex items-center gap-2 flex-shrink-0 w-[72px] justify-end">
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t bg-muted/50 font-medium">
                  <td colSpan={4} className="px-6 py-4 align-middle text-left"></td>
                  <td className="px-6 py-4 align-middle text-left font-semibold text-[17px] leading-7">{totalFinancing.toLocaleString()}</td>
                  <td className="px-6 py-4 align-middle text-left font-semibold text-[17px] leading-7">XXX</td>
                  <td className="px-6 py-4 align-middle text-left font-semibold text-[17px] leading-7">Total fess</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-muted-foreground text-sm italic mt-4 text-right border-b border-dotted border-border pb-2">
          Estimated fees based on 15% p.a. but exact amount will only be decided in offer letter
        </p>
      </div>
    </div>
  );
}
