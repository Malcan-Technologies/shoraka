"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Item unlock logic for invoice rows, InvoiceErrorCard for amendment errors
 */

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
 * 5. Min/max financing amount (product config)
 *    - Per-invoice: each invoice's financing amount (value × ratio) must be within min/max.
 *
 * 6. Financing ratio (all structures including invoice_only)
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
import { DateInput } from "@/app/(application-flow)/applications/components/date-input";
import { Trash2 } from "lucide-react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import { XMarkIcon, CloudArrowUpIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { Slider } from "@/components/ui/slider";
import { cn } from "@cashsouk/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useProducts } from "@/hooks/use-products";
import {
  formInputDisabledClassName,
  withFieldError,
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import { StatusBadge } from "../components/invoice-status-badge";
import { InvoiceErrorCard } from "../components/amendments";
import { formatMoney, parseMoney } from "@cashsouk/ui";
import { MoneyInput } from "@cashsouk/ui";
import { InvoiceDetailsSkeleton } from "@/app/(application-flow)/applications/components/invoice-details-skeleton";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import { generateInvoiceData } from "../utils/dev-data-generator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FileDisplayBadge } from "../components/file-display-badge";

const valueClassName = "text-[17px] leading-7 text-foreground font-medium";
const sectionTitleClassName =
  "text-base font-semibold text-foreground pb-1.5 border-b-2 border-border inline-block";

/** Mock data for dev Auto Fill Step. Random 1–5 invoices. */
export function generateMockData(): Record<string, unknown> {
  return generateInvoiceData();
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

import { parseISO, parse, isValid, format } from "date-fns";

/**
 * PRODUCT CONFIG EXTRACTION
 *
 * Reads invoice validation config from product workflow.
 * Config must be provided by admin; no fallbacks.
 */
interface InvoiceConfig {
  min_invoice_value?: number | null;
  max_invoice_value?: number | null;
}

/**
 * Resolve invoice config from product.
 * Product is obtained by:
 * 1) looking up application.financing_type.product_id in the provided products array
 * 2) falling back to application.product if present
 */
function getProductInvoiceConfig(application: any, products: any[] = []): InvoiceConfig | null {
  try {
    const productId = application?.financing_type?.product_id;
    let product = null;
    if (productId && Array.isArray(products)) {
      product = products.find((p: any) => p.id === productId) ?? null;
    }
    if (!product && application?.product) product = application.product;
    const workflow = product?.workflow || [];
    const invoiceStep = workflow.find(
      (step: any) => step.id?.includes?.("invoice_details") || step.name?.includes?.("invoice")
    );
    const config = invoiceStep?.config || {};
    // debug removed
    if (config == null || Object.keys(config).length === 0) return null;
    return {
      min_invoice_value: config.min_invoice_value ?? null,
      max_invoice_value: config.max_invoice_value ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Parse date string to Date object.
 *
 * What: Converts "YYYY-MM-DD" string to Date.
 * Why: Normalize date comparisons.
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try ISO formats first (full ISO or yyyy-MM-dd)
  const iso = parseISO(dateStr);
  if (isValid(iso)) return iso;
  // Fallback to d/M/yyyy (user-facing)
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
  document?: { file_name: string; file_size?: number; s3_key?: string; uploaded_at?: string } | null;
};

interface InvoiceDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
  readOnly?: boolean;
  isAmendmentMode?: boolean;
  flaggedSections?: Set<string>;
  flaggedItems?: Map<string, Set<string>>;
  remarks?: { scope?: string; scope_key?: string; remark?: string }[];
}

export default function InvoiceDetailsStep({
  applicationId,
  onDataChange,
  readOnly = false,
  isAmendmentMode = false,
  flaggedSections: _flaggedSections,
  flaggedItems: _flaggedItems,
  remarks = [],
}: InvoiceDetailsStepProps) {
  const devTools = useDevTools();

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
  const queryClient = useQueryClient();
  const { data: productsData } = useProducts({ page: 1, pageSize: 100 });

  /** Parse remark text: split by /n for bullets, else by newline. Returns trimmed non-empty lines. */
  const parseRemarkBullets = React.useCallback((text: string): string[] => {
    if (!text?.trim()) return [];
    const raw = text.trim();
    const delimiter = raw.includes("/n") ? "/n" : "\n";
    return raw.split(delimiter).map((s) => s.trim()).filter(Boolean);
  }, []);

  /** Map invoice index -> list of remark texts. Scope keys: invoice_details:N:... or invoice:N:... */
  const invoiceRemarksByIndex = React.useMemo(() => {
    const map = new Map<number, string[]>();
    for (const r of remarks) {
      const rem = r as { scope?: string; scope_key?: string; remark?: string };
      if (rem.scope !== "item") continue;
      const sk = rem.scope_key || "";
      if (!sk.startsWith("invoice_details:") && !sk.startsWith("invoice:")) continue;
      const parts = sk.split(":");
      if (parts.length >= 2) {
        const idx = parseInt(parts[1], 10);
        if (!Number.isNaN(idx) && idx >= 0 && (rem.remark || "").trim()) {
          const bullets = parseRemarkBullets(rem.remark || "");
          if (bullets.length > 0) {
            const existing = map.get(idx) ?? [];
            map.set(idx, [...existing, ...bullets]);
          }
        }
      }
    }
    return map;
  }, [remarks, parseRemarkBullets]);

  /** Indices of invoices that have amendment remarks (for row highlighting). */
  const invoicesWithRemarks = React.useMemo(
    () => new Set(invoiceRemarksByIndex.keys()),
    [invoiceRemarksByIndex]
  );

  /** Grouped invoice amendment data for card: { invoiceLabel, bullets }[]. */
  const invoiceAmendmentGroups = React.useMemo(() => {
    const sorted = Array.from(invoiceRemarksByIndex.entries()).sort((a, b) => a[0] - b[0]);
    return sorted.map(([idx, bullets]) => {
      const inv = invoices[idx];
      const label = inv?.number ? `Invoice ${inv.number}` : `Invoice #${idx + 1}`;
      return { invoiceLabel: label, bullets };
    });
  }, [invoiceRemarksByIndex, invoices]);

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

  /** Apply dev-tools Fill Entire Application (autoFillDataMap) or Auto Fill Step (autoFillData). */
  React.useEffect(() => {
    const data =
      devTools?.autoFillData?.stepKey === "invoice_details"
        ? (devTools.autoFillData.data as { invoices?: LocalInvoice[] })
        : (devTools?.autoFillDataMap?.["invoice_details"] as { invoices?: LocalInvoice[] } | undefined);
    if (!data?.invoices?.length) return;
    setInvoices(
      data.invoices.map((inv) => ({
        ...inv,
        document: inv.document ?? null,
      }))
    );
    if (devTools?.autoFillData?.stepKey === "invoice_details") devTools.clearAutoFill();
    else devTools?.clearAutoFillForStep("invoice_details");
  }, [devTools]);

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
      uploaded_at: new Date().toISOString(),
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
  const validateInvoiceConstraints = (inv: LocalInvoice, productConfig: InvoiceConfig | null): string => {
    // debug removed
    // Ignore empty rows
    if (isRowEmpty(inv)) return "";

    // Parse maturity date
    const maturityDate = parseDateString(inv.maturity_date);

    // Check if date string exists but couldn't be parsed (invalid date like Feb 31)
    if (inv.maturity_date && !maturityDate) {
      return `Invoice ${inv.number}: Invalid date.`;
    }

    if (!maturityDate) return "";

    // must be at least today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (maturityDate < today) {
      return `Invoice ${inv.number}: Maturity date cannot be in the past.`;
    }

    // contract window check (only for contract-based structures)
    if (!isInvoiceOnly && application?.contract?.contract_details?.start_date) {
      // Debug logs: show raw and parsed dates and comparison result
      // These logs help diagnose cases where maturity dates appear before contract start but aren't caught.
      // Example reproduction: contract start = "12/2/2026", maturity = "1/2/2026"
      // (Logs intentionally minimal; only invoice number and date values)
      const contractStart = parseDateString(application.contract.contract_details?.start_date);

      if (contractStart && maturityDate < contractStart) {
        return `Invoice ${inv.number}: Maturity date must be on or after contract start date.`;
      }
    }


    // min/max invoice value checks only if productConfig provided
    // debug removed
    if (productConfig) {
      // debug removed
      const invoiceValue = parseMoney(inv.value);
      const ratio = (inv.financing_ratio_percent || 60) / 100;
      const financingAmount = invoiceValue * ratio;

      const minValue = productConfig.min_invoice_value;
      const maxValue = productConfig.max_invoice_value;

      if (typeof minValue === "number") {
        if (financingAmount < minValue) {
          return `Invoice ${inv.number}: Financing amount must be at least RM ${formatMoney(minValue)}.`;
        }
      }

      if (typeof maxValue === "number") {
        if (financingAmount > maxValue) {
          return `Invoice ${inv.number}: Financing amount cannot exceed RM ${formatMoney(maxValue)}.`;
        }
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

  const totalFinancingAmount = invoices.reduce((acc, inv) => {
    const value = parseMoney(inv.value);
    const ratio = (inv.financing_ratio_percent || 60) / 100;
    return acc + value * ratio;
  }, 0);

  const cd = application?.contract?.contract_details;
  const approvedFacility =
    typeof cd?.approved_facility === "number" && cd.approved_facility > 0
      ? cd.approved_facility
      : 0;
  const contractFinancing =
    typeof cd?.financing === "number"
      ? cd.financing
      : parseMoney(String(cd?.financing ?? ""));

  /** For existing_contract: use stored available_facility from backend (approved - utilized, utilized = approved invoices only). */
  const storedAvailableFacility =
    typeof cd?.available_facility === "number" ? cd.available_facility : null;

  /** For existing_contract: sum of financing for invoices not yet approved (DRAFT, SUBMITTED). Used for facility validation. */
  const nonApprovedFinancingAmount = invoices
    .filter((inv) => inv.status !== "APPROVED")
    .reduce((sum, inv) => {
      const value = parseMoney(inv.value);
      const ratio = (inv.financing_ratio_percent || 60) / 100;
      return sum + value * ratio;
    }, 0);

  const structureType = application?.financing_structure?.structure_type;
  const hasApprovedFacility = approvedFacility > 0;

  let facilityLimit = 0;
  if (structureType === "new_contract") {
    facilityLimit = hasApprovedFacility ? approvedFacility : contractFinancing;
  }
  if (structureType === "existing_contract" && storedAvailableFacility != null) {
    facilityLimit = storedAvailableFacility;
  }

  const hasPendingFiles = Object.keys(selectedFiles).length > 0;
  const hasPartialRows = invoices.some((inv) => isRowPartial(inv));
  const allRowsValid = invoices.every((inv) => validateRow(inv));

  let validationError = "";
  const shouldRunValidation =
    isInitialized &&
    !isLoadingInvoices &&
    !isLoadingApplication;

  const isInvoiceOnly = application?.financing_structure?.structure_type === "invoice_only";
  const isExistingContract = application?.financing_structure?.structure_type === "existing_contract";

  let productConfig: InvoiceConfig | null = null;
  try {
    productConfig = getProductInvoiceConfig(application, productsData?.products || []);
  } catch (err) {
    validationError = err instanceof Error ? err.message : "Product configuration error";
  }

  if (shouldRunValidation) {
    if (hasPartialRows) {
      validationError = "Please complete all invoice details. Rows cannot have partial data.";
    }

    if (!validationError && hasDuplicateInvoiceNumbers()) {
      validationError = "Invoice numbers must be unique. Duplicate invoice numbers are not allowed.";
    }

    // Validate all invoice constraints (maturity date, value limits, contract window)
    // debug removed
    if (!validationError) {
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

    /** Financing ratio 60–80% applies to all structures including invoice_only. */
    if (!validationError) {
      const invalidRatioInvoice = invoices.find(
        (inv) => !isRowEmpty(inv) && (inv.financing_ratio_percent! < 60 || inv.financing_ratio_percent! > 80)
      );
      if (invalidRatioInvoice) {
        validationError = "Financing ratio must be between 60% and 80%.";
      }
    }

    /** Facility limit only for new_contract and existing_contract (invoice_only has no facility). */
    if (!isInvoiceOnly && !validationError) {
      const amountToCheck = isExistingContract ? nonApprovedFinancingAmount : totalFinancingAmount;
      if (amountToCheck > facilityLimit) {
        validationError = `Total financing amount (RM ${formatMoney(amountToCheck)}) exceeds facility limit (RM ${formatMoney(facilityLimit)}).`;
      }
    }
  }

  const saveFunction = async () => {
    /**
     * VALIDATION CHECK
     *
     * If there are validation errors, show toast and prevent save.
     */
    if (!productConfig) {
      toast.error("Product configuration is missing. Please contact administrator.");
      throw new Error("VALIDATION_PRODUCT_CONFIG");
    }

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
      const isLocked =
        inv.status === "SUBMITTED" ||
        inv.status === "APPROVED" ||
        inv.status === "OFFER_SENT" ||
        inv.status === "REJECTED";
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
          uploaded_at: new Date().toISOString(),
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
                uploaded_at: new Date().toISOString(),
              },
            }
            : row
        )
      );
    }

    setSelectedFiles({});
    setDeletedInvoices({});

    // Return persisted invoices for application-level persistence
    /**
     * Sync with React Query cache so other views (Review step) pick up
     * newly created invoices immediately.
     *
     * What: Invalidate invoices queries for this application (and contract when present).
     * Why: Invoice creation/updates in this step use direct API calls. React Query
     *      cache is not aware unless we invalidate to trigger a refetch.
     * Data: Query keys: ["invoices", applicationId] and ["invoices","contract",contractId]
     */
    try {
      queryClient.invalidateQueries({ queryKey: ["invoices", applicationId] });
      if (application?.contract_id) {
        queryClient.invalidateQueries({ queryKey: ["invoices", "contract", application.contract_id] });
      }
      // Also refresh application summary that may include invoice totals.
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
    } catch (err) {
      // Non-fatal: continue returning persisted snapshot even if invalidation fails.
    }

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
    let isValid = shouldRunValidation ? !hasPartialRows && !validationError : true;
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
                uploaded_at: d.document.uploaded_at,
              }
              : null,
          };
        };

        let mapped: LocalInvoice[];

        const resp: any = await apiClient.getInvoicesByApplication(applicationId);
        if (!("success" in resp) || !resp.success) return;
        const items: any[] = resp.data || [];

        if (isAmendmentMode) {
          /**
           * AMENDMENT: Show all invoices (SUBMITTED, APPROVED, REJECTED, WITHDRAWN, DRAFT).
           * For existing_contract, application fetch includes contract-linked invoices.
           */
          mapped = items.map(toLocalInvoice);
        } else if (isExistingContract && contractId) {
          /**
           * EXISTING CONTRACT (non-amendment): Contract invoices (SUBMITTED/APPROVED) + DRAFT.
           * DRAFT can be removed if user switches structure.
           */
          const contractResp: any = await apiClient.getInvoicesByContract(contractId);
          const contractItems: any[] =
            "success" in contractResp && contractResp.success
              ? (contractResp.data || []).filter(
                (it: any) => it.status === "APPROVED" || it.status === "SUBMITTED"
              )
              : [];
          const contractIds = new Set(contractItems.map((it: any) => it.id));
          const appDrafts = (items || []).filter(
            (it: any) => it.status === "DRAFT" && !contractIds.has(it.id)
          );
          mapped = [...contractItems.map(toLocalInvoice), ...appDrafts.map(toLocalInvoice)];
        } else {
          /**
           * INVOICE_ONLY / NEW_CONTRACT: DRAFT only (not related to contract).
           */
          const filtered = items.filter((it: any) => it.status === "DRAFT");
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
      } catch {
        // Non-fatal: continue with empty list
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
  }, [applicationId, application, application?.financing_structure?.structure_type, application?.contract_id, isAmendmentMode]);

  if (isLoadingApplication || devTools?.showSkeletonDebug) {
    return (
      <>
        <InvoiceDetailsSkeleton
          showContractSection={!isInvoiceOnly}
          showInvoiceTable={true}
        />

      </>
    );
  }

  return (
    <>
      <div className="space-y-10 px-3 max-w-[1200px] mx-auto">
        {/* ================= Contract ================= */}
        {!isInvoiceOnly && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className={sectionTitleClassName}>
              {isInvoiceOnly ? "Customer" : "Contract"}
            </h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
              {!isInvoiceOnly && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Contract title</p>
                    <p className={valueClassName}>
                      {application?.contract?.contract_details?.title ?? "—"}
                    </p>
                  </div>
                </>
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Customer</p>
                <p className={valueClassName}>
                  {application?.contract?.customer_details?.name ?? "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Contract value</p>
                <p className={valueClassName}>
                  {application?.contract?.contract_details?.value != null
                    ? `RM ${formatMoney(application.contract.contract_details.value)}`
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Financing</p>
                <p className={valueClassName}>
                  {application?.contract?.contract_details?.financing != null
                    ? `RM ${formatMoney(application.contract.contract_details.financing)}`
                    : "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Approved facility</p>
                <p className={valueClassName}>
                  {typeof cd?.approved_facility === "number"
                    ? `RM ${formatMoney(cd.approved_facility)}`
                    : "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Utilised facility</p>
                <p className={valueClassName}>
                  {typeof cd?.utilized_facility === "number"
                    ? `RM ${formatMoney(cd.utilized_facility)}`
                    : "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Available facility</p>
                <p
                  className={cn(
                    "text-[17px] leading-7 font-medium",
                    typeof cd?.available_facility === "number" &&
                      cd.available_facility < 0 &&
                      "text-destructive"
                  )}
                >
                  {typeof cd?.available_facility === "number"
                    ? `RM ${formatMoney(cd.available_facility)}`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= Invoice Details ================= */}
        {isLoadingApplication || devTools?.showSkeletonDebug ? null : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className={sectionTitleClassName}>Invoices</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Add invoices below. Rows are local until you Save and Continue.
                </p>
              </div>
              <Button
                onClick={addInvoice}
                disabled={readOnly}
                className="bg-primary text-primary-foreground shrink-0"
              >
                Add invoice
              </Button>
            </div>

            {/* Item-level invoice amendment remarks above table */}
            {invoiceAmendmentGroups.length > 0 && (
              <InvoiceErrorCard groups={invoiceAmendmentGroups} />
            )}

            {/* ================= Table ================= */}
            <div className="mt-4 px-3">
              {!isLoadingInvoices && (
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
                              {productConfig &&
                                (typeof productConfig.min_invoice_value === "number" ||
                                  typeof productConfig.max_invoice_value === "number") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={fieldTooltipTriggerClassName}>
                                        <InformationCircleIcon className="h-4 w-4" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                                      {"Per invoice\n"}
                                      {typeof productConfig.min_invoice_value === "number"
                                        ? `min RM ${formatMoney(productConfig.min_invoice_value)}`
                                        : ""}
                                      {typeof productConfig.min_invoice_value === "number" &&
                                      typeof productConfig.max_invoice_value === "number"
                                        ? "\n"
                                        : ""}
                                      {typeof productConfig.max_invoice_value === "number"
                                        ? `max RM ${formatMoney(productConfig.max_invoice_value)}`
                                        : ""}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                            </div>
                          </TableHead>

                          <TableHead className="w-[160px] whitespace-nowrap text-xs font-semibold">
                            Documents
                          </TableHead>

                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {/* APPLICATION INVOICES */}
                        {invoices.map((inv, invIndex) => {
                          const ratio = inv.financing_ratio_percent || 60;
                          const value = parseMoney(inv.value);
                          const financingAmount = value * (ratio / 100);
                          const isLocked =
                            inv.status === "SUBMITTED" ||
                            inv.status === "APPROVED" ||
                            inv.status === "OFFER_SENT" ||
                            inv.status === "REJECTED";
                          const isEditable =
                            (inv.status === "DRAFT" ||
                              inv.status === "AMENDMENT_REQUESTED" ||
                              !inv.status) &&
                            !readOnly;
                          const isInvFlagged = invoicesWithRemarks.has(invIndex);

                          return (
                            <TableRow
                              key={inv.id}
                              className={cn(
                                "hover:bg-muted/40 transition-colors",
                                (isLocked || readOnly) && "bg-muted/30",
                                isInvFlagged && "border-l-4 border-l-destructive bg-red-50"
                              )}
                            >
                              <TableCell className="p-2">
                                <Input
                                  value={inv.number}
                                  disabled={!isEditable}
                                  onChange={(e) => updateInvoiceField(inv.id, "number", e.target.value)}
                                  placeholder="Enter invoice"
                                  className={cn(
                                    withFieldError(
                                      "h-9 text-xs rounded-xl border border-input bg-background px-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary",
                                      isRowPartial(inv)
                                    ),
                                    !isEditable && formInputDisabledClassName
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
                                  disabled={!isEditable}
                                  className={!isEditable ? "bg-muted" : ""}
                                  isInvalid={isRowPartial(inv)}
                                  size="compact"
                                  placeholder="Enter date"
                                />
                              </TableCell>

                              <TableCell className="p-2">
                                <MoneyInput
                                  value={inv.value}
                                  onValueChange={(v) => updateInvoiceField(inv.id, "value", v)}
                                  placeholder="0.00"
                                  prefix="RM"
                                  disabled={!isEditable}
                                  inputClassName={cn(
                                    withFieldError(
                                      "h-9 text-xs rounded-xl border border-input bg-background px-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary",
                                      isRowPartial(inv)
                                    ),
                                    !isEditable && formInputDisabledClassName
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
                                      className={cn(
                                        "relative",
                                        "[&_[data-orientation=horizontal]]:h-1.5",
                                        "[&_[data-orientation=horizontal]]:bg-muted",
                                        "[&_[data-orientation=horizontal]>span]:bg-primary",
                                        "[&_[role=slider]]:h-4 [&_[role=slider]]:w-4",
                                        "[&_[role=slider]]:border-2 [&_[role=slider]]:border-primary",
                                        "[&_[role=slider]]:bg-background [&_[role=slider]]:shadow-none",
                                        !isEditable &&
                                          "data-[disabled]:[&_[data-orientation=horizontal]]:bg-muted data-[disabled]:[&_[data-orientation=horizontal]>span]:bg-muted-foreground/60 data-[disabled]:[&_[role=slider]]:border-muted-foreground/50 data-[disabled]:[&_[role=slider]]:bg-muted data-[disabled]:[&_[role=slider]]:opacity-100"
                                      )}
                                    />
                                  </div>

                                  <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                                    <span>60%</span>
                                    <span>80%</span>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="p-2 text-xs tabular-nums whitespace-nowrap">
                                RM {formatMoney(financingAmount)}
                              </TableCell>

                              <TableCell className="p-2 min-w-0 overflow-hidden">
                                {inv.document ? (
                                  <FileDisplayBadge
                                    fileName={inv.document.file_name}
                                    size="sm"
                                    className="bg-background"
                                    trailing={
                                      isEditable ? (
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
                                        className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                      >
                                        <XMarkIcon className="h-3 w-3" />
                                      </button>
                                      ) : undefined
                                    }
                                  />
                                ) : isEditable ? (
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
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground h-8 bg-muted px-2 rounded border border-muted-foreground/20">
                                    Locked
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="p-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isLocked || readOnly}
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
                          <TableCell className="p-2 font-semibold text-xs tabular-nums">
                            RM {formatMoney(totalFinancingAmount)}
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
        )}
      </div>
    </>
  );
}

export { InvoiceDetailsStep };
