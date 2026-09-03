"use client";

/**
 * Offer review UI for reviewing contract or invoice offers. Issuer can download offer
 * letter, accept, decline, or track the SigningCloud signing package after CashSouk sends it.
 * CashSouk brand styling per BRANDING.md. Contract end date uses contract_details.end_date.
 *
 * - mode="inline" (default): embeds on the application detail Offer tab without the outer Dialog;
 *   the awaiting-review success view and confirm dialogs render inline/standalone.
 * - mode="modal": full Dialog shell (legacy hosts only).
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
import { createApiClient, getLiveSigningEnvelopeRefetchInterval, useAuthToken, useOrganization } from "@cashsouk/config";
import { useAcceptInvoiceOffer, useRejectContractOffer, useRejectInvoiceOffer, useApplication } from "@/hooks/use-applications";
import { SupportingDocumentsStep } from "@/app/(application-flow)/applications/steps/supporting-documents-step";
import { SupportingDocumentsSkeleton } from "@/app/(application-flow)/applications/components/supporting-documents-skeleton";
import { AcceptanceDocumentChangesRequestedBanner } from "@/app/(application-flow)/applications/components/amendments/acceptance-document-change-callout";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { NormalizedInvoice } from "../status";
import {
  type ApiError,
  type SigningEnvelopeDto,
  computeSigningEnvelopeProgress,
  getOfferAcceptanceStatusPresentation,
  offerAcceptanceAllowsSigning,
  offerAcceptanceIsStep1Editable,
  getOfferAcceptanceFromOfferDetails,
  AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
  AUTHORIZED_REPRESENTATIVES_ISSUER_ITEM_ID,
  authorizedRepresentativeReviewItemIdForGuarantor,
  areUtilisationOfferConsentsComplete,
  computeIndicativeAmountPayable,
  computeIndicativeUtilisationProfit,
  utilisationOfferAcceptBlockedReason,
  type Application,
  type UtilisationOfferConsentId,
} from "@cashsouk/types";
import {
  getOfferPhaseDeadlineDisplay,
} from "@/lib/offer-utils";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ApplicationSummaryDownloadButton } from "@/components/application-summary-download-button";
import { OfferAcceptOtpDialog } from "./offer-accept-otp/offer-accept-otp-dialog";
import { UtilisationOfferTerms } from "./utilisation-offer-terms";
import { SigningProgressMatrix } from "@/components/signing/signing-progress-matrix";
import { SigningProgressStepper, type SigningOfferStep } from "@/components/signing/signing-progress-stepper";
import {
  compareSigningOfferStepOrder,
  getCurrentSigningOfferStepId,
  buildAcceptanceDocumentsStepConfig,
  getSigningOfferSteps,
  hasCompletedContractEnvelope,
  hasAcceptanceDocuments,
  isSigningOfferStepReachable,
  resolveAcceptanceStep1Screen,
  resolveOfferAcceptanceStatus,
  resolveReviewOfferModalMode,
  workflowUsesOfferAcceptanceFlow,
  type SigningOfferStepId,
} from "@/lib/signing-offer-steps";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OfferAcceptanceSubmittedSuccessView } from "@/components/onboarding-fee-return-views";
import { InvoiceOfferTerms } from "./invoice-offer-terms";
import { offerLetterDownloadFileName } from "./offer-letter-filename";
import { buildInvoiceFeeDisplay } from "@/lib/facility-fee-display";
import { IssuerAuthorizedRepresentativesCard } from "./issuer-authorized-representatives-card";
import { CorporateGuarantorRepresentativesCard } from "./corporate-guarantor-representatives-card";
import { IndividualGuarantorRepresentativesCard } from "./individual-guarantor-representatives-card";
import { AuthorizedPartyTypeGroup } from "./authorized-party-type-group";
import {
  areIssuerDirectorSelectionsReady,
  issuerDirectorsFromOrganization,
} from "./issuer-directors";
import {
  guarantorsFromApplication,
  nextIssuerRepMatchKeys,
} from "./build-issuer-envelope-bindings";
import {
  areGuarantorPartiesReady,
  buildAuthorizedPartiesSubmitPayload,
  emptyGuarantorPartyDrafts,
  EMPTY_CORPORATE_REP,
  nextGuarantorPartyDrafts,
} from "./guarantor-authorized-parties";
import { resolveIssuerFacilityFeeBalance } from "@/lib/facility-enabled";
import { FacilityFeeBalanceSummary } from "@/components/financing/facility-fee-status";

const CONTRACT_FACILITY_FEE_RATE_TOOLTIP =
  "The facility fee is owed in full when you accept this offer (maximum 1%). CashSouk collects it at its discretion.";

const CONTRACT_FACILITY_FEE_CAP_TOOLTIP =
  "Amount already collected toward the facility fee, against the facility fee cap. Collection timing is at Shoraka's discretion.";

export type OfferReviewPanelProps = {
  type: "contract" | "invoice";
  applicationId: string;
  /** Application's issuer org — preferred over active org from context. */
  issuerOrganizationId?: string;
  productId?: string | null;
  contractId?: string;
  /** Persisted CON-… for download filenames. Loaded contract is the fallback. */
  contractDisplayReference?: string | null;
  invoice?: NormalizedInvoice | null;
  /** Kept for host compatibility; the signing/accept-decline split is derived from the
   * frozen product workflow (resolveReviewOfferModalMode), not this flag. */
  requiresInvoiceSigning?: boolean;
  /** Called after decline/accept-without-signing, or when the panel/dialog dismisses. */
  onClose?: () => void;
  /** modal = Dialog shell (financing pages). inline = embed on application detail Offer tab. */
  mode?: "modal" | "inline";
  className?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const DECLINE_CONTEXT_MAX = 200;

type PostApplicationDocsState = {
  areAllFilesUploaded: boolean;
  hasPendingChanges: boolean;
};

/** GET /v1/applications/:id includes `contract` and `invoices` relations not on the base Application type. */
type ApplicationWithOfferRelations = Application & {
  contract?: { offer_details?: Record<string, unknown> | null } | null;
  invoices?: Array<{ id: string; offer_details?: Record<string, unknown> | null }>;
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

function findActiveSigningEnvelope(
  envelopes: SigningEnvelopeDto[],
  offerType: "contract" | "invoice",
  contractId: string | undefined,
  invoiceId: string | null | undefined
): SigningEnvelopeDto | null {
  const open = envelopes.filter(
    (envelope) => !["VOIDED", "DECLINED", "EXPIRED"].includes(envelope.status)
  );
  if (offerType === "contract") {
    if (contractId) {
      return open.find((envelope) => envelope.contract_id === contractId) ?? null;
    }
    return (
      open.find((envelope) => envelope.contract_id != null && envelope.invoice_id == null) ??
      open[0] ??
      null
    );
  }
  if (invoiceId) {
    return open.find((envelope) => envelope.invoice_id === invoiceId) ?? null;
  }
  return open.find((envelope) => envelope.invoice_id != null) ?? open[0] ?? null;
}

/** Only mounted when Review Offer is clicked. Renders once, no isOpen toggle to avoid flash. */
export function OfferReviewPanel({
  type,
  applicationId,
  issuerOrganizationId: issuerOrganizationIdProp,
  productId: _unusedProductId,
  contractId,
  contractDisplayReference,
  invoice,
  requiresInvoiceSigning: _unusedRequiresInvoiceSigning,
  onClose,
  mode = "inline",
  className,
}: OfferReviewPanelProps) {
  // productId/requiresInvoiceSigning kept in props for callers; signing/post-docs use frozen application workflow.
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
  const acceptanceDocumentsStepConfig = React.useMemo(
    () => buildAcceptanceDocumentsStepConfig(frozenProductWorkflow?.workflow),
    [frozenProductWorkflow]
  );
  const hasPostDocs = React.useMemo(
    () => hasAcceptanceDocuments(frozenProductWorkflow?.workflow),
    [frozenProductWorkflow]
  );
  const usesAcceptanceFlow = React.useMemo(
    () => workflowUsesOfferAcceptanceFlow(frozenProductWorkflow?.workflow),
    [frozenProductWorkflow]
  );
  const [isSubmittingAcceptance, setIsSubmittingAcceptance] = React.useState(false);
  const [isSavingPartyDraft, setIsSavingPartyDraft] = React.useState(false);
  const invoiceContractId =
    type === "invoice" ? (invoice?.contractId ?? contractId ?? null) : null;
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
    enabled: Boolean(applicationId),
    refetchInterval: (query) => getLiveSigningEnvelopeRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
  });
  const contractEnvelopeCompleted = hasCompletedContractEnvelope(
    signingEnvelopes,
    invoiceContractId
  );
  const modalMode = resolveReviewOfferModalMode({
    offerType: type,
    invoiceContractId,
    hasCompletedContractEnvelope: contractEnvelopeCompleted,
  });
  const useSigningStepper = modalMode.ui === "signing_stepper";
  const activeSigningEnvelope = React.useMemo(
    () =>
      findActiveSigningEnvelope(signingEnvelopes, type, contractId, envelopeTargetInvoiceId),
    [signingEnvelopes, type, contractId, envelopeTargetInvoiceId]
  );
  const packageSent =
    activeSigningEnvelope != null && activeSigningEnvelope.status !== "DRAFT";
  const canRemindSigners =
    activeSigningEnvelope != null &&
    (activeSigningEnvelope.status === "SENT" || activeSigningEnvelope.status === "IN_PROGRESS") &&
    activeSigningEnvelope.recipients.some(
      (recipient) => recipient.status !== "SIGNED" && recipient.status !== "DECLINED"
    );
  // Always enabled (not gated on useSigningStepper): this is the polling source of truth for
  // acceptance phase — application/contract refresh on the detail policy (15s), so the modal
  // never derives phase from a stale snapshot.
  const { data: applicationRecord, isFetched: isApplicationFetched } = useApplication(applicationId);
  const { data: corporateEntities, isFetched: isCorporateEntitiesFetched } = useCorporateEntities(
    useSigningStepper ? issuerOrganizationId : undefined
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
  const guarantorRows = React.useMemo(
    () => guarantorsFromApplication(applicationRecord?.application_guarantors),
    [applicationRecord?.application_guarantors]
  );

  const shouldLoadContract = type === "contract" ? !!contractId : !!invoiceContractId;
  const contractLookupId =
    type === "contract" ? contractId : (invoiceContractId ?? undefined);
  const { data: contractRecord, isLoading: isLoadingContract } = useContract(
    shouldLoadContract && contractLookupId ? contractLookupId : ""
  );

  const rejectContract = useRejectContractOffer();
  const rejectInvoice = useRejectInvoiceOffer();
  const acceptInvoice = useAcceptInvoiceOffer();

  /**
   * Unified refresh after any action that can move `offer_acceptance.status` (Step 1 submit,
   * envelope send, provider sync): application + contract + applications-list invalidation,
   * awaited so the next render's phase derivation uses fresh data instead of the pre-action
   * snapshot.
   */
  const invalidateOfferAcceptanceQueries = React.useCallback(async () => {
    const tasks = [
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] }),
      queryClient.invalidateQueries({ queryKey: ["applications"] }),
    ];
    if (type === "contract" && contractId) {
      tasks.push(queryClient.invalidateQueries({ queryKey: ["contract", contractId] }));
    }
    await Promise.all(tasks);
  }, [applicationId, contractId, queryClient, type]);

  // Refreshed invoice from the polling application query — falls back to the (possibly stale)
  // invoice prop only until the query resolves, so the acceptance phase never sticks on a
  // point-in-time snapshot captured when "Review offer" was clicked.
  const liveInvoice = React.useMemo(() => {
    if (type !== "invoice" || !invoice?.id) return undefined;
    const app = applicationRecord as ApplicationWithOfferRelations | null | undefined;
    return app?.invoices?.find((inv) => inv.id === invoice.id);
  }, [applicationRecord, invoice?.id, type]);

  const offerDetails =
    type === "contract"
      ? (contractRecord as { offer_details?: Record<string, unknown> } | null)?.offer_details
      : (liveInvoice?.offer_details ??
        (invoice as { offer_details?: Record<string, unknown> } | undefined)?.offer_details);
  const od = offerDetails as Record<string, unknown> | null | undefined;
  const acceptanceStatus = resolveOfferAcceptanceStatus(offerDetails);
  const authorizedParties = React.useMemo(() => {
    const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
    if (!acceptance) return null;
    if (offerAcceptanceIsStep1Editable(acceptance.status)) {
      return acceptance.authorized_parties_draft ?? acceptance.authorized_parties ?? null;
    }
    return acceptance.authorized_parties ?? acceptance.authorized_parties_draft ?? null;
  }, [offerDetails]);
  const isAcceptanceChangesRequested = acceptanceStatus === "CHANGES_REQUESTED";

  type ReviewItemRow = { item_type: string; item_id: string; status: string };
  type ReviewRemarkRow = { scope?: string; scope_key?: string; remark?: string };

  const acceptanceChangeRemarks = React.useMemo(() => {
    if (!isAcceptanceChangesRequested || !applicationRecord) return [];
    const remarks =
      (applicationRecord as { application_review_remarks?: ReviewRemarkRow[] })
        .application_review_remarks ?? [];
    return remarks
      .filter(
        (r) => r.scope === "item" && r.scope_key?.startsWith("acceptance_documents:")
      )
      .map((r) => ({
        scope: "item" as const,
        scope_key: r.scope_key ?? "",
        remark: r.remark ?? "",
      }));
  }, [applicationRecord, isAcceptanceChangesRequested]);

  const partyChangeRemarks = React.useMemo(() => {
    if (!isAcceptanceChangesRequested || !applicationRecord) return [];
    const remarks =
      (applicationRecord as { application_review_remarks?: ReviewRemarkRow[] })
        .application_review_remarks ?? [];
    return remarks.filter(
      (r) =>
        r.scope === "item" && r.scope_key?.startsWith("authorized_representatives:") && r.remark
    );
  }, [applicationRecord, isAcceptanceChangesRequested]);

  const acceptanceFlaggedItems = React.useMemo(() => {
    if (!isAcceptanceChangesRequested || !applicationRecord) return undefined;
    const items =
      (applicationRecord as { application_review_items?: ReviewItemRow[] })
        .application_review_items ?? [];
    const set = new Set<string>();
    for (const item of items) {
      if (
        item.item_type === "document" &&
        item.status === "AMENDMENT_REQUESTED" &&
        item.item_id.startsWith("acceptance_documents:")
      ) {
        set.add(item.item_id);
      }
    }
    if (set.size === 0) return undefined;
    return new Map<string, Set<string>>([["acceptance_documents", set]]);
  }, [applicationRecord, isAcceptanceChangesRequested]);

  const flaggedPartyItemIds = React.useMemo(() => {
    if (!isAcceptanceChangesRequested || !applicationRecord) return new Set<string>();
    const items =
      (applicationRecord as { application_review_items?: ReviewItemRow[] })
        .application_review_items ?? [];
    const ids = new Set<string>();
    for (const item of items) {
      if (
        item.item_type === AUTHORIZED_REPRESENTATIVES_ITEM_TYPE &&
        item.status === "AMENDMENT_REQUESTED"
      ) {
        ids.add(item.item_id);
      }
    }
    return ids;
  }, [applicationRecord, isAcceptanceChangesRequested]);

  const partyRemarkByItemId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const remark of partyChangeRemarks) {
      if (remark.scope_key) map.set(remark.scope_key, remark.remark ?? "");
    }
    return map;
  }, [partyChangeRemarks]);

  const flaggedAcceptanceDocCount =
    acceptanceFlaggedItems?.get("acceptance_documents")?.size ?? 0;
  const isPeopleOnlyAcceptanceResubmit =
    isAcceptanceChangesRequested &&
    flaggedPartyItemIds.size > 0 &&
    flaggedAcceptanceDocCount === 0;
  const isStep1PartyCardReadOnly = (itemId: string) =>
    packageSent ||
    !offerAcceptanceIsStep1Editable(acceptanceStatus) ||
    (isAcceptanceChangesRequested && !flaggedPartyItemIds.has(itemId));

  const phaseDeadline = React.useMemo(
    () => getOfferPhaseDeadlineDisplay(offerDetails),
    [offerDetails]
  );
  const phaseDeadlineRowLabel = phaseDeadline?.label ?? "Accept by";
  const entityOfferStatus =
    type === "contract"
      ? String((contractRecord as { status?: string } | null)?.status ?? "").toUpperCase()
      : String(
          (liveInvoice as { status?: string } | undefined)?.status ??
            (invoice as { status?: string } | undefined)?.status ??
            ""
        ).toUpperCase();
  /** Past clock or durable OFFER_EXPIRED — read-only until admin resends. */
  const isPhaseDeadlinePast =
    phaseDeadline?.isPast === true || entityOfferStatus === "OFFER_EXPIRED";
  const stepShellInput = React.useMemo(
    () => ({
      usesAcceptanceFlow,
      hasPostDocs,
      acceptanceStatus,
    }),
    [usesAcceptanceFlow, hasPostDocs, acceptanceStatus]
  );

  const isLoading = shouldLoadContract ? isLoadingContract : false;

  const [downloading, setDownloading] = React.useState(false);
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
  const [issuerRepMatchKeys, setIssuerRepMatchKeys] = React.useState<string[]>([]);
  const issuerRepInitializedRef = React.useRef(false);
  const issuerRepDirtyRef = React.useRef(false);
  const [guarantorDrafts, setGuarantorDrafts] = React.useState(emptyGuarantorPartyDrafts);
  const guarantorPartiesDirtyRef = React.useRef(false);
  const [acceptOfferConfirmOpen, setAcceptOfferConfirmOpen] = React.useState(false);
  const [utilisationConsentIds, setUtilisationConsentIds] = React.useState<
    UtilisationOfferConsentId[]
  >([]);
  const frozenUtilisationConsentsRef = React.useRef<UtilisationOfferConsentId[] | null>(null);
  const utilisationConsentsComplete = areUtilisationOfferConsentsComplete(utilisationConsentIds);
  React.useEffect(() => {
    frozenUtilisationConsentsRef.current = null;
    setUtilisationConsentIds([]);
    setAcceptOfferConfirmOpen(false);
  }, [invoice?.id]);
  const [discardConfirmOpen, setDiscardConfirmOpen] = React.useState(false);
  const [remindLoading, setRemindLoading] = React.useState(false);
  const [isSyncingSigning, setIsSyncingSigning] = React.useState(false);
  // Viewed step stickiness (D-05–D-07): domain progress stays in currentSigningStepId.
  const [viewedStepId, setViewedStepId] = React.useState<SigningOfferStepId | null>(null);
  const [peopleStepConfirmed, setPeopleStepConfirmed] = React.useState(false);
  /** When true, the user picked an earlier step in the sidebar — do not auto-advance the main panel. */
  const viewStepPinnedRef = React.useRef(false);
  const isOtherDeclineReason = selectedDeclineReason === OTHER_ISSUER_DECLINE_REASON_VALUE;

  React.useEffect(() => {
    issuerRepInitializedRef.current = false;
    issuerRepDirtyRef.current = false;
    setIssuerRepMatchKeys([]);
    guarantorPartiesDirtyRef.current = false;
    setGuarantorDrafts(emptyGuarantorPartyDrafts());
  }, [applicationId]);

  const prevAcceptanceStatusRef = React.useRef(acceptanceStatus);
  React.useEffect(() => {
    const previous = prevAcceptanceStatusRef.current;
    prevAcceptanceStatusRef.current = acceptanceStatus;
    if (acceptanceStatus === "CHANGES_REQUESTED" && previous !== "CHANGES_REQUESTED") {
      issuerRepDirtyRef.current = false;
      guarantorPartiesDirtyRef.current = false;
      setPeopleStepConfirmed(false);
    }
  }, [acceptanceStatus]);

  const offerDetailsReady =
    type === "contract" ? !isLoadingContract : isApplicationFetched;

  React.useEffect(() => {
    if (!usesAcceptanceFlow) return;
    if (useSigningStepper && !isCorporateEntitiesFetched) return;
    if (!offerDetailsReady) return;
    const nextKeys = nextIssuerRepMatchKeys({
      snapshot: authorizedParties,
      directors: issuerDirectors,
      currentKeys: issuerRepMatchKeys,
      initialized: issuerRepInitializedRef.current,
      dirty: issuerRepDirtyRef.current,
    });
    if (nextKeys) setIssuerRepMatchKeys(nextKeys);
    issuerRepInitializedRef.current = true;
  }, [
    authorizedParties,
    isCorporateEntitiesFetched,
    issuerDirectors,
    issuerRepMatchKeys,
    offerDetailsReady,
    useSigningStepper,
    usesAcceptanceFlow,
  ]);

  React.useEffect(() => {
    if (!usesAcceptanceFlow) return;
    if (!isApplicationFetched) return;
    const nextDrafts = nextGuarantorPartyDrafts({
      snapshot: authorizedParties,
      guarantors: guarantorRows,
      current: guarantorDrafts,
      dirty: guarantorPartiesDirtyRef.current,
    });
    if (nextDrafts) setGuarantorDrafts(nextDrafts);
  }, [
    authorizedParties,
    guarantorDrafts,
    guarantorRows,
    isApplicationFetched,
    usesAcceptanceFlow,
  ]);

  const contractDetails = (contractRecord as { contract_details?: Record<string, unknown> } | null)?.contract_details;
  const contractName =
    type === "contract"
      ? (contractDetails?.title ?? contractDetails?.contract_title
          ? String(contractDetails.title ?? contractDetails.contract_title)
          : "—")
      : invoice?.number ?? "Invoice financing";

  /** Contract end date from contract_details.end_date. */
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

  const contractOfferFeeBalance =
    type === "contract" && offeredFacilityNumber != null && facilityFeeRatePercentNumber != null
      ? resolveIssuerFacilityFeeBalance({
          contractDetails: {
            ...(contractDetails ?? {}),
            facility_fee_rate_percent: facilityFeeRatePercentNumber,
          },
          approvedFacilityAmount: offeredFacilityNumber,
          facilityFeeCapAmount: maximumFacilityFeeNumber,
        })
      : null;

  const isContractLinkedInvoice = type === "invoice" && !!invoiceContractId;

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

  const invoiceFinancingAmountNumber =
    type === "invoice" && od?.offered_amount != null ? Number(od.offered_amount) : null;

  const invoiceRiskRating =
    type === "invoice" && typeof od?.risk_rating === "string" && od.risk_rating.trim()
      ? od.risk_rating.trim()
      : null;

  const invoiceFinancingMarginPercent =
    type === "invoice" &&
    od?.offered_ratio_percent != null &&
    Number.isFinite(Number(od.offered_ratio_percent))
      ? Number(od.offered_ratio_percent)
      : null;

  const invoiceProfitRatePercent =
    type === "invoice" &&
    od?.offered_profit_rate_percent != null &&
    Number.isFinite(Number(od.offered_profit_rate_percent))
      ? Number(od.offered_profit_rate_percent)
      : null;

  const invoiceIndicativeProfit = computeIndicativeUtilisationProfit({
    offeredAmount: invoiceFinancingAmountNumber,
    profitRatePercent: invoiceProfitRatePercent,
    tenureDays: invoice?.financingTenureDays ?? null,
  });

  const invoiceIndicativeAmountPayable = computeIndicativeAmountPayable(
    invoiceFinancingAmountNumber,
    invoiceIndicativeProfit
  );

  const invoiceFacilityFeeCapAmount =
    approvedFacilityAmountNumber != null &&
    contractFacilityFeeRatePercentNumber != null &&
    Number.isFinite(approvedFacilityAmountNumber) &&
    Number.isFinite(contractFacilityFeeRatePercentNumber) &&
    contractFacilityFeeRatePercentNumber > 0
      ? approvedFacilityAmountNumber * (contractFacilityFeeRatePercentNumber / 100)
      : null;

  const invoiceFeeDisplay = buildInvoiceFeeDisplay({
    status: invoice?.status,
    offerDetails: od,
    financingAmount: invoiceFinancingAmountNumber,
    isContractFinancing: isContractLinkedInvoice,
    contractFacilityFeeRatePercent: contractFacilityFeeRatePercentNumber,
    contractFacilityFeeCapAmount: invoiceFacilityFeeCapAmount,
    contractFacilityFeePaidAmount: contractFacilityFeePaidAmountNumber,
    contractDetails,
    invoiceSnapshot: invoice?.invoiceSnapshot ?? invoice?.details ?? null,
  });


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
      const loadedContractRef =
        (contractRecord as { displayReference?: string | null; display_reference?: string | null } | null | undefined)
          ?.displayReference ??
        (contractRecord as { display_reference?: string | null } | null | undefined)?.display_reference ??
        null;
      a.download =
        type === "contract"
          ? offerLetterDownloadFileName(
              "contract",
              contractDisplayReference ?? loadedContractRef
            )
          : offerLetterDownloadFileName("invoice", invoice?.displayReference);
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
    if (isPhaseDeadlinePast) {
      toast.error("This offer has expired.");
      return;
    }
    if (!resolvedDeclineReason) return;
    if (type === "contract") {
      try {
        await rejectContract.mutateAsync({ applicationId, reason: resolvedDeclineReason });
        toast.success("Offer declined");
        onClose?.();
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
        onClose?.();
      } catch {
        // toast handled by hook
      }
    }
  };

  /** Step 1 editable: keep acceptance uploads local until Submit (do not PATCH early). */
  const deferAcceptanceDocsUntilSubmit =
    usesAcceptanceFlow && offerAcceptanceIsStep1Editable(acceptanceStatus);

  const ensurePostApplicationDocumentsSaved = React.useCallback(async (): Promise<boolean> => {
    if (packageSent) return true;
    // After admin approval, acceptance docs are already saved — no in-modal upload to save.
    if (usesAcceptanceFlow && offerAcceptanceAllowsSigning(acceptanceStatus)) {
      return true;
    }
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
        stepId: "acceptance_documents",
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
    acceptanceStatus,
    apiClient,
    applicationId,
    applicationRecord?.last_completed_step,
    hasPostDocs,
    isLoadingFrozenProductWorkflow,
    postDocsState,
    queryClient,
    packageSent,
    usesAcceptanceFlow,
  ]);

  const submitOfferAcceptance = React.useCallback(async () => {
    if (isPhaseDeadlinePast) {
      toast.error("This offer has expired.");
      return;
    }
    if (hasPostDocs && !isPeopleOnlyAcceptanceResubmit) {
      const saved = await ensurePostApplicationDocumentsSaved();
      if (!saved) return;
    }
    if (!areIssuerDirectorSelectionsReady(issuerDirectors, issuerRepMatchKeys)) {
      toast.error("Select at least one director to represent the issuer company.");
      return;
    }
    if (!areGuarantorPartiesReady(guarantorRows, guarantorDrafts)) {
      toast.error("Complete authorised representatives for every guarantor.");
      return;
    }
    const authorizedPartiesPayload = buildAuthorizedPartiesSubmitPayload({
      directors: issuerDirectors,
      selectedMatchKeys: issuerRepMatchKeys,
      guarantors: guarantorRows,
      drafts: guarantorDrafts,
    });
    setIsSubmittingAcceptance(true);
    try {
      const response =
        type === "contract"
          ? await apiClient.submitContractOfferAcceptance(applicationId, {
              authorized_parties: authorizedPartiesPayload,
            })
          : invoice?.id
            ? await apiClient.submitInvoiceOfferAcceptance(applicationId, invoice.id, {
                authorized_parties: authorizedPartiesPayload,
              })
            : null;
      if (!response?.success) {
        const err = getApiErrorDetails(
          response ?? { success: false },
          "Could not submit offer acceptance"
        );
        toast.error(err.message);
        return;
      }
      await invalidateOfferAcceptanceQueries();
      viewStepPinnedRef.current = false;
      setViewedStepId("awaiting_review");
      setPeopleStepConfirmed(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit offer acceptance");
    } finally {
      setIsSubmittingAcceptance(false);
    }
  }, [
    apiClient,
    applicationId,
    ensurePostApplicationDocumentsSaved,
    guarantorDrafts,
    guarantorRows,
    hasPostDocs,
    invalidateOfferAcceptanceQueries,
    invoice?.id,
    isPeopleOnlyAcceptanceResubmit,
    isPhaseDeadlinePast,
    issuerDirectors,
    issuerRepMatchKeys,
    type,
  ]);

  const goToDocumentsStep = React.useCallback(async () => {
    if (!areIssuerDirectorSelectionsReady(issuerDirectors, issuerRepMatchKeys)) {
      toast.error("Select at least one director to represent the issuer company.");
      return;
    }
    if (!areGuarantorPartiesReady(guarantorRows, guarantorDrafts)) {
      toast.error("Complete authorised representatives for every guarantor.");
      return;
    }
    if (type === "contract") {
      const authorizedPartiesPayload = buildAuthorizedPartiesSubmitPayload({
        directors: issuerDirectors,
        selectedMatchKeys: issuerRepMatchKeys,
        guarantors: guarantorRows,
        drafts: guarantorDrafts,
      });
      setIsSavingPartyDraft(true);
      try {
        const response = await apiClient.saveContractAuthorizedPartiesDraft(applicationId, {
          authorized_parties: authorizedPartiesPayload,
        });
        if (!response?.success) {
          const err = getApiErrorDetails(
            response ?? { success: false },
            "Could not save authorised representatives"
          );
          toast.error(err.message);
          return;
        }
        await invalidateOfferAcceptanceQueries();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save authorised representatives"
        );
        return;
      } finally {
        setIsSavingPartyDraft(false);
      }
    }
    // Unpin and set the viewed step here. After the first Continue, peopleStepConfirmed
    // is already true so currentSigningStepId does not change — the auto-advance effect
    // would not run if the user came back from documents and Continue'd again.
    viewStepPinnedRef.current = false;
    setPeopleStepConfirmed(true);
    if (hasPostDocs) {
      setViewedStepId("documents");
    }
  }, [
    apiClient,
    applicationId,
    guarantorDrafts,
    guarantorRows,
    hasPostDocs,
    invalidateOfferAcceptanceQueries,
    issuerDirectors,
    issuerRepMatchKeys,
    type,
  ]);

  React.useEffect(() => {
    if (isPhaseDeadlinePast) {
      setIsRejectMode(false);
      setAcceptOfferConfirmOpen(false);
    }
  }, [isPhaseDeadlinePast]);

  const prepareAccept = async (): Promise<boolean> => {
    if (isPhaseDeadlinePast) {
      toast.error("This offer has expired.");
      return false;
    }
    const invoiceId = invoice?.id;

    if (type === "invoice" && !invoiceId) {
      return false;
    }

    if (modalMode.ui === "accept_decline") {
      if (!modalMode.canAccept) {
        toast.error("Cannot accept yet", {
          description: modalMode.blockedMessage,
        });
        return false;
      }
      if (!areUtilisationOfferConsentsComplete(utilisationConsentIds)) {
        toast.error("Confirm the utilisation terms", {
          description:
            utilisationOfferAcceptBlockedReason(utilisationConsentIds) ??
            "Tick both confirmations and confirm the full authorisation before accepting.",
        });
        return false;
      }
      return true;
    }

    return false;
  };

  const handleAccept = async () => {
    if (isPhaseDeadlinePast) {
      toast.error("This offer has expired.");
      return;
    }
    const ready = await prepareAccept();
    if (!ready) return;

    if (modalMode.ui === "accept_decline") {
      frozenUtilisationConsentsRef.current = [...utilisationConsentIds];
      setAcceptOfferConfirmOpen(true);
    }
  };

  const handleConfirmDirectInvoiceAccept = async (input: {
    challenge_id: string;
    otp_code: string;
  }) => {
    const invoiceId = invoice?.id;
    if (!invoiceId) {
      throw new Error("Invoice ID is missing. Please refresh and try again.");
    }
    const consentIds = frozenUtilisationConsentsRef.current;
    if (!consentIds || !areUtilisationOfferConsentsComplete(consentIds)) {
      throw new Error(
        utilisationOfferAcceptBlockedReason(consentIds ?? []) ??
          "Tick both confirmations and confirm the full authorisation before accepting."
      );
    }
    await acceptInvoice.mutateAsync({
      applicationId,
      invoiceId,
      challenge_id: input.challenge_id,
      otp_code: input.otp_code,
      consent_ids: consentIds,
    });
    toast.success("Offer accepted");
    frozenUtilisationConsentsRef.current = null;
    setAcceptOfferConfirmOpen(false);
    onClose?.();
  };

  const handleResendReminders = async () => {
    if (isPhaseDeadlinePast) {
      toast.error("This offer has expired.");
      return;
    }
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
    if (isPhaseDeadlinePast) {
      toast.error("This offer has expired.");
      return;
    }
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

  const isPending =
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
  // After admin approval, uploads are already done in Step 1 — do not gate tracking on the upload UI.
  const signingPhaseSkipsUploadGate =
    usesAcceptanceFlow && offerAcceptanceAllowsSigning(acceptanceStatus);
  const postDocsReady =
    signingPhaseSkipsUploadGate || !hasPostDocs || postDocsState.areAllFilesUploaded;
  const issuerRepsReady =
    !usesAcceptanceFlow ||
    (areIssuerDirectorSelectionsReady(issuerDirectors, issuerRepMatchKeys) &&
      areGuarantorPartiesReady(guarantorRows, guarantorDrafts));
  const canSubmitFromRepresentatives =
    usesAcceptanceFlow &&
    (!hasPostDocs ||
      (isAcceptanceChangesRequested &&
        flaggedPartyItemIds.size > 0 &&
        flaggedAcceptanceDocCount === 0));

  const envelopeProgress = activeSigningEnvelope
    ? computeSigningEnvelopeProgress(activeSigningEnvelope)
    : null;
  const allDocsSigned =
    envelopeProgress != null &&
    envelopeProgress.total_required > 0 &&
    envelopeProgress.signed === envelopeProgress.total_required;
  const envelopeCompleted = activeSigningEnvelope?.status === "COMPLETED";
  const acceptanceStep1Screen = resolveAcceptanceStep1Screen({
    hasPostDocs,
    peopleStepConfirmed,
    flaggedPartyCount: flaggedPartyItemIds.size,
    flaggedDocumentCount: flaggedAcceptanceDocCount,
  });
  const step1Cursor = {
    ...stepShellInput,
    postDocsReady,
    packageSent,
    allDocsSigned,
    envelopeCompleted,
    acceptanceStep1Screen,
  };
  const currentSigningStepId = getCurrentSigningOfferStepId(step1Cursor);
  const signingSteps = getSigningOfferSteps(step1Cursor);

  // D-06: recompute viewed step on each open/reopen (applicationId change), never restore prior session.
  React.useEffect(() => {
    setViewedStepId(null);
    viewStepPinnedRef.current = false;
    setPeopleStepConfirmed(false);
    postDocsSaveRef.current = undefined;
    setPostDocsState({ areAllFilesUploaded: false, hasPendingChanges: false });
  }, [applicationId]);

  // D-05 smart land once workflow settles; do not re-sync when postDocsReady flips (D-07).
  React.useEffect(() => {
    if (isLoadingFrozenProductWorkflow || viewedStepId !== null) return;
    setViewedStepId(
      getCurrentSigningOfferStepId({
        ...stepShellInput,
        postDocsReady,
        packageSent,
        allDocsSigned,
        envelopeCompleted,
        acceptanceStep1Screen,
      })
    );
  }, [
    isLoadingFrozenProductWorkflow,
    viewedStepId,
    stepShellInput,
    postDocsReady,
    packageSent,
    allDocsSigned,
    envelopeCompleted,
    acceptanceStep1Screen,
  ]);

  // Snap viewed step when domain retreats, or auto-advance when domain moves forward (e.g. after Confirm).
  React.useEffect(() => {
    if (viewedStepId == null) return;
    if (!isSigningOfferStepReachable(viewedStepId, currentSigningStepId, stepShellInput)) {
      setViewedStepId(currentSigningStepId);
      viewStepPinnedRef.current = false;
      return;
    }
    if (
      !viewStepPinnedRef.current &&
      compareSigningOfferStepOrder(currentSigningStepId, viewedStepId, stepShellInput) > 0
    ) {
      setViewedStepId(currentSigningStepId);
    }
  }, [viewedStepId, currentSigningStepId, stepShellInput]);

  // While frozen workflow loads, force documents shell + skeleton.
  const displaySigningStepId: SigningOfferStepId = isLoadingFrozenProductWorkflow
    ? usesAcceptanceFlow
      ? "representatives"
      : "signing"
    : (viewedStepId ?? currentSigningStepId);

  // Keep Upload mounted (hidden) during Step 1 so local draft survives sidebar nav before Submit.
  const keepAcceptanceDocsDraftMounted =
    deferAcceptanceDocsUntilSubmit && hasPostDocs && !packageSent;

  // Close without auto-save; discard confirm when Upload has pending changes (D-11).
  const requestClose = React.useCallback(() => {
    if (
      postDocsState.hasPendingChanges &&
      (displaySigningStepId === "documents" || keepAcceptanceDocsDraftMounted)
    ) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose?.();
  }, [
    displaySigningStepId,
    keepAcceptanceDocsDraftMounted,
    onClose,
    postDocsState.hasPendingChanges,
  ]);

  // Legacy (non-phased) Upload: persist before leaving. Acceptance Step 1: local draft until Submit.
  const navigateFromUploadDocuments = React.useCallback(
    async (targetStepId: SigningOfferStepId) => {
      if (targetStepId === displaySigningStepId) return;
      if (displaySigningStepId !== "documents" || packageSent) {
        viewStepPinnedRef.current =
          compareSigningOfferStepOrder(targetStepId, currentSigningStepId, stepShellInput) < 0;
        setViewedStepId(targetStepId);
        return;
      }
      if (deferAcceptanceDocsUntilSubmit) {
        viewStepPinnedRef.current =
          compareSigningOfferStepOrder(targetStepId, currentSigningStepId, stepShellInput) < 0;
        setViewedStepId(targetStepId);
        return;
      }
      const saved = await ensurePostApplicationDocumentsSaved();
      if (!saved) return;
      viewStepPinnedRef.current =
        compareSigningOfferStepOrder(targetStepId, currentSigningStepId, stepShellInput) < 0;
      setViewedStepId(targetStepId);
    },
    [
      currentSigningStepId,
      deferAcceptanceDocsUntilSubmit,
      displaySigningStepId,
      ensurePostApplicationDocumentsSaved,
      packageSent,
      stepShellInput,
    ]
  );

  // Free-nav within domain cursor (D-01–D-04); leave-Upload persists via navigateFromUploadDocuments (D-09/D-10).
  const handleSigningStepSelect = (stepId: SigningOfferStepId) => {
    if (stepId === displaySigningStepId) return;
    if (!isSigningOfferStepReachable(stepId, currentSigningStepId, stepShellInput)) return;
    viewStepPinnedRef.current =
      compareSigningOfferStepOrder(stepId, currentSigningStepId, stepShellInput) < 0;
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
      // Sync can auto-complete the envelope and flip offer_acceptance.status to COMPLETED —
      // refresh the phase-feeding queries alongside the envelope.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["signing-envelopes", applicationId] }),
        invalidateOfferAcceptanceQueries(),
      ]);
    })();
  };

  const invoiceOfferPhaseDeadline = phaseDeadline ? (
    <div className="space-y-1 text-ui">
      <p className="text-muted-foreground">{phaseDeadlineRowLabel}</p>
      <p
        className={cn(
          "font-medium tabular-nums",
          phaseDeadline.urgency === "past" && "text-destructive",
          phaseDeadline.urgency === "soon" && "text-status-action-text"
        )}
      >
        {phaseDeadline.absolute}
        {phaseDeadline.relative ? (
          <span
            className={cn(
              "mt-0.5 block text-meta font-normal",
              phaseDeadline.urgency === "past"
                ? "text-destructive"
                : phaseDeadline.urgency === "soon"
                  ? "text-status-action-text"
                  : "text-muted-foreground"
            )}
          >
            {phaseDeadline.relative}
          </span>
        ) : null}
      </p>
    </div>
  ) : null;

  const invoiceOfferTerms = type === "invoice" ? (
    <InvoiceOfferTerms
      invoiceNumber={contractName}
      invoiceValue={invoice?.value ?? null}
      maturityDate={invoiceMaturityDate}
      financingTenureDays={invoice?.financingTenureDays ?? null}
      profitRate={profitRateDisplay}
      riskRating={invoiceRiskRating}
      financingMarginPercent={invoiceFinancingMarginPercent}
      indicativeProfit={invoiceIndicativeProfit}
      indicativeAmountPayable={invoiceIndicativeAmountPayable}
      requestedFinancing={requestedFinancingNumber}
      approvedFinancing={invoiceFinancingAmountNumber}
      includeFacilityFee={isContractLinkedInvoice}
      feeDisplay={invoiceFeeDisplay}
      footer={invoiceOfferPhaseDeadline}
    />
  ) : null;

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
        {contractOfferFeeBalance ? (
          <FacilityFeeBalanceSummary
            balance={contractOfferFeeBalance}
            stacked
            owedLabelExtra={
              <InfoTooltip content={CONTRACT_FACILITY_FEE_CAP_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
            }
          />
        ) : (
          <div className="space-y-1">
            <dt className="text-muted-foreground inline-flex items-center gap-1">
              Facility fee owed
              <InfoTooltip content={CONTRACT_FACILITY_FEE_CAP_TOOLTIP} iconClassName="h-3.5 w-3.5 shrink-0" />
            </dt>
            <dd className="font-medium tabular-nums">
              {maximumFacilityFeeNumber != null ? formatCurrency(maximumFacilityFeeNumber) : "—"}
            </dd>
          </div>
        )}
        {phaseDeadline ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground">{phaseDeadlineRowLabel}</dt>
            <dd
              className={cn(
                "font-medium tabular-nums",
                phaseDeadline.urgency === "past" && "text-destructive",
                phaseDeadline.urgency === "soon" && "text-status-action-text"
              )}
            >
              {phaseDeadline.absolute}
              {phaseDeadline.relative ? (
                <span
                  className={cn(
                    "mt-0.5 block text-xs font-normal",
                    phaseDeadline.urgency === "past"
                      ? "text-destructive"
                      : phaseDeadline.urgency === "soon"
                        ? "text-status-action-text"
                        : "text-muted-foreground"
                  )}
                >
                  {phaseDeadline.relative}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    ) : (
      invoiceOfferTerms
    );

  const renderSigningStepContent = (stepId: SigningOfferStepId) => {
    if (isRejectMode) {
      return (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">
              {modalMode.ui === "accept_decline" ? "Reject offer" : "Decline offer"}
            </CardTitle>
            <CardDescription>
              {modalMode.ui === "accept_decline"
                ? "Select a reason and confirm if you wish to reject this financing offer."
                : "Select a reason and confirm if you wish to decline this financing offer."}
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
      case "awaiting_review":
        // Replaced by OfferAcceptanceSubmittedSuccessView at the modal root.
        return null;
      case "rejected":
      case "declined": {
        // Terminal — never the "Under review" copy or the auto-refresh reassurance (nothing
        // further will change here).
        const presentation = getOfferAcceptanceStatusPresentation(
          stepId === "rejected" ? "REJECTED" : "DECLINED"
        );
        return (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <XMarkIcon className="h-5 w-5" />
                {presentation.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This offer is closed. No further action is available in this dialog.
              </p>
            </CardContent>
          </Card>
        );
      }
      case "representatives":
        return (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserGroupIcon className="h-5 w-5 text-primary" />
                Authorised representatives
              </CardTitle>
              <CardDescription>
                Name who will represent the issuer and each company guarantor, then confirm
                individual guarantors. Everyone named here must sign. CashSouk will review these
                lists with the Board Resolution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAcceptanceChangesRequested &&
              (flaggedPartyItemIds.size > 0 || flaggedAcceptanceDocCount > 0) ? (
                <AcceptanceDocumentChangesRequestedBanner
                  flaggedCount={flaggedPartyItemIds.size + flaggedAcceptanceDocCount}
                  partyCount={flaggedPartyItemIds.size}
                  documentCount={flaggedAcceptanceDocCount}
                />
              ) : null}
              <div className="space-y-3">
                <IssuerAuthorizedRepresentativesCard
                  companyName={activeOrganization?.name?.trim() || "Your company"}
                  directors={issuerDirectors}
                  selectedMatchKeys={issuerRepMatchKeys}
                  onChange={(keys) => {
                    issuerRepDirtyRef.current = true;
                    setIssuerRepMatchKeys(keys);
                  }}
                  readOnly={isStep1PartyCardReadOnly(AUTHORIZED_REPRESENTATIVES_ISSUER_ITEM_ID)}
                  highlighted={flaggedPartyItemIds.has(AUTHORIZED_REPRESENTATIVES_ISSUER_ITEM_ID)}
                  remark={partyRemarkByItemId.get(AUTHORIZED_REPRESENTATIVES_ISSUER_ITEM_ID) ?? null}
                  isLoading={
                    (useSigningStepper && !isCorporateEntitiesFetched) ||
                    (usesAcceptanceFlow && !offerDetailsReady)
                  }
                />
                {guarantorRows.some((guarantor) => guarantor.guarantor_type === "company") ? (
                  <AuthorizedPartyTypeGroup
                    title="Corporate guarantors"
                    description="Name the people who will represent each company. Everyone named here must sign."
                  >
                    {guarantorRows
                      .filter((guarantor) => guarantor.guarantor_type === "company")
                      .map((guarantor) => {
                        const partyItemId = authorizedRepresentativeReviewItemIdForGuarantor(
                          authorizedParties,
                          guarantor,
                          guarantorRows
                        );
                        return (
                          <CorporateGuarantorRepresentativesCard
                            key={guarantor.id}
                            entityId={guarantor.id}
                            companyName={
                              guarantor.business_name?.trim() || "Company guarantor"
                            }
                            representatives={
                              guarantorDrafts.corporateRepsById[guarantor.id] ?? [
                                { ...EMPTY_CORPORATE_REP },
                              ]
                            }
                            onChange={(representatives) => {
                              guarantorPartiesDirtyRef.current = true;
                              setGuarantorDrafts((prev) => ({
                                ...prev,
                                corporateRepsById: {
                                  ...prev.corporateRepsById,
                                  [guarantor.id]: representatives,
                                },
                              }));
                            }}
                            readOnly={isStep1PartyCardReadOnly(partyItemId)}
                            highlighted={flaggedPartyItemIds.has(partyItemId)}
                            remark={partyRemarkByItemId.get(partyItemId) ?? null}
                            embedded
                          />
                        );
                      })}
                  </AuthorizedPartyTypeGroup>
                ) : null}
                {guarantorRows.some((guarantor) => guarantor.guarantor_type !== "company") ? (
                  <AuthorizedPartyTypeGroup
                    title="Individual guarantors"
                    description="These people sign personally. Name, IC number, and email come from the application."
                  >
                    {guarantorRows
                      .filter((guarantor) => guarantor.guarantor_type !== "company")
                      .map((guarantor) => {
                        const partyItemId = authorizedRepresentativeReviewItemIdForGuarantor(
                          authorizedParties,
                          guarantor,
                          guarantorRows
                        );
                        return (
                          <IndividualGuarantorRepresentativesCard
                            key={guarantor.id}
                            entityId={guarantor.id}
                            personName={guarantor.name?.trim() || ""}
                            icNumber={guarantor.ic_number ?? ""}
                            email={
                              guarantorDrafts.individualEmailsById[guarantor.id] ??
                              guarantor.email
                            }
                            highlighted={flaggedPartyItemIds.has(partyItemId)}
                            remark={partyRemarkByItemId.get(partyItemId) ?? null}
                            embedded
                          />
                        );
                      })}
                  </AuthorizedPartyTypeGroup>
                ) : null}
              </div>
              {!packageSent && !isLoadingFrozenProductWorkflow && canSubmitFromRepresentatives ? (
                <Button
                  className="h-11 w-full rounded-xl"
                  disabled={isSubmittingAcceptance || !issuerRepsReady}
                  onClick={() => {
                    void submitOfferAcceptance();
                  }}
                >
                  Submit for review
                </Button>
              ) : null}
              {!packageSent &&
              !isLoadingFrozenProductWorkflow &&
              hasPostDocs &&
              !canSubmitFromRepresentatives ? (
                <Button
                  className="h-11 w-full rounded-xl"
                  disabled={isSubmittingAcceptance || isSavingPartyDraft || !issuerRepsReady}
                  onClick={() => {
                    void goToDocumentsStep();
                  }}
                >
                  Continue
                </Button>
              ) : null}
              {!packageSent &&
              !isLoadingFrozenProductWorkflow &&
              !issuerRepsReady &&
              isCorporateEntitiesFetched ? (
                <p className="text-ui text-muted-foreground">
                  Complete authorised representatives for the issuer and every guarantor before
                  continuing.
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      case "documents":
        return (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DocumentTextIcon className="h-5 w-5 text-primary" />
                Upload documents
              </CardTitle>
              <CardDescription>
                {usesAcceptanceFlow
                  ? "Upload required acceptance documents (for example a Board Resolution). CashSouk must approve them before signing."
                  : "Upload required documents. Optional documents can stay empty."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usesAcceptanceFlow &&
              isAcceptanceChangesRequested &&
              (flaggedAcceptanceDocCount > 0 || flaggedPartyItemIds.size > 0) ? (
                <AcceptanceDocumentChangesRequestedBanner
                  flaggedCount={flaggedAcceptanceDocCount + flaggedPartyItemIds.size}
                  documentCount={flaggedAcceptanceDocCount}
                  partyCount={flaggedPartyItemIds.size}
                />
              ) : null}
              {packageSent ? (
                <p className="text-sm text-muted-foreground">
                  {usesAcceptanceFlow
                    ? "Documents and representative lists are locked after signing emails were sent. Voiding the package does not reopen them."
                    : "Documents are locked for review after signing emails were sent. Void the package to edit again."}
                </p>
              ) : null}
              {isLoadingFrozenProductWorkflow ? (
                <SupportingDocumentsSkeleton />
              ) : hasPostDocs ? (
                <SupportingDocumentsStep
                  applicationId={applicationId}
                  stepConfig={acceptanceDocumentsStepConfig}
                  documentStorage="acceptance_documents"
                  onDataChange={handlePostDocsDataChange}
                  readOnly={packageSent}
                  documentRowLayout="stacked"
                  isAcceptanceChangeMode={isAcceptanceChangesRequested}
                  amendmentRemarks={acceptanceChangeRemarks}
                  flaggedItems={acceptanceFlaggedItems}
                />
              ) : null}
              {!packageSent && !isLoadingFrozenProductWorkflow && !postDocsReady ? (
                <p className="text-sm text-muted-foreground">
                  Upload all required documents before continuing.
                </p>
              ) : null}
              {!packageSent && !isLoadingFrozenProductWorkflow && postDocsReady ? (
                usesAcceptanceFlow && displaySigningStepId === "documents" ? (
                    <Button
                      className="h-11 w-full rounded-xl"
                      disabled={isSubmittingAcceptance || !issuerRepsReady}
                      onClick={() => {
                        void submitOfferAcceptance();
                      }}
                    >
                      Submit for review
                    </Button>
                ) : null
              ) : null}
              {usesAcceptanceFlow &&
              displaySigningStepId === "documents" &&
              !packageSent &&
              !isLoadingFrozenProductWorkflow &&
              postDocsReady &&
              !issuerRepsReady &&
              isCorporateEntitiesFetched ? (
                <p className="text-ui text-muted-foreground">
                  Complete authorised representatives for the issuer and every guarantor before
                  submitting.
                </p>
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
                    {packageSent
                      ? "Signers complete signing externally via secure links. Track progress and send reminders to anyone who has not signed yet."
                      : "CashSouk will send signing links to the authorised representatives. You can track progress here once the package is sent."}
                  </CardDescription>
                </div>
                {packageSent ? (
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
                ) : null}
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
                <p className="text-sm text-muted-foreground">
                  Waiting for CashSouk to send signing links to the authorised representatives.
                </p>
              )}
              {canRemindSigners ? (
                <Button
                  className="h-11 w-full rounded-xl"
                  onClick={handleResendReminders}
                  disabled={isPending}
                >
                  {remindLoading ? "Sending reminders..." : "Send reminders"}
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

  const acceptDeclineSteps: SigningOfferStep[] = [
    {
      id: "respond",
      label: "Respond to offer",
      description: "Accept or decline this invoice offer",
      status: "current",
    },
  ];

  const canDirectAccept =
    modalMode.ui === "accept_decline" &&
    modalMode.canAccept &&
    !isLoadingSigningEnvelopes;

  const linkedContractTitle =
    contractDetails?.title != null || contractDetails?.contract_title != null
      ? String(contractDetails.title ?? contractDetails.contract_title)
      : "—";
  const linkedContractValueNumber =
    contractDetails != null &&
    (contractDetails.contract_value != null || contractDetails.value != null)
      ? (() => {
          const n = Number(contractDetails.contract_value ?? contractDetails.value);
          return Number.isFinite(n) ? n : null;
        })()
      : null;
  const linkedContractStartDate = contractDetails?.start_date
    ? formatDateOrDash(String(contractDetails.start_date))
    : null;
  const linkedContractEndDate = contractDetails?.end_date
    ? formatDateOrDash(String(contractDetails.end_date))
    : null;
  const linkedContractOfferDetails = (
    contractRecord as { offer_details?: Record<string, unknown> } | null
  )?.offer_details;
  const linkedOfferedFacilityNumber =
    linkedContractOfferDetails?.offered_facility != null &&
    Number.isFinite(Number(linkedContractOfferDetails.offered_facility))
      ? Number(linkedContractOfferDetails.offered_facility)
      : null;
  const linkedApprovedFacilityNumber =
    approvedFacilityAmountNumber != null &&
    Number.isFinite(approvedFacilityAmountNumber) &&
    approvedFacilityAmountNumber > 0
      ? approvedFacilityAmountNumber
      : linkedOfferedFacilityNumber;
  const linkedFacilityFeeRatePercent =
    contractFacilityFeeRatePercentNumber ??
    (linkedContractOfferDetails?.facility_fee_rate_percent != null &&
    Number.isFinite(Number(linkedContractOfferDetails.facility_fee_rate_percent))
      ? Number(linkedContractOfferDetails.facility_fee_rate_percent)
      : null);
  const linkedFacilityFeeCapNumber =
    linkedFacilityFeeRatePercent != null && linkedApprovedFacilityNumber != null
      ? linkedApprovedFacilityNumber * (linkedFacilityFeeRatePercent / 100)
      : linkedFacilityFeeRatePercent != null && linkedOfferedFacilityNumber != null
        ? linkedOfferedFacilityNumber * (linkedFacilityFeeRatePercent / 100)
        : null;
  const linkedFacilityFeeBalance =
    linkedFacilityFeeRatePercent != null &&
    (linkedApprovedFacilityNumber != null || linkedOfferedFacilityNumber != null)
      ? resolveIssuerFacilityFeeBalance({
          contractDetails: {
            ...(contractDetails ?? {}),
            facility_fee_rate_percent: linkedFacilityFeeRatePercent,
          },
          approvedFacilityAmount: linkedApprovedFacilityNumber ?? linkedOfferedFacilityNumber,
          facilityFeeCapAmount: linkedFacilityFeeCapNumber,
          facilityFeePaidAmount: contractFacilityFeePaidAmountNumber,
          facilityFeeWaived: contractDetails?.facility_fee_waived === true,
        })
      : null;

  const linkedContractDetailsList = (
    <dl className="space-y-3 text-sm">
      <div className="space-y-1">
        <dt className="text-muted-foreground">Contract name</dt>
        <dd className="font-medium break-words">{linkedContractTitle}</dd>
      </div>
      {linkedContractValueNumber != null ? (
        <div className="space-y-1">
          <dt className="text-muted-foreground">Contract value</dt>
          <dd className="font-medium tabular-nums">{formatCurrency(linkedContractValueNumber)}</dd>
        </div>
      ) : null}
      {linkedApprovedFacilityNumber != null ? (
        <div className="space-y-1">
          <dt className="text-muted-foreground">Approved facility</dt>
          <dd className="font-medium tabular-nums">
            {formatCurrency(linkedApprovedFacilityNumber)}
          </dd>
        </div>
      ) : null}
      <div className="space-y-1">
        <dt className="text-muted-foreground">Contract period</dt>
        <dd className="font-medium tabular-nums">
          {linkedContractStartDate != null && linkedContractEndDate != null
            ? `${linkedContractStartDate} – ${linkedContractEndDate}`
            : "—"}
        </dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground inline-flex items-center gap-1">
          Facility fee rate
          <InfoTooltip
            content={CONTRACT_FACILITY_FEE_RATE_TOOLTIP}
            iconClassName="h-3.5 w-3.5 shrink-0"
          />
        </dt>
        <dd className="font-medium tabular-nums">
          {linkedFacilityFeeRatePercent != null ? `${linkedFacilityFeeRatePercent}%` : "—"}
        </dd>
      </div>
      {linkedFacilityFeeBalance ? (
        <FacilityFeeBalanceSummary
          balance={linkedFacilityFeeBalance}
          stacked
          owedLabelExtra={
            <InfoTooltip
              content={CONTRACT_FACILITY_FEE_CAP_TOOLTIP}
              iconClassName="h-3.5 w-3.5 shrink-0"
            />
          }
        />
      ) : null}
    </dl>
  );

  const invoiceOfferTermsList = invoiceOfferTerms;

  const renderAcceptDeclineContent = () => {
    if (isRejectMode) {
      return renderSigningStepContent("signing");
    }

    const acceptDisabled =
      isPending ||
      isLoadingSigningEnvelopes ||
      (modalMode.ui === "accept_decline" && !modalMode.canAccept) ||
      (canDirectAccept && !utilisationConsentsComplete);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DocumentTextIcon className="h-5 w-5 text-primary" />
            Offer terms
          </CardTitle>
          <CardDescription>
            {canDirectAccept
              ? "No signing package is required for this invoice. Confirm the utilisation, then accept or decline."
              : (modalMode.ui === "accept_decline" && modalMode.blockedMessage) ||
                "Finish facility signing first before accepting this invoice offer."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {invoiceOfferTermsList}
          {modalMode.ui === "accept_decline" ? (
            <UtilisationOfferTerms
              showConsents={canDirectAccept}
              consentsLocked={acceptOfferConfirmOpen}
              consentIds={utilisationConsentIds}
              onConsentIdsChange={setUtilisationConsentIds}
            />
          ) : null}
          <Separator />
          <div className="space-y-2">
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
            <ApplicationSummaryDownloadButton
              applicationId={applicationId}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              disabled={isPending}
              onClick={() => setIsRejectMode(true)}
            >
              Reject Offer
            </Button>
            <Button className="h-11 rounded-xl" onClick={handleAccept} disabled={acceptDisabled}>
              {acceptInvoice.isPending ? "Accepting..." : "Accept Offer & Authorize Listing"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // After Step 1 submit (or if reopened while PENDING_ADMIN_REVIEW): simple completion
  // view — same pattern as application processing-fee success — not the full Review Offer UI.
  if (displaySigningStepId === "awaiting_review") {
    if (mode === "inline") {
      return (
        <div className={cn("mx-auto w-full max-w-md", className)}>
          <OfferAcceptanceSubmittedSuccessView onContinue={onClose} />
        </div>
      );
    }
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose?.()}>
        <DialogContent
          className="max-w-md border-0 bg-transparent p-0 shadow-none"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Documents submitted</DialogTitle>
          <OfferAcceptanceSubmittedSuccessView onContinue={onClose} />
        </DialogContent>
      </Dialog>
    );
  }

  const headingBadges = (
    <>
      <Badge variant="outline" className="font-normal">
        {type === "contract" ? "Facility" : "Invoice"}
      </Badge>
      <Badge
        variant="secondary"
        className="border-transparent bg-status-success-bg font-normal text-status-success-text"
      >
        {offeredValue} approved
      </Badge>
    </>
  );
  const headingDescriptionText = useSigningStepper
    ? "Complete each step to accept this offer."
    : "Accept or decline this offer.";

  const mainBodyContent = (
    <>
      {phaseDeadline?.urgency === "soon" || phaseDeadline?.urgency === "past" ? (
          <Alert
            variant={phaseDeadline.urgency === "past" ? "destructive" : "default"}
            className={cn(
              "mt-4 flex items-start gap-3",
              phaseDeadline.urgency === "soon" &&
                "border-status-action-text/30 bg-status-action-bg text-status-action-text"
            )}
          >
            {phaseDeadline.urgency === "past" ? (
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <ClockIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            )}
            <AlertDescription className="min-w-0">
              {phaseDeadline.urgency === "past"
                ? `Expired ${phaseDeadline.absolute}. Accepting is no longer available. If CashSouk sends a new offer, it will appear on your applications.`
                : `${phaseDeadlineRowLabel} ${phaseDeadline.absolute} — ${phaseDeadline.relative}. Act soon to avoid this offer lapsing.`}
            </AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <p className="py-8 text-sm text-muted-foreground">Loading offer...</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SigningProgressStepper
                      steps={useSigningStepper ? signingSteps : acceptDeclineSteps}
                      onStepClick={
                        useSigningStepper
                          ? (stepId) => handleSigningStepSelect(stepId as SigningOfferStepId)
                          : undefined
                      }
                    />
                  </CardContent>
                </Card>

                {useSigningStepper ? (
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
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Contract details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>{linkedContractDetailsList}</CardContent>
                  </Card>
                )}
              </div>

              <div className="min-w-0">
                {isPhaseDeadlinePast ? (
                  <Card className="border-destructive/20 bg-destructive/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        Offer Expired
                      </CardTitle>
                      <CardDescription>
                        Expired {phaseDeadline?.absolute}. You can still download the offer letter from
                        the details panel.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        No further action is available in this dialog. Close it and check your
                        applications — a new offer will appear here if CashSouk resends one.
                      </p>
                    </CardContent>
                  </Card>
                ) : useSigningStepper ? (
                  <>
                    {keepAcceptanceDocsDraftMounted ? (
                      <div
                        className={cn(displaySigningStepId !== "documents" && "hidden")}
                        aria-hidden={displaySigningStepId !== "documents"}
                      >
                        {renderSigningStepContent("documents")}
                      </div>
                    ) : null}
                    {displaySigningStepId !== "documents" || !keepAcceptanceDocsDraftMounted
                      ? renderSigningStepContent(displaySigningStepId)
                      : null}
                  </>
                ) : (
                  renderAcceptDeclineContent()
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
              {!isPhaseDeadlinePast &&
              !envelopeCompleted &&
              displaySigningStepId !== "complete" &&
              ((useSigningStepper &&
                displaySigningStepId !== "rejected" &&
                displaySigningStepId !== "declined") ||
                isRejectMode) ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    setIsRejectMode((prev) => {
                      if (prev) {
                        setRejectionReason("");
                        setSelectedDeclineReason("");
                      }
                      return !prev;
                    })
                  }
                  disabled={isPending || (useSigningStepper && isPostDocsConfigLoading)}
                  className="rounded-xl"
                >
                  {isRejectMode ? "Cancel decline" : "Decline offer"}
                </Button>
              ) : null}
              <Button variant="outline" className="rounded-xl" onClick={requestClose}>
                Close
              </Button>
            </div>
          </>
        )}
    </>
  );

  const confirmDialogs = (
    <>
      <OfferAcceptOtpDialog
        key={`${applicationId}:${invoice?.id ?? "none"}`}
        open={acceptOfferConfirmOpen}
        onOpenChange={(open) => {
          if (!open) frozenUtilisationConsentsRef.current = null;
          setAcceptOfferConfirmOpen(open);
        }}
        applicationId={applicationId}
        invoiceId={invoice?.id ?? ""}
        offeredValue={offeredValue}
        accepting={acceptInvoice.isPending}
        onAccept={handleConfirmDirectInvoiceAccept}
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
          onClose?.();
        }}
      />
    </>
  );

  if (mode === "inline") {
    return (
      <div
        className={cn(
          "w-full rounded-2xl border border-border bg-card p-6 shadow-sm",
          className
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xl font-semibold leading-none tracking-tight">
            Review financing offer
            {headingBadges}
          </div>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{headingDescriptionText}</p>
        {mainBodyContent}
        {confirmDialogs}
      </div>
    );
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-xl border-border p-6 gap-0">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl flex items-center gap-3">
              Review financing offer
              {headingBadges}
            </DialogTitle>
          </div>
          <DialogDescription>{headingDescriptionText}</DialogDescription>
        </DialogHeader>
        {mainBodyContent}
      </DialogContent>
      {confirmDialogs}
    </Dialog>
  );
}
