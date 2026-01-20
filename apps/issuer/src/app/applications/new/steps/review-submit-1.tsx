"use client";

import * as React from "react";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";

export default function ReviewSubmitStep({
  applicationId,
}: StepComponentProps) {
  const { data: application } = useApplication(applicationId);

  const companyData = React.useMemo(() => {
    if (!application?.companyInfo) {
      return {
        companyName: "ABC Sdn Bhd",
        entityType: "Private Limited Company (Sdn. Bhd.)",
        registrationNumber: "201612345678",
        industry: "Textile",
        natureOfBusiness: "Private",
        numberOfEmployees: "50",
        directors: [
          { name: "Nur Hidayah", ownership: "30% ownership", kycStatus: "verified" },
          { name: "Nazrin", ownership: "45% ownership", kycStatus: "verified" },
          { name: "Riaz Ali", ownership: "25% ownership", kycStatus: "verified" },
        ],
        bankName: "Maybank",
        bankAccountNumber: "1234 1234 1234 1234",
        businessAddress: "24 Jalan Kiara, Kuala Lumpur 50480 Wilayah Persekutuan Kuala Lumpur, Malaysia",
        registeredAddress: "24 Jalan Kiara, Kuala Lumpur 50480 Wilayah Persekutuan Kuala Lumpur, Malaysia",
      };
    }
    return application.companyInfo as Record<string, unknown>;
  }, [application]);

  const financingData = React.useMemo(() => {
    if (!application?.financingTerms) {
      return {
        invoiceAmount: "RM 12,000",
        paymentDueDate: "12/04/2025",
        financingGoal: "RM 4800",
        loanTerm: "90 days",
        profitRate: "12%",
      };
    }
    return application.financingTerms as Record<string, unknown>;
  }, [application]);

  return (
    <div className="space-y-12">
      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Financing details</h3>
        </div>
        <div className="bg-muted border border-border rounded-xl p-4 flex items-start gap-4 mt-4">
          <div className="pt-1 text-muted-foreground">🌙</div>
          <div className="flex-1">
            <div className="text-sm font-medium">Invoice financing (Islamic)</div>
            <div className="text-xs text-primary">
              Get funding against your issued invoices under Islamic financing principles
            </div>
          </div>
          <div className="text-primary pt-1">✓</div>
        </div>
        <div className="grid grid-cols-2 gap-y-4 mt-6 text-sm">
          <div className="text-muted-foreground">Invoice amount (RM)</div>
          <div className="text-foreground font-medium">
            {financingData.invoiceAmount as string}
          </div>
          <div className="text-muted-foreground">Invoice payment due date</div>
          <div className="text-foreground font-medium">
            {financingData.paymentDueDate as string}
          </div>
          <div className="text-muted-foreground">Financing goal (RM)</div>
          <div className="text-foreground font-medium">
            {financingData.financingGoal as string}
          </div>
          <div className="text-muted-foreground">Loan term</div>
          <div className="text-foreground font-medium">
            {financingData.loanTerm as string}
          </div>
          <div className="text-muted-foreground">Profit rate</div>
          <div className="text-foreground font-medium">
            {financingData.profitRate as string}
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Company info</h3>
        </div>
        <div className="grid grid-cols-2 gap-y-4 mt-4 text-sm">
          <div className="text-muted-foreground">Company name</div>
          <div className="text-foreground font-medium">
            {companyData.companyName as string}
          </div>
          <div className="text-muted-foreground">Type of entity</div>
          <div className="text-foreground font-medium">
            {companyData.entityType as string}
          </div>
          <div className="text-muted-foreground">SSM no</div>
          <div className="text-foreground font-medium">
            {companyData.registrationNumber as string}
          </div>
          <div className="text-muted-foreground">Industry</div>
          <div className="text-foreground font-medium">
            {companyData.industry as string}
          </div>
          <div className="text-muted-foreground">Nature of business</div>
          <div className="text-foreground font-medium">
            {companyData.natureOfBusiness as string}
          </div>
          <div className="text-muted-foreground">Number of employees</div>
          <div className="text-foreground font-medium">
            {companyData.numberOfEmployees as string}
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Director & Shareholders</h3>
        </div>
        <div className="space-y-3 mt-4 text-sm">
          {Array.isArray(companyData.directors) &&
            companyData.directors.map((director: unknown, index: number) => {
              const dir = director as { name: string; ownership: string; kycStatus?: string };
              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-32 text-muted-foreground">Director</div>
                  <div className="flex-1 text-foreground font-medium">{dir.name}</div>
                  <div className="text-muted-foreground">{dir.ownership}</div>
                  {dir.kycStatus === "verified" && (
                    <div className="ml-2 text-green-600 font-medium">✔ KYC</div>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Banking details</h3>
        </div>
        <div className="grid grid-cols-2 gap-y-4 mt-4 text-sm">
          <div className="text-muted-foreground">Bank name</div>
          <div className="text-foreground font-medium">
            {companyData.bankName as string}
          </div>
          <div className="text-muted-foreground">Bank account number</div>
          <div className="text-foreground font-medium">
            {companyData.bankAccountNumber as string}
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Address</h3>
        </div>
        <div className="grid grid-cols-2 gap-y-4 mt-4 text-sm">
          <div className="text-muted-foreground">Business address</div>
          <div className="text-foreground font-medium">
            {companyData.businessAddress as string}
          </div>
          <div className="text-muted-foreground">Registered address</div>
          <div className="text-foreground font-medium">
            {companyData.registeredAddress as string}
          </div>
        </div>
      </section>
    </div>
  );
}
