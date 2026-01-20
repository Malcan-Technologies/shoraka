"use client";

import * as React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { FinancingTypeCard } from "@/components/financing-type-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/use-products";
import { cn } from "@/lib/utils";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";
import { hasProducts, extractFinancingType } from "../helpers";
import type { Product, ProductsResponse } from "../types";

function formatAddress(address: { line1: string; line2: string; city: string; postalCode: string; state: string; country: string } | string): string {
  if (typeof address === "string") {
    return address;
  }
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.postalCode,
    address.state,
    address.country,
  ].filter(Boolean);
  return parts.join(", ");
}

export default function ReviewSubmitStep({
  applicationId,
  selectedProductId,
}: StepComponentProps) {
  const { data: application, isLoading: isLoadingApplication } = useApplication(applicationId);
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    page: 1,
    pageSize: 100,
  });

  const isLoading = isLoadingApplication || isLoadingProducts;

  const selectedFinancingType = React.useMemo(() => {
    if (!selectedProductId || !productsData || !hasProducts(productsData)) {
      return null;
    }

    const response = productsData as ProductsResponse;
    const product = response.products.find((p: Product) => p.id === selectedProductId);
    
    if (!product) {
      return null;
    }

    return extractFinancingType(product);
  }, [selectedProductId, productsData]);

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
        businessAddress: {
          line1: "24 Jalan Kiara",
          line2: "",
          city: "Kuala Lumpur",
          postalCode: "50480",
          state: "Wilayah Persekutuan Kuala Lumpur",
          country: "Malaysia",
        },
        registeredAddress: {
          line1: "24 Jalan Kiara",
          line2: "",
          city: "Kuala Lumpur",
          postalCode: "50480",
          state: "Wilayah Persekutuan Kuala Lumpur",
          country: "Malaysia",
        },
        contactPerson: {
          name: "Jalan Klara",
          position: "Owner",
          icNo: "345712-03-0987",
          contact: "017-1234567",
        },
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

  const supportingDocumentsData = React.useMemo(() => {
    if (!application?.supportingDocuments) {
      return null;
    }

    const savedData = application.supportingDocuments as {
      categories?: Array<{
        name: string;
        documents: Array<{
          title: string;
          file?: {
            file_name?: string;
            name?: string;
            s3_key?: string;
            s3Key?: string;
          };
        }>;
      }>;
    };

    return savedData?.categories || null;
  }, [application]);

  if (isLoading) {
    return (
      <div className="space-y-12">
        {/* Financing details skeleton */}
        <section>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">Financing details</h3>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
              <Skeleton className="h-14 w-14 rounded-lg aspect-square border border-border" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-full max-w-md" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded-none" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Invoice amount (RM)</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Invoice payment due date</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Financing goal (RM)</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Loan term</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Profit rate</div>
            <Skeleton className="h-5 rounded" />
          </div>
        </section>

        {/* Company info skeleton */}
        <section>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">Company info</h3>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Company name</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Type of entity</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">SSM no</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Industry</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Nature of business</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Number of employees</div>
            <Skeleton className="h-5 rounded" />
          </div>
        </section>

        {/* Director & Shareholders skeleton */}
        <section>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">Director & Shareholders</h3>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <Skeleton className="h-5 w-24 pl-6" />
            <Skeleton className="h-5 rounded" />
            <Skeleton className="h-5 w-24 pl-6" />
            <Skeleton className="h-5 rounded" />
            <Skeleton className="h-5 w-24 pl-6" />
            <Skeleton className="h-5 rounded" />
          </div>
        </section>

        {/* Banking details skeleton */}
        <section>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">Banking details</h3>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Bank name</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Bank account number</div>
            <Skeleton className="h-5 rounded" />
          </div>
        </section>

        {/* Address skeleton */}
        <section>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">Address</h3>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Business address</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Registered address</div>
            <Skeleton className="h-5 rounded" />
          </div>
        </section>

        {/* Contact Person skeleton */}
        <section>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">Contact Person</h3>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant name</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant position</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant IC no</div>
            <Skeleton className="h-5 rounded" />
            <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant contact</div>
            <Skeleton className="h-5 rounded" />
          </div>
        </section>

        {/* Legal docs skeleton */}
        <section>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">Legal docs</h3>
          </div>
          <div className="mt-6">
            <ul className="space-y-4">
              {[1, 2, 3, 4].map((index) => (
                <li key={index} className="flex items-center justify-between text-[17px] leading-7 min-h-[2rem]">
                  <Skeleton className="h-3.5 w-48 pl-6" />
                  <Skeleton className="h-8 w-28" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Financing details</h3>
        </div>
        <div className="mt-4">
          {selectedFinancingType ? (
            <div className={cn("pointer-events-none [&>div]:bg-sidebar [&>div]:border-sidebar-border [&_div]:border-sidebar-border [&_input]:border-sidebar-border [&_button]:!border-black [&_button]:!opacity-50 [&_button[data-state=checked]]:!bg-black [&_button[data-state=checked]]:!border-black [&_button[data-state=checked]]:!text-white [&_button[data-state=checked]]:!opacity-50 [&_button[data-state=checked]_svg]:!text-white [&_button[data-state=checked]_svg_path]:!stroke-white")}>
              <FinancingTypeCard
                id={selectedFinancingType.id}
                name={selectedFinancingType.name}
                description={selectedFinancingType.description}
                s3Key={selectedFinancingType.s3Key}
                isSelected={true}
                onSelect={() => {}}
              />
            </div>
          ) : (
            <div className="bg-sidebar border border-sidebar-border rounded-xl p-4 flex items-start gap-4">
              <div className="pt-1 text-muted-foreground">🌙</div>
                  <div className="flex-1">
                    <div className="text-[17px] leading-7 font-medium">No financing type selected</div>
                    <div className="text-sm text-muted-foreground">
                      Financing type information not available
                    </div>
                  </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Invoice amount (RM)</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {financingData.invoiceAmount as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Invoice payment due date</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {financingData.paymentDueDate as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Financing goal (RM)</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {financingData.financingGoal as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Loan term</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {financingData.loanTerm as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Profit rate</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {financingData.profitRate as string}
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Company info</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Company name</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.companyName as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Type of entity</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.entityType as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">SSM no</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.registrationNumber as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Industry</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.industry as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Nature of business</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.natureOfBusiness as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Number of employees</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.numberOfEmployees as string}
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Director & Shareholders</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          {Array.isArray(companyData.directors) && companyData.directors.length > 0 ? (
            companyData.directors.map((director: unknown, index: number) => {
              const dir = director as { name: string; ownership: string; kycStatus?: string };
              return (
                <React.Fragment key={index}>
                  <div className="text-[17px] leading-7 text-muted-foreground pl-6">Director</div>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                    <div className="text-[17px] leading-7 font-medium whitespace-nowrap">{dir.name}</div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-[17px] leading-7 text-muted-foreground whitespace-nowrap">{dir.ownership}</div>
                    <div className="h-4 w-px bg-border" />
                    {dir.kycStatus === "verified" ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        <span className="text-[17px] leading-7 text-green-600">KYC</span>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                </React.Fragment>
              );
            })
          ) : (
            <div className="col-span-2 text-[17px] leading-7 text-muted-foreground pl-6">No directors found</div>
          )}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Banking details</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Bank name</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.bankName as string}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Bank account number</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.bankAccountNumber as string}
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Address</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Business address</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.businessAddress ? formatAddress(companyData.businessAddress as { line1: string; line2: string; city: string; postalCode: string; state: string; country: string } | string) : "-"}
          </div>
          <div className="text-[17px] leading-7 text-muted-foreground pl-6">Registered address</div>
          <div className="text-[17px] leading-7 text-foreground font-medium">
            {companyData.registeredAddress ? formatAddress(companyData.registeredAddress as { line1: string; line2: string; city: string; postalCode: string; state: string; country: string } | string) : "-"}
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold">Contact Person</h3>
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          {companyData.contactPerson ? (
            <>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant name</div>
              <div className="text-[17px] leading-7 text-foreground font-medium">
                {(companyData.contactPerson as { name?: string }).name || "-"}
              </div>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant position</div>
              <div className="text-[17px] leading-7 text-foreground font-medium">
                {(companyData.contactPerson as { position?: string }).position || "-"}
              </div>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant IC no</div>
              <div className="text-[17px] leading-7 text-foreground font-medium">
                {(companyData.contactPerson as { icNo?: string }).icNo || "-"}
              </div>
              <div className="text-[17px] leading-7 text-muted-foreground pl-6">Applicant contact</div>
              <div className="text-[17px] leading-7 text-foreground font-medium">
                {(companyData.contactPerson as { contact?: string }).contact || "-"}
              </div>
            </>
          ) : (
            <div className="col-span-2 text-[17px] leading-7 text-muted-foreground pl-6">No contact person information available</div>
          )}
        </div>
      </section>

      {supportingDocumentsData && supportingDocumentsData.length > 0 && (
        <section>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold">Legal docs</h3>
          </div>
          <div className={cn("mt-6 opacity-60")}>
            <ul className="space-y-4">
              {supportingDocumentsData.flatMap((category) =>
                category.documents.map((document, documentIndex) => {
                  const hasFile = !!document.file;
                  const fileName = document.file?.file_name || document.file?.name || "";

                  return (
                    <li key={`${category.name}-${documentIndex}`} className="flex items-center justify-between text-[17px] leading-7 min-h-[2rem]">
                      <span className="pl-6">{document.title}</span>
                      {hasFile && fileName ? (
                        <div className="flex items-center gap-2 bg-background text-foreground border border-border text-[17px] leading-7 rounded-sm px-2 py-1 min-h-[2rem]">
                          <div className="w-3.5 h-3.5 rounded flex items-center justify-center bg-foreground">
                            <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                          </div>
                          <span>{fileName}</span>
                        </div>
                      ) : (
                        <div className="text-[17px] leading-7 text-muted-foreground">Not uploaded</div>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
