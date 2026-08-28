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
 *    - Financing ratio must be a whole percent within the product min/max (e.g. 60%–80%).
 *    - Editing maximum financing amount uses ceil(amount ÷ invoice value × 100), then clamps to that range.
 *
 * 9. Facility limits (existing facility)
 *    - Draft overage is an amber preview: saveable, not submittable.
 *    - Reserved amendment overage is a hard inline/server error.
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
import { Button } from "@/components/ui/button";
import { createApiClient, useAuthToken, ApiClient, resolveApprovedFacility } from "@cashsouk/config";
import { toast } from "sonner";
import { ExclamationTriangleIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import { useIssuerProducts } from "@/hooks/use-products";
import { useInvoicesByContract } from "@/hooks/use-invoices";
import {
  applicationFlowSectionDividerClassName,
  applicationFlowSectionTitleClassName,
  applicationFlowStepOuterClassName,
  formLabelClassName,
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
  dualLimitOverageCopy,
  isEditableReservedInvoiceStatus,
  isValidFinancingTenureDays,
  mapCapacityApiError,
  parseFinancingTenureDays,
  previewDualLimits,
  resolveInvoiceFinancingRatioBounds,
  validateFinancingTenureAgainstDueDate,
} from "@cashsouk/types";
import { InvoiceErrorCard } from "../components/amendments";
import { StatusBadge } from "@/app/(application-flow)/applications/components/invoice-status-badge";
import { formatMoney, parseMoney } from "@cashsouk/ui";
import { ExistingFacilityLimitPreview } from "@/app/(application-flow)/applications/components/existing-facility-limit-preview";
import { FacilityFeeDrawdownBlockedNotice } from "@/components/financing/facility-fee-drawdown-blocked";
import { resolveIssuerFacilityGate } from "@/lib/facility-enabled";
import {
  FACILITY_FEE_DRAWDOWN_BLOCKED_MESSAGE,
  facilityFeeContractHref,
} from "@/lib/facility-fee-payment-ui";
import { InvoiceDetailsSkeleton } from "@/app/(application-flow)/applications/components/invoice-details-skeleton";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import { generateInvoiceData } from "../utils/dev-data-generator";
import {
  InvoiceFormFields,
  invoiceTabLabel,
  type InvoiceFieldErrors,
  type InvoiceFormModel,
} from "@/app/(application-flow)/applications/components/invoice-form-fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  hasInvoiceFormRowChanged,
  invoiceRowHasRequiredFields,
  isInvoiceFormRowEmpty,
  isInvoiceFormRowPartial,
  isInvoiceStepContinueReady,
} from "@/app/(application-flow)/applications/lib/invoice-form-row";

const valueClassName = "text-ui leading-7 text-foreground font-medium";

const OTHER_FACILITY_INVOICE_HELPER =
  "This invoice belongs to another application and cannot be edited here.";

/** Mock data for dev Auto Fill Step. One invoice. */
export function generateMockData(): Record<string, unknown> {
  return generateInvoiceData();
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const MAX_ONE_INVOICE_MESSAGE =
  "Applications allow only one invoice. Remove extra invoices or start a new application for another invoice.";

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

function pickInvoiceConfigFromWorkflow(workflow: unknown[]): Record<string, unknown> | null {
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

function pickInvoiceWorkflowConfig(product: Product | null): Record<string, unknown> | null {
  if (!product) return null;
  const workflow = Array.isArray(product.workflow) ? product.workflow : [];
  return pickInvoiceConfigFromWorkflow(workflow);
}

/**
 * Resolve invoice config from product.
 * Prefer frozenWorkflow (application.product_version) when provided; otherwise:
 * 1) looking up application.financing_type.product_id in the provided products array
 * 2) falling back to application.product if present
 */
function getProductInvoiceConfig(
  application: ApplicationHydrated | null,
  products: Product[] = [],
  frozenWorkflow?: unknown[] | null
): InvoiceConfig | null {
  try {
    let config: Record<string, unknown> | null = null;
    if (Array.isArray(frozenWorkflow) && frozenWorkflow.length > 0) {
      config = pickInvoiceConfigFromWorkflow(frozenWorkflow);
    } else {
      const ft = application?.financing_type as { product_id?: string } | undefined;
      const productId = ft?.product_id;
      let product: Product | null = null;
      if (productId) {
        product = products.find((p) => p.id === productId) ?? null;
      }
      if (!product && application?.product) product = application.product;
      config = pickInvoiceWorkflowConfig(product);
    }
    if (config == null || Object.keys(config).length === 0) return null;
    const minRatio = config.min_financing_ratio_percent;
    const maxRatio = config.max_financing_ratio_percent;
    const hasValidRatioConfig =
      typeof minRatio === "number" &&
      Number.isFinite(minRatio) &&
      typeof maxRatio === "number" &&
      Number.isFinite(maxRatio) &&
      minRatio <= maxRatio &&
      minRatio >= 1;
    if (!hasValidRatioConfig) return null;
    const ratioBounds = resolveInvoiceFinancingRatioBounds(minRatio, maxRatio);
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
      min_financing_ratio_percent: ratioBounds.min,
      max_financing_ratio_percent: ratioBounds.max,
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
 * Integer ratio % shown in the row (slider + money field). Blur sync must use the same basis as
 * `invoice value × ratio` or fractional API values falsely look like an edited amount and the ratio creeps up.
 */
function clampedRoundedFinancingRatio(
  raw: number | string | null | undefined,
  minR: number,
  maxR: number
): number {
  if (raw == null) return minR;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return minR;
  return Math.min(maxR, Math.max(minR, Math.round(n)));
}

/**
 * LOCAL INVOICE STATE SHAPE
 */
type LocalInvoice = InvoiceFormModel;

function toLocalInvoice(it: Invoice & { withdraw_reason?: WithdrawReason | string | null }): LocalInvoice {
  const d = it.details;
  const wr = it.withdraw_reason;
  const withdraw_reason =
    wr === WithdrawReason.USER_CANCELLED || wr === WithdrawReason.OFFER_REJECTED
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
    financing_tenure_days: (() => {
      const parsed = parseFinancingTenureDays(d.financing_tenure_days);
      return parsed != null && isValidFinancingTenureDays(parsed) ? parsed : undefined;
    })(),
    document: d.document
      ? {
          file_name: d.document.file_name,
          file_size: d.document.file_size,
          s3_key: d.document.s3_key,
          uploaded_at: (d.document as { uploaded_at?: string }).uploaded_at,
        }
      : null,
    displayReference: it.displayReference ?? null,
  };
}

function invoiceTabId(kind: "this" | "other", id: string) {
  return `${kind}:${id}`;
}

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
  /** Session/DB effective structure; preferred over stale DB when user changed Financing Structure without saving. */
  effectiveStructureType?: "new_contract" | "existing_contract" | "invoice_only" | null;
  /** Frozen application.product_version workflow — prefer over live catalog for ratio/maturity limits. */
  frozenProductWorkflow?: unknown[] | null;
}

export default function InvoiceDetailsStep({
  applicationId,
  onDataChange,
  readOnly = false,
  isAmendmentMode = false,
  flaggedSections,
  remarks = [],
  effectiveStructureType = null,
  frozenProductWorkflow = null,
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
  const [hasSubmitted, setHasSubmitted] = React.useState(false);
  const [capacityServerError, setCapacityServerError] = React.useState<string | null>(null);
  const [activeInvoiceTab, setActiveInvoiceTab] = React.useState<string | null>(null);
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const { data: productsData } = useIssuerProducts({ page: 1, pageSize: 100 });
  const { data: contractInvoicesData } = useInvoicesByContract(application?.contract_id ?? undefined);

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

  const otherFacilityInvoices = React.useMemo(() => {
    if (!contractInvoicesData?.length) return [] as LocalInvoice[];
    const thisIds = new Set(invoices.filter((inv) => inv.isPersisted).map((inv) => inv.id));
    return contractInvoicesData
      .filter((inv) => inv.status !== InvoiceStatus.WITHDRAWN)
      .filter((inv) => inv.application_id !== applicationId)
      .filter((inv) => !thisIds.has(inv.id))
      .map(toLocalInvoice);
  }, [contractInvoicesData, invoices, applicationId]);

  const otherFacilityNumbers = React.useMemo(() => {
    return new Set(otherFacilityInvoices.map((inv) => inv.number.trim()).filter(Boolean));
  }, [otherFacilityInvoices]);

  const addInvoice = () => {
    const defaultRatio = productConfig?.min_financing_ratio_percent ?? 60;
    const id = crypto.randomUUID();
    setInvoices((s) => {
      if (s.length >= 1) return s;
      return [
        ...s,
        {
          id,
          isPersisted: false,
          number: "",
          value: "",
          maturity_date: "",
          financing_tenure_days: undefined,
          financing_ratio_percent: defaultRatio,
          document: null,
          status: "DRAFT",
        },
      ];
    });
    setActiveInvoiceTab(invoiceTabId("this", id));
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
          const effectiveRatio = clampedRoundedFinancingRatio(
            row.financing_ratio_percent,
            minR,
            maxR
          );
          const canonicalFinancing = invoiceValue * (effectiveRatio / 100);
          if (Math.round(desired * 100) === Math.round(canonicalFinancing * 100)) {
            return row;
          }
          const rawRatio = (desired / invoiceValue) * 100;
          const wholeRatioUp = Math.ceil(rawRatio - 1e-9);
          const clamped = Math.min(maxR, Math.max(minR, wholeRatioUp));
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

  const isRowEmpty = (inv: LocalInvoice) => isInvoiceFormRowEmpty(inv);
  const isRowPartial = (inv: LocalInvoice) =>
    isInvoiceFormRowPartial(inv, Boolean(selectedFiles[inv.id]));
  const validateRow = (inv: LocalInvoice) =>
    isRowEmpty(inv) || invoiceRowHasRequiredFields(inv, Boolean(selectedFiles[inv.id]));

  const hasDuplicateInvoiceNumbers = () => {
    const numbers = invoices
      .filter((inv) => !isRowEmpty(inv))
      .map((inv) => inv.number.trim())
      .filter(Boolean);

    if (new Set(numbers).size !== numbers.length) return true;
    return numbers.some((number) => otherFacilityNumbers.has(number));
  };

  const isDuplicateNumber = (inv: LocalInvoice) => {
    const number = inv.number.trim();
    if (!number) return false;
    const localCount = invoices.filter((row) => !isRowEmpty(row) && row.number.trim() === number).length;
    return localCount > 1 || otherFacilityNumbers.has(number);
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

    const tenureResult = validateFinancingTenureAgainstDueDate({
      tenureDays: inv.financing_tenure_days,
      maturityDate: inv.maturity_date,
    });
    if (!tenureResult.ok) {
      return `Invoice ${inv.number}: ${tenureResult.message}`;
    }

    // min/max invoice value checks only if productConfig provided
    // debug removed
    if (productConfig) {
      // debug removed
      const invoiceValue = parseMoney(inv.value);
      const minR = productConfig.min_financing_ratio_percent ?? 60;
      const ratio = (inv.financing_ratio_percent ?? minR) / 100;
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


  const hasRowChanged = (inv: LocalInvoice) =>
    hasInvoiceFormRowChanged(inv, initialInvoices[inv.id]);

  const cd = application?.contract?.contract_details;
  const approvedFacility = resolveApprovedFacility(
    application?.contract?.status ?? "",
    cd as Record<string, unknown> | null | undefined
  );
  const contractFinancing =
    typeof cd?.financing === "number"
      ? cd.financing
      : parseMoney(String(cd?.financing ?? ""));

  /** Live snapshot from typed columns overlaid onto contract_details. Pending already reduces available. */
  const storedAvailableFacility =
    typeof cd?.available_facility === "number"
      ? cd.available_facility
      : cd?.available_facility != null
        ? parseMoney(String(cd.available_facility))
        : null;
  const storedLifetimeRemaining =
    typeof cd?.lifetime_remaining === "number"
      ? cd.lifetime_remaining
      : cd?.lifetime_remaining != null
        ? parseMoney(String(cd.lifetime_remaining))
        : null;

  const structureType =
    effectiveStructureType ?? application?.financing_structure?.structure_type;
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
  let facilityCapacityWarning = "";
  const shouldRunValidation =
    isInitialized &&
    !isLoadingInvoices &&
    !isLoadingApplication;

  const isInvoiceOnly = structureType === "invoice_only";
  const isExistingContract = structureType === "existing_contract";
  const existingFacilityGate = isExistingContract
    ? resolveIssuerFacilityGate({
        contractDetails: application?.contract?.contract_details,
        contractStatus: application?.contract?.status,
        facilityFeeUpfrontOutstanding: application?.contract?.facilityFeeUpfrontOutstanding,
      })
    : null;
  const requiresFacilityFeePayment = existingFacilityGate?.requiresFacilityFeePayment === true;
  const fieldsReady = isInvoiceStepContinueReady({
    invoices,
    hasPendingFile: (id) => Boolean(selectedFiles[id]),
    requiresInvoice: isInvoiceOnly || isExistingContract,
    requiresFacilityFeePayment,
  });

  /** Applications allow at most one invoice; legacy files may still have more. */
  const maxInvoicesReached = invoices.length >= 1;
  const isGrandfatherMultiInvoice = invoices.length > 1;
  const canRemoveInvoiceRow = isGrandfatherMultiInvoice || structureType === "new_contract";

  let productConfig: InvoiceConfig | null = null;
  try {
    productConfig = getProductInvoiceConfig(
      application,
      productsData?.products || [],
      frozenProductWorkflow
    );
  } catch (error: unknown) {
    validationError = error instanceof Error ? error.message : "Product configuration error";
  }

  const { min: displayMinRatio, max: displayMaxRatio } = resolveInvoiceFinancingRatioBounds(
    productConfig?.min_financing_ratio_percent,
    productConfig?.max_financing_ratio_percent
  );

  const totalFinancingAmount = invoices.reduce((acc, inv) => {
    const value = parseMoney(inv.value);
    const ratio = (inv.financing_ratio_percent ?? displayMinRatio) / 100;
    return acc + value * ratio;
  }, 0);

  const previewInvoice = invoices.find((inv) => !isRowEmpty(inv)) ?? invoices[0] ?? null;
  const previewFinancingAmount = previewInvoice
    ? parseMoney(previewInvoice.value) *
      ((previewInvoice.financing_ratio_percent ?? displayMinRatio) / 100)
    : 0;
  const previewInvoiceFace = previewInvoice ? parseMoney(previewInvoice.value) : 0;
  const persistedPreview = previewInvoice ? initialInvoices[previewInvoice.id] : undefined;
  const addBackReserved = isEditableReservedInvoiceStatus(previewInvoice?.status);
  const dualLimitPreview = previewDualLimits({
    availableFacility: storedAvailableFacility,
    lifetimeRemaining: storedLifetimeRemaining,
    financingAmount: previewFinancingAmount,
    invoiceFace: previewInvoiceFace,
    addBackFinancing: addBackReserved && persistedPreview
      ? parseMoney(persistedPreview.value) *
        ((persistedPreview.financing_ratio_percent ?? displayMinRatio) / 100)
      : 0,
    addBackFace: addBackReserved && persistedPreview ? parseMoney(persistedPreview.value) : 0,
  });
  const reservedOverageCopy = addBackReserved
    ? dualLimitOverageCopy(dualLimitPreview, "reserved")
    : null;
  const draftOverageCopy =
    isExistingContract && !addBackReserved
      ? dualLimitOverageCopy(dualLimitPreview, "draft")
      : null;

  if (shouldRunValidation) {
    if (!productConfig && application?.financing_type?.product_id) {
      validationError = "Product configuration is incomplete. Min and max financing ratio must be set in the product workflow.";
    }
    if (!validationError && hasPartialRows) {
        validationError = "Please complete all invoice details before saving.";
    }

    if (!validationError && hasDuplicateInvoiceNumbers()) {
      validationError = "Invoice numbers must be unique on this facility.";
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
        validationError = "Please add at least one valid invoice with all fields filled (invoice number, value, maturity date, financing tenure, document).";
      }
    }

    /** Financing ratio from product config applies to all structures including invoice_only. */
    if (!validationError && productConfig) {
      const { min: minR, max: maxR } = resolveInvoiceFinancingRatioBounds(
        productConfig.min_financing_ratio_percent,
        productConfig.max_financing_ratio_percent
      );
      const invalidRatioInvoice = invoices.find(
        (inv) => !isRowEmpty(inv) && (inv.financing_ratio_percent! < minR || inv.financing_ratio_percent! > maxR)
      );
      if (invalidRatioInvoice) {
        validationError = `Financing ratio must be between ${minR}% and ${maxR}%.`;
      }
    }

    /** Facility limit only for new_contract and existing_contract (invoice_only has no facility). */
    if (!isInvoiceOnly && !isExistingContract) {
      if (totalFinancingAmount > facilityLimit) {
        facilityCapacityWarning = `Total financing amount (RM ${formatMoney(totalFinancingAmount)}) exceeds remaining facility capacity (RM ${formatMoney(facilityLimit)}). You can still save; CashSouk may size the offer.`;
      }
    }
    if (!validationError && reservedOverageCopy) {
      validationError = reservedOverageCopy;
    }
    if (!facilityCapacityWarning && draftOverageCopy) {
      facilityCapacityWarning = draftOverageCopy;
    }

    if (!validationError) {
      const nonEmptyInvoiceCount = invoices.filter((inv) => !isRowEmpty(inv)).length;
      if (nonEmptyInvoiceCount > 1) {
        validationError = MAX_ONE_INVOICE_MESSAGE;
      }
    }
  }

  const fieldErrorsByInvoiceId = React.useMemo(() => {
    const map: Record<string, InvoiceFieldErrors> = {};
    for (const inv of invoices) {
      if (isRowEmpty(inv)) continue;
      const errors: InvoiceFieldErrors = {};
      const hasNumber = Boolean(String(inv.number).trim());
      const hasValue = inv.value !== "";
      const hasDate = Boolean(String(inv.maturity_date).trim());
      const hasTenure = inv.financing_tenure_days != null;
      const hasDocument = Boolean(inv.document) || Boolean(selectedFiles[inv.id]);
      const looksFilled = hasNumber && hasValue && hasDate;
      if (isRowPartial(inv) && (hasSubmitted || looksFilled)) {
        if (!hasNumber) errors.number = "Invoice number is required";
        if (!hasValue) errors.value = "Invoice value is required";
        if (!hasDate) errors.maturity_date = "Maturity date is required";
        if (!hasTenure) errors.financing_tenure_days = "Financing tenure is required";
        if (!hasDocument) errors.document = "Document is required";
      }
      if (hasNumber && isDuplicateNumber(inv)) {
        errors.number = "This invoice number is already used on this facility";
      }
      const constraintError =
        hasSubmitted || (hasDate && hasTenure)
          ? validateInvoiceConstraints(inv, productConfig)
          : "";
      if (constraintError) {
        if (constraintError.includes("more than")) {
          errors.maturity_date = constraintError;
        } else if (constraintError.includes("Financing tenure")) {
          errors.financing_tenure_days = constraintError;
        } else if (
          constraintError.includes("Invalid date") ||
          constraintError.includes("past") ||
          constraintError.includes("month") ||
          constraintError.includes("contract start") ||
          constraintError.includes("due date")
        ) {
          errors.maturity_date = constraintError;
        } else if (constraintError.includes("Financing amount")) {
          errors.financing_amount = constraintError;
        }
      }
      if (productConfig && (hasSubmitted || looksFilled)) {
        const { min: minR, max: maxR } = resolveInvoiceFinancingRatioBounds(
          productConfig.min_financing_ratio_percent,
          productConfig.max_financing_ratio_percent
        );
        const ratio = inv.financing_ratio_percent ?? minR;
        if (ratio < minR || ratio > maxR) {
          errors.financing_ratio_percent = `Financing ratio must be between ${minR}% and ${maxR}%.`;
        }
      }
      map[inv.id] = errors;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubmitted, invoices, selectedFiles, productConfig, otherFacilityNumbers]);

  const saveFunction = async () => {
    setHasSubmitted(true);
    setCapacityServerError(null);
    /**
     * VALIDATION CHECK
     *
     * If there are validation errors, show toast and prevent save.
     */
    if (!productConfig) {
      toast.error(
        application?.financing_type?.product_id
          ? "Product configuration is incomplete. Min and max financing ratio must be set in the product workflow."
          : "Product configuration is missing. Please contact CashSouk support."
      );
      throw new Error("VALIDATION_PRODUCT_CONFIG");
    }

    if (validationError) {
      toast.error(
        validationError === MAX_ONE_INVOICE_MESSAGE
          ? MAX_ONE_INVOICE_MESSAGE
          : "Please fix the highlighted fields"
      );
      throw new Error("VALIDATION_INVOICES");
    }

    const apiClient = createApiClient(API_URL, getAccessToken);
    const token = await getAccessToken();
    const saveStructureType =
      effectiveStructureType ?? application?.financing_structure?.structure_type;
    const isInvoiceOnly = saveStructureType === "invoice_only";

    for (const invoiceId of Object.keys(deletedInvoices)) {
      await apiClient.deleteInvoice(invoiceId);
    }

    const persistedCount = invoices.filter((row) => row.isPersisted).length;
    let createdThisSave = 0;

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
        if (persistedCount + createdThisSave >= 1) {
          toast.error(MAX_ONE_INVOICE_MESSAGE);
          throw new Error("VALIDATION_MAX_INVOICES");
        }

        const createPayload: Parameters<ApiClient["createInvoice"]>[0] = {
          applicationId,
          details: {
            number: inv.number,
            value: parseMoney(inv.value),
            maturity_date: (() => {
              const pd = parseDateString(inv.maturity_date);
              return pd ? format(pd, "yyyy-MM-dd") : inv.maturity_date;
            })(),
            financing_ratio_percent: inv.financing_ratio_percent ?? displayMinRatio,
            financing_tenure_days: inv.financing_tenure_days,
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
          const isMaxInvoices = createResp.error.code === "MAX_INVOICES_REACHED";
          const isDuplicate = createResp.error.code === "DUPLICATE_INVOICE_NUMBER";
          const capacityMessage = mapCapacityApiError(createResp.error);
          if (capacityMessage) setCapacityServerError(capacityMessage);
          toast.error(
            capacityMessage ??
              (isMaxInvoices
                ? createResp.error.message || MAX_ONE_INVOICE_MESSAGE
                : createResp.error.message || "Failed to create invoice")
          );
          throw new Error(
            isMaxInvoices
              ? "VALIDATION_MAX_INVOICES"
              : isDuplicate
                ? "VALIDATION_DUPLICATE_INVOICE_NUMBER"
                : "VALIDATION_CREATE_INVOICE"
          );
        }
        invoiceId = createResp.data.id;
        createdThisSave += 1;
        setInvoices((prev) =>
          prev.map((row) =>
            row.id === inv.id
              ? {
                  ...row,
                  id: invoiceId,
                  isPersisted: true,
                  displayReference: createResp.data.displayReference ?? row.displayReference,
                }
              : row
          )
        );
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
          financing_ratio_percent: inv.financing_ratio_percent ?? displayMinRatio,
          financing_tenure_days: inv.financing_tenure_days,
        };

        if (isInvoiceOnly) {
          updatePayload.contractId = null;
        } else if (application?.contract_id) {
          updatePayload.contractId = application.contract_id;
        }
        const updateResp = await apiClient.updateInvoice(invoiceId, updatePayload);
        if (!updateResp.success) {
          const capacityMessage = mapCapacityApiError(updateResp.error);
          if (capacityMessage) setCapacityServerError(capacityMessage);
          toast.error(capacityMessage ?? (updateResp.error.message || "Failed to update invoice"));
          throw new Error(
            updateResp.error.code === "DUPLICATE_INVOICE_NUMBER"
              ? "VALIDATION_DUPLICATE_INVOICE_NUMBER"
              : "VALIDATION_UPDATE_INVOICE"
          );
        }
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
      const documentUpdateResp = await apiClient.updateInvoice(invoiceId, finalUpdatePayload);
      if (!documentUpdateResp.success) {
        toast.error(documentUpdateResp.error.message || "Failed to save invoice document");
        throw new Error("VALIDATION_UPDATE_INVOICE");
      }
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

  const saveFunctionRef = React.useRef(saveFunction);
  saveFunctionRef.current = saveFunction;

  React.useEffect(() => {
    setInvoices((prev) => {
      let changed = false;
      const next = prev.map((inv) => {
        const clamped = clampedRoundedFinancingRatio(
          inv.financing_ratio_percent,
          displayMinRatio,
          displayMaxRatio
        );
        if (inv.financing_ratio_percent === clamped) return inv;
        changed = true;
        return { ...inv, financing_ratio_percent: clamped };
      });
      return changed ? next : prev;
    });
  }, [displayMinRatio, displayMaxRatio, invoices]);

  React.useLayoutEffect(() => {
    const isValid = shouldRunValidation ? fieldsReady : !requiresFacilityFeePayment;
    onDataChange?.({
      invoices,
      totalFinancingAmount,
      isValid,
      validationError,
      hasPendingChanges: hasUnsavedChanges,
      isUploading: false,
      saveFunction: () => saveFunctionRef.current(),
    });
  }, [
    invoices,
    totalFinancingAmount,
    hasPendingFiles,
    allRowsValid,
    hasPartialRows,
    fieldsReady,
    shouldRunValidation,
    validationError,
    isInvoiceOnly,
    isExistingContract,
    requiresFacilityFeePayment,
    hasUnsavedChanges,
    onDataChange,
  ]);

  React.useEffect(() => {
    if (!application) return;

    let mounted = true;
    const loadInvoices = async () => {
      setIsLoadingInvoices(true);
      try {
        const apiClient = createApiClient(API_URL, getAccessToken);

        let mapped: LocalInvoice[];

        const resp = await apiClient.getInvoicesByApplication(applicationId);
        if (!isApiSuccess(resp)) {
          if (mounted) setIsInitialized(true);
          return;
        }
        const items = resp.data;

        if (isAmendmentMode) {
          mapped = items.map(toLocalInvoice);
        } else {
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
        if (mounted) setIsInitialized(true);
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

  React.useEffect(() => {
    if (!isInitialized || isLoadingInvoices || readOnly) return;
    if (structureType === "new_contract") return;
    if (invoices.length > 0) return;
    addInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isLoadingInvoices, readOnly, structureType, invoices.length]);

  const thisInvoiceTabs = invoices.map((inv) => ({
    id: invoiceTabId("this", inv.id),
    kind: "this" as const,
    invoice: inv,
    index: invoices.findIndex((row) => row.id === inv.id),
    label: invoiceTabLabel(inv),
  }));
  const otherInvoiceTabs = otherFacilityInvoices.map((inv) => ({
    id: invoiceTabId("other", inv.id),
    kind: "other" as const,
    invoice: inv,
    index: -1,
    label: invoiceTabLabel(inv),
  }));
  const invoiceSwitcherTabs = [...otherInvoiceTabs, ...thisInvoiceTabs];
  const showInvoiceTabStrip = invoiceSwitcherTabs.length > 1;
  const defaultInvoiceTabId =
    thisInvoiceTabs[thisInvoiceTabs.length - 1]?.id ?? otherInvoiceTabs[0]?.id ?? null;
  const selectedInvoiceTabId = invoiceSwitcherTabs.some((tab) => tab.id === activeInvoiceTab)
    ? activeInvoiceTab
    : defaultInvoiceTabId;

  const financingAmountTooltip = (() => {
    const lines: string[] = [
      "Financing amount is calculated from the invoice value and financing ratio.",
      "If you edit this amount, the financing ratio will update automatically.",
    ];
    const limits: string[] = [];
    if (typeof productConfig?.min_invoice_value === "number") {
      limits.push(`Min RM ${formatMoney(productConfig.min_invoice_value)}`);
    }
    if (typeof productConfig?.max_invoice_value === "number") {
      limits.push(`Max RM ${formatMoney(productConfig.max_invoice_value)}`);
    }
    if (limits.length > 0) {
      lines.push(`Per invoice financing limit:\n${limits.join("\n")}`);
    }
    return lines.join("\n\n");
  })();

  function isThisInvoiceEditable(inv: LocalInvoice, invIndex: number): boolean {
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
    return isEditable;
  }

  const selectedInvoiceTab = invoiceSwitcherTabs.find((tab) => tab.id === selectedInvoiceTabId);
  const selectedThisInvoiceTab =
    selectedInvoiceTab?.kind === "this" ? selectedInvoiceTab : undefined;
  const selectedPersistedInvoice =
    selectedInvoiceTab?.invoice.isPersisted ? selectedInvoiceTab.invoice : null;
  const invoiceToRemove =
    selectedThisInvoiceTab &&
    canRemoveInvoiceRow &&
    isThisInvoiceEditable(selectedThisInvoiceTab.invoice, selectedThisInvoiceTab.index)
      ? selectedThisInvoiceTab.invoice
      : null;

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
                  <div className="col-span-full space-y-3">
                    {requiresFacilityFeePayment && application?.contract?.id ? (
                      <FacilityFeeDrawdownBlockedNotice
                        href={facilityFeeContractHref(application.contract.id)}
                      />
                    ) : null}
                    <ExistingFacilityLimitPreview
                      preview={dualLimitPreview}
                      warning={draftOverageCopy}
                      hardError={
                        requiresFacilityFeePayment
                          ? FACILITY_FEE_DRAWDOWN_BLOCKED_MESSAGE
                          : (capacityServerError ?? reservedOverageCopy)
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= Invoice Details ================= */}
        <section className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className={applicationFlowSectionTitleClassName}>
                  {isGrandfatherMultiInvoice ? "Invoices" : "Invoice"}
                </h3>
                {selectedPersistedInvoice ? (
                  <StatusBadge
                    status={selectedPersistedInvoice.status}
                    withdrawReason={selectedPersistedInvoice.withdraw_reason}
                  />
                ) : null}
              </div>
              {invoiceToRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove invoice"
                  onClick={() => deleteInvoice(invoiceToRemove)}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {maxInvoicesReached
                ? structureType === "new_contract"
                  ? "This application already has an invoice. Start a new application to finance another invoice against this facility."
                  : "Applications allow only one invoice."
                : structureType === "new_contract"
                  ? "You can add one invoice now, or originate the facility first and finance an invoice later from the facility page."
                  : "Provide the invoice for this application. Details stay local until you Save and Continue."}
            </p>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          {invoiceAmendmentGroups.length > 0 && (
            <InvoiceErrorCard groups={invoiceAmendmentGroups} />
          )}

          {!isLoadingInvoices && invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {structureType === "new_contract" ? (
                <div className="space-y-4">
                  <p>
                    No invoice added yet. Click{" "}
                    <span className="font-medium text-foreground">Add invoice</span> if you want to
                    finance one with this facility application, or continue without an invoice.
                  </p>
                  <Button
                    type="button"
                    onClick={addInvoice}
                    disabled={readOnly}
                    className="bg-primary text-primary-foreground"
                  >
                    Add invoice
                  </Button>
                </div>
              ) : (
                <p>No invoice on this application yet.</p>
              )}
            </div>
          ) : null}

          {!isLoadingInvoices && invoiceSwitcherTabs.length > 0 && selectedInvoiceTabId ? (
            <Tabs
              value={selectedInvoiceTabId}
              onValueChange={setActiveInvoiceTab}
              className="w-full"
            >
              {showInvoiceTabStrip ? (
                <div className="mb-4 w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-xl bg-muted p-1">
                  <TabsList className="flex h-auto min-h-11 w-max min-w-full flex-nowrap justify-start gap-1 bg-transparent p-0 text-muted-foreground">
                    {invoiceSwitcherTabs.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="shrink-0 rounded-lg px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-4"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              ) : null}

              {otherInvoiceTabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0 focus-visible:outline-none">
                  <InvoiceFormFields
                    invoice={tab.invoice}
                    minRatio={displayMinRatio}
                    maxRatio={displayMaxRatio}
                    isEditable={false}
                    helperText={OTHER_FACILITY_INVOICE_HELPER}
                    financingAmountTooltip={financingAmountTooltip}
                  />
                </TabsContent>
              ))}

              {thisInvoiceTabs.map((tab) => {
                const inv = tab.invoice;
                const invIndex = tab.index;
                const isEditable = isThisInvoiceEditable(inv, invIndex);
                return (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0 focus-visible:outline-none">
                    <InvoiceFormFields
                      invoice={inv}
                      minRatio={displayMinRatio}
                      maxRatio={displayMaxRatio}
                      isEditable={isEditable}
                      isAmendmentTarget={isEditable && invoicesWithRemarks.has(invIndex)}
                      pendingFile={selectedFiles[inv.id]}
                      fieldErrors={fieldErrorsByInvoiceId[inv.id]}
                      financingAmountDraft={financingAmountDraftById[inv.id]}
                      financingAmountTooltip={financingAmountTooltip}
                      onNumberChange={(value) => updateInvoiceField(inv.id, "number", value)}
                      onMaturityDateChange={(value) =>
                        updateInvoiceField(inv.id, "maturity_date", value)
                      }
                      onFinancingTenureDaysChange={(value) =>
                        updateInvoiceField(inv.id, "financing_tenure_days", value)
                      }
                      onValueChange={(value) => {
                        clearFinancingAmountDraft(inv.id);
                        updateInvoiceField(inv.id, "value", value);
                      }}
                      onRatioChange={(value) => {
                        clearFinancingAmountDraft(inv.id);
                        updateInvoiceField(inv.id, "financing_ratio_percent", value);
                      }}
                      onFinancingAmountDraftChange={(value) =>
                        setFinancingAmountDraftById((p) => ({ ...p, [inv.id]: value }))
                      }
                      onFinancingAmountCommit={(formatted) => {
                        clearFinancingAmountDraft(inv.id);
                        if (formatted === "") {
                          updateInvoiceField(
                            inv.id,
                            "financing_ratio_percent",
                            displayMinRatio
                          );
                          return;
                        }
                        syncRatioFromFinancingAmountString(
                          inv.id,
                          formatted,
                          displayMinRatio,
                          displayMaxRatio
                        );
                      }}
                      onFileSelect={(file) => handleFileChange(inv.id, file, inv.document?.s3_key)}
                      onRemoveFile={() => {
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
                    />
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : null}

          {validationError &&
          invoices.some(
            (inv) =>
              Boolean(String(inv.maturity_date).trim()) &&
              inv.financing_tenure_days != null &&
              Boolean(validateInvoiceConstraints(inv, productConfig))
          ) ? (
            <div className="mx-3 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 mt-4">
              <XMarkIcon className="h-5 w-5" />
              {validationError}
            </div>
          ) : null}
          {facilityCapacityWarning && structureType !== "existing_contract" ? (
            <div className="mx-3 mt-4 flex items-center gap-2 rounded-xl border border-status-action-text/30 bg-status-action-bg px-4 py-3 text-ui font-medium text-status-action-text">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
              {facilityCapacityWarning}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

export { InvoiceDetailsStep };
