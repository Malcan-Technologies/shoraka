"use client";

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { useContract } from "@/hooks/use-contracts";
import { useProducts } from "@/hooks/use-products";
import { ProductImagePreview } from "@/app/(application-flow)/applications/components/product-image-preview";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import {
  formLabelClassName,
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { useInvoicesByApplication } from "@/hooks/use-invoices";
import { getStepKeyFromStepId, type ApplicationStepKey } from "@cashsouk/types";
import { SelectionCard } from "@/app/(application-flow)/applications/components/selection-card";
import { StatusBadge } from "../components/invoice-status-badge";
import { ReviewContractSkeleton } from "../components/review-contract-skeleton";
import { ReviewInvoiceSkeleton } from "../components/review-invoice-skeleton";
import { ReviewCompanySkeleton } from "../components/review-company-skeleton";
import { ReviewBusinessSkeleton } from "../components/review-business-skeleton";
import { ReviewSupportingDocsSkeleton } from "../components/review-supporting-docs-skeleton";
import { ReviewFinancingSkeleton } from "../components/review-financing-skeleton";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import { format } from "date-fns";
import { formatMoney } from "@cashsouk/ui";
import { FINANCIAL_FIELD_LABELS } from "@cashsouk/types";
import { FinancialStatementsSkeleton } from "../components/financial-statements-skeleton";
import { FileDisplayBadge } from "../components/file-display-badge";

const isValidNumber = (v: any): v is number =>
  typeof v === "number" && !Number.isNaN(v);

/** Show financial year end as a four-digit year (issuer step stores year; legacy rows may be a full date). */
function financialYearEndDisplay(val: unknown): string {
  const s = String(val).trim();
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 4);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
  return s;
}


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
  readOnly?: boolean;
}

/**
 * REUSED STYLES FROM STEPS
 * Matching: business-details-step, contract-details-step patterns
 */
// Centralized layout/class tokens (aligned with Branding.mdc)
const pageWrapperClassName = "mx-auto max-w-7xl px-6 "; //py-10 md:py-12
const labelClassName = formLabelClassName; // canonical label class from shared form control
const valueClassName = "text-[17px] leading-7 text-foreground font-medium break-words min-w-0";
const sectionHeaderClassName = "text-base font-semibold text-foreground";
const sectionGridClassName = "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 px-3 items-start min-w-0";
const sectionSpacingClassName = "space-y-6";
export function ReviewAndSubmitStep({
  applicationId,
  onDataChange,
  readOnly: _readOnly = false,
}: ReviewAndSubmitStepProps) {
  // DEBUG: Toggle skeleton mode
  const devTools = useDevTools();

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
  const showFinancialStatementsSection = workflowStepKeys.has("financial_statements");
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

  const invoiceProductConfig = React.useMemo(() => {
    if (!selectedProduct?.workflow || !application?.financing_type?.product_id) return null;
    const step = selectedProduct.workflow.find(
      (s: any) => getStepKeyFromStepId(s.id) === "invoice_details"
    );
    const config = step?.config || {};
    const hasMin = typeof config.min_invoice_value === "number";
    const hasMax = typeof config.max_invoice_value === "number";
    if (!hasMin && !hasMax) return null;
    return {
      min_invoice_value: config.min_invoice_value ?? null,
      max_invoice_value: config.max_invoice_value ?? null,
    };
  }, [selectedProduct, application]);

  // Get the product image S3 key from config
  const productImageS3Key = financingTypeConfig?.image?.s3_key || "";


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
      const sharePercentage =
        shareField?.fieldValue != null
          ? Number(shareField.fieldValue)
          : null;

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

  const contractValue = Number(contractDetails.value || 0);

  const totalFinancingAmount = invoices.reduce((sum: number, invoice: any) => {
    const d = invoice.details || {};
    const value = Number(d.value || 0);
    const ratio = (d.financing_ratio_percent ?? 60) / 100;
    return sum + value * ratio;
  }, 0);

  // Determine which data is actually loading based on what sections are shown
  // Note: removed unused isLoading variable to satisfy build checks.

  const isInvoiceOnly = structureType === "invoice_only";

  // Section-level loading flags
  const contractLoading =
    showContractSection &&
    !isInvoiceOnly &&
    (isLoadingApp || (contractId ? isLoadingContract : (application as any)?.contract == null));

  const invoiceLoading = showInvoiceSection && isLoadingInvoices;
  const financingLoading = showFinancingDetails && isLoadingProducts;
  const companyLoading = showCompanySection && (isLoadingInfo || isLoadingEntities);
  const financialStatementsLoading = showFinancialStatementsSection && isLoadingApp;
  const supportingLoading = showSupportingDocsSection && isLoadingApp;




  // Notify parent that this step is valid (it's read-only)
  React.useEffect(() => {
    onDataChange?.({
      isValid: true,
      isCurrentStepValid: true,
      hasPendingChanges: false,
      saveFunction: async () => null,
    });
  }, [onDataChange]);

  // Note: we no longer short-circuit to a full-page skeleton.
  // Each section will render its own skeleton when its data is loading.

  // Formatters
  const renderMoney = (value: any) => {
    if (value === null || value === undefined) return "—";
    // formatMoney returns a formatted number string like "1,234.56"
    try {
      return `RM ${formatMoney(value)}`;
    } catch (e) {
      return "—";
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return format(date, "dd MMM yyyy");
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
    <>
      <div className={`${pageWrapperClassName} space-y-12 pb-20`}>
        {/* Financing details */}
        {showFinancingDetails && (
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Financing Details</h3>
              <div className="border-b border-border mt-2 mb-4" />
            </div>

            {financingTypeConfig ? (
              financingLoading || devTools?.showSkeletonDebug ? (
                <ReviewFinancingSkeleton />
              ) : (
                <SelectionCard
                  title={financingTypeConfig.name}
                  description={financingTypeConfig.description}
                  isSelected={false}
                  onClick={() => {}}
                  disabled={true}
                  leading={<ProductImagePreview s3Key={productImageS3Key} alt={financingTypeConfig.name || "Product"} forceBgWhite={true} />}
                />
              )
            ) : (
              <div className="text-sm text-muted-foreground italic">
                Financing type not selected
              </div>
            )}
          </section>
        )}

        {/* Contract Details — hidden for invoice_only */}
        {showContractSection && !isInvoiceOnly && (
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>{isInvoiceOnly ? "Customer Details" : "Contract Details"}</h3>
              <div className="border-b border-border mt-2 mb-4" />
            </div>
            {contractLoading || devTools?.showSkeletonDebug ? (
              <ReviewContractSkeleton />
            ) : (
              <div className={sectionGridClassName}>
                {!isInvoiceOnly && (
                  <>
                    <div className={labelClassName}>Contract Title</div>
                    <div className={valueClassName}>{contractDetails.title || "—"}</div>

                    <div className={labelClassName}>Contract Status</div>
                    <div className={cn(valueClassName, "text-primary font-semibold")}>New submission (Pending approval)</div>
                  </>
                )}

                <div className={labelClassName}>Customer Name</div>
                <div className={valueClassName}>{customerDetails.name || "—"}</div>

                {!isInvoiceOnly && (
                  <>
                    <div className={labelClassName}>Contract Value</div>
                    <div className={valueClassName}>
                      {isValidNumber(contractValue) ? renderMoney(contractValue) : "N/A"}
                    </div>

                    <div className={labelClassName}>Contract Financing</div>
                    <div className={valueClassName}>
                      {contractDetails?.financing === null || contractDetails?.financing === undefined
                        ? "N/A"
                        : renderMoney(contractDetails?.financing)}
                    </div>

                    {structureType === "existing_contract" && (
                      <>
                        <div className={labelClassName}>Approved Facility</div>
                        <div className={valueClassName}>
                          {typeof contractDetails.approved_facility === "number"
                            ? renderMoney(contractDetails.approved_facility)
                            : "N/A"}
                        </div>

                        <div className={labelClassName}>Utilised Facility</div>
                        <div className={valueClassName}>
                          {typeof contractDetails.utilized_facility === "number"
                            ? renderMoney(contractDetails.utilized_facility)
                            : "N/A"}
                        </div>

                        <div className={labelClassName}>Available Facility</div>
                        <div className={valueClassName}>
                          {typeof contractDetails.available_facility === "number"
                            ? renderMoney(contractDetails.available_facility)
                            : "N/A"}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* Invoices */}
        {showInvoiceSection && (
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Invoices</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You may include multiple invoices in a single financing request, provided all invoices relate to the same underlying contract with the buyer
              </p>
              <div className="border-b border-border mt-2 mb-4" />
            </div>
            {invoiceLoading || devTools?.showSkeletonDebug ? (
              <ReviewInvoiceSkeleton />
            ) : (
              <div className="mt-4 px-3 max-w-[1200px] mx-auto">
                <div className="border rounded-xl bg-card overflow-hidden">
                  {invoices.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground italic">
                      No invoices added
                    </div>
                  ) : (
                    <>
                      {/* Table — same structure as invoice-details; document column can overflow → horizontal scroll */}
                      <div className="overflow-x-auto">
                        <Table className="w-full min-w-[1080px] table-fixed">
                          <TableHeader className="bg-muted/20">
                            <TableRow>
                              <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold">
                                Invoice
                              </TableHead>
                              <TableHead className="w-[100px] whitespace-nowrap text-xs font-semibold">
                                Status
                              </TableHead>
                              <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold">
                                Maturity Date
                              </TableHead>
                              <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold">
                                Invoice Value
                              </TableHead>
                              <TableHead className="w-[130px] whitespace-nowrap text-xs font-semibold">
                                Financing Ratio
                              </TableHead>
                              <TableHead className="w-[200px] whitespace-nowrap text-xs font-semibold">
                                <div className="inline-flex items-center gap-0.5">
                                  Maximum Financing Amount
                                  {invoiceProductConfig &&
                                    (typeof invoiceProductConfig.min_invoice_value === "number" ||
                                      typeof invoiceProductConfig.max_invoice_value === "number") && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={fieldTooltipTriggerClassName}>
                                            <InformationCircleIcon className="h-4 w-4" />
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                                          {"Per invoice\n"}
                                          {typeof invoiceProductConfig.min_invoice_value === "number"
                                            ? `min RM ${formatMoney(invoiceProductConfig.min_invoice_value)}`
                                            : ""}
                                          {typeof invoiceProductConfig.min_invoice_value === "number" &&
                                          typeof invoiceProductConfig.max_invoice_value === "number"
                                            ? "\n"
                                            : ""}
                                          {typeof invoiceProductConfig.max_invoice_value === "number"
                                            ? `max RM ${formatMoney(invoiceProductConfig.max_invoice_value)}`
                                            : ""}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                </div>
                              </TableHead>
                              <TableHead className="w-[200px] max-w-[200px] whitespace-nowrap text-xs font-semibold">
                                Documents
                              </TableHead>
                              <TableHead className="w-[50px]" />
                            </TableRow>
                          </TableHeader>


                          <TableBody>
                            {invoices.map((invoice: any) => {
                              const d = invoice.details || {};
                              const value = Number(d.value || 0);
                              const ratio = d.financing_ratio_percent ?? 60;
                              const financingAmount = value * (ratio / 100);

                              return (
                                <TableRow key={invoice.id} className="hover:bg-muted/40">
                                  {/* Invoice */}
                                  <TableCell className="p-2 text-xs whitespace-nowrap">
                                    {d.number || "—"}
                                  </TableCell>

                                  {/* Status */}
                                  <TableCell className="p-2">
                                    <StatusBadge status={invoice.status} withdrawReason={invoice.withdraw_reason} />
                                  </TableCell>

                                  {/* Maturity */}
                                  <TableCell className="p-2 text-xs whitespace-nowrap">
                                    {formatDate(d.maturity_date)}
                                  </TableCell>

                                  {/* Value */}
                                  <TableCell className="p-2 text-xs whitespace-nowrap tabular-nums">
                                    {isValidNumber(value) ? renderMoney(value) : "—"}
                                  </TableCell>

                                  {/* Ratio */}
                                  <TableCell className="p-2 text-xs whitespace-nowrap">
                                    {ratio}%
                                  </TableCell>

                                  {/* Amount */}
                                  <TableCell className="p-2 text-xs tabular-nums whitespace-nowrap">
                                    {isValidNumber(financingAmount) ? renderMoney(financingAmount) : "—"}
                                  </TableCell>

                                  {/* Document — truncate long filenames */}
                                  <TableCell className="p-2 max-w-[200px]">
                                    {d.document?.file_name ? (
                                      <div className="min-w-0 overflow-hidden">
                                        <FileDisplayBadge
                                          fileName={d.document.file_name}
                                          size="sm"
                                          className="bg-background"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">—</span>
                                    )}
                                  </TableCell>

                                  {/* Empty action column (keeps width alignment) */}
                                  <TableCell />
                                </TableRow>
                              );
                            })}

                            {/* TOTAL — identical to Invoice Details */}
                            <TableRow className="bg-muted/10">
                              <TableCell colSpan={5} />
                              <TableCell className="p-2 font-semibold text-xs">
                                {isValidNumber(totalFinancingAmount) ? renderMoney(totalFinancingAmount) : "—"}

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
              </div>
            )}
          </section>
        )}

        {/* Company Info */}
        {showCompanySection && (
          <>
            <section className={sectionSpacingClassName}>
              <div>
                <h3 className={sectionHeaderClassName}>Company Info</h3>
                <div className="border-b border-border mt-2 mb-4" />
              </div>
              {companyLoading || devTools?.showSkeletonDebug ? (
                <ReviewCompanySkeleton />
              ) : (
                <div className={sectionGridClassName}>
                  <div className={labelClassName}>Company Name</div>
                  <div className={valueClassName}>{basicInfo?.businessName || "—"}</div>

                  <div className={labelClassName}>Type of Entity</div>
                  <div className={valueClassName}>{basicInfo?.entityType || "—"}</div>

                  <div className={labelClassName}>SSM No</div>
                  <div className={valueClassName}>{basicInfo?.ssmRegisterNumber || "—"}</div>

                  <div className={labelClassName}>Industry</div>
                  <div className={valueClassName}>{basicInfo?.industry || "—"}</div>

                  <div className={labelClassName}>Nature of Business</div>
                  <div className={valueClassName}>Private</div>

                  <div className={labelClassName}>Number of Employees</div>
                  <div className={valueClassName}>{basicInfo?.numberOfEmployees || "—"}</div>
                </div>
              )}
            </section>

            {/* Director & Shareholders */}
            <section className={sectionSpacingClassName}>
              <div>
                <h3 className={sectionHeaderClassName}>Director & Shareholders</h3>
                <div className="border-b border-border mt-2 mb-4" />
              </div>
              {companyLoading || devTools?.showSkeletonDebug ? (
                <ReviewBusinessSkeleton />
              ) : combinedList.length === 0 ? (
                <div className="text-sm text-muted-foreground px-3">
                  No directors or shareholders found
                </div>
              ) : (
<div className={sectionGridClassName}>
  {combinedList.map((item: any) => (
    <React.Fragment key={item.key}>
      <div className={labelClassName}>{item.roleLabel}</div>

      <div className="max-w-[480px] w-full min-w-0">
        <div className="grid grid-cols-[160px_auto_160px_auto_160px] items-center gap-x-3">

          <div className={cn(valueClassName, "break-words")}>
            {item.name}
          </div>

          <div className="w-px h-4 bg-border" />

          <div className="text-[17px] leading-7 text-muted-foreground break-words min-w-0">
            {item.ownership}
          </div>

          <div className="w-px h-4 bg-border" />

          <div className="flex items-center gap-1.5">
            {item.statusVerified && (
              <>
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <span className="text-[17px] leading-7 text-green-600">
                  {item.statusType === "kyb" ? "KYB" : "KYC"}
                </span>
              </>
            )}
          </div>

        </div>
      </div>
    </React.Fragment>
  ))}
</div>
              )}
            </section>

            {/* Banking details */}
            <section className={sectionSpacingClassName}>
              <div>
                <h3 className={sectionHeaderClassName}>Banking Details</h3>
                <div className="border-b border-border mt-2 mb-4" />
              </div>
              {companyLoading || devTools?.showSkeletonDebug ? (
                <ReviewBusinessSkeleton />
              ) : (
                <div className={sectionGridClassName}>
                  <div className={labelClassName}>Bank Name</div>
                  <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank")?.fieldValue || "—"}</div>

                  <div className={labelClassName}>Bank Account Number</div>
                  <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank account number")?.fieldValue || "—"}</div>
                </div>
              )}
            </section>

            {/* Address */}
            <section className={sectionSpacingClassName}>
              <div>
                <h3 className={sectionHeaderClassName}>Address</h3>
                <div className="border-b border-border mt-2 mb-4" />
              </div>
              {companyLoading || devTools?.showSkeletonDebug ? (
                <ReviewBusinessSkeleton />
              ) : (
                <div className={sectionGridClassName}>
                  <div className={labelClassName}>Business Address</div>
                  <div className={valueClassName}>{formatAddress(businessAddress)}</div>

                  <div className={labelClassName}>Registered Address</div>
                  <div className={valueClassName}>{formatAddress(registeredAddress)}</div>
                </div>
              )}
            </section>

            {/* Contact Person */}
            <section className={sectionSpacingClassName}>
              <div>
                <h3 className={sectionHeaderClassName}>Contact Person</h3>
                <div className="border-b border-border mt-2 mb-4" />
              </div>
              {companyLoading || devTools?.showSkeletonDebug ? (
                <ReviewBusinessSkeleton />
              ) : (
                <div className={sectionGridClassName}>
                  <div className={labelClassName}>Applicant Name</div>
                  <div className={valueClassName}>{contactPerson.name || "—"}</div>

                  <div className={labelClassName}>Applicant Position</div>
                  <div className={valueClassName}>{contactPerson.position || "—"}</div>

                  <div className={labelClassName}>Applicant IC No</div>
                  <div className={valueClassName}>{contactPerson.ic || "—"}</div>

                  <div className={labelClassName}>Applicant Contact</div>
                  <div className={valueClassName}>{contactPerson.contact || "—"}</div>
                </div>
              )}
            </section>
          </>
        )}

        {/* Financial Statements */}
        {showFinancialStatementsSection && (
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Financial Statements</h3>
              <div className="border-b border-border mt-2 mb-4" />
            </div>
            {financialStatementsLoading || devTools?.showSkeletonDebug ? (
              <FinancialStatementsSkeleton />
            ) : (() => {
              const raw = (application as any)?.financial_statements;
              if (raw && typeof raw === "object" && raw.questionnaire != null && raw.unaudited_by_year != null) {
                const q = raw.questionnaire as {
                  financial_year_end_year: number;
                  latest_year_submitted: boolean;
                  has_next_financial_year_data: boolean;
                };
                const by = raw.unaudited_by_year as Record<string, Record<string, unknown>>;
                const years = Object.keys(by).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                console.log("Review step: financial v2, years:", years);
                const keys = Object.keys(FINANCIAL_FIELD_LABELS);
                if (years.length === 0) {
                  return (
                    <div className="text-sm text-muted-foreground px-3 space-y-2">
                      <p>
                        Financial year end (questionnaire): {q.financial_year_end_year}. Latest year submitted:{" "}
                        {q.latest_year_submitted ? "Yes" : "No"}. Next year data:{" "}
                        {q.has_next_financial_year_data ? "Yes" : "No"}.
                      </p>
                      <p>No unaudited figures in this step (information-only).</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-8">
                    <div className="text-sm text-muted-foreground px-3">
                      FY end year {q.financial_year_end_year}; latest year submitted:{" "}
                      {q.latest_year_submitted ? "Yes" : "No"}; data for year after:{" "}
                      {q.has_next_financial_year_data ? "Yes" : "No"}.
                    </div>
                    {years.map((y) => {
                      const flat = (by[y] && typeof by[y] === "object" ? by[y] : {}) as Record<string, unknown>;
                      return (
                        <div key={y} className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground px-3">Financial year {y}</h4>
                          <div className={sectionGridClassName}>
                            {keys.map((key) => {
                              const label = FINANCIAL_FIELD_LABELS[key];
                              const val = flat[key];
                              const display =
                                val == null || val === ""
                                  ? "N/A"
                                  : key === "pldd"
                                    ? financialYearEndDisplay(val)
                                    : key === "bsdd"
                                      ? String(val)
                                      : renderMoney(Number(String(val).replace(/,/g, "")));
                              return (
                                <React.Fragment key={`${y}-${key}`}>
                                  <div className={labelClassName}>{label}</div>
                                  <div className={valueClassName}>{display}</div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              const data = raw && typeof raw === "object" && "input" in raw ? raw.input : raw;
              const flat = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
              const keys = Object.keys(FINANCIAL_FIELD_LABELS);
              if (keys.length === 0) {
                return <div className="text-sm text-muted-foreground italic px-3">No financial data</div>;
              }
              return (
                <div className={sectionGridClassName}>
                  {keys.map((key) => {
                    const label = FINANCIAL_FIELD_LABELS[key];
                    const val = flat[key];
                    const display = val == null || val === ""
                      ? "N/A"
                      : key === "pldd"
                        ? financialYearEndDisplay(val)
                        : key === "bsdd"
                          ? String(val)
                          : renderMoney(Number(String(val).replace(/,/g, "")));
                    return (
                      <React.Fragment key={key}>
                        <div className={labelClassName}>{label}</div>
                        <div className={valueClassName}>{display}</div>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        )}

        {/* Supporting Documents — grouped by category (Legal Docs, Financial, etc.) */}
        {showSupportingDocsSection && (
          <>
            {supportingLoading || devTools?.showSkeletonDebug ? (
              <section className={sectionSpacingClassName}>
                <div>
                  <h3 className={sectionHeaderClassName}>Supporting Documents</h3>
                  <div className="border-b border-border mt-2 mb-4" />
                </div>
                <ReviewSupportingDocsSkeleton />
              </section>
            ) : categories.length === 0 ? (
              <section className={sectionSpacingClassName}>
                <div>
                  <h3 className={sectionHeaderClassName}>Supporting Documents</h3>
                  <div className="border-b border-border mt-2 mb-4" />
                </div>
                <div className="text-sm text-muted-foreground italic px-3">No documents</div>
              </section>
            ) : (
              categories.map((cat: any, catIdx: number) => (
                <section key={catIdx} className={sectionSpacingClassName}>
                  <div>
                    <h3 className={sectionHeaderClassName}>{cat.name || "Documents"}</h3>
                    <div className="border-b border-border mt-2 mb-4" />
                  </div>
                  <div className={sectionGridClassName}>
                    {(cat.documents || []).map((doc: any, docIdx: number) => (
                      <React.Fragment key={docIdx}>
                        <div className={labelClassName}>{doc.title}</div>
                        <div className={valueClassName}>
                          {Array.isArray(doc.files) && doc.files.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {doc.files.map((file: any, fileIndex: number) => (
                                <FileDisplayBadge
                                  key={`${file?.s3_key ?? file?.file_name ?? "file"}-${fileIndex}`}
                                  fileName={file.file_name}
                                />
                              ))}
                            </div>
                          ) : doc.file ? (
                            <FileDisplayBadge fileName={doc.file.file_name} />
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not provided</span>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </>
  );
}
