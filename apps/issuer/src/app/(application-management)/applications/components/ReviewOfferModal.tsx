"use client";

/**
 * Modal for reviewing contract or invoice offers. Issuer can download offer letter,
 * accept, or decline. CashSouk brand styling per BRANDING.md.
 * Contract end date uses contract_details.end_date; offer expiry shown in footer.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextareaWithCharCount } from "@/components/textarea-with-char-count";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ISSUER_OFFER_DECLINE_REASONS,
  OTHER_ISSUER_DECLINE_REASON_VALUE,
  resolveIssuerOfferDeclineReason,
} from "@/lib/issuer-offer-decline-reasons";
import { useContract } from "@/hooks/use-contracts";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import { useAcceptInvoiceOffer, useRejectContractOffer, useRejectInvoiceOffer, useApplication } from "@/hooks/use-applications";
import { useIssuerProduct } from "@/hooks/use-products";
import { SupportingDocumentsStep } from "@/app/(application-flow)/applications/steps/supporting-documents-step";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import {
  ArrowDownTrayIcon,
  CheckIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";
import { toast } from "sonner";
import type { NormalizedInvoice } from "../status";
import {
  SIGNING_TEMPLATE_WORKFLOW_KEY,
  parseSigningTemplateConfig,
  isValidSigningIcNumber,
  normalizeSigningIcNumber,
  roleRequiresBindingIcAtOffer,
  type ApiError,
  type ApplicationPersonRow,
  type RecipientBinding,
  type SigningEnvelopeDto,
  type SigningTemplateConfig,
  type SigningTemplateRole,
} from "@cashsouk/types";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SigningProgressMatrix } from "@/components/signing/signing-progress-matrix";
import { cn } from "@/lib/utils";

const PLATFORM_FEE_TOOLTIP =
  "Deducted from disbursement when funding closes, applied as a percentage of the funded amount.";

const PROFIT_RATE_TOOLTIP =
  "Profit per annum (%). Deducted during settlement when calculating the residual refund to the issuer.";

const CONTRACT_FACILITY_FEE_RATE_TOOLTIP =
  "Facility fee is deducted from each invoice financing disbursement under this contract.";

const CONTRACT_FACILITY_FEE_CAP_TOOLTIP =
  "Maximum total facility fee that can be collected for this contract.";

type ReviewOfferModalProps = {
  type: "contract" | "invoice";
  applicationId: string;
  /** Application's issuer org — preferred over active org from context. */
  issuerOrganizationId?: string;
  productId?: string | null;
  contractId?: string;
  invoice?: NormalizedInvoice | null;
  requiresInvoiceSigning?: boolean;
  onClose: () => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DECLINE_CONTEXT_MAX = 200;

type PostApplicationDocsState = {
  areAllFilesUploaded: boolean;
  hasPendingChanges: boolean;
  saveFunction?: () => Promise<unknown>;
};

function formatDateOrDash(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "d MMM yyyy");
}

function getApiErrorDetails(
  response: ApiError | Error | unknown,
  fallback: string
): { code: string | null; message: string } {
  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    response.success === false &&
    "error" in response &&
    response.error &&
    typeof response.error === "object"
  ) {
    const error = response.error as { code?: string; message?: string };
    return {
      code: typeof error.code === "string" ? error.code : null,
      message: typeof error.message === "string" ? error.message : fallback,
    };
  }

  if (response instanceof Error) {
    const maybeCode =
      "code" in response && typeof response.code === "string" ? response.code : null;
    return {
      code: maybeCode,
      message: response.message || fallback,
    };
  }

  return {
    code: null,
    message: fallback,
  };
}

function findSupportingDocumentsStepConfig(workflow: unknown): { config?: Record<string, unknown> } | undefined {
  if (!Array.isArray(workflow)) return undefined;
  return workflow.find((step) => {
    const id = String((step as { id?: unknown })?.id ?? "");
    return id === "supporting_documents" || id.startsWith("supporting_documents_");
  }) as { config?: Record<string, unknown> } | undefined;
}

function hasPostApplicationDocuments(stepConfig: { config?: Record<string, unknown> } | undefined): boolean {
  const config = stepConfig?.config;
  if (!config || typeof config !== "object") return false;
  return Object.entries(config).some(([key, value]) => {
    if (key === "enabled_categories" || !Array.isArray(value)) return false;
    return value.some((row) => {
      const timing =
        row && typeof row === "object"
          ? (row as Record<string, unknown>).upload_timing
          : undefined;
      return timing === "post_application";
    });
  });
}

function readSigningTemplate(workflow: unknown): SigningTemplateConfig {
  const steps = Array.isArray(workflow) ? workflow : [];
  for (const step of steps) {
    const config = (step as { config?: Record<string, unknown> } | null)?.config;
    if (config && config[SIGNING_TEMPLATE_WORKFLOW_KEY] != null) {
      return parseSigningTemplateConfig(config[SIGNING_TEMPLATE_WORKFLOW_KEY]);
    }
  }
  return parseSigningTemplateConfig(null);
}

type IssuerDirectorOption = {
  matchKey: string;
  name: string;
  email: string;
  ic_number: string | null;
};

type ApplicationGuarantorRow = {
  id: string;
  name?: string | null;
  business_name?: string | null;
  email: string;
  ic_number?: string | null;
};

function directorIcFromMatchKey(matchKey: string): string | null {
  const normalized = normalizeSigningIcNumber(matchKey);
  return normalized.length === 12 ? normalized : null;
}

function isDirectorRole(role: SigningTemplateRole): boolean {
  return role.key === "issuer_director" || role.source_hint === "issuer_director";
}

function isGuarantorRole(role: SigningTemplateRole): boolean {
  return role.key === "guarantor" || role.source_hint === "guarantor";
}

function guarantorsFromApplication(rows: unknown): ApplicationGuarantorRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const guarantor = row as Record<string, unknown>;
      const id = typeof guarantor.id === "string" ? guarantor.id : "";
      if (!id) return null;
      return {
        id,
        name: typeof guarantor.name === "string" ? guarantor.name : null,
        business_name:
          typeof guarantor.business_name === "string" ? guarantor.business_name : null,
        email: typeof guarantor.email === "string" ? guarantor.email : "",
        ic_number: typeof guarantor.ic_number === "string" ? guarantor.ic_number : null,
      };
    })
    .filter((guarantor): guarantor is ApplicationGuarantorRow => guarantor != null);
}

function dedupeIssuerDirectors(directors: IssuerDirectorOption[]): IssuerDirectorOption[] {
  const seen = new Set<string>();
  return directors.filter((director) => {
    const key = directorIcFromMatchKey(director.matchKey) ?? director.matchKey.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function issuerDirectorsFromOrganization(activeOrganization: unknown): IssuerDirectorOption[] {
  const org = activeOrganization as
    | {
        people?: ApplicationPersonRow[];
        directorKycStatus?: {
          directors?: Array<{
            name?: string;
            email?: string;
            role?: string;
            kycId?: string;
            eodRequestId?: string;
          }>;
        };
        directorAmlStatus?: {
          directors?: Array<{
            name?: string;
            email?: string;
            role?: string;
            kycId?: string;
          }>;
        };
      }
    | null
    | undefined;

  const fromPeople = (org?.people ?? [])
    .filter((person) => person.roles?.some((role) => role.toUpperCase() === "DIRECTOR"))
    .map((person) => ({
      matchKey: person.matchKey,
      name: String(person.name ?? "").trim(),
      email: String(person.email ?? "").trim(),
      ic_number: directorIcFromMatchKey(person.matchKey),
    }))
    .filter((person) => person.name.length > 0);
  if (fromPeople.length > 0) return dedupeIssuerDirectors(fromPeople);

  const fromKyc = (org?.directorKycStatus?.directors ?? [])
    .filter((director) => {
      const role = String(director.role ?? "").toUpperCase();
      return role.length === 0 || role.includes("DIRECTOR");
    })
    .map((director, index) => ({
      matchKey: director.kycId ?? director.eodRequestId ?? `director-kyc-${index}`,
      name: String(director.name ?? "").trim(),
      email: String(director.email ?? "").trim(),
      ic_number: directorIcFromMatchKey(
        director.kycId ?? director.eodRequestId ?? `director-kyc-${index}`
      ),
    }))
    .filter((director) => director.name.length > 0);
  if (fromKyc.length > 0) return dedupeIssuerDirectors(fromKyc);

  const fromAml = (org?.directorAmlStatus?.directors ?? [])
    .filter((director) => {
      const role = String(director.role ?? "").toUpperCase();
      return role.length === 0 || role.includes("DIRECTOR");
    })
    .map((director, index) => ({
      matchKey: director.kycId ?? `director-aml-${index}`,
      name: String(director.name ?? "").trim(),
      email: String(director.email ?? "").trim(),
      ic_number: directorIcFromMatchKey(director.kycId ?? `director-aml-${index}`),
    }))
    .filter((director) => director.name.length > 0);

  return dedupeIssuerDirectors(fromAml);
}

function resolveBindingDirectorKey(
  directors: IssuerDirectorOption[],
  binding: RecipientBinding
): string {
  const name = binding.name.trim();
  const email = binding.email.trim();
  const exact = directors.find((director) => director.name === name && director.email === email);
  if (exact) return exact.matchKey;
  const byName = directors.find((director) => director.name === name);
  return byName?.matchKey ?? "";
}

function buildFallbackBinding(
  role: SigningTemplateRole,
  activeOrganization: unknown,
  directors: IssuerDirectorOption[]
): RecipientBinding {
  const director = directors[0];
  if (director) {
    return {
      role_key: role.key,
      name: director.name,
      email: director.email,
      ic_number: director.ic_number,
    };
  }
  const org = activeOrganization as
    | {
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        members?: Array<{ email?: string; firstName?: string; lastName?: string }>;
      }
    | null
    | undefined;
  const member = org?.members?.[0];
  const fallbackName =
    [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim() ||
    [org?.firstName, org?.lastName].filter(Boolean).join(" ").trim() ||
    org?.name ||
    role.label ||
    "Issuer signer";
  return {
    role_key: role.key,
    name: fallbackName,
    email: member?.email ?? "",
    ic_number: "",
  };
}

function buildIssuerEnvelopeBindings(
  template: SigningTemplateConfig,
  activeOrganization: unknown,
  applicationGuarantors: ApplicationGuarantorRow[] = []
): RecipientBinding[] {
  const directors = issuerDirectorsFromOrganization(activeOrganization);
  const guarantorRows = guarantorsFromApplication(applicationGuarantors);
  const bindings: RecipientBinding[] = [];

  for (const role of template.roles) {
    const preferredCount = Math.max(role.min_count, 1);
    let roleBindings: RecipientBinding[];
    if (isDirectorRole(role) && directors.length > 0) {
      roleBindings = directors.slice(0, preferredCount).map((director) => ({
        role_key: role.key,
        name: director.name,
        email: director.email,
        ic_number: director.ic_number,
      }));
    } else if (isGuarantorRole(role) && guarantorRows.length > 0) {
      const maxRows = role.max_count ?? guarantorRows.length;
      roleBindings = guarantorRows.slice(0, maxRows).map((guarantor) => ({
        role_key: role.key,
        name: guarantor.name ?? guarantor.business_name ?? "",
        email: guarantor.email,
        ic_number: guarantor.ic_number?.trim()
          ? normalizeSigningIcNumber(guarantor.ic_number)
          : null,
        application_guarantor_id: guarantor.id,
      }));
    } else {
      roleBindings = [buildFallbackBinding(role, activeOrganization, directors)];
    }
    const limited: RecipientBinding[] =
      role.max_count != null ? roleBindings.slice(0, role.max_count) : roleBindings;
    while (limited.length < role.min_count) {
      limited.push(buildFallbackBinding(role, activeOrganization, directors));
    }
    bindings.push(...limited);
  }

  return bindings;
}

function validateSignerBindings(bindings: RecipientBinding[], template: SigningTemplateConfig): string | null {
  for (const role of template.roles) {
    const rows = bindings.filter((binding) => binding.role_key === role.key);
    if (rows.length < role.min_count) {
      return `${role.label || role.key} needs at least ${role.min_count} signer(s).`;
    }
    if (role.max_count != null && rows.length > role.max_count) {
      return `${role.label || role.key} allows at most ${role.max_count} signer(s).`;
    }
  }
  for (const binding of bindings) {
    if (!binding.name.trim()) return "Every signer needs a name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(binding.email.trim())) {
      return "Every signer needs a valid email address.";
    }
    const role = template.roles.find((item) => item.key === binding.role_key);
    if (role && roleRequiresBindingIcAtOffer(role)) {
      if (!String(binding.ic_number ?? "").trim()) {
        return `${role.label || role.key} is missing an IC number from company records.`;
      }
      if (!isValidSigningIcNumber(binding.ic_number)) {
        return `${role.label || role.key} must have a valid 12-digit IC number on file.`;
      }
    } else if (binding.ic_number?.trim() && !isValidSigningIcNumber(binding.ic_number)) {
      return "A signer has an invalid IC number.";
    }
  }
  return null;
}

type SignerCompareRow = { role_key: string; name: string; email: string };

function sortSignerCompareRows(rows: SignerCompareRow[]): SignerCompareRow[] {
  return [...rows].sort((left, right) => {
    const roleDiff = left.role_key.localeCompare(right.role_key);
    if (roleDiff !== 0) return roleDiff;
    const emailDiff = left.email.localeCompare(right.email);
    if (emailDiff !== 0) return emailDiff;
    return left.name.localeCompare(right.name);
  });
}

function normalizeSignerCompareRows(bindings: RecipientBinding[]): SignerCompareRow[] {
  return sortSignerCompareRows(
    bindings.map((binding) => ({
      role_key: binding.role_key,
      name: binding.name.trim(),
      email: binding.email.trim().toLowerCase(),
    }))
  );
}

function envelopeMatchesSignerBindings(
  envelope: SigningEnvelopeDto,
  bindings: RecipientBinding[]
): boolean {
  const envelopeRows = sortSignerCompareRows(
    envelope.recipients.map((recipient) => ({
      role_key: recipient.role_key,
      name: recipient.name.trim(),
      email: recipient.email.trim().toLowerCase(),
    }))
  );
  const bindingRows = normalizeSignerCompareRows(bindings);
  if (envelopeRows.length !== bindingRows.length) return false;
  return envelopeRows.every(
    (row, index) =>
      row.role_key === bindingRows[index].role_key &&
      row.name === bindingRows[index].name &&
      row.email === bindingRows[index].email
  );
}

function formatSignerNameList(names: string[]): string {
  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  if (trimmed.length === 0) return "the selected signers";
  if (trimmed.length === 1) return trimmed[0];
  if (trimmed.length === 2) return `${trimmed[0]} and ${trimmed[1]}`;
  return `${trimmed.slice(0, -1).join(", ")}, and ${trimmed[trimmed.length - 1]}`;
}

function buildSigningConfirmDescription(bindings: RecipientBinding[]): string {
  const names = bindings.map((binding) => binding.name);
  const signers = formatSignerNameList(names);
  return `Signing emails will be sent to ${signers}. Each signer will receive a link to review and sign the offer letter.`;
}

function findActiveSigningEnvelope(
  envelopes: SigningEnvelopeDto[],
  offerType: "contract" | "invoice",
  contractId: string | undefined,
  invoiceId: string | null | undefined
): SigningEnvelopeDto | null {
  return (
    envelopes.find((envelope) => {
      if (["VOIDED", "DECLINED", "EXPIRED", "COMPLETED"].includes(envelope.status)) return false;
      if (offerType === "contract") return envelope.contract_id === (contractId ?? null);
      return envelope.invoice_id === invoiceId;
    }) ?? null
  );
}

function bindingsFromEnvelopeRecipients(
  envelope: SigningEnvelopeDto,
  template: SigningTemplateConfig
): RecipientBinding[] {
  const byRole = new Map<string, SigningEnvelopeDto["recipients"]>();
  for (const recipient of envelope.recipients) {
    const list = byRole.get(recipient.role_key) ?? [];
    list.push(recipient);
    byRole.set(recipient.role_key, list);
  }

  const bindings: RecipientBinding[] = [];
  for (const role of template.roles) {
    for (const recipient of byRole.get(role.key) ?? []) {
      bindings.push({
        role_key: role.key,
        name: recipient.name,
        email: recipient.email,
      });
    }
  }
  return bindings;
}

function RecipientReminders({
  envelope,
  onRemind,
  disabled,
}: {
  envelope: SigningEnvelopeDto;
  onRemind: (recipientId: string) => void;
  disabled: boolean;
}) {
  const pending = envelope.recipients.filter((r) => r.status !== "SIGNED");
  if (pending.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      <span className="text-xs text-muted-foreground">Remind:</span>
      {pending.map((r) => (
        <Button
          key={r.id}
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => onRemind(r.id)}
          disabled={disabled}
        >
          {r.name}
        </Button>
      ))}
    </div>
  );
}

/** Only mounted when Review Offer is clicked. Renders once, no isOpen toggle to avoid flash. */
export function ReviewOfferModal({
  type,
  applicationId,
  issuerOrganizationId: issuerOrganizationIdProp,
  productId,
  contractId,
  invoice,
  requiresInvoiceSigning = true,
  onClose,
}: ReviewOfferModalProps) {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const issuerOrganizationId = issuerOrganizationIdProp ?? activeOrganization?.id;
  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );
  const { data: product, isLoading: isLoadingProduct } = useIssuerProduct(productId ?? "");
  const supportingDocumentsStepConfig = React.useMemo(
    () => findSupportingDocumentsStepConfig((product as { workflow?: unknown } | null | undefined)?.workflow),
    [product]
  );
  const hasPostDocs = React.useMemo(
    () => hasPostApplicationDocuments(supportingDocumentsStepConfig),
    [supportingDocumentsStepConfig]
  );
  const signingTemplate = React.useMemo(
    () => readSigningTemplate((product as { workflow?: unknown } | null | undefined)?.workflow),
    [product]
  );
  const useEnvelopeSigning = signingTemplate.enabled;
  const envelopeTargetInvoiceId = type === "invoice" ? invoice?.id : null;
  const { data: signingEnvelopes = [], isLoading: isLoadingSigningEnvelopes } = useQuery({
    queryKey: ["signing-envelopes", applicationId],
    queryFn: async () => {
      const response = await apiClient.getSigningEnvelopes(applicationId);
      if (!response.success) {
        throw new Error(getApiErrorDetails(response, "Failed to load signing package").message);
      }
      return response.data;
    },
    enabled: useEnvelopeSigning,
  });
  const activeSigningEnvelope = React.useMemo(
    () =>
      findActiveSigningEnvelope(signingEnvelopes, type, contractId, envelopeTargetInvoiceId),
    [signingEnvelopes, type, contractId, envelopeTargetInvoiceId]
  );
  const signersLocked =
    activeSigningEnvelope != null && activeSigningEnvelope.status !== "DRAFT";
  const showSigningProgress =
    signersLocked &&
    activeSigningEnvelope != null &&
    (activeSigningEnvelope.status === "SENT" ||
      activeSigningEnvelope.status === "IN_PROGRESS" ||
      activeSigningEnvelope.status === "COMPLETED");
  const canRemindSigners =
    activeSigningEnvelope != null &&
    (activeSigningEnvelope.status === "SENT" || activeSigningEnvelope.status === "IN_PROGRESS");
  const { data: applicationRecord } = useApplication(useEnvelopeSigning ? applicationId : "");
  const { data: corporateEntities } = useCorporateEntities(
    useEnvelopeSigning ? issuerOrganizationId : undefined
  );
  const directorSourceOrganization = React.useMemo(() => {
    if (corporateEntities?.people?.length) {
      return { ...activeOrganization, people: corporateEntities.people };
    }
    return activeOrganization;
  }, [activeOrganization, corporateEntities?.people]);
  const issuerDirectors = React.useMemo(
    () => issuerDirectorsFromOrganization(directorSourceOrganization),
    [directorSourceOrganization]
  );

  const shouldLoadContract = !!contractId;
  const { data: contractRecord, isLoading: isLoadingContract } = useContract(
    shouldLoadContract && contractId ? contractId : ""
  );

  const rejectContract = useRejectContractOffer();
  const rejectInvoice = useRejectInvoiceOffer();
  const acceptInvoice = useAcceptInvoiceOffer();

  const offerDetails =
    type === "contract"
      ? (contractRecord as { offer_details?: Record<string, unknown> } | null)?.offer_details
      : (invoice as { offer_details?: Record<string, unknown> } | undefined)?.offer_details;
  const od = offerDetails as Record<string, unknown> | null | undefined;

  const isLoading = shouldLoadContract ? isLoadingContract : false;

  const [downloading, setDownloading] = React.useState(false);
  const [acceptSigningLoading, setAcceptSigningLoading] = React.useState(false);
  const [acceptOverrideLoading, setAcceptOverrideLoading] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [selectedDeclineReason, setSelectedDeclineReason] = React.useState("");
  const [isRejectMode, setIsRejectMode] = React.useState(false);
  const [postDocsState, setPostDocsState] = React.useState<PostApplicationDocsState>({
    areAllFilesUploaded: false,
    hasPendingChanges: false,
  });
  const [isSavingPostDocs, setIsSavingPostDocs] = React.useState(false);
  const [signerBindings, setSignerBindings] = React.useState<RecipientBinding[]>([]);
  const [signerConfirmOpen, setSignerConfirmOpen] = React.useState(false);
  const [remindLoading, setRemindLoading] = React.useState(false);
  const isOtherDeclineReason = selectedDeclineReason === OTHER_ISSUER_DECLINE_REASON_VALUE;
  const isSigningOverrideEnabled = process.env.NODE_ENV !== "production";

  React.useEffect(() => {
    if (!signingTemplate.enabled) {
      setSignerBindings([]);
      return;
    }
    if (isLoadingSigningEnvelopes) return;
    if (activeSigningEnvelope) {
      setSignerBindings(bindingsFromEnvelopeRecipients(activeSigningEnvelope, signingTemplate));
      return;
    }
    setSignerBindings(
      buildIssuerEnvelopeBindings(
        signingTemplate,
        directorSourceOrganization,
        applicationRecord?.application_guarantors
      )
    );
  }, [
    activeSigningEnvelope,
    applicationRecord?.application_guarantors,
    directorSourceOrganization,
    isLoadingSigningEnvelopes,
    signingTemplate,
  ]);

  const contractDetails = (contractRecord as { contract_details?: Record<string, unknown> } | null)?.contract_details;
  const contractName =
    type === "contract"
      ? (contractDetails?.title ?? contractDetails?.contract_title
          ? String(contractDetails.title ?? contractDetails.contract_title)
          : "—")
      : invoice?.number ?? "Invoice financing";

  /** Contract end date from contract_details.end_date; invoice uses offer expiry. */
  const contractEndDate =
    type === "contract" && contractDetails?.end_date
      ? formatDateOrDash(String(contractDetails.end_date))
      : null;
  const contractStartDate =
    type === "contract" && contractDetails?.start_date ? formatDateOrDash(String(contractDetails.start_date)) : null;
  const contractValueNumber =
    type === "contract" &&
    contractDetails != null &&
    (contractDetails.contract_value != null || contractDetails.value != null)
      ? (() => {
          const raw = contractDetails.contract_value ?? contractDetails.value;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        })()
      : null;

  const invoiceMaturityDate =
    type === "invoice" && invoice?.maturityDate ? formatDateOrDash(String(invoice.maturityDate)) : null;

  const requestedFacilityNumber =
    type === "contract" && od?.requested_facility != null && Number.isFinite(Number(od.requested_facility))
      ? Number(od.requested_facility)
      : null;

  const requestedFinancingNumber =
    type === "invoice" && od?.requested_amount != null && Number.isFinite(Number(od.requested_amount))
      ? Number(od.requested_amount)
      : null;
  const offeredValue =
    type === "contract"
      ? od?.offered_facility != null
        ? formatCurrency(Number(od.offered_facility))
        : "—"
      : od?.offered_amount != null
        ? formatCurrency(Number(od.offered_amount))
        : "—";

  const expiresAt = od?.expires_at
    ? format(new Date(String(od.expires_at)), "d MMM yyyy")
    : "—";
  const dateLabel =
    type === "contract"
      ? contractEndDate
        ? "Contract end date"
        : "Expires"
      : "Expires";
  const dateValue = type === "contract" && contractEndDate ? contractEndDate : expiresAt;

  const profitRateDisplay =
    od?.offered_profit_rate_percent != null &&
    Number.isFinite(Number(od.offered_profit_rate_percent))
      ? `${Number(od.offered_profit_rate_percent)}%`
      : "—";

  const facilityFeeRatePercentNumber =
    type === "contract" &&
    od?.facility_fee_rate_percent != null &&
    Number.isFinite(Number(od.facility_fee_rate_percent))
      ? Number(od.facility_fee_rate_percent)
      : null;

  const offeredFacilityNumber =
    type === "contract" &&
    od?.offered_facility != null &&
    Number.isFinite(Number(od.offered_facility))
      ? Number(od.offered_facility)
      : null;

  const maximumFacilityFeeNumber =
    facilityFeeRatePercentNumber != null && offeredFacilityNumber != null
      ? offeredFacilityNumber * (facilityFeeRatePercentNumber / 100)
      : null;

  const isContractLinkedInvoice = type === "invoice" && !!contractId;

  const approvedFacilityAmountNumber =
    isContractLinkedInvoice && contractDetails?.approved_facility != null
      ? Number(contractDetails.approved_facility)
      : null;

  const contractFacilityFeeRatePercentNumber =
    isContractLinkedInvoice && contractDetails?.facility_fee_rate_percent != null
      ? Number(contractDetails.facility_fee_rate_percent)
      : null;

  const contractFacilityFeePaidAmountNumber =
    isContractLinkedInvoice && contractDetails?.facility_fee_paid_amount != null
      ? Number(contractDetails.facility_fee_paid_amount)
      : null;

  const facilityFeeRemainingAmountNumber =
    approvedFacilityAmountNumber != null &&
    contractFacilityFeeRatePercentNumber != null &&
    contractFacilityFeePaidAmountNumber != null &&
    Number.isFinite(approvedFacilityAmountNumber) &&
    Number.isFinite(contractFacilityFeeRatePercentNumber) &&
    Number.isFinite(contractFacilityFeePaidAmountNumber) &&
    contractFacilityFeeRatePercentNumber > 0
      ? Math.max(
          0,
          (approvedFacilityAmountNumber * contractFacilityFeeRatePercentNumber) / 100 -
            contractFacilityFeePaidAmountNumber
        )
      : null;

  const invoiceFinancingAmountNumber =
    type === "invoice" && od?.offered_amount != null ? Number(od.offered_amount) : null;

  const invoicePlatformFeeRatePercentNumber =
    type === "invoice" && od?.platform_fee_rate_percent != null ? Number(od.platform_fee_rate_percent) : null;

  const expectedFacilityFeeNumber =
    isContractLinkedInvoice &&
    facilityFeeRemainingAmountNumber != null &&
    invoiceFinancingAmountNumber != null &&
    contractFacilityFeeRatePercentNumber != null &&
    Number.isFinite(invoiceFinancingAmountNumber) &&
    Number.isFinite(contractFacilityFeeRatePercentNumber)
      ? Math.min(
          (invoiceFinancingAmountNumber * contractFacilityFeeRatePercentNumber) / 100,
          facilityFeeRemainingAmountNumber
        )
      : null;

  const expectedPlatformFeeNumber =
    invoiceFinancingAmountNumber != null &&
    invoicePlatformFeeRatePercentNumber != null &&
    Number.isFinite(invoiceFinancingAmountNumber) &&
    Number.isFinite(invoicePlatformFeeRatePercentNumber)
      ? (invoiceFinancingAmountNumber * invoicePlatformFeeRatePercentNumber) / 100
      : null;

  const facilityFeeEstimatedTooltip =
    expectedFacilityFeeNumber != null && expectedFacilityFeeNumber > 0
      ? "Deducted from disbursement when funding closes. For contract financing, this is collected progressively until the facility fee cap is reached."
      : "Deducted from disbursement when funding closes. For contract financing, this is collected progressively until the facility fee cap is reached. No facility fee applies here because the cap has already been reached.";

  const summarySecondLabel = type === "contract" ? "Approved facility:" : "Invoice value:";
  const summarySecondValue =
    type === "contract"
      ? offeredValue
      : invoice?.value != null && Number.isFinite(invoice.value)
        ? formatCurrency(invoice.value)
        : "—";

  const summaryThirdLabel = type === "contract" ? `${dateLabel}:` : "Profit rate (p.a.):";
  const summaryThirdValue = type === "contract" ? dateValue : profitRateDisplay;

  const handleDownload = async () => {
    if (type === "invoice" && !invoice?.id) {
      toast.error("Cannot download", {
        description: "Invoice ID is missing. Please refresh and try again.",
      });
      return;
    }
    setDownloading(true);
    try {
      const blob =
        type === "contract"
          ? await apiClient.getContractOfferLetterBlob(applicationId)
          : await apiClient.getInvoiceOfferLetterBlob(applicationId, invoice!.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        type === "contract"
          ? `contract-offer-${contractId}.pdf`
          : `invoice-offer-${invoice?.id ?? "letter"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Failed to download offer letter", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setDownloading(false);
    }
  };

  const resolvedDeclineReason = resolveIssuerOfferDeclineReason(selectedDeclineReason, rejectionReason);

  const handleReject = async () => {
    if (!resolvedDeclineReason) return;
    if (type === "contract") {
      try {
        await rejectContract.mutateAsync({ applicationId, reason: resolvedDeclineReason });
        toast.success("Offer declined");
        onClose();
      } catch {
        // toast handled by hook
      }
    } else {
      if (!invoice?.id) return;
      try {
        await rejectInvoice.mutateAsync({
          applicationId,
          invoiceId: invoice.id,
          reason: resolvedDeclineReason,
        });
        toast.success("Offer declined");
        onClose();
      } catch {
        // toast handled by hook
      }
    }
  };

  const sendSigningPackage = React.useCallback(async (): Promise<void> => {
    if (productId && isLoadingProduct) {
      throw new Error("Loading signing configuration. Please wait a moment.");
    }

    if (!useEnvelopeSigning) {
      throw new Error("Signing package is not configured for this product.");
    }

    const invoiceId = type === "invoice" ? invoice?.id : null;
    if (type === "invoice" && !invoiceId) {
      throw new Error("Invoice ID is missing. Please refresh and try again.");
    }

    const existingResponse = await apiClient.getSigningEnvelopes(applicationId);
    if (!existingResponse.success) {
      const err = getApiErrorDetails(existingResponse, "Failed to load signing package");
      throw new Error(err.message);
    }
    const targetEnvelope = findActiveSigningEnvelope(
      existingResponse.data,
      type,
      contractId,
      invoiceId
    );

    let envelope = targetEnvelope;
    if (envelope && !envelopeMatchesSignerBindings(envelope, signerBindings)) {
      throw new Error(
        "Signing was already started with different signers. Contact CashSouk support to reset the signing package."
      );
    }

    if (!envelope) {
      const createResponse = await apiClient.createIssuerSigningEnvelope(applicationId, {
        title: type === "contract" ? "Contract offer signing package" : "Invoice offer signing package",
        contractId: type === "contract" ? contractId ?? null : null,
        invoiceId,
        bindings: signerBindings,
      });
      if (!createResponse.success) {
        const err = getApiErrorDetails(createResponse, "Failed to create signing package");
        throw new Error(err.message);
      }
      envelope = createResponse.data;
    }

    if (envelope.status === "DRAFT") {
      const sendResponse = await apiClient.sendIssuerSigningEnvelope(envelope.id);
      if (!sendResponse.success) {
        const err = getApiErrorDetails(sendResponse, "Failed to send signing package");
        throw new Error(err.message);
      }
      envelope = sendResponse.data;
    }

    await queryClient.invalidateQueries({ queryKey: ["signing-envelopes", applicationId] });
    toast.success("Signing emails sent to all signers");
  }, [
    apiClient,
    applicationId,
    contractId,
    invoice?.id,
    isLoadingProduct,
    productId,
    queryClient,
    signerBindings,
    type,
    useEnvelopeSigning,
  ]);

  const ensurePostApplicationDocumentsSaved = React.useCallback(async (): Promise<boolean> => {
    if (productId && isLoadingProduct) {
      toast.info("Loading required documents. Please wait a moment.");
      return false;
    }
    if (!hasPostDocs) return true;
    if (!postDocsState.hasPendingChanges && !postDocsState.areAllFilesUploaded) {
      toast.error("Upload required documents before signing");
      return false;
    }
    if (!postDocsState.saveFunction || !postDocsState.hasPendingChanges) {
      return postDocsState.areAllFilesUploaded;
    }

    setIsSavingPostDocs(true);
    try {
      const saved = await postDocsState.saveFunction();
      const response = await apiClient.updateApplicationStep(applicationId, {
        stepId: "supporting_documents",
        stepNumber: 0,
        data: saved as Record<string, unknown>,
      });
      if (!response.success) {
        const err = getApiErrorDetails(response, "Could not save required documents");
        throw new Error(err.message);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["application", applicationId] }),
        queryClient.invalidateQueries({ queryKey: ["applications"] }),
        queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] }),
      ]);
      toast.success("Required documents saved");
      return true;
    } catch (error) {
      toast.error("Could not save required documents", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    } finally {
      setIsSavingPostDocs(false);
    }
  }, [
    apiClient,
    applicationId,
    hasPostDocs,
    isLoadingProduct,
    postDocsState,
    productId,
    queryClient,
  ]);

  const needsSigningConfirm =
    useEnvelopeSigning && !(type === "invoice" && !requiresInvoiceSigning);

  const signingConfirmDescription = React.useMemo(
    () => buildSigningConfirmDescription(signerBindings),
    [signerBindings]
  );

  const prepareAccept = async (): Promise<boolean> => {
    const invoiceId = invoice?.id;

    if (type === "invoice" && !invoiceId) {
      return false;
    }

    if (type === "invoice" && !requiresInvoiceSigning) {
      const docsReady = await ensurePostApplicationDocumentsSaved();
      if (!docsReady) return false;
      setAcceptSigningLoading(true);
      try {
        await acceptInvoice.mutateAsync({ applicationId, invoiceId: invoiceId! });
        toast.success("Offer accepted");
        onClose();
      } catch {
        // toast handled by hook
      } finally {
        setAcceptSigningLoading(false);
      }
      return false;
    }

    const docsReady = await ensurePostApplicationDocumentsSaved();
    if (!docsReady) return false;

    if (useEnvelopeSigning) {
      const bindingError = validateSignerBindings(signerBindings, signingTemplate);
      if (bindingError) {
        toast.error("Review signer details", { description: bindingError });
        return false;
      }
    }

    return true;
  };

  const executeAccept = async () => {
    setAcceptSigningLoading(true);
    try {
      await sendSigningPackage();
    } catch (e) {
      const err = getApiErrorDetails(e, "Could not send signing package");
      toast.error("Could not send signing package", {
        description: err.message,
      });
    } finally {
      setAcceptSigningLoading(false);
    }
  };

  const handleAccept = async () => {
    const ready = await prepareAccept();
    if (!ready) return;

    if (needsSigningConfirm) {
      setSignerConfirmOpen(true);
      return;
    }

    await executeAccept();
  };

  const handleConfirmSignersAccept = async () => {
    setSignerConfirmOpen(false);
    await executeAccept();
  };

  const handleResendReminders = async () => {
    if (!activeSigningEnvelope || !canRemindSigners) return;
    const unsigned = activeSigningEnvelope.recipients.filter((r) => r.status !== "SIGNED");
    if (unsigned.length === 0) {
      toast.info("All signers have already signed.");
      return;
    }

    setRemindLoading(true);
    try {
      for (const recipient of unsigned) {
        const response = await apiClient.remindIssuerSigningRecipient(
          activeSigningEnvelope.id,
          recipient.id
        );
        if (!response.success) {
          const err = getApiErrorDetails(response, "Failed to send reminder");
          throw new Error(err.message);
        }
      }
      toast.success(
        unsigned.length === 1
          ? `Reminder sent to ${unsigned[0].name}`
          : `Reminders sent to ${unsigned.length} signers`
      );
    } catch (e) {
      toast.error("Could not send reminders", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setRemindLoading(false);
    }
  };

  const handleRemindRecipient = async (recipientId: string) => {
    if (!activeSigningEnvelope || !canRemindSigners) return;
    setRemindLoading(true);
    try {
      const response = await apiClient.remindIssuerSigningRecipient(
        activeSigningEnvelope.id,
        recipientId
      );
      if (!response.success) {
        const err = getApiErrorDetails(response, "Failed to send reminder");
        throw new Error(err.message);
      }
      const recipient = activeSigningEnvelope.recipients.find((r) => r.id === recipientId);
      toast.success(recipient ? `Reminder sent to ${recipient.name}` : "Reminder sent");
    } catch (e) {
      toast.error("Could not send reminder", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setRemindLoading(false);
    }
  };

  const handleAcceptOverride = async () => {
    setAcceptOverrideLoading(true);
    try {
      if (type === "contract") {
        const res = await apiClient.acceptContractOffer(applicationId, { skipSigning: true });
        if (!res.success) {
          const err = res as ApiError;
          throw new Error(err.error?.message ?? "Failed to accept contract offer");
        }
      } else {
        if (!invoice?.id) return;
        const res = await apiClient.acceptInvoiceOffer(applicationId, invoice.id, {
          skipSigning: true,
        });
        if (!res.success) {
          const err = res as ApiError;
          throw new Error(err.error?.message ?? "Failed to accept invoice offer");
        }
      }

      toast.success("Offer accepted (signing skipped)");
      onClose();
    } catch (e) {
      toast.error("Could not accept offer without signing", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setAcceptOverrideLoading(false);
    }
  };

  const isPending =
    acceptSigningLoading ||
    acceptOverrideLoading ||
    isSavingPostDocs ||
    remindLoading ||
    acceptInvoice.isPending ||
    rejectContract.isPending ||
    rejectInvoice.isPending;
  const confirmDeclineDisabled =
    isPending ||
    !selectedDeclineReason ||
    (isOtherDeclineReason && rejectionReason.trim() === "");

  const canDownload =
    type === "contract" || (type === "invoice" && !!invoice?.id);
  const isPostDocsConfigLoading = Boolean(productId) && isLoadingProduct;
  const postDocsReady = !hasPostDocs || postDocsState.areAllFilesUploaded;
  const updateSignerBinding = (index: number, updates: Partial<RecipientBinding>) => {
    setSignerBindings((prev) =>
      prev.map((binding, i) => (i === index ? { ...binding, ...updates } : binding))
    );
  };
  const removeSignerBinding = (index: number) => {
    setSignerBindings((prev) => prev.filter((_, i) => i !== index));
  };
  const addSignerBinding = (role: SigningTemplateRole) => {
    setSignerBindings((prev) => {
      const usedDirectorKeys = new Set(
        prev
          .filter((binding) => binding.role_key === role.key)
          .map((binding) => resolveBindingDirectorKey(issuerDirectors, binding))
          .filter(Boolean)
      );
      const nextDirector = issuerDirectors.find((director) => !usedDirectorKeys.has(director.matchKey));
      return [
        ...prev,
        {
          role_key: role.key,
          name: nextDirector?.name ?? "",
          email: nextDirector?.email ?? "",
          ic_number: nextDirector?.ic_number ?? null,
        },
      ];
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl border-border p-6 gap-0 sm:max-w-[720px]">
        <DialogTitle className="sr-only">
          Financing offer approved — Review and respond
        </DialogTitle>
        <DialogDescription className="sr-only">
          Review the financing offer and accept or decline.
        </DialogDescription>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8">Loading offer...</p>
        ) : (
          <>
            <div className="flex flex-col items-center text-center mb-6">
              <div
                className="w-[74px] h-[74px] rounded-full flex items-center justify-center mb-4 shadow-none"
                style={{ background: "#ececec", boxShadow: "none", filter: "none" }}
              >
                <div
                  className="w-[66px] h-[66px] rounded-full flex items-center justify-center shadow-none"
                  style={{ background: "#c4c4c4", boxShadow: "none", filter: "none" }}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center shadow-none"
                    style={{ background: "#000000", boxShadow: "none", filter: "none" }}
                  >
                    <CheckIcon className="h-7 w-7 text-white" />
                  </div>
                </div>
              </div>
              <p className="text-base font-semibold text-foreground">
                Congratulations! Your {type === "contract" ? "contract" : "invoice"} financing request
              </p>
              <p className="text-3xl sm:text-4xl font-extrabold text-status-success-text tracking-tight mt-2">
                {offeredValue}
              </p>
              <p className="text-base font-semibold text-foreground mt-1">
                has been approved
              </p>
            </div>

            {type === "contract" ? (
              <>
                <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm py-4 border-y border-border">
                  <dt className="text-muted-foreground font-medium">Contract name:</dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">
                    {contractName}
                  </dd>

                  {contractValueNumber != null ? (
                    <>
                      <dt className="text-muted-foreground font-medium">Contract value:</dt>
                      <dd className="font-medium text-foreground text-right tabular-nums">
                        {formatCurrency(contractValueNumber)}
                      </dd>
                    </>
                  ) : null}

                  {requestedFacilityNumber != null ? (
                    <>
                      <dt className="text-muted-foreground font-medium">Requested facility:</dt>
                      <dd className="font-medium text-foreground text-right tabular-nums">
                        {formatCurrency(requestedFacilityNumber)}
                      </dd>
                    </>
                  ) : null}

                  <dt className="text-muted-foreground font-medium">Contract period:</dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">
                    {contractStartDate != null && contractEndDate != null ? `${contractStartDate} – ${contractEndDate}` : "—"}
                  </dd>

                  <dt className="text-muted-foreground font-medium inline-flex items-center gap-1.5">
                    Facility fee rate:
                    <InfoTooltip content={CONTRACT_FACILITY_FEE_RATE_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
                  </dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">
                    {facilityFeeRatePercentNumber != null ? `${facilityFeeRatePercentNumber}%` : "—"}
                  </dd>

                  <dt className="text-muted-foreground font-medium inline-flex items-center gap-1.5">
                    Facility fee cap:
                    <InfoTooltip content={CONTRACT_FACILITY_FEE_CAP_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
                  </dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">
                    {maximumFacilityFeeNumber != null ? formatCurrency(maximumFacilityFeeNumber) : "—"}
                  </dd>
                </dl>
              </>
            ) : (
              <>
                <dl
                  className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-sm py-4 border-y border-border"
                >
                  <dt className="text-muted-foreground font-medium">Invoice number:</dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">{contractName}</dd>

                  <dt className="text-muted-foreground font-medium">{summarySecondLabel}</dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">{summarySecondValue}</dd>

                  {requestedFinancingNumber != null ? (
                    <>
                      <dt className="text-muted-foreground font-medium">Requested financing:</dt>
                      <dd className="font-medium text-foreground text-right tabular-nums">
                        {formatCurrency(requestedFinancingNumber)}
                      </dd>
                    </>
                  ) : null}

                  {invoiceMaturityDate != null ? (
                    <>
                      <dt className="text-muted-foreground font-medium">Maturity date</dt>
                      <dd className="font-medium text-foreground text-right tabular-nums">{invoiceMaturityDate}</dd>
                    </>
                  ) : null}

                  <dt className="text-muted-foreground font-medium inline-flex items-center gap-1.5">
                    {summaryThirdLabel}
                    <InfoTooltip content={PROFIT_RATE_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
                  </dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">{summaryThirdValue}</dd>

                  <dt className="text-muted-foreground font-medium inline-flex items-center gap-1.5">
                    Platform fee
                    <InfoTooltip content={PLATFORM_FEE_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
                  </dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">
                    {expectedPlatformFeeNumber != null ? formatCurrency(expectedPlatformFeeNumber) : "—"}
                  </dd>

                  <dt className="text-muted-foreground font-medium inline-flex items-center gap-1.5">
                    Estimated facility fee
                    <InfoTooltip content={facilityFeeEstimatedTooltip} iconClassName="h-3.5 w-3.5 shrink-0" />
                  </dt>
                  <dd className="font-medium text-foreground text-right tabular-nums">
                    {expectedFacilityFeeNumber != null ? formatCurrency(expectedFacilityFeeNumber) : "—"}
                  </dd>
                </dl>
              </>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={!canDownload || downloading}
              className="w-full min-h-[56px] rounded-xl border border-border bg-muted/30 hover:bg-muted/50 flex items-center justify-center gap-3 px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              <span className="rounded-lg border border-border bg-background p-2">
                <ArrowDownTrayIcon className="h-5 w-5 text-foreground" />
              </span>
              <span className="text-base font-semibold text-foreground">
                {downloading ? "Downloading…" : "Download offer letter"}
              </span>
            </button>

            {hasPostDocs ? (
              <div className="mt-4 rounded-2xl border border-border bg-muted/15 p-4">
                <div className="space-y-1 pb-3">
                  <p className="text-base font-semibold text-foreground">
                    Required documents before signing
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Upload the post-application documents requested for this product before you sign the offer.
                  </p>
                </div>
                {isLoadingProduct ? (
                  <p className="text-sm text-muted-foreground">Loading required documents...</p>
                ) : supportingDocumentsStepConfig ? (
                  <SupportingDocumentsStep
                    applicationId={applicationId}
                    stepConfig={supportingDocumentsStepConfig}
                    timingFilter="post_application"
                    onDataChange={(data) => {
                      setPostDocsState({
                        areAllFilesUploaded: data.areAllFilesUploaded === true,
                        hasPendingChanges: data.hasPendingChanges === true,
                        saveFunction:
                          typeof data.saveFunction === "function"
                            ? (data.saveFunction as () => Promise<unknown>)
                            : undefined,
                      });
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No post-application document configuration was found.
                  </p>
                )}
                {!postDocsReady ? (
                  <p className="mt-3 text-sm font-medium text-destructive">
                    Upload all required documents before accepting this offer.
                  </p>
                ) : null}
              </div>
            ) : null}

            {useEnvelopeSigning ? (
              <div className="mt-4 rounded-2xl border border-border bg-muted/15 p-4">
                <div className="space-y-1 pb-3">
                  <p className="text-base font-semibold text-foreground">
                    {showSigningProgress ? "Signing progress" : "Signing package signers"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {showSigningProgress
                      ? "Track who has signed each document. Reminders can be sent to signers who have not completed signing yet."
                      : signersLocked
                        ? "This signing package has already been sent. Signers cannot be changed here."
                        : "Review who will sign each configured role. Signing emails will be sent to every signer."}
                  </p>
                </div>

                {showSigningProgress && activeSigningEnvelope ? (
                  <div className="space-y-4">
                    <SigningProgressMatrix envelope={activeSigningEnvelope} />
                    {canRemindSigners ? (
                      <RecipientReminders
                        envelope={activeSigningEnvelope}
                        onRemind={handleRemindRecipient}
                        disabled={remindLoading}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {signingTemplate.roles.map((role) => {
                      const roleBindings = signerBindings
                        .map((binding, index) => ({ binding, index }))
                        .filter(({ binding }) => binding.role_key === role.key);
                      const canAdd =
                        !signersLocked &&
                        (role.max_count == null || roleBindings.length < role.max_count);
                      const useDirectorDropdown =
                        isDirectorRole(role) && issuerDirectors.length > 0;

                      return (
                        <div key={role.key} className="space-y-2 rounded-xl border border-border bg-background p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{role.label || role.key}</p>
                              <p className="text-xs text-muted-foreground">
                                {useDirectorDropdown ? "Issuer director" : "Signer"}
                                {role.min_count > 0 ? ` · minimum ${role.min_count}` : ""}
                                {role.max_count != null ? ` · maximum ${role.max_count}` : ""}
                              </p>
                            </div>
                            {canAdd ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => addSignerBinding(role)}
                              >
                                Add signer
                              </Button>
                            ) : null}
                          </div>
                          {roleBindings.length === 0 ? (
                            <p className="text-sm text-destructive">Add at least one signer for this role.</p>
                          ) : (
                            <div className="space-y-2">
                              {roleBindings.map(({ binding, index }) => {
                                const selectedDirectorKey = resolveBindingDirectorKey(
                                  issuerDirectors,
                                  binding
                                );
                                const usedDirectorKeys = new Set(
                                  roleBindings
                                    .filter(({ index: rowIndex }) => rowIndex !== index)
                                    .map(({ binding: rowBinding }) =>
                                      resolveBindingDirectorKey(issuerDirectors, rowBinding)
                                    )
                                    .filter(Boolean)
                                );
                                const selectableDirectors = issuerDirectors.filter(
                                  (director) =>
                                    director.matchKey === selectedDirectorKey ||
                                    !usedDirectorKeys.has(director.matchKey)
                                );

                                return (
                                  <div key={`${role.key}-${index}`}>
                                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                      {useDirectorDropdown ? (
                                        <Select
                                          value={selectedDirectorKey || undefined}
                                          disabled={signersLocked}
                                          onValueChange={(matchKey) => {
                                            const director = issuerDirectors.find(
                                              (item) => item.matchKey === matchKey
                                            );
                                            if (!director) return;
                                            updateSignerBinding(index, {
                                              name: director.name,
                                              email: director.email,
                                              ic_number: director.ic_number,
                                            });
                                          }}
                                        >
                                          <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select director" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {selectableDirectors.map((director) => (
                                              <SelectItem key={director.matchKey} value={director.matchKey}>
                                                {director.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input
                                          value={binding.name}
                                          onChange={(event) =>
                                            updateSignerBinding(index, { name: event.target.value })
                                          }
                                          placeholder="Full name"
                                          disabled={signersLocked}
                                          className="rounded-xl"
                                        />
                                      )}
                                      <Input
                                        value={binding.email}
                                        onChange={(event) =>
                                          updateSignerBinding(index, { email: event.target.value })
                                        }
                                        placeholder="Email"
                                        type="email"
                                        readOnly={useDirectorDropdown || signersLocked}
                                        disabled={useDirectorDropdown || signersLocked}
                                        tabIndex={useDirectorDropdown ? -1 : undefined}
                                        className={cn(
                                          "rounded-xl",
                                          useDirectorDropdown && "bg-muted select-none"
                                        )}
                                      />
                                      {!signersLocked ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="rounded-xl text-muted-foreground hover:text-destructive"
                                          onClick={() => removeSignerBinding(index)}
                                        >
                                          Remove
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  setIsRejectMode((prev) => {
                    if (prev) {
                      setRejectionReason("");
                      setSelectedDeclineReason("");
                    }
                    return !prev;
                  })
                }
                disabled={isPending || isPostDocsConfigLoading}
                className={
                  isRejectMode
                    ? "h-12 rounded-xl border-[#f0caca] bg-[#f9e2e2] text-[#CE2922] hover:bg-[#f5d5d5]"
                    : "h-12 rounded-xl border-border bg-[#e9edf2] text-foreground hover:bg-[#dde4eb]"
                }
              >
                Decline offer
              </Button>
              <Button
                size="lg"
                onClick={signersLocked ? handleResendReminders : handleAccept}
                disabled={isPending || isPostDocsConfigLoading}
                className="h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm"
              >
                {isSavingPostDocs
                  ? "Saving documents..."
                  : remindLoading
                    ? "Sending reminders..."
                    : acceptSigningLoading
                      ? "Sending signing emails..."
                      : type === "invoice" && !requiresInvoiceSigning
                        ? "Accept offer"
                        : signersLocked
                          ? "Resend reminders"
                          : "Accept and send for signing"}
              </Button>
            </div>
            {isSigningOverrideEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcceptOverride}
                disabled={isPending}
                className="mt-3 h-9 rounded-xl border-dashed border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                Accept without signing (local override)
              </Button>
            )}

            {isRejectMode && (
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="decline-primary-reason" className="block text-base font-semibold text-foreground">
                    Reason (required)
                  </Label>
                  <Select
                    value={selectedDeclineReason}
                    onValueChange={(value) => {
                      setSelectedDeclineReason(value);
                      if (value !== OTHER_ISSUER_DECLINE_REASON_VALUE) {
                        setRejectionReason("");
                      }
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger
                      id="decline-primary-reason"
                      className="h-12 rounded-xl border-border bg-[#f9fafb] focus:ring-4 focus:ring-primary/10"
                    >
                      <SelectValue placeholder="Select a primary reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUER_OFFER_DECLINE_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER_ISSUER_DECLINE_REASON_VALUE}>
                        Other (manual reason)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason" className="block text-base font-semibold text-foreground">
                    {isOtherDeclineReason
                      ? "Additional context (required)"
                      : "Additional context (optional)"}
                  </Label>
                  <TextareaWithCharCount
                    id="rejection-reason"
                    placeholder={
                      isOtherDeclineReason
                        ? "Enter the primary reason and any details."
                        : "Add any extra details (optional)."
                    }
                    value={rejectionReason}
                    onChange={(e) =>
                      setRejectionReason(e.target.value.slice(0, DECLINE_CONTEXT_MAX))
                    }
                    rows={4}
                    className="min-h-[92px] resize-none rounded-xl border-border bg-[#f9fafb] px-4 py-3.5 focus:border-primary/35 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10"
                    maxLength={DECLINE_CONTEXT_MAX}
                    countLabel={`${rejectionReason.length}/${DECLINE_CONTEXT_MAX} characters`}
                    disabled={isPending}
                  />
                </div>
              </div>
            )}

            <div
              className={`mt-6 flex gap-3 ${isRejectMode ? "flex-row flex-wrap items-center justify-between" : "flex-wrap items-center justify-center"}`}
            >
              <p
                className={`text-sm text-muted-foreground ${isRejectMode ? "flex-1 min-w-0 text-left" : "text-center flex-1 min-w-0"}`}
              >
                {isRejectMode ? (
                  <>
                    Please respond to this offer by
                    <br />
                    {expiresAt}.
                  </>
                ) : (
                  <>Please respond to this offer by {expiresAt}.</>
                )}
              </p>
              {isRejectMode && (
                <Button
                  size="sm"
                  onClick={handleReject}
                  disabled={confirmDeclineDisabled}
                  className="inline-flex h-9 min-h-[36px] items-center justify-center gap-2 rounded-xl border border-[#e3e8ee] bg-[#edf1f5] px-3.5 text-[15px] font-medium text-[#444] hover:bg-[#e6ebf0]"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Confirm decline
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
      <ConfirmDialog
        open={signerConfirmOpen}
        onOpenChange={setSignerConfirmOpen}
        title="Confirm signers"
        description={signingConfirmDescription}
        confirmText="Accept and send for signing"
        cancelText="Go back"
        onConfirm={handleConfirmSignersAccept}
        isLoading={acceptSigningLoading}
      />
    </Dialog>
  );
}
