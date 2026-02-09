"use client";

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { useContract } from "@/hooks/use-contracts";
import { useProducts } from "@/hooks/use-products";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { useInvoicesByApplication } from "@/hooks/use-invoices";


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

const labelClassName = "text-sm md:text-base leading-6 text-muted-foreground";
const valueClassName = "text-[17px] leading-7 text-foreground font-medium";
const sectionHeaderClassName = "text-base sm:text-lg md:text-xl font-semibold";
const gridClassName = "grid grid-cols-1 sm:grid-cols-[348px_1fr] gap-x-6 gap-y-4 mt-4 px-3";
const inputClassName = "flex items-center text-foreground min-h-[28px]";

export function ReviewAndSubmitStep({
  applicationId,
  onDataChange,
}: ReviewAndSubmitStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const organizationId = (application as any)?.issuer_organization_id || (application as any)?.company_details?.issuer_organization_id;
  const contractId = (application as any)?.contract?.id || (application as any)?.contract_id;
  const productId = (application as any)?.financing_type?.product_id;

  const { data: productsData, isLoading: isLoadingProducts } = useProducts({ page: 1, pageSize: 100 });

  const { corporateInfo, bankAccountDetails, isLoading: isLoadingInfo } = useCorporateInfo(organizationId);
  const { data: entitiesData, isLoading: isLoadingEntities } = useCorporateEntities(organizationId);
  const { data: contract, isLoading: isLoadingContract } = useContract(contractId || "");

  const { data: invoices = [], isLoading: isLoadingInvoices } =
    useInvoicesByApplication(applicationId);

    const selectedProduct = React.useMemo(() => {
  if (!productsData?.products || !application?.financing_type?.product_id) {
    return null;
  }

  return productsData.products.find(
    (p: any) => p.id === application.financing_type.product_id
  );
}, [productsData, application]);


const financingTypeConfig = React.useMemo(() => {
  if (!selectedProduct?.workflow) return null;

  const step = selectedProduct.workflow.find(
    (s: any) => s.name?.toLowerCase() === "financing type"
  );

  return step?.config || null;
}, [selectedProduct]);


  /**
   * BUILD COMBINED LIST OF DIRECTORS AND SHAREHOLDERS
   */
  const combinedList = React.useMemo(() => {
    const directorsDisplay = entitiesData?.directorsDisplay ?? [];
    const shareholdersDisplay = entitiesData?.shareholdersDisplay ?? [];
    const corporateShareholders = entitiesData?.corporateShareholders ?? [];

    const seen = new Set<string>();
    const result: any[] = [];

    const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

    // Process directors first
    directorsDisplay.forEach((d: any) => {
      const normalized = normalizeName(d.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        const isAlsoShareholder = d.ownershipLabel !== "—";
        result.push({
          type: "director",
          name: d.name,
          roleLabel: isAlsoShareholder ? "Director, Shareholder" : "Director",
          ownership: d.ownershipLabel,
          statusType: "kyc",
          statusVerified: d.kycVerified,
          key: `dir-${normalized}`,
        });
      }
    });

    // Process shareholders who are NOT directors
    shareholdersDisplay.forEach((s: any) => {
      const normalized = normalizeName(s.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push({
          type: "shareholder",
          name: s.name,
          roleLabel: "Shareholder",
          ownership: s.ownershipLabel,
          statusType: "kyc",
          statusVerified: s.kycVerified,
          key: `sh-${normalized}`,
        });
      }
    });

    // Process corporate shareholders
    corporateShareholders.forEach((corp: any) => {
      const shareField = corp.formContent?.displayAreas?.[0]?.content?.find(
        (f: any) => f.fieldName === "% of Shares"
      );
      const sharePercentage = shareField?.fieldValue ? Number(shareField.fieldValue) : null;
      const ownershipLabel = sharePercentage != null ? `${sharePercentage}% ownership` : "—";
      const kybApproved = corp.approveStatus === "APPROVED";

      result.push({
        type: "corporate_shareholder",
        name: corp.businessName || corp.companyName || "—",
        roleLabel: "Corporate Shareholder",
        ownership: ownershipLabel,
        statusType: "kyb",
        statusVerified: kybApproved,
        key: `corp-${corp.requestId}`,
      });
    });

    return result;
  }, [entitiesData]);

  // Invoices
  // =========================
// Facility calculation (single source of truth)
// =========================

const financingStructure = application?.financing_structure as any;
const structureType = financingStructure?.structure_type;

const contractDetails = (contract?.contract_details as any) || {};

const approvedFacility = Number(contractDetails.approved_facility || 0);
const contractValue = Number(contractDetails.value || 0);

// Base facility depends on structure
const baseFacility =
  structureType === "new_contract"
    ? contractValue
    : approvedFacility;

// Sum financing from invoices
const totalFinancingAmount = invoices.reduce((sum: number, invoice: any) => {
  const d = invoice.details || {};
  const value = Number(d.value || 0);
  const ratio = (d.financing_ratio_percent ?? 60) / 100;
  return sum + value * ratio;
}, 0);

// Always calculated, never stored
const calculatedAvailableFacility =
  baseFacility - totalFinancingAmount;


 const isLoading =
  isLoadingApp ||
  isLoadingInfo ||
  isLoadingEntities ||
  isLoadingInvoices ||
  isLoadingProducts ||
  (!!contractId && isLoadingContract);
 



  // Notify parent that this step is valid (it's read-only)
  React.useEffect(() => {
    onDataChange?.({
      isValid: true,
      isCurrentStepValid: true,
      hasPendingChanges: false,
      saveFunction: async () => null,
    });
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




  const showContractSection =
    structureType === "new_contract" || structureType === "existing_contract";

  const showInvoiceSection = true; // invoices always applicable

  const showCompanySection = true;
  const showSupportingDocsSection = true;


  const financingType = (application?.financing_type as any) || {};
  const customerDetails = (contract?.customer_details as any) || {};
  const basicInfo = corporateInfo?.basicInfo;
  const businessAddress = corporateInfo?.addresses?.business;
  const registeredAddress = corporateInfo?.addresses?.registered;
  const contactPerson = (application?.company_details as any)?.contact_person || {};


  // Supporting Documents
  let supportingDocs = (application as any)?.supporting_documents;
  if (typeof supportingDocs === "string") supportingDocs = JSON.parse(supportingDocs);
  if (supportingDocs?.supporting_documents) supportingDocs = supportingDocs.supporting_documents;
  const categories = supportingDocs?.categories || [];

  return (
    <div className="space-y-12 px-3 max-w-[1200px] mx-auto pb-20">
      <section className="space-y-6">
  <h3 className={sectionHeaderClassName}>Financing details</h3>

  {financingTypeConfig ? (
    <div className="border rounded-xl px-4 py-3 flex items-start gap-4">
      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
        {/* optional icon */}
      </div>

      <div>
        <div className="text-base font-medium">
          {financingTypeConfig.name}
        </div>
        <div className="text-sm text-muted-foreground">
          {financingTypeConfig.description}
        </div>
      </div>
    </div>
  ) : (
    <div className="text-sm text-muted-foreground italic">
      Financing type not selected
    </div>
  )}
</section>

      {/* Contract */}
      {showContractSection && contractId && (

        <section className="space-y-6">
          <h3 className={sectionHeaderClassName}>Contract</h3>
          <div className={gridClassName}>
            <div className={labelClassName}>Contract title</div>
            <div className={valueClassName}>{contractDetails.title || "—"}</div>

            <div className={labelClassName}>Contract status</div>
            <div className={cn(valueClassName, "text-primary font-semibold")}>New submission (Pending approval)</div>

            <div className={labelClassName}>Customer</div>
            <div className={valueClassName}>{customerDetails.name || "—"}</div>

            <div className={labelClassName}>Contract value</div>
            <div className={valueClassName}>{formatCurrency(contractDetails.value)}</div>

            <div className={labelClassName}>Approved facility</div>
            <div className={valueClassName}>
              {approvedFacility > 0 ? formatCurrency(approvedFacility) : "—"}
            </div>

<div className={labelClassName}>Utilised facility</div>
<div className={valueClassName}>
  {structureType === "existing_contract"
    ? formatCurrency(totalFinancingAmount)
    : "—"}
</div>



<div className={labelClassName}>Available facility</div>
<div
  className={cn(
    valueClassName,
    calculatedAvailableFacility < 0 && "text-destructive"
  )}
>
  {formatCurrency(Math.max(calculatedAvailableFacility, 0))}

  {structureType === "new_contract" && (
    <div className="text-xs text-muted-foreground mt-1">
      * Subject to credit approval
    </div>
  )}
</div>


          </div>
        </section>
      )}

      {/* Invoices */}
      {showInvoiceSection && (

        <section className="space-y-6">
          <h3 className={sectionHeaderClassName}>Invoices</h3>

          <div className="border rounded-xl divide-y bg-card">
            {invoices.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground italic">
                No invoices added
              </div>
            ) : (
              invoices.map((invoice: any) => {
                const details = invoice.details || {};

                return (
                  <div key={invoice.id} className="p-4 grid grid-cols-2 gap-y-2">
                    <div className={labelClassName}>Invoice number</div>
                    <div className={valueClassName}>{details.number || "—"}</div>

                    <div className={labelClassName}>Invoice value</div>
                    <div className={valueClassName}>
                      {details.value ? formatCurrency(details.value) : "—"}
                    </div>

                    <div className={labelClassName}>Maturity date</div>
                    <div className={valueClassName}>{details.maturity_date || "—"}</div>

                    <div className={labelClassName}>Document</div>
                    <div className={valueClassName}>
                      {details.document?.file_name || "—"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

      )}

      {/* Company Info */}
      {showCompanySection && (
        <>
          <section className="space-y-6">
            <h3 className={sectionHeaderClassName}>Company info</h3>
            <div className={gridClassName}>
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
          <section className="space-y-6">
            <h3 className={sectionHeaderClassName}>Director & Shareholders</h3>
            <div className={gridClassName}>
              {(combinedList || []).map((item: any) => (
                <React.Fragment key={item.key}>
                  <div className={labelClassName}>{item.roleLabel}</div>
                  <div className="flex items-center gap-3 h-11">
                    <div className="text-[17px] leading-7 font-medium whitespace-nowrap truncate">
                      {item.name}
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-[17px] leading-7 text-muted-foreground whitespace-nowrap">
                      {item.ownership}
                    </div>
                    <div className="h-4 w-px bg-border" />
                    {item.statusVerified ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        <span className="text-[17px] leading-7 text-green-600">
                          {item.statusType === "kyb" ? "KYB" : "KYC"}
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* Banking details */}
          <section className="space-y-6">
            <h3 className={sectionHeaderClassName}>Banking details</h3>
            <div className={gridClassName}>
              <div className={labelClassName}>Bank name</div>
              <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank")?.fieldValue || "—"}</div>

              <div className={labelClassName}>Bank account number</div>
              <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank account number")?.fieldValue || "—"}</div>
            </div>
          </section>

          {/* Address */}
          <section className="space-y-6">
            <h3 className={sectionHeaderClassName}>Address</h3>
            <div className={gridClassName}>
              <div className={labelClassName}>Business address</div>
              <div className={valueClassName}>{formatAddress(businessAddress)}</div>

              <div className={labelClassName}>Registered address</div>
              <div className={valueClassName}>{formatAddress(registeredAddress)}</div>
            </div>
          </section>

          {/* Contact Person */}
          <section className="space-y-6">
            <h3 className={sectionHeaderClassName}>Contact Person</h3>
            <div className={gridClassName}>
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

      {/* Legal docs */}
      {showSupportingDocsSection && (
        <section className="space-y-6">
          <h3 className={sectionHeaderClassName}>Legal docs</h3>
          <div className="space-y-3 px-3">
            {categories.flatMap((cat: any) => cat.documents).map((doc: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2">
                <span className={labelClassName}>{doc.title}</span>
                {doc.file ? (
                  <div className="inline-flex items-center gap-1.5 bg-background border rounded px-2 py-1 text-xs">
                    <div className="w-3.5 h-3.5 rounded-full bg-foreground flex items-center justify-center">
                      <CheckIconSolid className="h-2 w-2 text-background" />
                    </div>
                    <span className="font-medium">{doc.file.file_name}</span>
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
