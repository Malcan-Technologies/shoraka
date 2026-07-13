"use client";

/**
 * Modal for reviewing contract or invoice offers. Issuer can download offer letter,
 * accept, or decline. CashSouk brand styling per BRANDING.md.
 * Contract end date uses contract_details.end_date; offer expiry shown in the sidebar.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { SupportingDocumentsStep } from "@/app/(application-flow)/applications/steps/supporting-documents-step";
import { SupportingDocumentsSkeleton } from "@/app/(application-flow)/applications/components/supporting-documents-skeleton";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon as CheckIconSolid } from "@heroicons/react/24/solid";
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
  computeSigningEnvelopeProgress,
} from "@cashsouk/types";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SigningProgressMatrix } from "@/components/signing/signing-progress-matrix";
import { SigningProgressStepper } from "@/components/signing/signing-progress-stepper";
import {
  getCurrentSigningOfferStepId,
  findSupportingDocumentsStepConfig,
  getSigningOfferSteps,
  hasPostApplicationDocuments,
  isSigningOfferStepReachable,
  type SigningOfferStepId,
} from "@/lib/signing-offer-steps";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const result: ApplicationGuarantorRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const guarantor = row as Record<string, unknown>;
    const id = typeof guarantor.id === "string" ? guarantor.id : "";
    if (!id) continue;
    result.push({
      id,
      name: typeof guarantor.name === "string" ? guarantor.name : null,
      business_name:
        typeof guarantor.business_name === "string" ? guarantor.business_name : null,
      email: typeof guarantor.email === "string" ? guarantor.email : "",
      ic_number: typeof guarantor.ic_number === "string" ? guarantor.ic_number : null,
    });
  }
  return result;
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
        // Guarantors self-declare IC on the signing link; never pre-bind from application.
        ic_number: null,
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

type SigningDocumentGroup = {
  key: string;
  name: string;
  roleKeys: string[];
};

function signingDocumentGroups(template: SigningTemplateConfig): SigningDocumentGroup[] {
  const groups: SigningDocumentGroup[] = template.documents.map((doc) => ({
    key: doc.key,
    name: doc.name,
    roleKeys: doc.signer_role_keys,
  }));
  // Roles with no document mapping still need a place to configure signers.
  const covered = new Set(groups.flatMap((group) => group.roleKeys));
  const uncovered = template.roles.filter((role) => !covered.has(role.key));
  if (uncovered.length > 0) {
    groups.push({
      key: "_unassigned_roles",
      name: "Other signers",
      roleKeys: uncovered.map((role) => role.key),
    });
  }
  return groups;
}

function roleCountSubtitle(role: SigningTemplateRole): string {
  const parts: string[] = [];
  if (role.min_count > 0) parts.push(`min. ${role.min_count}`);
  if (role.max_count != null) parts.push(`max. ${role.max_count}`);
  return parts.join(" · ");
}

type SigningConfirmSigner = {
  name: string;
  email: string;
  roleLabel: string;
};

type SigningConfirmDocumentGroup = {
  key: string;
  name: string;
  signers: SigningConfirmSigner[];
};

function buildSigningConfirmGroups(
  bindings: RecipientBinding[],
  template: SigningTemplateConfig
): SigningConfirmDocumentGroup[] {
  const groups = signingDocumentGroups(template).filter(
    (group) => group.key !== "_unassigned_roles"
  );
  const assignedRoleKeys = new Set(bindings.map((binding) => binding.role_key));
  const coveredRoleKeys = new Set(groups.flatMap((group) => group.roleKeys));
  const uncoveredRoleKeys = [...assignedRoleKeys].filter((roleKey) => !coveredRoleKeys.has(roleKey));
  if (uncoveredRoleKeys.length > 0) {
    groups.push({
      key: "_unassigned_roles",
      name: "Other documents",
      roleKeys: uncoveredRoleKeys,
    });
  }

  return groups
    .map((group) => {
      const seen = new Set<string>();
      const signers: SigningConfirmSigner[] = [];
      for (const binding of bindings) {
        if (!group.roleKeys.includes(binding.role_key)) continue;
        const role = template.roles.find((item) => item.key === binding.role_key);
        const name = binding.name.trim() || "Unnamed signer";
        const email = binding.email.trim();
        const roleLabel = role?.label || binding.role_key;
        const dedupeKey = `${binding.role_key}|${name.toLowerCase()}|${email.toLowerCase()}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        signers.push({ name, email, roleLabel });
      }
      return { key: group.key, name: group.name, signers };
    })
    .filter((group) => group.signers.length > 0);
}

function findActiveSigningEnvelope(
  envelopes: SigningEnvelopeDto[],
  offerType: "contract" | "invoice",
  contractId: string | undefined,
  invoiceId: string | null | undefined
): SigningEnvelopeDto | null {
  return (
    envelopes.find((envelope) => {
      // VOIDED/DECLINED/EXPIRED unlock prep; COMPLETED stays locked for review (NAV-03/NAV-04).
      if (["VOIDED", "DECLINED", "EXPIRED"].includes(envelope.status)) return false;
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

/** Only mounted when Review Offer is clicked. Renders once, no isOpen toggle to avoid flash. */
export function ReviewOfferModal({
  type,
  applicationId,
  issuerOrganizationId: issuerOrganizationIdProp,
  productId: _unusedProductId,
  contractId,
  invoice,
  requiresInvoiceSigning = true,
  onClose,
}: ReviewOfferModalProps) {
  // productId kept in props for callers; signing/post-docs use frozen application workflow.
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const issuerOrganizationId = issuerOrganizationIdProp ?? activeOrganization?.id;
  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );
  // Frozen product.workflow for this application (application.product_version) — not the live catalog row.
  const {
    data: frozenProductWorkflow,
    isLoading: isLoadingFrozenProductWorkflow,
  } = useQuery({
    queryKey: ["signing-product-workflow", applicationId],
    queryFn: async () => {
      const response = await apiClient.getIssuerApplicationSigningProductWorkflow(applicationId);
      if (!response.success) {
        throw new Error(
          getApiErrorDetails(response, "Failed to load signing product configuration").message
        );
      }
      return response.data;
    },
    enabled: Boolean(applicationId),
  });
  const supportingDocumentsStepConfig = React.useMemo(
    () => findSupportingDocumentsStepConfig(frozenProductWorkflow?.workflow),
    [frozenProductWorkflow]
  );
  const hasPostDocs = React.useMemo(
    () => hasPostApplicationDocuments(supportingDocumentsStepConfig),
    [supportingDocumentsStepConfig]
  );
  const signingTemplate = React.useMemo(
    () => readSigningTemplate(frozenProductWorkflow?.workflow),
    [frozenProductWorkflow]
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
  // Keep save fn in a ref so SupportingDocumentsStep's onDataChange can stay stable
  // (inline setState + changing saveFunction identity caused max update depth).
  const postDocsSaveRef = React.useRef<(() => Promise<unknown>) | undefined>(undefined);
  const handlePostDocsDataChange = React.useCallback((data: Record<string, unknown>) => {
    if (typeof data.saveFunction === "function") {
      postDocsSaveRef.current = data.saveFunction as () => Promise<unknown>;
    }
    const areAllFilesUploaded = data.areAllFilesUploaded === true;
    const hasPendingChanges = data.hasPendingChanges === true;
    setPostDocsState((prev) => {
      if (
        prev.areAllFilesUploaded === areAllFilesUploaded &&
        prev.hasPendingChanges === hasPendingChanges
      ) {
        return prev;
      }
      return { areAllFilesUploaded, hasPendingChanges };
    });
  }, []);
  const [isSavingPostDocs, setIsSavingPostDocs] = React.useState(false);
  const [signerBindings, setSignerBindings] = React.useState<RecipientBinding[]>([]);
  const [signerConfirmOpen, setSignerConfirmOpen] = React.useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = React.useState(false);
  const [remindLoading, setRemindLoading] = React.useState(false);
  const [isSyncingSigning, setIsSyncingSigning] = React.useState(false);
  // Viewed step stickiness (D-05–D-07): domain progress stays in currentSigningStepId.
  const [viewedStepId, setViewedStepId] = React.useState<SigningOfferStepId | null>(null);
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
        guarantorsFromApplication(applicationRecord?.application_guarantors)
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
    if (isLoadingFrozenProductWorkflow) {
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
    isLoadingFrozenProductWorkflow,
    queryClient,
    signerBindings,
    type,
    useEnvelopeSigning,
  ]);

  const ensurePostApplicationDocumentsSaved = React.useCallback(async (): Promise<boolean> => {
    if (signersLocked) return true;
    if (isLoadingFrozenProductWorkflow) {
      toast.info("Loading required documents. Please wait a moment.");
      return false;
    }
    if (!hasPostDocs) return true;
    if (!postDocsState.hasPendingChanges && !postDocsState.areAllFilesUploaded) {
      toast.error("Upload required documents before signing");
      return false;
    }
    if (!postDocsSaveRef.current || !postDocsState.hasPendingChanges) {
      return postDocsState.areAllFilesUploaded;
    }

    setIsSavingPostDocs(true);
    try {
      const saved = await postDocsSaveRef.current();
      // Schema requires stepNumber >= 1; Math.max on the API keeps last_completed_step unchanged.
      const stepNumber = Math.max(1, applicationRecord?.last_completed_step ?? 1);
      const response = await apiClient.updateApplicationStep(applicationId, {
        stepId: "supporting_documents",
        stepNumber,
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
    applicationRecord?.last_completed_step,
    hasPostDocs,
    isLoadingFrozenProductWorkflow,
    postDocsState,
    queryClient,
    signersLocked,
  ]);

  const needsSigningConfirm =
    useEnvelopeSigning && !(type === "invoice" && !requiresInvoiceSigning);

  const signingConfirmGroups = React.useMemo(
    () => buildSigningConfirmGroups(signerBindings, signingTemplate),
    [signerBindings, signingTemplate]
  );

  const signingConfirmDescription = (
    <div className="space-y-4 text-left">
      <p>
        Signing emails with secure links will be sent to the people below.
      </p>
      {signingConfirmGroups.length === 0 ? (
        <p>No signers have been assigned yet.</p>
      ) : (
        <div className="space-y-3">
          {signingConfirmGroups.map((group) => (
            <div
              key={group.key}
              className="rounded-xl border border-border bg-muted/30 px-3 py-2.5"
            >
              <p className="text-sm font-semibold text-foreground">{group.name}</p>
              <ul className="mt-2 space-y-1.5">
                {group.signers.map((signer) => (
                  <li
                    key={`${group.key}-${signer.roleLabel}-${signer.email || signer.name}`}
                    className="text-sm"
                  >
                    <span className="font-medium text-foreground">{signer.name}</span>
                    <span className="text-muted-foreground"> · {signer.roleLabel}</span>
                    {signer.email ? (
                      <span className="block text-xs text-muted-foreground">{signer.email}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
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
  const isPostDocsConfigLoading = isLoadingFrozenProductWorkflow;
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
      if (isDirectorRole(role) && issuerDirectors.length > 0) {
        const usedDirectorKeys = new Set(
          prev
            .filter((binding) => binding.role_key === role.key)
            .map((binding) => resolveBindingDirectorKey(issuerDirectors, binding))
            .filter(Boolean)
        );
        const nextDirector = issuerDirectors.find(
          (director) => !usedDirectorKeys.has(director.matchKey)
        );
        return [
          ...prev,
          {
            role_key: role.key,
            name: nextDirector?.name ?? "",
            email: nextDirector?.email ?? "",
            ic_number: nextDirector?.ic_number ?? null,
          },
        ];
      }

      return [
        ...prev,
        {
          role_key: role.key,
          name: "",
          email: "",
          ic_number: null,
        },
      ];
    });
  };

  const envelopeProgress = activeSigningEnvelope
    ? computeSigningEnvelopeProgress(activeSigningEnvelope)
    : null;
  const allDocsSigned =
    envelopeProgress != null &&
    envelopeProgress.total_required > 0 &&
    envelopeProgress.signed === envelopeProgress.total_required;
  const envelopeCompleted = activeSigningEnvelope?.status === "COMPLETED";
  const currentSigningStepId = getCurrentSigningOfferStepId({
    hasPostDocs,
    postDocsReady,
    signersLocked,
    allDocsSigned,
    envelopeCompleted,
  });
  const signingSteps = getSigningOfferSteps({
    hasPostDocs,
    postDocsReady,
    signersLocked,
    allDocsSigned,
    envelopeCompleted,
  });

  // D-06: recompute viewed step on each open/reopen (applicationId change), never restore prior session.
  React.useEffect(() => {
    setViewedStepId(null);
    postDocsSaveRef.current = undefined;
    setPostDocsState({ areAllFilesUploaded: false, hasPendingChanges: false });
  }, [applicationId]);

  // D-05 smart land once workflow settles; do not re-sync when postDocsReady flips (D-07).
  React.useEffect(() => {
    if (isLoadingFrozenProductWorkflow || viewedStepId !== null) return;
    setViewedStepId(
      getCurrentSigningOfferStepId({
        hasPostDocs,
        postDocsReady,
        signersLocked,
        allDocsSigned,
        envelopeCompleted,
      })
    );
  }, [
    isLoadingFrozenProductWorkflow,
    viewedStepId,
    hasPostDocs,
    postDocsReady,
    signersLocked,
    allDocsSigned,
    envelopeCompleted,
  ]);

  // D-13: if domain retreats (e.g. required doc removed), snap viewed step back — never auto-advance (D-14).
  React.useEffect(() => {
    if (viewedStepId == null) return;
    if (!isSigningOfferStepReachable(viewedStepId, currentSigningStepId, hasPostDocs)) {
      setViewedStepId(currentSigningStepId);
    }
  }, [viewedStepId, currentSigningStepId, hasPostDocs]);

  // While frozen workflow loads, force documents shell + skeleton (D-03) — hasPostDocs is fail-closed false.
  const displaySigningStepId: SigningOfferStepId = isLoadingFrozenProductWorkflow
    ? "documents"
    : (viewedStepId ?? currentSigningStepId);

  // Close without auto-save; discard confirm when Upload has pending changes (D-11).
  const requestClose = React.useCallback(() => {
    if (displaySigningStepId === "documents" && postDocsState.hasPendingChanges) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  }, [displaySigningStepId, onClose, postDocsState.hasPendingChanges]);

  // D-09/D-10: persist pending post-app uploads before leaving Upload; block nav on save failure.
  const navigateFromUploadDocuments = React.useCallback(
    async (targetStepId: SigningOfferStepId) => {
      if (targetStepId === displaySigningStepId) return;
      if (displaySigningStepId !== "documents" || signersLocked) {
        setViewedStepId(targetStepId);
        return;
      }
      const saved = await ensurePostApplicationDocumentsSaved();
      if (!saved) return;
      setViewedStepId(targetStepId);
    },
    [displaySigningStepId, ensurePostApplicationDocumentsSaved, signersLocked]
  );

  // Free-nav within domain cursor (D-01–D-04); leave-Upload persists via navigateFromUploadDocuments (D-09/D-10).
  const handleSigningStepSelect = (stepId: SigningOfferStepId) => {
    if (stepId === displaySigningStepId) return;
    if (!isSigningOfferStepReachable(stepId, currentSigningStepId, hasPostDocs)) return;
    void navigateFromUploadDocuments(stepId);
  };

  const handleRefreshSigning = () => {
    void (async () => {
      if (activeSigningEnvelope?.id) {
        setIsSyncingSigning(true);
        try {
          await apiClient.syncIssuerSigningEnvelopeFromProvider(activeSigningEnvelope.id);
        } catch {
          // Still refetch local state if provider sync fails.
        } finally {
          setIsSyncingSigning(false);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["signing-envelopes", applicationId] });
    })();
  };

  // Label/value stack reads better in the sidebar than a cramped two-column dl.
  const offerDetailsList =
    type === "contract" ? (
      <dl className="space-y-3 text-sm">
        <div className="space-y-1">
          <dt className="text-muted-foreground">Contract name</dt>
          <dd className="font-medium break-words">{contractName}</dd>
        </div>
        {contractValueNumber != null ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Contract value</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(contractValueNumber)}</dd>
          </div>
        ) : null}
        {requestedFacilityNumber != null ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Requested facility</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(requestedFacilityNumber)}</dd>
          </div>
        ) : null}
        <div className="space-y-1">
          <dt className="text-muted-foreground">Contract period</dt>
          <dd className="font-medium tabular-nums">
            {contractStartDate != null && contractEndDate != null
              ? `${contractStartDate} – ${contractEndDate}`
              : "—"}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground inline-flex items-center gap-1">
            Facility fee rate
            <InfoTooltip content={CONTRACT_FACILITY_FEE_RATE_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
          </dt>
          <dd className="font-medium tabular-nums">
            {facilityFeeRatePercentNumber != null ? `${facilityFeeRatePercentNumber}%` : "—"}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground inline-flex items-center gap-1">
            Facility fee cap
            <InfoTooltip content={CONTRACT_FACILITY_FEE_CAP_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
          </dt>
          <dd className="font-medium tabular-nums">
            {maximumFacilityFeeNumber != null ? formatCurrency(maximumFacilityFeeNumber) : "—"}
          </dd>
        </div>
      </dl>
    ) : (
      <dl className="space-y-3 text-sm">
        <div className="space-y-1">
          <dt className="text-muted-foreground">Invoice number</dt>
          <dd className="font-medium break-words">{contractName}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">{summarySecondLabel}</dt>
          <dd className="font-medium tabular-nums">{summarySecondValue}</dd>
        </div>
        {requestedFinancingNumber != null ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Requested financing</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(requestedFinancingNumber)}</dd>
          </div>
        ) : null}
        {invoiceMaturityDate != null ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">Maturity date</dt>
            <dd className="font-medium tabular-nums">{invoiceMaturityDate}</dd>
          </div>
        ) : null}
        <div className="space-y-1">
          <dt className="text-muted-foreground inline-flex items-center gap-1">
            {summaryThirdLabel}
            <InfoTooltip content={PROFIT_RATE_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
          </dt>
          <dd className="font-medium tabular-nums">{summaryThirdValue}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground inline-flex items-center gap-1">
            Platform fee
            <InfoTooltip content={PLATFORM_FEE_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
          </dt>
          <dd className="font-medium tabular-nums">
            {expectedPlatformFeeNumber != null ? formatCurrency(expectedPlatformFeeNumber) : "—"}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground inline-flex items-center gap-1">
            Estimated facility fee
            <InfoTooltip content={facilityFeeEstimatedTooltip} iconClassName="h-3.5 w-3.5 shrink-0" />
          </dt>
          <dd className="font-medium tabular-nums">
            {expectedFacilityFeeNumber != null ? formatCurrency(expectedFacilityFeeNumber) : "—"}
          </dd>
        </div>
      </dl>
    );

  const renderRoleSignerSection = (role: SigningTemplateRole) => {
    const roleBindings = signerBindings
      .map((binding, index) => ({ binding, index }))
      .filter(({ binding }) => binding.role_key === role.key);
    const useDirectorDropdown = isDirectorRole(role) && issuerDirectors.length > 0;
    const usedDirectorKeys = new Set(
      roleBindings
        .map(({ binding }) => resolveBindingDirectorKey(issuerDirectors, binding))
        .filter(Boolean)
    );
    const availableDirectors = issuerDirectors.filter(
      (director) => !usedDirectorKeys.has(director.matchKey)
    );
    // Dropdown roles cannot add rows once every selectable person is already assigned.
    const hasAvailableDropdownOptions = !useDirectorDropdown || availableDirectors.length > 0;
    const withinMaxCount = role.max_count == null || roleBindings.length < role.max_count;
    const canAdd = !signersLocked && withinMaxCount && hasAvailableDropdownOptions;
    const countSubtitle = roleCountSubtitle(role);

    return (
      <div key={role.key} className="space-y-3 rounded-xl border border-border bg-background p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{role.label || role.key}</p>
            {countSubtitle ? (
              <p className="text-xs text-muted-foreground">{countSubtitle}</p>
            ) : null}
          </div>
          {!signersLocked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-xl hover:bg-muted hover:text-foreground"
              disabled={!canAdd}
              title={
                !hasAvailableDropdownOptions
                  ? "All available signers have already been assigned"
                  : !withinMaxCount
                    ? `Maximum of ${role.max_count} signer(s) reached`
                    : undefined
              }
              onClick={() => addSignerBinding(role)}
            >
              Add signer
            </Button>
          ) : null}
        </div>
        {roleBindings.length === 0 ? (
          <p className="text-sm text-destructive">Add at least one signer for this role.</p>
        ) : (
          <div className="space-y-3">
            {roleBindings.map(({ binding, index }) => {
              const selectedDirectorKey = resolveBindingDirectorKey(issuerDirectors, binding);
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
              const emailLocked = useDirectorDropdown || signersLocked;
              const nameFieldId = `signer-name-${role.key}-${index}`;
              const emailFieldId = `signer-email-${role.key}-${index}`;

              return (
                <div key={`${role.key}-${index}`} className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-1.5">
                      <Label htmlFor={nameFieldId} className="text-xs text-muted-foreground">
                        Full name
                      </Label>
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
                          <SelectTrigger id={nameFieldId} className="rounded-xl">
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
                          id={nameFieldId}
                          value={binding.name}
                          onChange={(event) =>
                            updateSignerBinding(index, {
                              name: event.target.value,
                              application_guarantor_id: null,
                            })
                          }
                          placeholder="Full name"
                          disabled={signersLocked}
                          className="rounded-xl"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={emailFieldId} className="text-xs text-muted-foreground">
                        Email
                      </Label>
                      <Input
                        id={emailFieldId}
                        value={binding.email}
                        onChange={(event) =>
                          updateSignerBinding(index, {
                            email: event.target.value,
                            application_guarantor_id: null,
                          })
                        }
                        placeholder="Email"
                        type="email"
                        readOnly={emailLocked}
                        disabled={emailLocked}
                        tabIndex={emailLocked ? -1 : undefined}
                        className={cn("rounded-xl", emailLocked && "bg-muted select-none")}
                      />
                    </div>
                    {!signersLocked ? (
                      <div className="flex items-end pb-1">
                        <button
                          type="button"
                          aria-label="Remove signer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-transparent hover:text-destructive"
                          onClick={() => removeSignerBinding(index)}
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const signerBindingEditor = (
    <div className="space-y-4">
      {(() => {
        const renderedRoleKeys = new Set<string>();
        return signingDocumentGroups(signingTemplate).map((group) => {
          const roles = group.roleKeys
            .map((roleKey) => signingTemplate.roles.find((role) => role.key === roleKey))
            .filter((role): role is SigningTemplateRole => role != null)
            .filter((role) => {
              if (renderedRoleKeys.has(role.key)) return false;
              renderedRoleKeys.add(role.key);
              return true;
            });

          return (
            <div
              key={group.key}
              className="space-y-3 rounded-xl border border-border bg-background p-4"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{group.name}</p>
                <p className="text-xs text-muted-foreground">
                  Assign who will sign this document
                  {group.roleKeys.length > 0
                    ? ` · ${group.roleKeys
                        .map(
                          (roleKey) =>
                            signingTemplate.roles.find((role) => role.key === roleKey)?.label ||
                            roleKey
                        )
                        .join(", ")}`
                    : ""}
                </p>
              </div>
              {roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Signers for this document are configured above.
                </p>
              ) : (
                <div className="space-y-3">{roles.map((role) => renderRoleSignerSection(role))}</div>
              )}
            </div>
          );
        });
      })()}
    </div>
  );

  const renderSigningStepContent = (stepId: SigningOfferStepId) => {
    if (isRejectMode) {
      return (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Decline offer</CardTitle>
            <CardDescription>
              Select a reason and confirm if you wish to decline this financing offer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="decline-primary-reason" className="text-sm font-semibold">
                Reason (required)
              </Label>
              <Select
                value={selectedDeclineReason}
                onValueChange={(value) => {
                  setSelectedDeclineReason(value);
                  if (value !== OTHER_ISSUER_DECLINE_REASON_VALUE) setRejectionReason("");
                }}
                disabled={isPending}
              >
                <SelectTrigger id="decline-primary-reason" className="h-11 rounded-xl bg-muted/40">
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
              <Label htmlFor="rejection-reason" className="text-sm font-semibold">
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
                onChange={(e) => setRejectionReason(e.target.value.slice(0, DECLINE_CONTEXT_MAX))}
                rows={4}
                className="min-h-[92px] resize-none rounded-xl bg-muted/40"
                maxLength={DECLINE_CONTEXT_MAX}
                countLabel={`${rejectionReason.length}/${DECLINE_CONTEXT_MAX} characters`}
                disabled={isPending}
              />
            </div>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              disabled={confirmDeclineDisabled}
              onClick={handleReject}
            >
              <CheckCircleIcon className="mr-2 h-4 w-4" />
              Confirm decline
            </Button>
          </CardContent>
        </Card>
      );
    }

    switch (stepId) {
      case "documents":
        return (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DocumentTextIcon className="h-5 w-5 text-primary" />
                Upload documents
              </CardTitle>
              <CardDescription>
                Complete all required documents before you confirm signers. Optional documents can
                stay empty.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {signersLocked ? (
                <p className="text-sm text-muted-foreground">
                  Documents are locked for review after signing emails were sent. Void the package to
                  edit again.
                </p>
              ) : null}
              {isLoadingFrozenProductWorkflow ? (
                <SupportingDocumentsSkeleton />
              ) : supportingDocumentsStepConfig && hasPostDocs ? (
                <SupportingDocumentsStep
                  applicationId={applicationId}
                  stepConfig={supportingDocumentsStepConfig}
                  timingFilter="post_application"
                  onDataChange={handlePostDocsDataChange}
                  readOnly={signersLocked}
                />
              ) : null}
              {!signersLocked && !isLoadingFrozenProductWorkflow && !postDocsReady ? (
                <p className="text-sm text-muted-foreground">
                  Upload all required documents before continuing.
                </p>
              ) : null}
              {!signersLocked && !isLoadingFrozenProductWorkflow && postDocsReady ? (
                <Button
                  className="h-11 w-full rounded-xl"
                  onClick={() => {
                    void navigateFromUploadDocuments("signers");
                  }}
                >
                  Continue to Configure signers
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      case "signers":
        return (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserGroupIcon className="h-5 w-5 text-primary" />
                Configure signers
              </CardTitle>
              <CardDescription>
                Assign who will sign each document. Signing emails with secure links will be sent
                to every signer when you confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {signersLocked ? (
                <p className="text-sm text-muted-foreground">
                  Signers are locked for review after signing emails were sent. Void the package to
                  edit again.
                </p>
              ) : null}
              <div className="rounded-lg bg-muted/50 p-4">{signerBindingEditor}</div>
              {!isRejectMode && !signersLocked ? (
                <div className="space-y-2">
                  <Button
                    className="h-11 w-full rounded-xl"
                    onClick={handleAccept}
                    disabled={isPending || isPostDocsConfigLoading || !postDocsReady}
                  >
                    {acceptSigningLoading ? "Sending signing emails..." : "Confirm"}
                  </Button>
                  {hasPostDocs && !postDocsReady ? (
                    <p className="text-sm text-muted-foreground">
                      Upload required documents first
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      case "signing":
        return (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PencilSquareIcon className="h-5 w-5 text-primary" />
                    Document signing
                  </CardTitle>
                  <CardDescription>
                    Signers complete signing externally via secure links. Track progress and send
                    reminders to anyone who has not signed yet.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={handleRefreshSigning}
                  disabled={isLoadingSigningEnvelopes || isSyncingSigning}
                >
                  <ArrowPathIcon
                    className={cn(
                      "h-4 w-4",
                      (isLoadingSigningEnvelopes || isSyncingSigning) && "animate-spin"
                    )}
                  />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeSigningEnvelope ? (
                <SigningProgressMatrix
                  envelope={activeSigningEnvelope}
                  onRemind={canRemindSigners ? handleRemindRecipient : undefined}
                  remindDisabled={remindLoading}
                  showRemindActions={canRemindSigners}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No signing package found.</p>
              )}
              {canRemindSigners ? (
                <Button
                  className="h-11 w-full rounded-xl"
                  onClick={handleResendReminders}
                  disabled={isPending}
                >
                  {remindLoading ? "Sending reminders..." : "Resend reminders"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      case "complete":
        return (
          <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                Signing complete
              </CardTitle>
              <CardDescription>
                All required documents have been signed. The offer acceptance process is complete.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSigningEnvelope ? (
                <SigningProgressMatrix envelope={activeSigningEnvelope} />
              ) : null}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && requestClose()}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto rounded-xl border-border p-6 gap-0",
          useEnvelopeSigning ? "max-w-4xl" : "sm:max-w-[720px]"
        )}
      >
        {useEnvelopeSigning ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="text-xl flex items-center gap-3">
                  Review financing offer
                  <Badge variant="outline" className="font-normal">
                    {type === "contract" ? "Contract" : "Invoice"}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="border-transparent bg-status-success-bg font-normal text-status-success-text"
                  >
                    {offeredValue} approved
                  </Badge>
                </DialogTitle>
              </div>
              <DialogDescription>
                Complete each step to accept this offer.
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <p className="py-8 text-sm text-muted-foreground">Loading offer...</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Signing progress
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SigningProgressStepper
                          steps={signingSteps}
                          onStepClick={(stepId) =>
                            handleSigningStepSelect(stepId as SigningOfferStepId)
                          }
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Offer details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {offerDetailsList}
                        <Separator />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 rounded-xl"
                          onClick={handleDownload}
                          disabled={!canDownload || downloading}
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          {downloading ? "Downloading…" : "Download offer letter"}
                        </Button>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarDaysIcon className="h-4 w-4 shrink-0" />
                          <span>Respond by {expiresAt}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="min-w-0">
                    {renderSigningStepContent(displaySigningStepId)}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
                  <Button
                    variant={isRejectMode ? "outline" : "destructive"}
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
                    className="rounded-xl"
                  >
                    {isRejectMode ? "Cancel decline" : "Decline offer"}
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={requestClose}>
                    Close
                  </Button>
                </div>

                {isSigningOverrideEnabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAcceptOverride}
                    disabled={isPending}
                    className="mt-3 h-9 w-full rounded-xl border-dashed border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/20"
                  >
                    Accept without signing (local override)
                  </Button>
                ) : null}
              </>
            )}
          </>
        ) : (
          <>
            <DialogTitle className="sr-only">
              Financing offer approved — Review and respond
            </DialogTitle>
            <DialogDescription className="sr-only">
              Review the financing offer and accept or decline.
            </DialogDescription>
            {isLoading ? (
              <p className="py-8 text-sm text-muted-foreground">Loading offer...</p>
            ) : (
              <>
                <div className="mb-6 flex flex-col items-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-success-bg">
                    <CheckIconSolid className="h-7 w-7 text-status-success-text" />
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    Congratulations! Your {type === "contract" ? "contract" : "invoice"} financing
                    request
                  </p>
                  <p className="mt-2 text-3xl font-extrabold tracking-tight text-status-success-text sm:text-4xl">
                    {offeredValue}
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">has been approved</p>
                </div>

                <div className="rounded-xl bg-muted/30 p-4">{offerDetailsList}</div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-11 w-full gap-2 rounded-xl"
                  onClick={handleDownload}
                  disabled={!canDownload || downloading}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  {downloading ? "Downloading…" : "Download offer letter"}
                </Button>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setIsRejectMode((prev) => !prev)}
                    disabled={isPending}
                    className={cn(
                      "h-12 rounded-xl",
                      isRejectMode &&
                        "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
                    )}
                  >
                    Decline offer
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleAccept}
                    disabled={isPending}
                    className="h-12 rounded-xl bg-status-success-text text-white hover:bg-status-success-text/90"
                  >
                    {acceptInvoice.isPending ? "Accepting..." : "Accept offer"}
                  </Button>
                </div>

                {isRejectMode ? (
                  <div className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="decline-primary-reason-simple">Reason (required)</Label>
                      <Select
                        value={selectedDeclineReason}
                        onValueChange={(value) => {
                          setSelectedDeclineReason(value);
                          if (value !== OTHER_ISSUER_DECLINE_REASON_VALUE) setRejectionReason("");
                        }}
                        disabled={isPending}
                      >
                        <SelectTrigger id="decline-primary-reason-simple" className="rounded-xl">
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
                    <TextareaWithCharCount
                      id="rejection-reason-simple"
                      value={rejectionReason}
                      onChange={(e) =>
                        setRejectionReason(e.target.value.slice(0, DECLINE_CONTEXT_MAX))
                      }
                      rows={4}
                      className="rounded-xl bg-muted/40"
                      maxLength={DECLINE_CONTEXT_MAX}
                      countLabel={`${rejectionReason.length}/${DECLINE_CONTEXT_MAX} characters`}
                      disabled={isPending}
                    />
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      disabled={confirmDeclineDisabled}
                      onClick={handleReject}
                    >
                      Confirm decline
                    </Button>
                  </div>
                ) : null}

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Please respond to this offer by {expiresAt}.
                </p>
              </>
            )}
          </>
        )}
      </DialogContent>
      <ConfirmDialog
        open={signerConfirmOpen}
        onOpenChange={setSignerConfirmOpen}
        title="Confirm signers"
        description={signingConfirmDescription}
        confirmText="Confirm"
        cancelText="Go back"
        onConfirm={handleConfirmSignersAccept}
        isLoading={acceptSigningLoading}
      />
      <ConfirmDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        title="Unsaved changes"
        description="You have unsaved document uploads. If you leave now, those changes will be discarded."
        confirmText="Discard"
        cancelText="Stay"
        variant="destructive"
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          onClose();
        }}
      />
    </Dialog>
  );
}
