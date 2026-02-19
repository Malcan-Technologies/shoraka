"use client";

/**
 * INVOICE VALIDATION RULES (SUMMARY)
 *
 * 1. Partial rows
 *    - All required columns must be filled.
 *    - Half-filled invoice rows are not allowed.
 *
 * 2. Duplicate invoice numbers
 *    - Each invoice must have a unique invoice number.
 *
 * 3. Past maturity date
 *    - Invoice maturity date must be today or a future date.
 *    - Overdue (past) invoices cannot be financed.
 *
 * 4. Contract date window (only if a contract exists)
 *    - Invoice maturity date must fall within the
 *      contract start and end dates.
 *    - Skipped for invoice-only flows (no contract).
 *
 * 5. Minimum invoice value
 *    - Each product defines a minimum invoice value.
 *    - Invoice value must meet or exceed this amount.
 *
 * 6. Financing ratio
 *    - Only part of each invoice can be financed.
 *    - Financing ratio must be between 60% and 80%.
 *
 * 9. Facility limit
 *    - Total financing amount across all invoices
 *      must not exceed the approved facility limit.
 */


/**
 * INVOICE DETAILS STEP
 *
 * - Manages invoice rows (local state until Save and Continue)
 * * - File uploads happen on Save and Continue
* - One document per invoice (no versioning)
 * - Each invoice is persisted individually to DB
 * - Documents are uploaded with version tracking
 * - Returns invoice snapshot for application-level persistence
 */
import * as React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/app/applications/components/date-input";
import { Trash2 } from "lucide-react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { XMarkIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
import { Slider } from "@/components/ui/slider";
import { cn } from "@cashsouk/ui";
import {
  formLabelClassName,
  withFieldError,
} from "@/app/applications/components/form-control";
import { StatusBadge } from "../components/invoice-status-badge";
import { formatMoney, parseMoney } from "../components/money";
import { MoneyInput } from "@/app/applications/components/money-input";
import { InvoiceDetailsSkeleton } from "@/app/applications/components/invoice-details-skeleton";
import { InvoiceTableSkeleton } from "@/app/applications/components/invoice-table-skeleton";
import { DebugSkeletonToggle } from "@/app/applications/components/debug-skeleton-toggle";
const valueClassName = "text-[17px] leading-7 text-foreground font-medium";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

import { parseISO, parse, isValid, format } from "date-fns";

/**
 * PRODUCT CONFIG EXTRACTION
 *
 * Reads invoice validation config from product workflow.
 * Config must be provided by admin; no fallbacks.
 */
interface InvoiceConfig {
  min_invoice_value?: number;
}

function getProductInvoiceConfig(application: any): InvoiceConfig | null {
  /** Extract invoice step config from product workflow */
  const workflow = application?.product?.workflow || [];
  const invoiceStep = workflow.find(
    (step: any) => step.id?.includes?.("invoice_details") || step.name?.includes?.("invoice")
  );
  const config = invoiceStep?.config || {};

  // If admin hasn't provided the invoice config, return null (validation will be skipped for missing fields)
  if (config == null || Object.keys(config).length === 0) return null;

  return {
    min_invoice_value: config.min_invoice_value,
  };
}

/**
 * Parse date string to Date object.
 *
 * What: Converts "YYYY-MM-DD" string to Date.
 * Why: Normalize date comparisons.
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  // ISO yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = parseISO(dateStr);
    return isValid(d) ? d : null;
  }
  // d/M/yyyy (user-facing)
  const d = parse(dateStr, "d/M/yyyy", new Date());
  return isValid(d) ? d : null;
}

/**
 * LOCAL INVOICE STATE SHAPE
 */
type LocalInvoice = {
  id: string;
  isPersisted: boolean;
  number: string;
  value: string;
  maturity_date: string;
  financing_ratio_percent?: number;
  status?: string;
  document?: { file_name: string; file_size: number; s3_key?: string } | null;
};

interface InvoiceDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

export default function InvoiceDetailsStep({ applicationId, onDataChange }: InvoiceDetailsStepProps) {
  // DEBUG: Toggle skeleton mode
  const [debugSkeletonMode, setDebugSkeletonMode] = React.useState(false);
  
  const [invoices, setInvoices] = React.useState<LocalInvoice[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});
  const [application, setApplication] = React.useState<any>(null);
  const [lastS3Keys, setLastS3Keys] = React.useState<Record<string, string>>({});
  const [deletedInvoices, setDeletedInvoices] = React.useState<Record<string, { s3_key?: string }>>({});
  const [initialInvoices, setInitialInvoices] = React.useState<Record<string, LocalInvoice>>({});
  const [isLoadingApplication, setIsLoadingApplication] = React.useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = React.useState(true);
  const [isInitialized, setIsInitialized] = React.useState(false);

  const { getAccessToken } = useAuthToken();

  React.useEffect(() => {
    let mounted = true;
    const loadApplication = async () => {
      if (application) {
        setIsLoadingApplication(false);
        return;
      }
      setIsLoadingApplication(true);
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        const resp: any = await apiClient.get(`/v1/applications/${applicationId}`);
        if (resp.success && mounted) {
          setApplication(resp.data);
        }
      } catch (err) {

      } finally {
        if (mounted) {
          setIsLoadingApplication(false);
        }
      }
    };
    loadApplication();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const addInvoice = () => {
    setInvoices((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        isPersisted: false,
        number: "",
        value: "",
        maturity_date: "",
        financing_ratio_percent: 60,
        document: null,
        status: "DRAFT",
      },
    ]);
  };

  const deleteInvoice = (inv: LocalInvoice) => {
    if (inv.isPersisted) {
      setDeletedInvoices((prev) => ({
        ...prev,
        [inv.id]: {
          s3_key: inv.document?.s3_key,
        },
      }));
    }
    setInvoices((prev) => prev.filter((row) => row.id !== inv.id));
    setSelectedFiles((prev) => {
      const copy = { ...prev };
      delete copy[inv.id];
      return copy;
    });
    setLastS3Keys((prev) => {
      const copy = { ...prev };
      delete copy[inv.id];
      return copy;
    });
  };

  const updateInvoiceField = (id: string, field: keyof LocalInvoice, value: any) => {
    setInvoices((s) => s.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
  };

  const handleFileChange = (id: string, file: File, existingS3Key?: string) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large (max 5MB)");
      return;
    }
    setSelectedFiles((p) => ({ ...p, [id]: file }));
    updateInvoiceField(id, "document", {
      file_name: file.name,
      file_size: file.size,
      s3_key: existingS3Key,
    });
    toast.success("File added");
  };

  const isRowEmpty = (inv: LocalInvoice) => {
    return !inv.number && inv.value === "" && !inv.maturity_date && !inv.document;
  };

  const isRowPartial = (inv: LocalInvoice) => {
    if (isRowEmpty(inv)) return false;
    /**
     * CHECK PARTIAL DATA
     *
     * 0 is considered valid user input, not empty
     * A row is partial if some fields are filled but not all 4
     */
    const hasNumber = Boolean(String(inv.number).trim());
    const hasValue = inv.value !== ""; // 0 is valid, empty string is not
    const hasDate = Boolean(String(inv.maturity_date).trim());
    const hasDocument = Boolean(inv.document) || Boolean(selectedFiles[inv.id]);
    const filledCount = [hasNumber, hasValue, hasDate, hasDocument].filter(Boolean).length;
    return filledCount > 0 && filledCount < 4;
  };


  const validateRow = (inv: LocalInvoice) => {
    if (isRowEmpty(inv)) return true;
    /**
     * VALIDATE COMPLETE ROW
     *
     * All 4 fields must be filled:
     * - number: non-empty string
     * - value: non-empty (0 is valid, empty string is not)
     * - maturity_date: non-empty string
     * - document: file attached
     */
    const hasNumber = Boolean(String(inv.number).trim());
    const hasValue = inv.value !== ""; // 0 is valid, empty string is not
    const hasDate = Boolean(String(inv.maturity_date).trim());
    const hasDocument = Boolean(inv.document) || Boolean(selectedFiles[inv.id]);
    return hasNumber && hasValue && hasDate && hasDocument;
  };

  const hasDuplicateInvoiceNumbers = () => {
    const numbers = invoices
      .filter((inv) => !isRowEmpty(inv))
      .map((inv) => inv.number.trim())
      .filter(Boolean);

    const unique = new Set(numbers);
    return unique.size !== numbers.length;
  };

  /**
   * COMPREHENSIVE INVOICE VALIDATION
   *
   * Validates a single invoice against all product and contract constraints.
   * Returns error message if validation fails, empty string if valid.
   *
   * Validation order:
   * 1. Invalid date format
   * 2. Past maturity date
   * 3. Contract date window (if contract exists)
   * 4. Min invoice value
   */
  const validateInvoiceConstraints = (inv: LocalInvoice, productConfig: InvoiceConfig): string => {
    // Ignore empty rows
    if (isRowEmpty(inv)) return "";

    // Parse maturity date
    const maturityDate = parseDateString(inv.maturity_date);
    
    // Check if date string exists but couldn't be parsed (invalid date like Feb 31)
    if (inv.maturity_date && !maturityDate) {
      return `Invoice ${inv.number}: Invalid date.`;
    }

    if (!maturityDate) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (maturityDate < today) {
      return `Invoice ${inv.number}: Maturity date cannot be in the past.`;
    }

    if (!isInvoiceOnly && application?.contract) {

      const contractStart = parseDateString(application.contract.contract_details?.start_date);
      const contractEnd = parseDateString(application.contract.contract_details?.end_date);

      if (contractStart && maturityDate < contractStart) {
        return `Invoice ${inv.number}: Maturity date must be on or after contract start date.`;
      }

      if (contractEnd && maturityDate > contractEnd) {
        return `Invoice ${inv.number}: Maturity date must be on or before contract end date.`;
      }
    }

    const invoiceValue = parseMoney(inv.value);
    const minValue = productConfig.min_invoice_value;
    if (typeof minValue === "number") {
      if (invoiceValue < minValue) {
        return `Invoice ${inv.number}: Value must be at least ${formatMoney(minValue)}.`;
      }
    }

    return "";
  };


  const hasRowChanged = (inv: LocalInvoice) => {
    if (!inv.isPersisted) return !isRowEmpty(inv);
    const base = initialInvoices[inv.id];
    if (!base) return false;
    return (
      inv.number !== base.number ||
      inv.value !== base.value ||
      inv.maturity_date !== base.maturity_date ||
      inv.financing_ratio_percent !== base.financing_ratio_percent ||
      inv.document?.s3_key !== base.document?.s3_key
    );
  };

  const applicationFinancingAmount = invoices.reduce((acc, inv) => {

    const value = parseMoney(inv.value);

    const ratio = (inv.financing_ratio_percent || 60) / 100;
    return acc + value * ratio;
  }, 0);

  const totalFinancingAmount = applicationFinancingAmount;

  const approvedFacility = application?.contract?.contract_details?.approved_facility || 0;
  const contractValue = application?.contract?.contract_details?.value || 0;


  const structureType = application?.financing_structure?.structure_type;
  let facilityLimit = 0;
  if (structureType === "new_contract") {
    facilityLimit = parseMoney(contractValue);
  }
  if (structureType === "existing_contract") {
    facilityLimit = parseMoney(approvedFacility);
  }

  const liveAvailableFacility = facilityLimit - totalFinancingAmount;

  const hasPendingFiles = Object.keys(selectedFiles).length > 0;
  const hasPartialRows = invoices.some((inv) => isRowPartial(inv));
  const allRowsValid = invoices.every((inv) => validateRow(inv));

  let validationError = "";
  const isInvoiceOnly = application?.financing_structure?.structure_type === "invoice_only";
  const isExistingContract = application?.financing_structure?.structure_type === "existing_contract";

  let productConfig: InvoiceConfig | null = null;
  try {
    productConfig = getProductInvoiceConfig(application);
  } catch (err) {
    validationError = err instanceof Error ? err.message : "Product configuration error";
  }

  if (hasPartialRows) {
    validationError = "Please complete all invoice details. Rows cannot have partial data.";
  }

  if (!validationError && hasDuplicateInvoiceNumbers()) {
    validationError = "Invoice numbers must be unique. Duplicate invoice numbers are not allowed.";
  }

  // Validate all invoice constraints (maturity date, value limits, contract window)
  if (!validationError && productConfig) {
    for (const inv of invoices) {
      const constraintError = validateInvoiceConstraints(inv, productConfig);
      if (constraintError) {
        validationError = constraintError;
        break;
      }
    }
  }

  if (!validationError && (isInvoiceOnly || isExistingContract)) {
    const hasAtLeastOneValidInvoice = invoices.some((inv) => !isRowEmpty(inv) && validateRow(inv));
    if (!hasAtLeastOneValidInvoice) {
      validationError = "Please add at least one valid invoice with all fields filled (invoice number, value, maturity date, document).";
    }
  }

  if (!isInvoiceOnly && !validationError) {
    const invalidRatioInvoice = invoices.find(
      (inv) => !isRowEmpty(inv) && (inv.financing_ratio_percent! < 60 || inv.financing_ratio_percent! > 80)
    );
    if (invalidRatioInvoice) {
      validationError = "Financing ratio must be between 60% and 80%.";
    }
    if (!validationError && totalFinancingAmount > facilityLimit) {
      validationError = `Total financing amount (${formatMoney(totalFinancingAmount)}) exceeds facility limit (${formatMoney(facilityLimit)}).`;
    }
  }

  const saveFunction = async () => {
    /**
     * VALIDATION CHECK
     *
     * If there are validation errors, show toast and prevent save.
     */
    if (validationError) {
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_INVOICES");
    }

    const apiClient = createApiClient(API_URL, getAccessToken);
    const token = await getAccessToken();
    const structureType = application?.financing_structure?.structure_type;
    const isInvoiceOnly = structureType === "invoice_only";

    for (const invoiceId of Object.keys(deletedInvoices)) {
      await apiClient.deleteInvoice(invoiceId);
    }

    for (const inv of invoices) {
      if (isRowEmpty(inv)) continue;

      /**
       * SKIP LOCKED INVOICES
       *
       * Don't try to update APPROVED or SUBMITTED invoices
       * The backend rejects these with "Cannot update an approved invoice"
       */
      const isLocked = inv.status === "SUBMITTED" || inv.status === "APPROVED";
      if (isLocked) {
        continue;
      }

      let invoiceId = inv.id;
      let currentS3Key = lastS3Keys[inv.id] || lastS3Keys[invoiceId];

      if (!inv.isPersisted) {
        const createPayload: any = {
          applicationId,
          details: {
            number: inv.number,
            value: parseMoney(inv.value),
            maturity_date: (() => {
              const pd = parseDateString(inv.maturity_date);
              return pd ? format(pd, "yyyy-MM-dd") : inv.maturity_date;
            })(),
            financing_ratio_percent: inv.financing_ratio_percent || 60,
          },
        };

        /**
         * CONTRACT ID ASSIGNMENT FOR NEW INVOICES
         *
         * - invoice_only: DO NOT pass contractId (will be null in DB)
         * - existing_contract or new_contract: pass contract_id if it exists
         */
        if (!isInvoiceOnly && application?.contract_id)
          createPayload.contractId = application.contract_id;


        const createResp: any = await apiClient.createInvoice(createPayload);
        if (!createResp?.success) {
          throw new Error("Failed to create invoice");
        }
        invoiceId = createResp.data.id;
      } else {
        /**
         * UPDATE EXISTING INVOICES
         *
         * For invoice_only: ALWAYS set contractId to null (clear any existing contract_id)
         * For others: only update details, don't touch contractId
         */
        const updatePayload: any = {
          number: inv.number,
          value: parseMoney(inv.value),
          maturity_date: (() => {
            const pd = parseDateString(inv.maturity_date);
            return pd ? format(pd, "yyyy-MM-dd") : inv.maturity_date;
          })(),
          financing_ratio_percent: inv.financing_ratio_percent || 60,
        };

        if (isInvoiceOnly) {
          updatePayload.contractId = null;
        } else if (application?.contract_id) {
          updatePayload.contractId = application.contract_id;
        }
        await apiClient.updateInvoice(invoiceId, updatePayload);
      }

      const file = selectedFiles[inv.id] || selectedFiles[invoiceId];
      if (!file) continue;

      const existingS3Key = currentS3Key;
      const urlResp = await fetch(`${API_URL}/v1/invoices/${invoiceId}/upload-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          existingS3Key,
        }),
      });

      const urlJson = await urlResp.json();
      if (!urlJson.success) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl, s3Key } = urlJson.data;
      currentS3Key = s3Key;

      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      /**
       * UPDATE WITH DOCUMENT + CONTRACT ID
       *
       * Structure: { document: {...}, contractId: ... }
       */
      const finalUpdatePayload: any = {
        document: {
          file_name: file.name,
          file_size: file.size,
          s3_key: s3Key,
        },
      };

      if (isInvoiceOnly) {
        finalUpdatePayload.contractId = null;
      } else if (application?.contract_id) {
        finalUpdatePayload.contractId = application.contract_id;
      }
      await apiClient.updateInvoice(invoiceId, finalUpdatePayload);
      setLastS3Keys((prev) => ({
        ...prev,
        [invoiceId]: s3Key,
      }));

      setInvoices((prev) =>
        prev.map((row) =>
          row.id === inv.id
            ? {
              ...row,
              id: invoiceId,
              isPersisted: true,
              document: {
                file_name: file.name,
                file_size: file.size,
                s3_key: s3Key,
              },
            }
            : row
        )
      );
    }

    setSelectedFiles({});
    setDeletedInvoices({});
    
    // Return persisted invoices for application-level persistence
    return {
      invoices: invoices.filter((inv) => !isRowEmpty(inv)),
      totalFinancingAmount,
    };
  };

  const hasUnsavedChanges =
    invoices.some((inv) => !inv.isPersisted && !isRowEmpty(inv)) ||
    invoices.some((inv) => hasRowChanged(inv)) ||
    Object.keys(selectedFiles).length > 0 ||
    Object.keys(deletedInvoices).length > 0;

  React.useEffect(() => {
    let isValid = !hasPartialRows && !validationError;
    onDataChange?.({
      invoices,
      totalFinancingAmount,
      isValid,
      validationError,
      hasPendingChanges: hasUnsavedChanges,
      isUploading: false,
      saveFunction,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, totalFinancingAmount, hasPendingFiles, allRowsValid, hasPartialRows, validationError, isInvoiceOnly, isExistingContract]);

  React.useEffect(() => {
    if (!application) return;
    if (isInitialized) {
      setIsLoadingInvoices(false);
      return;
    }

    let mounted = true;
    const loadInvoices = async () => {
      setIsLoadingInvoices(true);
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);
        const isExistingContract = application?.financing_structure?.structure_type === "existing_contract";
        const contractId = application?.contract_id;

        const toLocalInvoice = (it: any): LocalInvoice => {
          const d = it.details || {};
          return {
            id: it.id,
            isPersisted: true,
            number: d.number || "",
            status: it.status || "DRAFT",
            value: d.value != null ? formatMoney(d.value) : "",
            maturity_date: (() => {
              if (!d.maturity_date) return "";
              if (/^\d{4}-\d{2}-\d{2}$/.test(d.maturity_date)) {
                const parsed = parseISO(d.maturity_date);
                if (isValid(parsed)) return format(parsed, "d/M/yyyy");
              }
              return d.maturity_date || "";
            })(),
            financing_ratio_percent: d.financing_ratio_percent || 60,
            document: d.document
              ? {
                file_name: d.document.file_name,
                file_size: d.document.file_size,
                s3_key: d.document.s3_key,
              }
              : null,
          };
        };

        let mapped: LocalInvoice[];

        if (isExistingContract && contractId) {
          /**
           * EXISTING CONTRACT: Fetch by contract first, then by application
           * Contract invoices (APPROVED/SUBMITTED) come first
           * Application invoices exclude APPROVED/SUBMITTED to avoid duplicates
           */
          const contractResp: any = await apiClient.getInvoicesByContract(contractId);
          const contractItems: any[] =
            "success" in contractResp && contractResp.success
              ? (contractResp.data || []).filter(
                (it: any) => it.status === "APPROVED" || it.status === "SUBMITTED"
              )
              : [];
          const contractMapped = contractItems.map(toLocalInvoice);

          const appResp: any = await apiClient.getInvoicesByApplication(applicationId);
          if (!("success" in appResp) || !appResp.success) {
            mapped = contractMapped;
          } else {
            const appItems: any[] = (appResp.data || []).filter(
              (it: any) =>
                it.status !== "REJECTED" &&
                it.status !== "APPROVED" &&
                it.status !== "SUBMITTED"
            );
            const appMapped = appItems.map(toLocalInvoice);
            mapped = [...contractMapped, ...appMapped];
          }
        } else {
          /**
           * INVOICE_ONLY / NEW_CONTRACT: Single fetch by application
           */
          const resp: any = await apiClient.getInvoicesByApplication(applicationId);
          if (!("success" in resp) || !resp.success) return;

          const items: any[] = resp.data || [];
          const isInvoiceOnly = application?.financing_structure?.structure_type === "invoice_only";
          const filtered = items.filter((it: any) => {
            if (it.status === "REJECTED") return false;
            if (isInvoiceOnly && it.status !== "DRAFT") return false;
            return true;
          });
          mapped = filtered.map(toLocalInvoice);
        }

        const baseline: Record<string, LocalInvoice> = {};
        mapped.forEach((inv) => {
          baseline[inv.id] = inv;
        });
        setInitialInvoices(baseline);

        if (mounted) {
          setInvoices(mapped);
          const keys: Record<string, string> = {};
          mapped.forEach((inv) => {
            if (inv.document?.s3_key) {
              keys[inv.id] = inv.document.s3_key;
            }
          });
          setLastS3Keys(keys);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error("Failed to load invoices", err);
      } finally {
        if (mounted) {
          setIsLoadingInvoices(false);
        }
      }
    };
    loadInvoices();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, application?.financing_structure?.structure_type, application?.contract_id]);

  const isNewContract =
    application?.financing_structure?.structure_type === "new_contract";


  return (
    <>
    <div className="space-y-10 px-3 max-w-[1200px] mx-auto">
      {/* ================= Contract ================= */}
      {isLoadingApplication || debugSkeletonMode ? (
        <>
          <InvoiceDetailsSkeleton />
          <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
        </>
      ) : (
        application?.contract && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold">Contract</h3>
              <div className="mt-2 h-px bg-border" />
            </div>

          <div className="space-y-3 mt-4 px-3">
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-y-3">
              <div className={formLabelClassName}>Contract title</div>
              <div className={valueClassName}>{application.contract.contract_details?.title || "-"}</div>

              <div className={formLabelClassName}>Customer</div>
              <div className={valueClassName}>{application.contract.customer_details?.name || "-"}</div>

              <div className={formLabelClassName}>Contract value</div>
              <div className={valueClassName}>
                RM {application.contract.contract_details?.value != null
                  ? formatMoney(application.contract.contract_details.value)
                  : "—"}
              </div>


              <div className={formLabelClassName}>Approved facility</div>
              <div className={valueClassName}>
                {isNewContract ? "—" : (
                  application.contract.contract_details?.approved_facility != null
                    ? `RM ${formatMoney(application.contract.contract_details.approved_facility)}`
                    : "—"
                )}
              </div>






              <div className={formLabelClassName}>Utilised facility</div>
              <div className={valueClassName}>
                {isNewContract ? "—" : (
                  application.contract.contract_details?.utilized_facility != null
                    ? `RM ${formatMoney(application.contract.contract_details.utilized_facility)}`
                    : "—"
                )}
              </div>


              <div className={formLabelClassName}>Available facility</div>
              <div
                className={cn(
                  "text-sm md:text-base leading-6 font-medium",
                  !isNewContract && liveAvailableFacility < 0 && "text-destructive"
                )}
              >
                {isNewContract ? "—" : `RM ${formatMoney(Math.max(liveAvailableFacility ?? 0, 0))}`}
              </div>




            </div>
          </div>
        </div>
        )
      )}

      {/* ================= Invoice Details ================= */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base sm:text-lg md:text-xl font-semibold">
              Invoice details
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add invoices below. Rows are local until you Save and Continue.
            </p>
          </div>

          <Button onClick={addInvoice} className="bg-primary text-primary-foreground">
            Add invoice
          </Button>
        </div>

        <div className="mt-2 h-px bg-border" />

        {/* ================= Table ================= */}
        <div className="mt-4 px-3">
          {isLoadingInvoices ? (
            <InvoiceTableSkeleton rowCount={3} />
          ) : (
          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="w-[140px] whitespace-nowrap text-xs font-semibold">
                      Invoice
                    </TableHead>

                    <TableHead className="w-[100px] whitespace-nowrap text-xs font-semibold">
                      Status
                    </TableHead>

                    <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold">
                      Maturity date
                    </TableHead>

                    <TableHead className="w-[150px] whitespace-nowrap text-xs font-semibold">
                      Invoice value (RM)
                    </TableHead>

                    <TableHead className="w-[130px] whitespace-nowrap text-xs font-semibold">
                      Financing ratio
                    </TableHead>

                    <TableHead className="w-[200px] whitespace-nowrap text-xs font-semibold">
                      Maximum financing amount (RM)
                    </TableHead>

                    <TableHead className="w-[160px] whitespace-nowrap text-xs font-semibold">
                      Documents
                    </TableHead>

                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {/* APPLICATION INVOICES */}
                  {invoices.map((inv) => {
                    const ratio = inv.financing_ratio_percent || 60;
                    const value = parseMoney(inv.value);
                    const financingAmount = value * (ratio / 100);
                    const isLocked = inv.status === "SUBMITTED" || inv.status === "APPROVED";
                    const isEditable = inv.status === "DRAFT" || !inv.status;

                    return (
                      <TableRow
                        key={inv.id}
                        className={cn(
                          "hover:bg-muted/40 transition-colors",
                          isLocked && "opacity-60 grayscale pointer-events-none"
                        )}
                      >
                        <TableCell className="p-2">
                          <Input
                            value={inv.number}
                            disabled={!isEditable}
                            onChange={(e) => updateInvoiceField(inv.id, "number", e.target.value)}
                            placeholder="Enter invoice"
                            className={withFieldError(
                              "h-9 text-xs rounded-xl border border-input bg-background px-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary",
                              isRowPartial(inv)
                            )}
                          />
                        </TableCell>

                        <TableCell className="p-2">
                          <StatusBadge status={inv.status} />
                        </TableCell>

                        <TableCell className="p-2">
                          <DateInput
                            value={inv.maturity_date || ""}
                            onChange={(v) => updateInvoiceField(inv.id, "maturity_date", v)}
                            className={!isEditable ? "opacity-60 pointer-events-none" : ""}
                            isInvalid={isRowPartial(inv)}
                            size="compact"
                            placeholder="Enter date"
                          />
                        </TableCell>

                        <TableCell className="p-2">
                          <MoneyInput
                            value={inv.value}
                            onValueChange={(v) => updateInvoiceField(inv.id, "value", v)}
                            placeholder="Enter value"
                            disabled={!isEditable}
                            inputClassName={withFieldError(
                              "h-9 text-xs rounded-xl border border-input bg-background px-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary",
                              isRowPartial(inv)
                            )}
                          />
                        </TableCell>

                        <TableCell className="p-2">
                          <div className="space-y-1">
                            <div
                              className="relative text-[10px] font-medium text-muted-foreground"
                              style={{
                                left: `${((ratio - 60) / 20) * 100}%`,
                                transform: "translateX(-50%)",
                                width: "fit-content",
                              }}
                            >
                              <div className="rounded-md border border-border bg-white px-2 py-0.5 text-[10px] font-medium text-black shadow-sm">
                                {ratio}%
                              </div>
                            </div>

                            <div className="max-w-[110px] mx-auto">
                              <Slider
                                min={60}
                                max={80}
                                step={1}
                                value={[ratio]}
                                disabled={!isEditable}
                                onValueChange={(value) =>
                                  updateInvoiceField(inv.id, "financing_ratio_percent", value[0])
                                }
                                className="
                                relative
                                [&_[data-orientation=horizontal]]:h-1.5
                                [&_[data-orientation=horizontal]]:bg-muted
                                [&_[data-orientation=horizontal]>span]:bg-primary
                                [&_[role=slider]]:h-4
                                [&_[role=slider]]:w-4
                                [&_[role=slider]]:border-2
                                [&_[role=slider]]:border-primary
                                [&_[role=slider]]:bg-background
                                [&_[role=slider]]:shadow-none
                              "
                              />
                            </div>

                            <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                              <span>60%</span>
                              <span>80%</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="p-2 text-xs tabular-nums whitespace-nowrap">
                          {formatMoney(financingAmount)}
                        </TableCell>

                        <TableCell className="p-2">
                          {inv.document ? (
                            <div className="inline-flex items-center gap-2 border border-border rounded-sm px-2 py-[2px] w-full h-8">
                              <div className="w-3 h-3 rounded-sm bg-foreground flex items-center justify-center shrink-0">
                                <CheckIconSolid className="h-2 w-2 text-background" />
                              </div>
                              <span className="text-xs font-medium truncate flex-1">
                                {inv.document.file_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (inv.document?.s3_key) {
                                    setLastS3Keys((prev) => ({
                                      ...prev,
                                      [inv.id]: inv.document!.s3_key!,
                                    }));
                                  }
                                  updateInvoiceField(inv.id, "document", null);
                                  setSelectedFiles((prev) => {
                                    const copy = { ...prev };
                                    delete copy[inv.id];
                                    return copy;
                                  });
                                }}
                                className={cn(
                                  "shrink-0",
                                  isEditable
                                    ? "text-muted-foreground hover:text-foreground cursor-pointer"
                                    : "opacity-40 cursor-not-allowed"
                                )}
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <label className="inline-flex items-center gap-1 text-xs font-medium text-primary cursor-pointer hover:opacity-80 h-8">
                              <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">Upload</span>
                              <Input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                disabled={!isEditable}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleFileChange(inv.id, f, inv.document?.s3_key);
                                }}
                              />
                            </label>
                          )}
                        </TableCell>

                        <TableCell className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isLocked}
                            onClick={() => deleteInvoice(inv)}
                            className={cn(
                              isLocked
                                ? "text-muted-foreground cursor-not-allowed"
                                : "hover:text-destructive"
                            )}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* TOTAL */}
                  <TableRow className="bg-muted/10">
                    <TableCell colSpan={5} />
                    <TableCell className="p-2 font-semibold text-xs">
                      {formatMoney(totalFinancingAmount)}
                      <div className="text-xs text-muted-foreground font-normal">Total</div>
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          )}
        </div>

        {/* ================= Validation ================= */}
        {validationError && (
          <div className="mx-3 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 mt-4">
            <XMarkIcon className="h-5 w-5" />
            {validationError}
          </div>
        )}
      </div>
    </div>
    <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
    </>
  );
}

export { InvoiceDetailsStep };
