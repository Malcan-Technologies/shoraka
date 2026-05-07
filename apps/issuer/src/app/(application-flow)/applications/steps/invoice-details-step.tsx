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
import { createApiClient, useAuthToken, ApiClient } from "@cashsouk/config";
import { toast } from "sonner";
import { XMarkIcon, CloudArrowUpIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { Slider } from "@cashsouk/ui";
import { cn } from "@cashsouk/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useProducts } from "@/hooks/use-products";
import {
  applicationFlowAmendmentTargetTableRowClassName,
  applicationFlowLockedTableRowClassName,
  applicationFlowSectionDividerClassName,
  applicationFlowSectionTitleClassName,
  applicationFlowStepOuterClassName,
  formInputDisabledClassName,
  formLabelClassName,
  withFieldError,
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import {
  WithdrawReason,
  Application,
  Contract,
  Invoice,
  InvoiceDetails,
  InvoiceStatus,
  Product,
  ApiResponse,
  ApiError,
} from "@cashsouk/types";
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

/** Mock data for dev Auto Fill Step. Random 1–5 invoices. */
export function generateMockData(): Record<string, unknown> {
  return generateInvoiceData();
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

import { parseISO, parse, isValid, format } from "date-fns";
import { maturityMeetsMinimumMonthsFrom } from "@cashsouk/config";

/**
 * PRODUCT CONFIG EXTRACTION
 *
 * Reads invoice validation config from product workflow.
 * Config must be provided by admin; no fallbacks.
 */
interface InvoiceConfig {
  min_invoice_value?: number | null;
  max_invoice_value?: number | null;
  min_financing_ratio_percent?: number | null;
  max_financing_ratio_percent?: number | null;
  min_months_application_to_maturity?: number | null;
}

type ApplicationHydrated = Omit<Application, "financing_structure" | "financing_type"> & {
  financing_structure?: { structure_type?: string } | null;
  financing_type?: { product_id?: string } | null;
  contract_id?: string | null;
  contract?: Contract;
  product?: Product;
};

function isApiSuccess<T>(r: ApiResponse<T> | ApiError): r is ApiResponse<T> {
  return r.success === true;
}

function pickInvoiceWorkflowConfig(product: Product | null): Record<string, unknown> | null {
  if (!product) return null;
  const workflow = Array.isArray(product.workflow) ? product.workflow : [];
  const invoiceStep = workflow.find((step) => {
    if (!step || typeof step !== "object") return false;
    const s = step as { id?: unknown; name?: unknown; config?: unknown };
    const idPart = s.id;
    const namePart = s.name;
    const idMatch =
      (typeof idPart === "string" && idPart.includes("invoice_details")) ||
      Boolean(
        idPart &&
          typeof idPart === "object" &&
          "includes" in idPart &&
          typeof (idPart as { includes: (sub: string) => boolean }).includes === "function" &&
          (idPart as { includes: (sub: string) => boolean }).includes("invoice_details")
      );
    const nameMatch =
      (typeof namePart === "string" && namePart.includes("invoice")) ||
      Boolean(
        namePart &&
          typeof namePart === "object" &&
          "includes" in namePart &&
          typeof (namePart as { includes: (sub: string) => boolean }).includes === "function" &&
          (namePart as { includes: (sub: string) => boolean }).includes("invoice")
      );
    return idMatch || nameMatch;
  });
  if (!invoiceStep || typeof invoiceStep !== "object") return null;
  const raw = (invoiceStep as { config?: unknown }).config;
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/**
 * Resolve invoice config from product.
 * Product is obtained by:
 * 1) looking up application.financing_type.product_id in the provided products array
 * 2) falling back to application.product if present
 */
function getProductInvoiceConfig(
  application: ApplicationHydrated | null,
  products: Product[] = []
): InvoiceConfig | null {
  try {
    const ft = application?.financing_type as { product_id?: string } | undefined;
    const productId = ft?.product_id;
    let product: Product | null = null;
    if (productId) {
      product = products.find((p) => p.id === productId) ?? null;
    }
    if (!product && application?.product) product = application.product;
    const config = pickInvoiceWorkflowConfig(product);
    if (config == null || Object.keys(config).length === 0) return null;
    const minRatio = config.min_financing_ratio_percent;
    const maxRatio = config.max_financing_ratio_percent;
    const hasValidRatioConfig =
      typeof minRatio === "number" &&
      Number.isFinite(minRatio) &&
      typeof maxRatio === "number" &&
      Number.isFinite(maxRatio) &&
      minRatio <= maxRatio &&
      minRatio >= 1 &&
      maxRatio <= 100;
    if (!hasValidRatioConfig) return null;
    const rawMonths = config.min_months_application_to_maturity;
    const applicationMonths =
      typeof rawMonths === "number" && Number.isFinite(rawMonths) && rawMonths > 0
        ? Math.floor(rawMonths)
        : null;
    const minInv = config.min_invoice_value;
    const maxInv = config.max_invoice_value;
    return {
      min_invoice_value: typeof minInv === "number" && Number.isFinite(minInv) ? minInv : null,
      max_invoice_value: typeof maxInv === "number" && Number.isFinite(maxInv) ? maxInv : null,
      min_financing_ratio_percent: minRatio,
      max_financing_ratio_percent: maxRatio,
      min_months_application_to_maturity: applicationMonths,
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
  withdraw_reason?: WithdrawReason;
  document?: { file_name: string; file_size?: number; s3_key?: string; uploaded_at?: string } | null;
};

interface InvoiceRemarkItem {
  scope?: string;
  scope_key?: string;
  remark?: string;
}

interface InvoiceDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
  isAmendmentMode?: boolean;
  flaggedSections?: Set<string>;
  flaggedItems?: Map<string, Set<string>>;
  remarks?: InvoiceRemarkItem[];
}

export default function InvoiceDetailsStep({
  applicationId,
  onDataChange,
  readOnly = false,
  isAmendmentMode = false,
  flaggedSections,
  remarks = [],
}: InvoiceDetailsStepProps) {
  const devTools = useDevTools();

  const [invoices, setInvoices] = React.useState<LocalInvoice[]>([]);
  /** While typing max financing amount, keep raw string; commit ratio on blur (see MoneyInput onBlurComplete). */
  const [financingAmountDraftById, setFinancingAmountDraftById] = React.useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});
  const [application, setApplication] = React.useState<ApplicationHydrated | null>(null);
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
      if (r.scope !== "item") continue;
      const sk = r.scope_key || "";
      if (!sk.startsWith("invoice_details:") && !sk.startsWith("invoice:")) continue;
      const parts = sk.split(":");
      if (parts.length >= 2) {
        const idx = parseInt(parts[1], 10);
        if (!Number.isNaN(idx) && idx >= 0 && (r.remark || "").trim()) {
          const bullets = parseRemarkBullets(r.remark || "");
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

  const hasItemLevelInvoiceRemarks = invoicesWithRemarks.size > 0;
  const sectionInvoiceAmendment =
    isAmendmentMode &&
    !readOnly &&
    !hasItemLevelInvoiceRemarks &&
    Boolean(
      flaggedSections?.has("invoice_details") ||
        flaggedSections?.has("invoice") ||
        remarks.some(
          (r) =>
            r.scope === "section" &&
            (r.scope_key === "invoice_details" || r.scope_key === "invoice")
        )
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
        const resp = await apiClient.getApplication(applicationId);
        if (isApiSuccess(resp) && mounted) {
          setApplication(resp.data as ApplicationHydrated);
        }
      } catch {
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
    const defaultRatio = productConfig?.min_financing_ratio_percent ?? 60;
    setInvoices((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        isPersisted: false,
        number: "",
        value: "",
        maturity_date: "",
        financing_ratio_percent: defaultRatio,
        document: null,
        status: "DRAFT",
      },
    ]);
  };

  const updateInvoiceField = <K extends keyof LocalInvoice>(id: string, field: K, value: LocalInvoice[K]) => {
    setInvoices((s) => s.map((inv) => (inv.id === id ? { ...inv, [field]: value } : inv)));
  };

  const clearFinancingAmountDraft = React.useCallback((id: string) => {
    setFinancingAmountDraftById((p) => {
      if (!(id in p)) return p;
      const n = { ...p };
      delete n[id];
      return n;
    });
  }, []);

  /** Derive financing_ratio_percent from desired amount (clamped to product min/max ratio). */
  const syncRatioFromFinancingAmountString = React.useCallback(
    (id: string, amountStr: string, minR: number, maxR: number) => {
      setInvoices((invs) =>
        invs.map((row) => {
          if (row.id !== id) return row;
          const invoiceValue = parseMoney(row.value);
          if (invoiceValue <= 0) return row;
          const desired = parseMoney(amountStr);
          const rawRatio = (desired / invoiceValue) * 100;
          const clamped = Math.min(maxR, Math.max(minR, Math.round(rawRatio)));
          return { ...row, financing_ratio_percent: clamped };
        })
      );
    },
    []
  );

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
    clearFinancingAmountDraft(inv.id);
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

    if (
      productConfig?.min_months_application_to_maturity != null &&
      productConfig.min_months_application_to_maturity > 0
    ) {
      if (
        !maturityMeetsMinimumMonthsFrom(
          maturityDate,
          today,
          productConfig.min_months_application_to_maturity
        )
      ) {
        return `Invoice ${inv.number}: Maturity date must be at least ${productConfig.min_months_application_to_maturity} month(s) after today.`;
      }
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
  } catch (error: unknown) {
    validationError = error instanceof Error ? error.message : "Product configuration error";
  }

  if (shouldRunValidation) {
    if (!productConfig && application?.financing_type?.product_id) {
      validationError = "Product configuration is incomplete. Min and max financing ratio must be set in the product workflow.";
    }
    if (!validationError && hasPartialRows) {
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

    /** Financing ratio from product config applies to all structures including invoice_only. */
    if (!validationError && productConfig) {
      const minR = productConfig.min_financing_ratio_percent ?? 60;
      const maxR = productConfig.max_financing_ratio_percent ?? 80;
      const invalidRatioInvoice = invoices.find(
        (inv) => !isRowEmpty(inv) && (inv.financing_ratio_percent! < minR || inv.financing_ratio_percent! > maxR)
      );
      if (invalidRatioInvoice) {
        validationError = `Financing ratio must be between ${minR}% and ${maxR}%.`;
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
      toast.error(
        application?.financing_type?.product_id
          ? "Product configuration is incomplete. Min and max financing ratio must be set in the product workflow."
          : "Product configuration is missing. Please contact administrator."
      );
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
        const createPayload: Parameters<ApiClient["createInvoice"]>[0] = {
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
        if (!isInvoiceOnly && application?.contract_id) {
          createPayload.contractId = application.contract_id;
        }


        const createResp = await apiClient.createInvoice(createPayload);
        if (!createResp.success) {
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
        const updatePayload: Partial<InvoiceDetails> & { contractId?: string | null } = {
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

      const urlJson: {
        success?: boolean;
        data?: { uploadUrl: string; s3Key: string };
      } = await urlResp.json();
      if (!urlJson.success || !urlJson.data) {
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
      const finalUpdatePayload: Partial<InvoiceDetails> & {
        contractId?: string | null;
        document?: InvoiceDetails["document"] & { uploaded_at?: string };
      } = {
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
    } catch {
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
    const isValid = shouldRunValidation ? !hasPartialRows && !validationError : true;
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

        const toLocalInvoice = (it: Invoice & { withdraw_reason?: WithdrawReason | string | null }): LocalInvoice => {
          const d = it.details;
          const wr = it.withdraw_reason;
          const withdraw_reason =
            wr === WithdrawReason.USER_CANCELLED ||
            wr === WithdrawReason.OFFER_EXPIRED ||
            wr === WithdrawReason.OFFER_REJECTED
              ? wr
              : undefined;
          return {
            id: it.id,
            isPersisted: true,
            number: d.number || "",
            status: it.status || InvoiceStatus.DRAFT,
            withdraw_reason,
            value: d.value != null ? formatMoney(d.value) : "",
            maturity_date: (() => {
              if (!d.maturity_date) return "";
              if (/^\d{4}-\d{2}-\d{2}$/.test(d.maturity_date)) {
                const parsed = parseISO(d.maturity_date);
                if (isValid(parsed)) return format(parsed, "d/M/yyyy");
              }
              return d.maturity_date || "";
            })(),
            financing_ratio_percent: (() => {
              const raw = d.financing_ratio_percent;
              if (raw == null) return 60;
              if (typeof raw === "string" && raw.trim() === "") return 60;
              const n = typeof raw === "number" ? raw : Number(raw);
              return Number.isFinite(n) ? Math.round(n) : 60;
            })(),
            document: d.document
              ? {
                file_name: d.document.file_name,
                file_size: d.document.file_size,
                s3_key: d.document.s3_key,
                uploaded_at: (d.document as { uploaded_at?: string }).uploaded_at,
              }
              : null,
          };
        };

        let mapped: LocalInvoice[];

        const resp = await apiClient.getInvoicesByApplication(applicationId);
        if (!isApiSuccess(resp)) return;
        const items = resp.data;

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
          const contractResp = await apiClient.getInvoicesByContract(contractId);
          const contractItems = isApiSuccess(contractResp)
            ? contractResp.data.filter(
              (it) => it.status === InvoiceStatus.APPROVED || it.status === InvoiceStatus.SUBMITTED
            )
            : [];
          const contractIds = new Set(contractItems.map((it) => it.id));
          const appDrafts = items.filter(
            (it) => it.status === InvoiceStatus.DRAFT && !contractIds.has(it.id)
          );
          mapped = [...contractItems.map(toLocalInvoice), ...appDrafts.map(toLocalInvoice)];
        } else {
          /**
           * INVOICE_ONLY / NEW_CONTRACT: DRAFT only (not related to contract).
           */
          const filtered = items.filter((it) => it.status === InvoiceStatus.DRAFT);
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
      <div className={applicationFlowStepOuterClassName}>
        {/* ================= Contract ================= */}
        {!isInvoiceOnly && (
          <div className="space-y-3">
            <div>
              <h3 className={applicationFlowSectionTitleClassName}>
                {isInvoiceOnly ? "Customer" : "Contract"}
              </h3>
              <div className={applicationFlowSectionDividerClassName} />
            </div>

            <div className="space-y-3 mt-4 px-3">
              <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-y-3">

                {!isInvoiceOnly && (
                  <>
                {/* ================= Contract Title ================= */}
                <div className={formLabelClassName}>Contract Title</div>
                <div className={valueClassName}>
                  {application?.contract?.contract_details?.title ?? "—"}
                </div>
                  </>
                )}

                {/* ================= Customer ================= */}
                <div className={formLabelClassName}>Customer Name</div>
                <div className={valueClassName}>
                  {application?.contract?.customer_details?.name ?? "—"}
                </div>

                {/* ================= Contract Value ================= */}
                <div className={formLabelClassName}>Contract Value</div>
                <div className={valueClassName}>
                  {application?.contract?.contract_details?.value != null
                    ? `RM ${formatMoney(application.contract.contract_details.value)}`
                    : "—"}
                </div>

                {/* ================= Contract Financing ================= */}
                <div className={formLabelClassName}>Contract Financing</div>
                <div className={valueClassName}>
                  {application?.contract?.contract_details?.financing != null
                    ? `RM ${formatMoney(application.contract.contract_details.financing)}`
                    : "N/A"}
                </div>

                {structureType === "existing_contract" && (
                  <>
                    {/* ================= Approved Facility ================= */}
                    <div className={formLabelClassName}>Approved Facility</div>
                    <div className={valueClassName}>
                      {typeof cd?.approved_facility === "number"
                        ? `RM ${formatMoney(cd.approved_facility)}`
                        : "N/A"}
                    </div>

                    {/* ================= Utilised Facility ================= */}
                    <div className={formLabelClassName}>Utilised Facility</div>
                    <div className={valueClassName}>
                      {typeof cd?.utilized_facility === "number"
                        ? `RM ${formatMoney(cd.utilized_facility)}`
                        : "N/A"}
                    </div>

                    {/* ================= Available Facility ================= */}
                    <div className={formLabelClassName}>Available Facility</div>
                    <div
                      className={cn(
                        "text-sm md:text-base leading-6 font-medium",
                        typeof cd?.available_facility === "number" &&
                        cd.available_facility < 0 &&
                        "text-destructive"
                      )}
                    >
                      {typeof cd?.available_facility === "number"
                        ? `RM ${formatMoney(cd.available_facility)}`
                        : "N/A"}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= Invoice Details ================= */}
        {isLoadingApplication || devTools?.showSkeletonDebug ? null : (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className={applicationFlowSectionTitleClassName}>
                  Invoices
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
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
            <div className={applicationFlowSectionDividerClassName} />

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
                            <div className="inline-flex items-center gap-0.5">
                              Maturity Date
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={fieldTooltipTriggerClassName}>
                                    <InformationCircleIcon className="h-4 w-4" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                                  Invoice maturity date is the deadline when your customer is required to pay for this
                                  invoice. For example, if your invoice date is 1st of January, and your payment term is
                                  60 days, the maturity date is 1st of March.
                                </TooltipContent>
                              </Tooltip>
                            </div>
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
                                      {"Per invoice.\n"}
                                      {typeof productConfig.min_invoice_value === "number"
                                        ? `Min RM ${formatMoney(productConfig.min_invoice_value)}.`
                                        : ""}
                                      {typeof productConfig.min_invoice_value === "number" &&
                                      typeof productConfig.max_invoice_value === "number"
                                        ? "\n"
                                        : ""}
                                      {typeof productConfig.max_invoice_value === "number"
                                        ? `Max RM ${formatMoney(productConfig.max_invoice_value)}.`
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
                          const minRatio = productConfig?.min_financing_ratio_percent ?? 60;
                          const maxRatio = productConfig?.max_financing_ratio_percent ?? 80;
                          const rawRatio = inv.financing_ratio_percent;
                          const ratioNum = (() => {
                            if (rawRatio == null) return minRatio;
                            const n = typeof rawRatio === "number" ? rawRatio : Number(rawRatio);
                            if (!Number.isFinite(n)) return minRatio;
                            return Math.min(maxRatio, Math.max(minRatio, Math.round(n)));
                          })();
                          const value = parseMoney(inv.value);
                          const financingAmount = value * (ratioNum / 100);
                          const isInvFlagged = invoicesWithRemarks.has(invIndex);
                          const isSubmittedEditableInAmendment =
                            isAmendmentMode &&
                            !readOnly &&
                            inv.status === "SUBMITTED" &&
                            (isInvFlagged || sectionInvoiceAmendment);

                          let isEditable =
                            !readOnly &&
                            (inv.status === "DRAFT" ||
                              inv.status === "AMENDMENT_REQUESTED" ||
                              !inv.status ||
                              isSubmittedEditableInAmendment);

                          if (isAmendmentMode && !readOnly && hasItemLevelInvoiceRemarks) {
                            if (inv.status === "DRAFT" || !inv.status) {
                              /* keep new / draft rows usable */
                            } else {
                              isEditable =
                                (inv.status === "AMENDMENT_REQUESTED" ||
                                  (inv.status === "SUBMITTED" && isInvFlagged)) &&
                                !readOnly;
                            }
                          }

                          const rowLocked = !isEditable;

                          return (
                            <TableRow
                              key={inv.id}
                              className={cn(
                                "transition-colors",
                                rowLocked && applicationFlowLockedTableRowClassName,
                                !rowLocked && "hover:bg-muted/40",
                                isEditable &&
                                  isInvFlagged &&
                                  applicationFlowAmendmentTargetTableRowClassName
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
                                <StatusBadge status={inv.status} withdrawReason={inv.withdraw_reason} />
                              </TableCell>

                              <TableCell className="p-2">
                                <DateInput
                                  value={inv.maturity_date || ""}
                                  onChange={(v) => updateInvoiceField(inv.id, "maturity_date", v)}
                                  disabled={!isEditable}
                                  className={!isEditable ? "cursor-not-allowed" : undefined}
                                  isInvalid={isRowPartial(inv)}
                                  size="compact"
                                  placeholder="Enter date"
                                />
                              </TableCell>

                              <TableCell className="p-2">
                                <MoneyInput
                                  value={inv.value}
                                  onValueChange={(v) => {
                                    clearFinancingAmountDraft(inv.id);
                                    updateInvoiceField(inv.id, "value", v);
                                  }}
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
                                      left: `${((ratioNum - minRatio) / (maxRatio - minRatio)) * 100}%`,
                                      transform: "translateX(-50%)",
                                      width: "fit-content",
                                    }}
                                  >
                                    <div
                                      className={cn(
                                        "rounded-md border border-border px-2 py-0.5 text-[10px] font-medium shadow-sm",
                                        !isEditable
                                          ? "bg-muted text-foreground"
                                          : "bg-background text-black"
                                      )}
                                    >
                                      {ratioNum}%
                                    </div>
                                  </div>

                                  <div className="max-w-[110px] mx-auto">
                                    <Slider
                                      min={minRatio}
                                      max={maxRatio}
                                      step={1}
                                      value={[ratioNum]}
                                      disabled={!isEditable}
                                      onValueChange={(value) => {
                                        clearFinancingAmountDraft(inv.id);
                                        updateInvoiceField(
                                          inv.id,
                                          "financing_ratio_percent",
                                          Math.round(value[0])
                                        );
                                      }}
                                      className={cn(
                                        "relative w-full max-w-full",
                                        !isEditable &&
                                          "opacity-100 [&_[data-disabled]]:opacity-100 [&_.relative.h-2]:bg-muted [&_span.absolute]:bg-muted-foreground/50 [&_button]:border-muted-foreground/50 [&_button]:bg-muted"
                                      )}
                                    />
                                  </div>

                                  <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                                    <span>{minRatio}%</span>
                                    <span>{maxRatio}%</span>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell className="p-2">
                                <MoneyInput
                                  value={
                                    financingAmountDraftById[inv.id] ??
                                    (financingAmount > 0 ? formatMoney(financingAmount) : "")
                                  }
                                  onValueChange={(v) =>
                                    setFinancingAmountDraftById((p) => ({ ...p, [inv.id]: v }))
                                  }
                                  onBlurComplete={(formatted) => {
                                    clearFinancingAmountDraft(inv.id);
                                    if (formatted === "") {
                                      updateInvoiceField(inv.id, "financing_ratio_percent", minRatio);
                                      return;
                                    }
                                    syncRatioFromFinancingAmountString(
                                      inv.id,
                                      formatted,
                                      minRatio,
                                      maxRatio
                                    );
                                  }}
                                  placeholder="0.00"
                                  prefix="RM"
                                  disabled={!isEditable || parseMoney(inv.value) <= 0}
                                  inputClassName={cn(
                                    "h-9 text-xs rounded-xl border border-input bg-background px-3 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary",
                                    (!isEditable || parseMoney(inv.value) <= 0) &&
                                      formInputDisabledClassName
                                  )}
                                />
                              </TableCell>

                              <TableCell className="p-2 min-w-0 overflow-hidden">
                                {inv.document ? (
                                  <FileDisplayBadge
                                    fileName={inv.document.file_name}
                                    size="sm"
                                    locked={!isEditable}
                                    className={cn(
                                      "min-w-0 max-w-full border-border",
                                      isEditable && "bg-background"
                                    )}
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
                                  disabled={!isEditable}
                                  onClick={() => deleteInvoice(inv)}
                                  className={cn(
                                    !isEditable
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
