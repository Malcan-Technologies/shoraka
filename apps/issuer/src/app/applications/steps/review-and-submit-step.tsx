"use client";

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { useContract } from "@/hooks/use-contracts";
import { useProducts } from "@/hooks/use-products";
import { useS3ViewUrl } from "@/hooks/use-s3";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { formLabelClassName } from "@/app/applications/components/form-control";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import { useInvoicesByApplication } from "@/hooks/use-invoices";
import { getStepKeyFromStepId, type ApplicationStepKey } from "@cashsouk/types";
import { SelectionCard } from "@/app/applications/components/selection-card";


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

/**
 * REUSED STYLES FROM STEPS
 * Matching: business-details-step, contract-details-step patterns
 */
const labelClassName = formLabelClassName;
const valueClassName = "text-[17px] leading-7 text-foreground font-medium";
const sectionHeaderClassName = "text-base sm:text-lg md:text-xl font-semibold";
const gridClassName = "grid grid-cols-1 sm:grid-cols-[348px_1fr] gap-x-12 gap-y-6 mt-4 px-3";
const sectionSpacingClassName = "space-y-6";

export function ReviewAndSubmitStep({
  applicationId,
  onDataChange,
}: ReviewAndSubmitStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const organizationId = (application as any)?.issuer_organization_id || (application as any)?.company_details?.issuer_organization_id;
  const contractId = (application as any)?.contract?.id || (application as any)?.contract_id;

  const { data: productsData, isLoading: isLoadingProducts } = useProducts({ page: 1, pageSize: 100 });

  // Selected product and workflow
  const selectedProduct = React.useMemo(() => {
    if (!productsData?.products || !application?.financing_type?.product_id) {
      return null;
    }

    return productsData.products.find(
      (p: any) => p.id === application.financing_type.product_id
    );
  }, [productsData, application]);

  // Extract workflow step keys to determine which sections to show
  const workflowStepKeys = React.useMemo(() => {
    if (!selectedProduct?.workflow) return new Set<ApplicationStepKey>();

    const keys = new Set<ApplicationStepKey>();
    selectedProduct.workflow.forEach((step: any) => {
      const key = getStepKeyFromStepId(step.id);
      if (key) keys.add(key);
    });
    return keys;
  }, [selectedProduct]);

  // Determine which sections to show based on workflow
  const showFinancingDetails = workflowStepKeys.has("financing_type");
  const showContractSection = workflowStepKeys.has("contract_details");
  const showInvoiceSection = workflowStepKeys.has("invoice_details");
  const showCompanySection = workflowStepKeys.has("company_details");
  const showSupportingDocsSection = workflowStepKeys.has("supporting_documents");

  // Conditionally fetch data only if sections are needed
  const { corporateInfo, bankAccountDetails, isLoading: isLoadingInfo } = useCorporateInfo(
    showCompanySection ? organizationId : undefined
  );
  const { data: entitiesData, isLoading: isLoadingEntities } = useCorporateEntities(
    showCompanySection ? organizationId : undefined
  );
  const { data: contract, isLoading: isLoadingContract } = useContract(
    showContractSection && contractId ? contractId : ""
  );
  const { data: invoices = [], isLoading: isLoadingInvoices } = useInvoicesByApplication(
    showInvoiceSection ? applicationId : ""
  );

  const financingTypeConfig = React.useMemo(() => {
    if (!selectedProduct?.workflow) return null;

    const step = selectedProduct.workflow.find(
      (s: any) => getStepKeyFromStepId(s.id) === "financing_type"
    );

    return step?.config || null;
  }, [selectedProduct]);

  // Get the product image S3 key from config
  const productImageS3Key = financingTypeConfig?.image?.s3_key || "";
  const { data: productImageUrl, isLoading: isLoadingProductImage } = useS3ViewUrl(productImageS3Key || null);


  /**
   * BUILD COMBINED LIST OF DIRECTORS AND SHAREHOLDERS
   */
  const combinedList = React.useMemo(() => {
    if (!showCompanySection) return [];

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
  }, [entitiesData, showCompanySection]);

  // Invoices and facility calculation
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

  // Determine which data is actually loading based on what sections are shown
  const isLoading =
    isLoadingApp ||
    isLoadingProducts ||
    (showCompanySection && (isLoadingInfo || isLoadingEntities)) ||
    (showContractSection && contractId && isLoadingContract) ||
    (showInvoiceSection && isLoadingInvoices);




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

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatAddress = (addr: any) => {
    if (!addr) return "—";
    const parts = [addr.line1, addr.line2, addr.city, addr.postalCode, addr.state, addr.country].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  };

  // Extract data for sections (only if sections are shown)
  const customerDetails = (contract?.customer_details as any) || {};
  const basicInfo = showCompanySection ? corporateInfo?.basicInfo : null;
  const businessAddress = showCompanySection ? corporateInfo?.addresses?.business : null;
  const registeredAddress = showCompanySection ? corporateInfo?.addresses?.registered : null;
  const contactPerson = showCompanySection ? ((application?.company_details as any)?.contact_person || {}) : {};

  // Supporting Documents
  let supportingDocs = showSupportingDocsSection ? ((application as any)?.supporting_documents) : null;
  if (typeof supportingDocs === "string") supportingDocs = JSON.parse(supportingDocs);
  if (supportingDocs?.supporting_documents) supportingDocs = supportingDocs.supporting_documents;
  const categories = supportingDocs?.categories || [];

  return (
    <div className="space-y-12 px-3 max-w-[1200px] mx-auto pb-20">
      {/* Financing details */}
      {showFinancingDetails && (
        <section className={sectionSpacingClassName}>
          <div>
            <h3 className={sectionHeaderClassName}>Financing details</h3>
            <div className="mt-2 h-px bg-border" />
          </div>

          {financingTypeConfig ? (
            <SelectionCard
              title={financingTypeConfig.name}
              description={financingTypeConfig.description}
              isSelected={false}
              onClick={() => {}}
              className="cursor-default"
              leading={
                <div className="h-14 w-14 rounded-md border border-border bg-white flex items-center justify-center overflow-hidden">
                    {isLoadingProductImage ? (
                      <Skeleton className="h-full w-full rounded-md" />
                    ) : productImageUrl ? (
                      <img
                        src={productImageUrl}
                        alt={financingTypeConfig.name || "Product"}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-muted-foreground text-[9px] text-center px-1 leading-tight">
                        Image
                        <br />
                        512x512
                      </div>
                  )}
                </div>
              }
            />
          ) : (
            <div className="text-sm text-muted-foreground italic">
              Financing type not selected
            </div>
          )}
        </section>
      )}

      {/* Contract */}
      {showContractSection && contractId && (
        <section className={sectionSpacingClassName}>
          <div>
            <h3 className={sectionHeaderClassName}>Contract</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={gridClassName}>
            <div className={labelClassName}>Contract title</div>
            <div className={valueClassName}>{contractDetails.title || "—"}</div>

            <div className={labelClassName}>Contract status</div>
            <div className={cn(valueClassName, "text-primary font-semibold")}>New submission (Pending approval)</div>

            <div className={labelClassName}>Customer</div>
            <div className={valueClassName}>{customerDetails.name || "—"}</div>

            <div className={labelClassName}>Contract value</div>
            <div className={valueClassName}>{contractDetails.value ? formatCurrency(contractDetails.value) : "—"}</div>

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
            <div className={valueClassName}>
              {structureType === "existing_contract" && calculatedAvailableFacility > 0
                ? formatCurrency(calculatedAvailableFacility)
                : "—"}
            </div>
          </div>
        </section>
      )}

      {/* Invoices */}
      {showInvoiceSection && (
        <section className={sectionSpacingClassName}>
          <div>
            <h3 className={sectionHeaderClassName}>Invoices</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <p className="text-sm text-muted-foreground">
            You may include multiple invoices in a single financing request, provided all invoices relate to the same underlying contract with the buyer
          </p>

          <div className="border rounded-xl bg-card overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground italic">
                No invoices added
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <Table className="table-fixed w-full">
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold">Invoice</TableHead>
                        <TableHead className="w-[90px] whitespace-nowrap text-xs font-semibold">Status</TableHead>
                        <TableHead className="w-[130px] whitespace-nowrap text-xs font-semibold">Maturity date</TableHead>
                        <TableHead className="w-[120px] whitespace-nowrap text-xs font-semibold">Value</TableHead>
                        <TableHead className="w-[180px] whitespace-nowrap text-xs font-semibold">Ratio</TableHead>
                        <TableHead className="w-[130px] whitespace-nowrap text-xs font-semibold">Amount</TableHead>
                        <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold">Document</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {invoices.map((invoice: any) => {
                        const details = invoice.details || {};
                        const invoiceValue = Number(details.value || 0);
                        const ratio = (details.financing_ratio_percent ?? 60);
                        const maxFinancing = invoiceValue * (ratio / 100);

                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="p-2 text-xs whitespace-nowrap">#{details.number || "—"}</TableCell>
                            <TableCell className="p-2 text-xs">
                              {invoice.status ? <span className="text-muted-foreground">{invoice.status}</span> : "—"}
                            </TableCell>
                            <TableCell className="p-2 text-xs whitespace-nowrap">{formatDate(details.maturity_date)}</TableCell>
                            <TableCell className="p-2 text-xs whitespace-nowrap">
                              {invoiceValue > 0 ? formatCurrency(invoiceValue) : "—"}
                            </TableCell>
                            <TableCell className="p-2 text-xs whitespace-nowrap">{ratio}%</TableCell>
                            <TableCell className="p-2 text-xs tabular-nums whitespace-nowrap">
                              {maxFinancing > 0 ? formatCurrency(maxFinancing) : "—"}
                            </TableCell>
                            <TableCell className="p-2 text-xs truncate max-w-[120px]">
                              {details.document?.file_name ? (
                                <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] h-6">
                                  <div className="w-3.5 h-3.5 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                                    <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                                  </div>
                                  <span className="text-[14px] font-medium truncate max-w-[100px]">{details.document.file_name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="p-2" />
                          </TableRow>
                        );
                      })}
                    <TableRow className="bg-muted/10">
                      <TableCell colSpan={5} />
                      <TableCell className="p-2 font-semibold text-xs">
                        {formatCurrency(totalFinancingAmount)}
                        <div className="text-xs text-muted-foreground font-normal">Total</div>
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Company Info */}
      {showCompanySection && (
        <>
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Company info</h3>
              <div className="mt-2 h-px bg-border" />
            </div>
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
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Director & Shareholders</h3>
              <div className="mt-2 h-px bg-border" />
            </div>
            {combinedList.length === 0 ? (
              <div className="text-sm text-muted-foreground px-3">
                No directors or shareholders found
              </div>
            ) : (
              <div className={gridClassName}>
                {combinedList.map((item: any) => (
                  <React.Fragment key={item.key}>
                    <div className={labelClassName}>{item.roleLabel}</div>
                    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                      <div className="text-[17px] leading-7 font-medium whitespace-nowrap">
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
            )}
          </section>

          {/* Banking details */}
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Banking details</h3>
              <div className="mt-2 h-px bg-border" />
            </div>
            <div className={gridClassName}>
              <div className={labelClassName}>Bank name</div>
              <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank")?.fieldValue || "—"}</div>

              <div className={labelClassName}>Bank account number</div>
              <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank account number")?.fieldValue || "—"}</div>
            </div>
          </section>

          {/* Address */}
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Address</h3>
              <div className="mt-2 h-px bg-border" />
            </div>
            <div className={gridClassName}>
              <div className={labelClassName}>Business address</div>
              <div className={valueClassName}>{formatAddress(businessAddress)}</div>

              <div className={labelClassName}>Registered address</div>
              <div className={valueClassName}>{formatAddress(registeredAddress)}</div>
            </div>
          </section>

          {/* Contact Person */}
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Contact Person</h3>
              <div className="mt-2 h-px bg-border" />
            </div>
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
        <section className={sectionSpacingClassName}>
          <div>
            <h3 className={sectionHeaderClassName}>Legal docs</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className="space-y-4 px-3">
            {categories.flatMap((cat: any) => cat.documents).map((doc: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2">
                <span className={labelClassName}>{doc.title}</span>
                {doc.file ? (
                  <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] h-6">
                    <div className="w-3.5 h-3.5 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                      <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                    </div>
                    <span className="text-[14px] font-medium truncate max-w-[140px]">{doc.file.file_name}</span>
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
