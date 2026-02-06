"use client";

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { useInvoices, useInvoicesByContract } from "@/hooks/use-invoices";
import { useContract } from "@/hooks/use-contracts";
import { useProducts } from "@/hooks/use-products";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

/**
 * REVIEW AND SUBMIT STEP
 * 
 * Final step where user reviews all information provided in previous steps.
 * This is a read-only summary of:
 * 1. Financing Details
 * 2. Contract Details
 * 3. Invoices
 * 4. Company Info
 * 5. Director & Shareholders
 * 6. Banking Details
 * 7. Address
 * 8. Contact Person
 * 9. Legal Docs (Supporting Documents)
 */

interface ReviewAndSubmitStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

const labelClassName = "text-muted-foreground text-sm sm:text-[15px]";
const valueClassName = "text-foreground font-medium text-sm sm:text-[15px]";
const sectionHeaderClassName = "text-base sm:text-lg font-bold text-foreground mb-4";
const rowGridClassName = "grid grid-cols-[1fr_2fr] gap-x-4 gap-y-3 sm:gap-y-4";

export function ReviewAndSubmitStep({
  applicationId,
  onDataChange,
}: ReviewAndSubmitStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const organizationId = (application as any)?.issuer_organization_id || (application as any)?.company_details?.issuer_organization_id;
  const contractId = (application as any)?.contract?.id || (application as any)?.contract_id;
  const productId = (application as any)?.financing_type?.product_id;

  const { corporateInfo, bankAccountDetails, isLoading: isLoadingInfo } = useCorporateInfo(organizationId);
  const { data: entitiesData, isLoading: isLoadingEntities } = useCorporateEntities(organizationId);
  const { data: contract, isLoading: isLoadingContract } = useContract(contractId || "");
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({ page: 1, pageSize: 100 });

  // Invoices
  const financingStructure = application?.financing_structure as any;
  const isExistingContract = financingStructure?.structure_type === "existing_contract";
  const existingContractId = financingStructure?.existing_contract_id;

  const { data: appInvoices = [], isLoading: isLoadingAppInvoices } = useInvoices(applicationId);
  const { data: contractInvoices = [], isLoading: isLoadingContractInvoices } = useInvoicesByContract(existingContractId);

  const isLoading = isLoadingApp || isLoadingInfo || isLoadingEntities || isLoadingAppInvoices || (isExistingContract && isLoadingContractInvoices) || (!!contractId && isLoadingContract) || isLoadingProducts;

  // Notify parent that this step is valid (it's read-only)
  React.useEffect(() => {
    onDataChange?.({ isValid: true });
  }, [onDataChange]);

  if (isLoading) {
    return (
      <div className="space-y-12">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // Formatters
  const formatCurrency = (value: any) => {
    const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0;
    return `RM ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatAddress = (addr: any) => {
    if (!addr) return "—";
    const parts = [addr.line1, addr.line2, addr.city, addr.postalCode, addr.state, addr.country].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  };

  // Data extraction
  const selectedProduct = productsData?.products?.find((p: any) => p.id === productId);
  const workflow = selectedProduct?.workflow || [];
  
  // Map workflow steps to visible sections
  const activeStepKeys = new Set(workflow.map((step: any) => {
    const rawKey = step.id.replace(/_\d+$/, "");
    if (rawKey === "verify_company_info") return "company_details";
    return rawKey;
  }));

  const financingType = (application?.financing_type as any) || {};
  const businessDetails = (application as any)?.business_details || {};
  const contractDetails = (contract?.contract_details as any) || {};
  const customerDetails = (contract?.customer_details as any) || {};
  const basicInfo = corporateInfo?.basicInfo;
  const businessAddress = corporateInfo?.addresses?.business;
  const registeredAddress = corporateInfo?.addresses?.registered;
  const contactPerson = (application?.company_details as any)?.contact_person || {};
  
  // Invoices deduplication (same as invoice-details-step)
  const mappedAppInvoices = appInvoices.map((inv: any) => ({ ...inv.details, id: inv.id }));
  const mappedContractInvoices = isExistingContract ? contractInvoices.map((inv: any) => ({ ...inv.details, id: inv.id })) : [];
  const appInvoiceIds = new Set(mappedAppInvoices.map((inv: any) => inv.id));
  const uniqueInvoices = [...mappedContractInvoices.filter((inv: any) => !appInvoiceIds.has(inv.id)), ...mappedAppInvoices];
  const totalFinancingAmount = uniqueInvoices.reduce((acc, inv) => acc + (inv.value || 0) * 0.8, 0);

  // Supporting Documents
  let supportingDocs = (application as any)?.supporting_documents;
  if (typeof supportingDocs === "string") supportingDocs = JSON.parse(supportingDocs);
  if (supportingDocs?.supporting_documents) supportingDocs = supportingDocs.supporting_documents;
  const categories = supportingDocs?.categories || [];

  return (
    <div className="space-y-12 pb-20 max-w-5xl mx-auto">
      {/* Financing Details */}
      {activeStepKeys.has("financing_type") && (
        <section>
          <h2 className={sectionHeaderClassName}>Financing details</h2>
          <div className="bg-muted/30 rounded-xl p-4 flex items-start gap-4 border border-border">
            <div className="bg-background p-2 rounded-lg border border-border shadow-sm">
              <CheckIconSolid className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{selectedProduct?.name || financingType.product_name || "Account Receivable (AR) Financing"}</h3>
              <p className="text-sm text-muted-foreground">Get funding against your issued invoices under Islamic financing principles</p>
            </div>
          </div>
        </section>
      )}

      {/* Contract */}
      {activeStepKeys.has("contract_details") && (
        <section>
          <h2 className={sectionHeaderClassName}>Contract</h2>
          <div className={rowGridClassName}>
            <div className={labelClassName}>Contract title</div>
            <div className={valueClassName}>{contractDetails.title || "—"}</div>
            
            <div className={labelClassName}>Contract status</div>
            <div className={cn(valueClassName, "text-primary")}>New submission (Pending approval)</div>
            
            <div className={labelClassName}>Customer</div>
            <div className={valueClassName}>{customerDetails.name || "—"}</div>
            
            <div className={labelClassName}>Contract value</div>
            <div className={valueClassName}>{formatCurrency(contractDetails.value)}</div>
            
            <div className={labelClassName}>Approved facility</div>
            <div className={valueClassName}>{formatCurrency(contractDetails.approved_facility)}</div>
            
            <div className={labelClassName}>Utilised facility</div>
            <div className={valueClassName}>{formatCurrency(contractDetails.utilized_facility)}</div>
            
            <div className={labelClassName}>Available facility</div>
            <div className={valueClassName}>{formatCurrency(contractDetails.available_facility)}</div>
          </div>
        </section>
      )}

      {/* Invoices */}
      {activeStepKeys.has("invoice_details") && (
        <section>
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className={sectionHeaderClassName}>Invoices</h2>
              <p className="text-sm text-muted-foreground">You may include multiple invoices in a single financing request, provided all invoices relate to the same underlying contract with the buyer</p>
            </div>
          </div>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Invoice</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Invoice value (RM)</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Maturity date</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Maximum financing amount (RM)</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {uniqueInvoices.map((inv, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4 font-bold">#{inv.number}</td>
                    <td className="px-4 py-4">{inv.value?.toLocaleString()}</td>
                    <td className="px-4 py-4">{inv.maturity_date ? new Date(inv.maturity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}</td>
                    <td className="px-4 py-4">{(inv.value * 0.8).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      {inv.document && (
                        <div className="inline-flex items-center gap-1.5 bg-background border rounded px-2 py-0.5 text-xs">
                          <div className="w-3.5 h-3.5 rounded-full bg-foreground flex items-center justify-center">
                            <CheckIconSolid className="h-2 w-2 text-background" />
                          </div>
                          {inv.document.file_name}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/10 font-bold">
                  <td colSpan={3}></td>
                  <td className="px-4 py-4">
                    <div>{totalFinancingAmount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground font-normal">Total financing amount</div>
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Company Info */}
      {activeStepKeys.has("company_details") && (
        <>
          <section>
            <h2 className={sectionHeaderClassName}>Company info</h2>
            <div className={rowGridClassName}>
              <div className={labelClassName}>Company name</div>
              <div className={valueClassName}>{basicInfo?.businessName || "—"}</div>
              
              <div className={labelClassName}>Type of entity</div>
              <div className={valueClassName}>{basicInfo?.entityType || "—"}</div>
              
              <div className={labelClassName}>SSM no</div>
              <div className={valueClassName}>{basicInfo?.ssmRegisterNumber || "—"}</div>
              
              <div className={labelClassName}>Industry</div>
              <div className={valueClassName}>{basicInfo?.industry || "—"}</div>
              
              <div className={labelClassName}>Nature of business</div>
              <div className={valueClassName}>Private</div>
              
              <div className={labelClassName}>Number of employees</div>
              <div className={valueClassName}>{basicInfo?.numberOfEmployees || "—"}</div>
            </div>
          </section>

          {/* Director & Shareholders */}
          <section>
            <h2 className={sectionHeaderClassName}>Director & Shareholders</h2>
            <div className="space-y-4">
              {(entitiesData?.directorsDisplay || []).map((d: any, i: number) => (
                <div key={`dir-${i}`} className={rowGridClassName}>
                  <div className={labelClassName}>{d.ownershipLabel !== "—" ? "Director, Shareholder" : "Director"}</div>
                  <div className="flex items-center gap-4">
                    <span className={valueClassName}>{d.name}</span>
                    <span className="text-muted-foreground text-sm">{d.ownershipLabel}</span>
                    {d.kycVerified && (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircleIcon className="h-4 w-4" />
                        KYC
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(entitiesData?.shareholdersDisplay || [])
                .filter((s: any) => !entitiesData?.directorsDisplay?.some((d: any) => d.name.trim().toLowerCase() === s.name.trim().toLowerCase()))
                .map((s: any, i: number) => (
                  <div key={`sh-${i}`} className={rowGridClassName}>
                    <div className={labelClassName}>Shareholder</div>
                    <div className="flex items-center gap-4">
                      <span className={valueClassName}>{s.name}</span>
                      <span className="text-muted-foreground text-sm">{s.ownershipLabel}</span>
                      {s.kycVerified && (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircleIcon className="h-4 w-4" />
                          KYC
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {(entitiesData?.corporateShareholders || []).map((corp: any, i: number) => {
                const shareField = corp.formContent?.displayAreas?.[0]?.content?.find((f: any) => f.fieldName === "% of Shares");
                const sharePercentage = shareField?.fieldValue ? Number(shareField.fieldValue) : null;
                const ownershipLabel = sharePercentage != null ? `${sharePercentage}% ownership` : "—";
                const kybApproved = corp.approveStatus === "APPROVED";
                
                return (
                  <div key={`corp-${i}`} className={rowGridClassName}>
                    <div className={labelClassName}>Corporate Shareholder</div>
                    <div className="flex items-center gap-4">
                      <span className={valueClassName}>{corp.businessName || corp.companyName || "—"}</span>
                      <span className="text-muted-foreground text-sm">{ownershipLabel}</span>
                      {kybApproved && (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircleIcon className="h-4 w-4" />
                          KYB
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Banking details */}
          <section>
            <h2 className={sectionHeaderClassName}>Banking details</h2>
            <div className={rowGridClassName}>
              <div className={labelClassName}>Bank name</div>
              <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank")?.fieldValue || "—"}</div>
              
              <div className={labelClassName}>Bank account number</div>
              <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank account number")?.fieldValue || "—"}</div>
            </div>
          </section>

          {/* Address */}
          <section>
            <h2 className={sectionHeaderClassName}>Address</h2>
            <div className={rowGridClassName}>
              <div className={labelClassName}>Business address</div>
              <div className={valueClassName}>{formatAddress(businessAddress)}</div>
              
              <div className={labelClassName}>Registered address</div>
              <div className={valueClassName}>{formatAddress(registeredAddress)}</div>
            </div>
          </section>

          {/* Contact Person */}
          <section>
            <h2 className={sectionHeaderClassName}>Contact Person</h2>
            <div className={rowGridClassName}>
              <div className={labelClassName}>Applicant name</div>
              <div className={valueClassName}>{contactPerson.name || "—"}</div>
              
              <div className={labelClassName}>Applicant position</div>
              <div className={valueClassName}>{contactPerson.position || "—"}</div>
              
              <div className={labelClassName}>Applicant IC no</div>
              <div className={valueClassName}>{contactPerson.ic || "—"}</div>
              
              <div className={labelClassName}>Applicant contact</div>
              <div className={valueClassName}>{contactPerson.contact || "—"}</div>
            </div>
          </section>
        </>
      )}

      {/* Business Details */}
      {activeStepKeys.has("business_details") && (
        <section>
          <h2 className={sectionHeaderClassName}>Business details</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">About your business</h3>
              <div className={rowGridClassName}>
                <div className={labelClassName}>What does your company do?</div>
                <div className={valueClassName}>{businessDetails.about_your_business?.what_does_company_do || "—"}</div>
                
                <div className={labelClassName}>Who are your main customers?</div>
                <div className={valueClassName}>{businessDetails.about_your_business?.main_customers || "—"}</div>
                
                <div className={labelClassName}>Does any single customer make up more than 50% of your revenue?</div>
                <div className={valueClassName}>{businessDetails.about_your_business?.single_customer_over_50_revenue ? "Yes" : "No"}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Why are you raising funds?</h3>
              <div className={rowGridClassName}>
                <div className={labelClassName}>What is this financing for?</div>
                <div className={valueClassName}>{businessDetails.why_raising_funds?.financing_for || "—"}</div>
                
                <div className={labelClassName}>How will the funds be used?</div>
                <div className={valueClassName}>{businessDetails.why_raising_funds?.how_funds_used || "—"}</div>
                
                <div className={labelClassName}>Tell us about your business plan</div>
                <div className={valueClassName}>{businessDetails.why_raising_funds?.business_plan || "—"}</div>
                
                <div className={labelClassName}>Are there any risks that may delay repayment of your invoices?</div>
                <div className={valueClassName}>{businessDetails.why_raising_funds?.risks_delay_repayment || "—"}</div>
                
                <div className={labelClassName}>If payment is delayed, what is your backup plan?</div>
                <div className={valueClassName}>{businessDetails.why_raising_funds?.backup_plan || "—"}</div>
                
                <div className={labelClassName}>Are you currently raising/applying funds on any other P2P platforms?</div>
                <div className={valueClassName}>{businessDetails.why_raising_funds?.raising_on_other_p2p ? "Yes" : "No"}</div>

                {businessDetails.why_raising_funds?.raising_on_other_p2p && (
                  <>
                    <div className={labelClassName}>Name of platform</div>
                    <div className={valueClassName}>{businessDetails.why_raising_funds?.platform_name || "—"}</div>
                    
                    <div className={labelClassName}>Amount raised</div>
                    <div className={valueClassName}>{businessDetails.why_raising_funds?.amount_raised ? formatCurrency(businessDetails.why_raising_funds.amount_raised) : "—"}</div>
                    
                    <div className={labelClassName}>Is the same invoice being used?</div>
                    <div className={valueClassName}>{businessDetails.why_raising_funds?.same_invoice_used ? "Yes" : "No"}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Legal docs */}
      {activeStepKeys.has("supporting_documents") && (
        <section>
          <h2 className={sectionHeaderClassName}>Legal docs</h2>
          <div className="space-y-3">
            {categories.flatMap((cat: any) => cat.documents).map((doc: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-b last:border-0">
                <span className={labelClassName}>{doc.title}</span>
                {doc.file ? (
                  <div className="inline-flex items-center gap-1.5 bg-background border rounded px-2 py-0.5 text-xs">
                    <div className="w-3.5 h-3.5 rounded-full bg-foreground flex items-center justify-center">
                      <CheckIconSolid className="h-2 w-2 text-background" />
                    </div>
                    {doc.file.file_name}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Not provided</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
