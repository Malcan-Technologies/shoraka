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
import { Plus, Trash2, Pencil, CloudUpload } from "lucide-react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

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

const MOCK_CONTRACT_SUMMARY = {
  title: "Mining Rig Repair 12654",
  customer: "Petronas Chemical Bhd",
  value: "RM 5,000,000",
  approved_facility: "RM 2,000,000",
  utilised_facility: "RM 500,000",
  available_facility: "RM 1,500,000",
};

const INITIAL_INVOICES = [
  {
    id: "1",
    number: "#3066",
    value: 10000,
    maturity_date: "2025-01-06",
    document: "Invoice.pdf",
    status: "APPROVED",
  },
  {
    id: "2",
    number: "#3065",
    value: 20000,
    maturity_date: "2025-02-12",
    document: "Invoice.pdf",
    status: "DRAFT",
  },
  {
    id: "3",
    number: "#3064",
    value: 30000,
    maturity_date: "2025-07-29",
    document: null,
    status: "DRAFT",
  },
];

export function InvoiceDetailsStep({ applicationId, onDataChange }: InvoiceDetailsStepProps) {
  const [invoices, setInvoices] = React.useState(INITIAL_INVOICES);

  // Track if we've initialized the data
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Stable reference for onDataChange callback
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // Notify parent on changes
  React.useEffect(() => {
    const totalFinancingAmount = invoices.reduce((acc, inv) => acc + inv.value * 0.8, 0);
    onDataChangeRef.current?.({
      invoices,
      totalFinancingAmount,
      isValid: invoices.length > 0 && invoices.every((inv) => inv.number && inv.value > 0),
    });
  }, [invoices]);

  const handleAddInvoice = () => {
    const newId = Math.random().toString(36).substring(7);
    const newInvoice = {
      id: newId,
      number: "",
      value: 0,
      maturity_date: "",
      document: null,
      status: "DRAFT",
    };
    setInvoices([...invoices, newInvoice]);
  };

  const handleDeleteInvoice = (id: string) => {
    const invoice = invoices.find((inv) => inv.id === id);
    if (invoice?.status === "APPROVED") return;
    setInvoices(invoices.filter((inv) => inv.id !== id));
  };

  const handleUpdateInvoice = (id: string, field: string, value: any) => {
    setInvoices(
      invoices.map((inv) =>
        inv.id === id && inv.status !== "APPROVED" ? { ...inv, [field]: value } : inv
      )
    );
  };

  const totalFinancingAmount = invoices.reduce((acc, inv) => acc + inv.value * 0.8, 0);

  return (
    <div className="space-y-12 pb-8">
      {/* Contract Summary Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold">Contract</h2>
        <div className="space-y-4 border rounded-xl p-6 bg-card/50">
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Contract title</span>
            <span>{MOCK_CONTRACT_SUMMARY.title}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Customer</span>
            <span>{MOCK_CONTRACT_SUMMARY.customer}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Contract value</span>
            <span className="font-medium text-foreground">{MOCK_CONTRACT_SUMMARY.value}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Approved facility</span>
            <span>{MOCK_CONTRACT_SUMMARY.approved_facility}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Utilised facility</span>
            <span>{MOCK_CONTRACT_SUMMARY.utilised_facility}</span>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-[348px_1fr] gap-2 md:gap-4">
            <span>Available facility</span>
            <span>{MOCK_CONTRACT_SUMMARY.available_facility}</span>
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
            className="bg-[#800000] hover:bg-[#600000] text-white rounded-lg flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" />
            Add invoice
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
                {invoices.map((invoice) => {
                  const isApproved = invoice.status === "APPROVED";
                  const maxFinancing = invoice.value * 0.8;

                  return (
                    <TableRow
                      key={invoice.id}
                      className={cn(
                        "border-b last:border-0 h-[72px]",
                        isApproved && "bg-muted/30 opacity-70"
                      )}
                    >
                      <TableCell>
                        {!isApproved ? (
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
                        {!isApproved ? (
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
                            {invoice.value.toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isApproved ? (
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
                            isApproved ? "text-muted-foreground" : "text-foreground"
                          )}
                        >
                          {maxFinancing.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {invoice.document ? (
                            <div className={cn(
                              "inline-flex items-center gap-2 bg-background text-foreground border border-border rounded-sm px-2 py-1 max-w-full",
                              isApproved && "opacity-70 bg-muted/30"
                            )}>
                              <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground shrink-0">
                                <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                              </div>
                              <span className="text-sm truncate max-w-[120px] sm:max-w-[200px]">
                                {invoice.document}
                              </span>
                              {!isApproved && (
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
                            !isApproved && (
                              <button className="flex items-center gap-2 text-[#800000] font-medium hover:underline text-sm">
                                <CloudUpload className="h-4 w-4" />
                                Upload file
                              </button>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2 pr-2">
                          {!isApproved && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
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
                      <div className="text-foreground">{totalFinancingAmount.toLocaleString()}</div>
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
