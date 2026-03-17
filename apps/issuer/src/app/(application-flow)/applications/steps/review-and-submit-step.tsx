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
import { formLabelClassName } from "@/app/(application-flow)/applications/components/form-control";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
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
import { formatMoney } from "../components/money";
import { FINANCIAL_FIELD_LABELS } from "@cashsouk/types";
import { FinancialStatementsSkeleton } from "../components/financial-statements-skeleton";

const INVOICE_TABLE_COLUMNS = {
  invoice: "w-[140px]",
  status: "w-[100px]",
  maturity: "w-[150px]",
  value: "w-[150px]",
  ratio: "w-[130px]",
  amount: "w-[200px]",
  document: "w-[160px]",
  action: "w-[50px]",
};


const isValidNumber = (v: any): v is number =>
  typeof v === "number" && !Number.isNaN(v);


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
const valueClassName = "text-[17px] leading-7 text-foreground font-medium";
const sectionHeaderClassName = "text-base font-semibold text-foreground";
const sectionGridClassName = "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 px-3 items-center";
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
    <>
      <div className={`${pageWrapperClassName} space-y-12 pb-20`}>
        {/* Financing details */}
        {showFinancingDetails && (
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Financing details</h3>
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

        {/* Contract */}
        {showContractSection && !isInvoiceOnly && (
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Contract</h3>
              <div className="border-b border-border mt-2 mb-4" />
            </div>
            {contractLoading || devTools?.showSkeletonDebug ? (
              <ReviewContractSkeleton />
            ) : (
              <div className={sectionGridClassName}>
                <div className={labelClassName}>Contract title</div>
                <div className={valueClassName}>{contractDetails.title || "—"}</div>

                <div className={labelClassName}>Contract status</div>
                <div className={cn(valueClassName, "text-primary font-semibold")}>New submission (Pending approval)</div>

                <div className={labelClassName}>Customer</div>
                <div className={valueClassName}>{customerDetails.name || "—"}</div>

                <div className={labelClassName}>Contract value</div>
                <div className={valueClassName}>
                  {isValidNumber(contractValue) ? renderMoney(contractValue) : "—"}
                </div>

                <div className={labelClassName}>Contract financing</div>
                <div className={valueClassName}>
                  {contractDetails?.financing === null || contractDetails?.financing === undefined
                    ? "N/A"
                    : renderMoney(contractDetails?.financing)}
                </div>

                <div className={labelClassName}>Approved facility</div>
                <div className={valueClassName}>
                  {isValidNumber(approvedFacility) && approvedFacility > 0 ? renderMoney(approvedFacility) : "N/A"}
                </div>

                <div className={labelClassName}>Utilised facility</div>
                <div className={valueClassName}>
                  {structureType === "existing_contract" && isValidNumber(totalFinancingAmount) ? renderMoney(totalFinancingAmount) : "N/A"}
                </div>

                <div className={labelClassName}>Available facility</div>
                <div className={valueClassName}>
                  {structureType === "existing_contract" && isValidNumber(calculatedAvailableFacility) ? renderMoney(calculatedAvailableFacility) : "N/A"}
                </div>
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
              <>
                <div className="border rounded-xl bg-card overflow-hidden">
                  {invoices.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground italic">
                      No invoices added
                    </div>
                  ) : (
                    <>
                      {/* Table */}
                      <div className="overflow-x-auto [&_tbody_tr]:hover:bg-transparent">
                        <Table className="table-fixed w-full">
                          <TableHeader className="bg-muted/20">
                            <TableRow>
                              <TableHead className={`${INVOICE_TABLE_COLUMNS.invoice} text-xs font-semibold`}>
                                Invoice
                              </TableHead>
                              <TableHead className={`${INVOICE_TABLE_COLUMNS.status} text-xs font-semibold`}>
                                Status
                              </TableHead>
                              <TableHead className={`${INVOICE_TABLE_COLUMNS.maturity} text-xs font-semibold`}>
                                Maturity date
                              </TableHead>
                              <TableHead className={`${INVOICE_TABLE_COLUMNS.value} text-xs font-semibold`}>
                                Invoice value
                              </TableHead>
                              <TableHead className={`${INVOICE_TABLE_COLUMNS.ratio} text-xs font-semibold`}>
                                Financing ratio
                              </TableHead>
                              <TableHead className={`${INVOICE_TABLE_COLUMNS.amount} text-xs font-semibold`}>
                                Maximum financing amount
                              </TableHead>
                              <TableHead className={`${INVOICE_TABLE_COLUMNS.document} text-xs font-semibold`}>
                                Documents
                              </TableHead>
                              <TableHead className={INVOICE_TABLE_COLUMNS.action} />
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

                                  {/* Document */}
                                  <TableCell className="p-2">
                                    {d.document?.file_name ? (
                                      <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] h-6">
                                        <div className="w-3.5 h-3.5 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                                          <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                                        </div>
                                        <span className="text-xs font-medium truncate max-w-[120px]">
                                          {d.document.file_name}
                                        </span>
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
              </>
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

      <div className="max-w-[480px] w-full">
        <div className="grid grid-cols-[160px_auto_160px_auto_160px] items-center gap-x-3">

          <div className={valueClassName}>
            {item.name}
          </div>

          <div className="w-px h-4 bg-border" />

          <div className="text-[17px] leading-7 text-muted-foreground">
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
                  <div className={labelClassName}>Bank name</div>
                  <div className={valueClassName}>{(bankAccountDetails as any)?.content?.find((f: any) => f.fieldName === "Bank")?.fieldValue || "—"}</div>

                  <div className={labelClassName}>Bank account number</div>
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
                  <div className={labelClassName}>Business address</div>
                  <div className={valueClassName}>{formatAddress(businessAddress)}</div>

                  <div className={labelClassName}>Registered address</div>
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
                  <div className={labelClassName}>Applicant name</div>
                  <div className={valueClassName}>{contactPerson.name || "—"}</div>

                  <div className={labelClassName}>Applicant position</div>
                  <div className={valueClassName}>{contactPerson.position || "—"}</div>

                  <div className={labelClassName}>Applicant IC no</div>
                  <div className={valueClassName}>{contactPerson.ic || "—"}</div>

                  <div className={labelClassName}>Applicant contact</div>
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
                    const isDate = key === "pldd" || key === "bsdd";
                    const display = val == null || val === ""

                      ? "N/A"
                      : isDate
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

        {/* Legal docs */}
        {showSupportingDocsSection && (
          <section className={sectionSpacingClassName}>
            <div>
              <h3 className={sectionHeaderClassName}>Legal Docs</h3>
              <div className="border-b border-border mt-2 mb-4" />
            </div>
            {supportingLoading || devTools?.showSkeletonDebug ? (
              <ReviewSupportingDocsSkeleton />
            ) : (
              <div className={sectionGridClassName}>
                {categories.flatMap((cat: any) => cat.documents).map((doc: any, i: number) => (
                  <React.Fragment key={i}>
                    <div className={labelClassName}>{doc.title}</div>
                    <div className={valueClassName}>
                      {doc.file ? (
                        <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] h-6">
                          <div className="w-3.5 h-3.5 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                            <CheckIconSolid className="h-2.5 w-2.5 text-background" />
                          </div>
                          <span className="text-[14px] font-medium truncate">{doc.file.file_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not provided</span>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
