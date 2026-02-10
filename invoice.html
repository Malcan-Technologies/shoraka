"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PlusIcon, CloudArrowUpIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { Save } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Standalone invoice details UI only.
 * No API calls, no DB. Editable cells + calendar; all state is local.
 */

interface Row {
  id: string;
  invoice: string;
  invoiceValue: string;
  maturityDate: string;
  duration: string;
  maxFinancingAmount: string;
  estimatedFees: string;
  hasDoc: boolean;
  docName: string;
}

function formatDateDisplay(dateString: string): string {
  if (!dateString) return "";
  try {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    if (isValid(date)) return format(date, "d MMM, yyyy");
    const d = new Date(dateString);
    if (isValid(d)) return format(d, "d MMM, yyyy");
  } catch {
    // ignore
  }
  return dateString;
}

function EditableCell({
  isEditing,
  value,
  placeholder,
  onChange,
  displayValue,
  className,
}: {
  isEditing: boolean;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  displayValue: string;
  className?: string;
}) {
  const [isFocused, setIsFocused] = React.useState(false);
  const showPlaceholder = !value && !isFocused;

  if (!isEditing) {
    return (
      <div
        className={`text-base leading-7 text-foreground text-left break-words whitespace-normal ${className || ""}`}
        style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
      >
        {displayValue || "-"}
      </div>
    );
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
        className={`absolute inset-0 w-full h-full px-6 py-6 !border-0 hover:!border hover:!border-primary rounded-none focus:outline-none focus:ring-0 focus:!border focus:!border-primary text-foreground bg-transparent shadow-none text-base leading-7 text-left ${className || ""}`}
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
    return (
      <div
        className="text-base leading-7 text-foreground text-left break-words whitespace-normal"
        style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
      >
        {displayValue || "-"}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full flex items-center">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute inset-0 w-full h-full px-6 py-6 flex items-center justify-start text-left font-normal !border-0 hover:!border hover:!border-primary rounded-none focus:outline-none focus:ring-0 focus:!border focus:!border-primary text-foreground hover:text-foreground bg-transparent shadow-none hover:bg-transparent"
          >
            {value ? (
              <span className="text-sm text-left">{formatDateDisplay(value)}</span>
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

const STATIC_ROWS: Row[] = [
  { id: "1", invoice: "#3066", invoiceValue: "10,000", maturityDate: "2025-01-06", duration: "60 days", maxFinancingAmount: "8,000", estimatedFees: "XXX", hasDoc: true, docName: "Invoice.pdf" },
  { id: "2", invoice: "#3065", invoiceValue: "20,000", maturityDate: "2025-02-12", duration: "90 days", maxFinancingAmount: "16,000", estimatedFees: "XXX", hasDoc: true, docName: "Invoice.pdf" },
  { id: "3", invoice: "#3064", invoiceValue: "30,000", maturityDate: "2025-07-29", duration: "120 days", maxFinancingAmount: "24,000", estimatedFees: "XXX", hasDoc: false, docName: "" },
];

export default function InvoiceDetailsUIPage() {
  const [rows, setRows] = React.useState<Row[]>(STATIC_ROWS);
  const [editingIds, setEditingIds] = React.useState<Set<string>>(new Set());
  const [tempValues, setTempValues] = React.useState<Record<string, Partial<Row>>>({});

  const totalFinancing = rows.reduce((sum, r) => sum + (parseFloat(r.maxFinancingAmount.replace(/,/g, "")) || 0), 0);

  const handleStartEdit = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setEditingIds((prev) => new Set(prev).add(id));
    setTempValues((prev) => ({
      ...prev,
      [id]: {
        invoice: row.invoice,
        invoiceValue: row.invoiceValue,
        maturityDate: row.maturityDate,
        duration: row.duration,
        maxFinancingAmount: row.maxFinancingAmount,
        estimatedFees: row.estimatedFees,
      },
    }));
  };

  const handleCancelEdit = (id: string) => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setTempValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveEdit = (id: string) => {
    const temp = tempValues[id];
    if (temp) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...temp } : r))
      );
    }
    handleCancelEdit(id);
  };

  const handleTempChange = (id: string, field: keyof Row, value: string) => {
    setTempValues((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    handleCancelEdit(id);
  };

  const handleRemoveDocument = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, hasDoc: false, docName: "" } : r)));
  };

  const handleFileSelect = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, hasDoc: true, docName: file.name } : r)));
    }
    e.target.value = "";
  };

  const addRow = () => {
    const id = String(Date.now());
    const newRow: Row = {
      id,
      invoice: `#${id.slice(-4)}`,
      invoiceValue: "",
      maturityDate: "",
      duration: "",
      maxFinancingAmount: "",
      estimatedFees: "",
      hasDoc: false,
      docName: "",
    };
    setRows((prev) => [...prev, newRow]);
    setEditingIds((prev) => new Set(prev).add(id));
    setTempValues((prev) => ({ ...prev, [id]: { ...newRow } }));
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-lg font-semibold">Invoice details (UI only)</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 pt-8 space-y-6">

          <div className="space-y-12">
            <div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="font-semibold text-xl">Invoices</h3>
                  <p className="text-sm text-muted-foreground mt-1 break-words">
                    You may include multiple invoices in a single financing request, provided all invoices relate to the same underlying contract with the buyer
                  </p>
                </div>
                <Button variant="default" onClick={addRow}>
                  <PlusIcon className="h-4 w-4" />
                  Add invoice
                </Button>
              </div>
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden mt-6">
                <div className="overflow-x-auto">
                  <table className="w-full caption-bottom text-base leading-7 table-auto">
                    <thead className="[&_tr]:border-b">
                      <tr className="border-b bg-muted/50">
                        <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[10%] text-base whitespace-nowrap">Invoice</th>
                        <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[12%] text-base whitespace-nowrap">Invoice value</th>
                        <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[12%] text-base whitespace-nowrap">Maturity date</th>
                        <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[10%] text-base whitespace-nowrap">Duration</th>
                        <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[15%] text-base whitespace-nowrap">Max financing amount (80%)</th>
                        <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[15%] text-base whitespace-nowrap">Estimated Fees</th>
                        <th className="h-12 px-6 py-3 text-left align-middle font-medium text-muted-foreground font-semibold w-[26%] text-base whitespace-nowrap">Documents</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {rows.map((row) => {
                        const isEditing = editingIds.has(row.id);
                        const temp = tempValues[row.id] || {};
                        const cellClassName = isEditing
                          ? "px-6 py-6 relative overflow-visible"
                          : "px-6 py-6 align-middle text-left text-base leading-7 text-foreground break-words";

                        return (
                          <tr
                            key={row.id}
                            className={`border-b transition-colors ${isEditing ? "bg-muted/30" : "hover:bg-muted/50"}`}
                          >
                            <td className={cellClassName}>
                              <EditableCell
                                isEditing={isEditing}
                                value={temp.invoice ?? ""}
                                placeholder="Enter invoice number"
                                onChange={(v) => handleTempChange(row.id, "invoice", v)}
                                displayValue={row.invoice}
                                className="font-semibold"
                              />
                            </td>
                            <td className={cellClassName}>
                              <EditableCell
                                isEditing={isEditing}
                                value={temp.invoiceValue ?? ""}
                                placeholder="Enter invoice value"
                                onChange={(v) => handleTempChange(row.id, "invoiceValue", v)}
                                displayValue={row.invoiceValue}
                              />
                            </td>
                            <td className={cellClassName}>
                              <DateCell
                                isEditing={isEditing}
                                value={temp.maturityDate ?? ""}
                                placeholder="Enter date"
                                onChange={(v) => handleTempChange(row.id, "maturityDate", v)}
                                displayValue={row.maturityDate ? formatDateDisplay(row.maturityDate) : ""}
                              />
                            </td>
                            <td className={cellClassName}>
                              <EditableCell
                                isEditing={isEditing}
                                value={temp.duration ?? ""}
                                placeholder="Enter duration"
                                onChange={(v) => handleTempChange(row.id, "duration", v)}
                                displayValue={row.duration}
                              />
                            </td>
                            <td className={cellClassName}>
                              <EditableCell
                                isEditing={isEditing}
                                value={temp.maxFinancingAmount ?? ""}
                                placeholder="Enter financing amount"
                                onChange={(v) => handleTempChange(row.id, "maxFinancingAmount", v)}
                                displayValue={row.maxFinancingAmount}
                              />
                            </td>
                            <td className={cellClassName}>
                              <EditableCell
                                isEditing={isEditing}
                                value={temp.estimatedFees ?? ""}
                                placeholder="Enter fees"
                                onChange={(v) => handleTempChange(row.id, "estimatedFees", v)}
                                displayValue={row.estimatedFees}
                              />
                            </td>
                            <td className="px-6 py-6 align-middle text-left">
                              <div className="flex items-center gap-3">
                                {row.hasDoc && row.docName ? (
                                  <>
                                    <div className="flex items-center gap-2 bg-background text-foreground border border-border text-base leading-7 rounded-sm px-2 py-1 h-8 max-w-[200px] min-w-0 flex-1">
                                      <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground flex-shrink-0">
                                        <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                                      </div>
                                      <span className="text-foreground truncate flex-1 min-w-0">{row.docName}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveDocument(row.id)}
                                        className="hover:text-destructive transition-colors cursor-pointer flex-shrink-0 ml-auto"
                                        aria-label="Remove file"
                                      >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 w-[72px] justify-end">
                                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" title="Delete invoice" aria-label="Delete invoice" onClick={() => handleDeleteRow(row.id)}>
                                        <TrashIcon className="h-4 w-4" />
                                      </Button>
                                      {isEditing ? (
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8" title="Save" aria-label="Save" onClick={() => handleSaveEdit(row.id)}>
                                          <Save className="h-4 w-4" strokeWidth={1.5} />
                                        </Button>
                                      ) : (
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8" title="Edit" aria-label="Edit invoice" onClick={() => handleStartEdit(row.id)}>
                                          <PencilIcon className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <label
                                      htmlFor={`file-input-${row.id}`}
                                      className="flex items-center gap-1.5 text-primary font-medium text-base leading-7 cursor-pointer hover:underline"
                                    >
                                      <CloudArrowUpIcon className="h-4 w-4" />
                                      Upload file
                                      <input
                                        type="file"
                                        id={`file-input-${row.id}`}
                                        accept=".pdf,application/pdf"
                                        className="hidden"
                                        onChange={(e) => handleFileSelect(row.id, e)}
                                      />
                                    </label>
                                    <div className="flex items-center gap-2 flex-shrink-0 w-[72px] justify-end">
                                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" title="Delete invoice" aria-label="Delete invoice" onClick={() => handleDeleteRow(row.id)}>
                                        <TrashIcon className="h-4 w-4" />
                                      </Button>
                                      {isEditing ? (
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8" title="Save" aria-label="Save" onClick={() => handleSaveEdit(row.id)}>
                                          <Save className="h-4 w-4" strokeWidth={1.5} />
                                        </Button>
                                      ) : (
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8" title="Edit" aria-label="Edit invoice" onClick={() => handleStartEdit(row.id)}>
                                          <PencilIcon className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t bg-background font-medium">
                        <td colSpan={4} className="px-6 py-4 align-middle text-left"></td>
                        <td className="px-6 py-4 align-middle text-left">
                          <div className="font-semibold text-base leading-6">{totalFinancing.toLocaleString()}</div>
                          <div className="text-sm leading-5 text-muted-foreground mt-0.5">Total financing amount</div>
                        </td>
                        <td className="px-6 py-4 align-middle text-left">
                          <div className="font-semibold text-base leading-6">XXX</div>
                          <div className="text-sm leading-5 text-muted-foreground mt-0.5">Total fees</div>
                        </td>
                        <td className="px-6 py-4 align-middle text-left"></td>
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
        </div>
      </main>
    </div>
  );
}
