"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@heroicons/react/24/outline";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";

interface InvoiceRow {
  id: string;
  invoice: string;
  invoiceValue: string;
  maturityDate: string;
  duration: string;
  maxFinancingAmount: string;
  estimatedFees: string;
  documents: string | null;
}

export default function InvoiceDetailsStep({
  applicationId,
  onDataChange,
}: StepComponentProps) {
  const { data: application } = useApplication(applicationId);

  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([
    {
      id: "1",
      invoice: "#3066",
      invoiceValue: "10,000",
      maturityDate: "2025-01-06",
      duration: "60 days",
      maxFinancingAmount: "8,000",
      estimatedFees: "XXX",
      documents: "Invoice.pdf",
    },
    {
      id: "2",
      invoice: "#3065",
      invoiceValue: "20,000",
      maturityDate: "2025-02-12",
      duration: "90 days",
      maxFinancingAmount: "16,000",
      estimatedFees: "XXX",
      documents: "Invoice.pdf",
    },
    {
      id: "3",
      invoice: "#3064",
      invoiceValue: "42000",
      maturityDate: "",
      duration: "",
      maxFinancingAmount: "",
      estimatedFees: "",
      documents: null,
    },
  ]);

  React.useEffect(() => {
    if (application?.invoiceDetails) {
      const data = application.invoiceDetails as InvoiceRow[];
      if (Array.isArray(data)) {
        setInvoices(data);
      }
    }
  }, [application]);

  const handleInvoiceChange = (id: string, field: keyof InvoiceRow, value: string) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv))
    );
  };

  const handleAddInvoice = () => {
    setInvoices((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        invoice: `#${Date.now().toString().slice(-4)}`,
        invoiceValue: "",
        maturityDate: "",
        duration: "",
        maxFinancingAmount: "",
        estimatedFees: "",
        documents: null,
      },
    ]);
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
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Invoices</h3>
          <Button
            onClick={handleAddInvoice}
            className="bg-primary text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add invoice
          </Button>
        </div>
        <div className="bg-white border border-border rounded-xl overflow-hidden mt-6">
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border-t border-border">
            <thead className="bg-muted text-muted-foreground font-medium">
              <tr>
                <th className="py-3 px-4">Invoice</th>
                <th className="py-3 px-4">Invoice value</th>
                <th className="py-3 px-4">Maturity date</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Max financing amount (80%)</th>
                <th className="py-3 px-4">Estimated Fees</th>
                <th className="py-3 px-4">Documents</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-border">
                  <td className="py-3 px-4 font-medium text-foreground">{invoice.invoice}</td>
                  <td className="py-3 px-4">
                    {invoice.invoiceValue && invoice.documents ? (
                      invoice.invoiceValue
                    ) : (
                      <Input
                        type="number"
                        value={invoice.invoiceValue}
                        onChange={(e) =>
                          handleInvoiceChange(invoice.id, "invoiceValue", e.target.value)
                        }
                        className="w-full h-10 px-3 border border-border rounded-lg"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {invoice.maturityDate && invoice.documents ? (
                      invoice.maturityDate
                    ) : (
                      <Input
                        type="date"
                        value={invoice.maturityDate}
                        onChange={(e) =>
                          handleInvoiceChange(invoice.id, "maturityDate", e.target.value)
                        }
                        className="w-full h-10 px-3 border border-border rounded-lg"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {invoice.duration && invoice.documents ? (
                      invoice.duration
                    ) : (
                      <Input
                        type="text"
                        placeholder="e.g. 120"
                        value={invoice.duration}
                        onChange={(e) =>
                          handleInvoiceChange(invoice.id, "duration", e.target.value)
                        }
                        className="w-full h-10 px-3 border border-border rounded-lg"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {invoice.maxFinancingAmount && invoice.documents ? (
                      invoice.maxFinancingAmount
                    ) : (
                      <Input
                        type="text"
                        placeholder="e.g. 33,600"
                        value={invoice.maxFinancingAmount}
                        onChange={(e) =>
                          handleInvoiceChange(invoice.id, "maxFinancingAmount", e.target.value)
                        }
                        className="w-full h-10 px-3 border border-border rounded-lg"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {invoice.estimatedFees && invoice.documents ? (
                      invoice.estimatedFees
                    ) : (
                      <Input
                        type="text"
                        placeholder="e.g. 150"
                        value={invoice.estimatedFees}
                        onChange={(e) =>
                          handleInvoiceChange(invoice.id, "estimatedFees", e.target.value)
                        }
                        className="w-full h-10 px-3 border border-border rounded-lg"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {invoice.documents ? (
                      <span className="text-green-600">✔ {invoice.documents}</span>
                    ) : (
                      <button className="text-accent text-sm font-medium hover:underline">
                        📤 Upload file
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border text-sm flex justify-between">
          <div className="text-muted-foreground italic">
            Estimated fees based on 15% p.a., but exact amount will only be decided in offer letter
          </div>
          <div className="text-right">
            <div>
              Total financing amount: <strong>{totalFinancing.toLocaleString()}</strong>
            </div>
            <div>
              Total fees: <strong>XXX</strong>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
