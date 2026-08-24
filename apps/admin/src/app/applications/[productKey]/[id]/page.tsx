"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@cashsouk/ui";
import { useApplicationDetail } from "@/hooks/use-application-detail";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import { useUpdateApplicationStatus } from "@/hooks/use-update-application-status";
import {
  useApproveReviewSection,
  useRejectReviewSection,
  useResetSectionReviewToPending,
  useResetItemReviewToPending,
  useApproveReviewItem,
  useRejectReviewItem,
  useRequestAmendmentReviewItem,
  useAddSectionComment,
  useAddPendingAmendment,
  useListPendingAmendments,
  useRemovePendingAmendment,
  useSubmitAmendmentRequest,
  useSendContractOffer,
  useSendInvoiceOffer,
  useStartApplicationGuarantorAml,
} from "@/hooks/use-application-review-actions";
import {
  ApplicationReviewTabs,
  ApplicationReviewTabContent,
} from "@/components/application-review-tabs";
import { ApplicationReviewRemarkDialog } from "@/components/application-review-remark-dialog";
import {
  SectionContent,
  ReviewSummaryCard,
  RecentActivityCard,
  AmendmentReviewModal,
  getSectionRejectCommonReasons,
  type ReviewSectionId,
} from "@/components/application-review";
import { useProducts } from "@/hooks/use-products";
import { productName, resolveDisplayProductForNav } from "@/app/settings/products/product-utils";
import { resolveProductImageS3KeyFromWorkflow } from "@cashsouk/types";
import {
  getReviewTabLabel,
  getTabUnlockTooltip,
  isTabUnlocked,
} from "@/components/application-review/review-registry";
import { getEffectiveReviewTabDescriptors } from "@/lib/effective-review-tab-descriptors";
import { mapAdminCapacityActionError } from "@/lib/facility-capacity-display";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import {
  createApiClient,
  useAuthToken,
  readInvoiceMaturityMonthsFromWorkflow,
} from "@cashsouk/config";
import {
  computeHasPendingDirectorShareholder,
  formatApplicationReference,
  getSectionForScopeKey,
  getOfferAcceptanceFromOfferDetails,
  buildOriginationPhaseInput,
  canRejectApplication,
  isCompletedWithNoApprovedInvoices,
  resolveOriginationPhase,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { orgHref } from "@/lib/admin-directory-hrefs";
import { ApplicationDetailHero } from "@/applications/application-detail-hero";
import {
  applicationFinancingStructureLabel,
  applicationPaymasterName,
} from "@/applications/application-hero-facts";
import {
  isSignedContractOfferLetterAvailable,
  isSignedInvoiceOfferLetterAvailable,
} from "@/components/application-review/offer-signing-availability";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import { useAdminSigningEnvelopes } from "@/hooks/use-signing-envelopes";
import type { AdminPermission } from "@cashsouk/types";
import JSZip from "jszip";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

function RelatedRecordLink({
  label,
  value,
  href,
  display,
}: {
  label: string;
  value: string | null | undefined;
  href?: string | null;
  display?: string | null;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      {value ? (
        href ? (
          <Link
            href={href}
            className="group flex min-w-0 items-center gap-1 break-all font-mono text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            <span className="min-w-0 break-all">{display ?? value}</span>
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
          </Link>
        ) : (
          <div className="break-all font-mono text-xs font-medium">{display ?? value}</div>
        )
      ) : (
        <div className="text-sm text-muted-foreground">—</div>
      )}
    </div>
  );
}

const SECTION_PERMISSION_MAP: Record<string, AdminPermission> = {
  financial: "applications.financial.manage",
  company_details: "applications.company.manage",
  business_details: "applications.business_guarantor.manage",
  supporting_documents: "applications.documents.manage",
  acceptance_documents: "applications.documents.manage",
  contract_details: "applications.contract.manage",
  invoice_details: "applications.invoice.manage",
};

export default function DynamicApplicationDetailPage() {
  const { can } = usePermissions();
  const canAppManage = can("applications.manage");
  const params = useParams();
  const productKey = params.productKey as string;
  const applicationId = params.id as string;
  const { getAccessToken } = useAuthToken();
  const platformFinanceApiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );
  const { data: platformFinanceSettings } = useQuery({
    queryKey: ["platform-finance-settings"],
    queryFn: async () => {
      const response = await platformFinanceApiClient.getPlatformFinanceSettings();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
  const platformFeeRateCapPercent = platformFinanceSettings?.platformFeeRateCapPercent ?? 3;

  const { data: app, isLoading, error } = useApplicationDetail(applicationId);
  const { data: signingEnvelopes = [] } = useAdminSigningEnvelopes(applicationId);
  const updateStatus = useUpdateApplicationStatus();

  // Fetch products to get the current product name (include deleted/inactive for nav key match)
  const { data: productsData } = useProducts({ page: 1, pageSize: 100, includeDeleted: true });
  const currentProduct = productsData?.products
    ? resolveDisplayProductForNav(productsData.products, productKey)
    : undefined;

  const currentProductName = currentProduct ? productName(currentProduct) : undefined;
  const currentProductImageS3Key = currentProduct
    ? resolveProductImageS3KeyFromWorkflow(currentProduct.workflow)
    : null;
  const productDefaultFacilityFeeRatePercent =
    (currentProduct as { default_facility_fee_rate_percent?: number | null })
      ?.default_facility_fee_rate_percent ?? null;

  const [rejectApplicationDialogOpen, setRejectApplicationDialogOpen] = React.useState(false);

  const approveSection = useApproveReviewSection();
  const rejectSection = useRejectReviewSection();
  const resetSectionToPending = useResetSectionReviewToPending();
  const resetItemToPending = useResetItemReviewToPending();
  const addPendingAmendment = useAddPendingAmendment();
  const approveItem = useApproveReviewItem();
  const rejectItem = useRejectReviewItem();
  const requestAmendmentReviewItem = useRequestAmendmentReviewItem();
  const addSectionComment = useAddSectionComment();
  const { data: pendingAmendments = [] } = useListPendingAmendments(applicationId);
  const removePendingAmendment = useRemovePendingAmendment();
  const submitAmendmentRequest = useSubmitAmendmentRequest();
  const sendContractOffer = useSendContractOffer();
  const sendInvoiceOffer = useSendInvoiceOffer();
  const startGuarantorAml = useStartApplicationGuarantorAml();
  const [amendmentModalOpen, setAmendmentModalOpen] = React.useState(false);

  const [noteDialog, setNoteDialog] = React.useState<
    | { open: boolean; action: "reject" | "amend"; section: ReviewSectionId }
    | {
        open: boolean;
        action: "reject" | "amend";
        itemType: "invoice" | "document";
        itemId: string;
      }
    | { open: boolean; action: "approve"; section: ReviewSectionId }
    | { open: boolean; action: "approve"; itemType: "invoice" | "document"; itemId: string }
  >({ open: false, action: "reject", section: "financial" });

  const REVIEWABLE_STATUSES = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "CONTRACT_PENDING",
    "CONTRACT_SENT",
    "CONTRACT_ACCEPTED",
    "INVOICE_ACCEPTED",
    "SIGNING_PENDING",
    "INVOICE_PENDING",
    "INVOICES_SENT",
    "RESUBMITTED",
    "AMENDMENT_REQUESTED",
    "OFFER_EXPIRED",
  ];
  const isReviewable = !!app && REVIEWABLE_STATUSES.includes(app.status);
  const isFinalApplicationForAmlGate = ["COMPLETED", "REJECTED", "WITHDRAWN", "ARCHIVED"].includes(
    String(app?.status ?? "")
  );
  const applicationContractId =
    (app as { contract_id?: string | null } | null)?.contract_id ??
    (app?.contract as { id?: string | null } | null)?.id ??
    null;
  const linkedNotes =
    (app as {
      linked_notes?: Array<{
        id: string;
        note_reference: string;
        title: string;
        status: string;
      }>;
    } | null)?.linked_notes ?? [];
  const applicationPeople = React.useMemo(() => {
    const people = (app as unknown as { people?: unknown } | null)?.people;
    return Array.isArray(people) ? (people as ApplicationPersonRow[]) : [];
  }, [app]);
  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();
  const [downloadAllDocumentsPending, setDownloadAllDocumentsPending] = React.useState(false);

  const handleDownloadAllDocuments = React.useCallback(
    async (files: { s3Key: string; fileName: string; category: string; field: string }[]) => {
      if (!files.length) {
        toast.error("No supporting documents available for download");
        return;
      }
      try {
        setDownloadAllDocumentsPending(true);
        const token = await getAccessToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const zip = new JSZip();
        const usedNames = new Map<string, Map<string, number>>();

        const sanitizePathSegment = (value: string, fallback: string) => {
          const v = value.trim();
          const cleaned = v.replace(/[\\/:*?"<>|]/g, "_").replace(/\.+/g, ".").replace(/\s+/g, " ");
          return cleaned || fallback;
        };

        const getUniqueName = (name: string, category: string, field: string) => {
          const trimmed = name.trim() || "document.pdf";
          const safeCategory = sanitizePathSegment(category, "Others");
          const safeField = sanitizePathSegment(field, "Document");
          const folderKey = `${safeCategory}/${safeField}`;
          const byFolder = usedNames.get(folderKey) ?? new Map<string, number>();
          const count = byFolder.get(trimmed) ?? 0;
          byFolder.set(trimmed, count + 1);
          usedNames.set(folderKey, byFolder);
          const safeName = sanitizePathSegment(trimmed, "document.pdf");
          if (count === 0) return `${safeCategory}/${safeField}/${safeName}`;
          const dot = safeName.lastIndexOf(".");
          if (dot <= 0) return `${safeCategory}/${safeField}/${safeName} (${count + 1})`;
          const base = safeName.slice(0, dot);
          const ext = safeName.slice(dot);
          return `${safeCategory}/${safeField}/${base} (${count + 1})${ext}`;
        };

        for (const item of files) {
          const response = await fetch(`${apiUrl}/v1/s3/download-url`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify({ s3Key: item.s3Key }),
          });
          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error?.message || "Failed to get download URL");
          }
          const downloadUrl = result.data?.downloadUrl;
          if (!downloadUrl) {
            throw new Error("Failed to get download URL");
          }
          const fileResponse = await fetch(downloadUrl);
          if (!fileResponse.ok) {
            throw new Error("Failed to fetch one of the files");
          }
          const blob = await fileResponse.blob();
          const entryName = getUniqueName(item.fileName, item.category, item.field);
          zip.file(entryName, blob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const objectUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = objectUrl;
        const suffix = formatApplicationReference({
          displayReference: (app as { displayReference?: string | null } | undefined)?.displayReference,
          id: app?.id ?? applicationId,
        }).replace(/[^A-Z0-9-]/gi, "");
        link.download = `supporting-documents-${suffix}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to download documents ZIP");
      } finally {
        setDownloadAllDocumentsPending(false);
      }
    },
    [getAccessToken, app?.id, applicationId]
  );

  const handleViewSignedInvoiceOffer = React.useCallback(
    async (invoiceId: string) => {
      const signedInvoiceOfferAvailable = isSignedInvoiceOfferLetterAvailable({
        invoiceId,
        envelopes: signingEnvelopes,
      });
      if (!applicationId || !invoiceId || !signedInvoiceOfferAvailable) {
        toast.error("Signed offer document is unavailable");
        return;
      }
      try {
        const blob = await platformFinanceApiClient.getAdminSignedInvoiceOfferLetterBlob(applicationId, invoiceId);
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open signed offer letter");
      }
    },
    [platformFinanceApiClient, applicationId, signingEnvelopes]
  );

  const signedContractOfferAvailable = React.useMemo(
    () =>
      isSignedContractOfferLetterAvailable({
        contractId: (app?.contract as { id?: string } | null | undefined)?.id,
        envelopes: signingEnvelopes,
      }),
    [app?.contract, signingEnvelopes]
  );

  const handleViewSignedContractOffer = React.useCallback(async () => {
    if (!applicationId || !signedContractOfferAvailable) {
      toast.error("Signed offer document is unavailable");
      return;
    }
    try {
      const blob = await platformFinanceApiClient.getAdminSignedContractOfferLetterBlob(applicationId);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open signed offer letter");
    }
  }, [platformFinanceApiClient, applicationId, signedContractOfferAvailable]);

  const visibleReviewSectionsFromApi = React.useMemo(() => {
    const fromApi = (app as { visible_review_sections?: unknown } | undefined)
      ?.visible_review_sections;
    if (!Array.isArray(fromApi)) return null;
    const normalized = fromApi.filter((s): s is string => typeof s === "string");
    const set = new Set(normalized);
    return normalized.length > 0 ? set : null;
  }, [app]);
  const structureType = (app?.financing_structure as { structure_type?: string } | null | undefined)?.structure_type;
  const isInvoiceOnly = structureType === "invoice_only";

  // Prefer frozen product_version workflow from detail; live catalog can drift after re-version.
  const reviewProductWorkflow = React.useMemo((): unknown[] | undefined => {
    const frozen = (app as { product_workflow?: unknown } | undefined)?.product_workflow;
    if (Array.isArray(frozen) && frozen.length > 0) return frozen;
    const live = (currentProduct as { workflow?: unknown } | undefined)?.workflow;
    return Array.isArray(live) ? live : undefined;
  }, [app, currentProduct]);

  const invoiceRatioLimits = React.useMemo(() => {
    const workflow = (reviewProductWorkflow ?? []) as {
      id?: string;
      name?: string;
      config?: Record<string, unknown>;
    }[];
    const invoiceStep = workflow.find(
      (s) => s.id?.includes?.("invoice_details") || s.name?.toLowerCase?.().includes?.("invoice")
    );
    const config = invoiceStep?.config ?? {};
    const min =
      typeof config.min_financing_ratio_percent === "number"
        ? config.min_financing_ratio_percent
        : 60;
    const max =
      typeof config.max_financing_ratio_percent === "number"
        ? config.max_financing_ratio_percent
        : 80;
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }, [reviewProductWorkflow]);

  const minMonthsReviewToMaturityForOffer = React.useMemo(() => {
    return readInvoiceMaturityMonthsFromWorkflow(reviewProductWorkflow ?? []).minMonthsReviewToMaturity;
  }, [reviewProductWorkflow]);

  const effectiveTabDescriptors = React.useMemo(
    () => getEffectiveReviewTabDescriptors(reviewProductWorkflow, app ?? null),
    [reviewProductWorkflow, app]
  );
  const hasAcceptanceTab = effectiveTabDescriptors.some(
    (descriptor) => descriptor.reviewSection === "acceptance_documents"
  );

  const defaultReviewTabId = effectiveTabDescriptors[0]?.id ?? "financial";
  const [reviewTabValue, setReviewTabValue] = React.useState<string | null>(null);
  const activeReviewTabId = reviewTabValue ?? defaultReviewTabId;

  React.useEffect(() => {
    if (
      reviewTabValue != null &&
      !effectiveTabDescriptors.some((descriptor) => descriptor.id === reviewTabValue)
    ) {
      setReviewTabValue(null);
    }
  }, [effectiveTabDescriptors, reviewTabValue]);

  const goToAcceptanceTab = React.useCallback(() => {
    const acceptanceTab = effectiveTabDescriptors.find(
      (descriptor) => descriptor.reviewSection === "acceptance_documents"
    );
    if (acceptanceTab) {
      setReviewTabValue(acceptanceTab.id);
    }
  }, [effectiveTabDescriptors]);

  const isExistingContract = React.useMemo(
    () =>
      (app?.financing_structure as { structure_type?: string } | undefined)?.structure_type ===
      "existing_contract",
    [app?.financing_structure]
  );

  const reviewSections = React.useMemo(() => {
    const reviewItems =
      (app?.application_review_items as { item_type: string; item_id: string; status: string }[]) ??
      [];
    const reviewSectionStatuses =
      (app?.application_reviews as { section: string; status: string }[] | undefined) ?? [];
    const reviewSectionStatusMap = new Map<string, string>();
    for (const review of reviewSectionStatuses) {
      reviewSectionStatusMap.set(review.section, review.status);
    }
    const orderedSections: string[] = effectiveTabDescriptors.map((d) => d.reviewSection);
    for (const review of reviewSectionStatuses) {
      if (visibleReviewSectionsFromApi && !visibleReviewSectionsFromApi.has(review.section)) {
        continue;
      }
      if (!orderedSections.includes(review.section)) {
        orderedSections.push(review.section);
      }
    }
    const baseSections = orderedSections.map((section) => {
      let status = reviewSectionStatusMap.get(section) ?? "PENDING";
      if (section === "contract_details" && isExistingContract) {
        status = "APPROVED";
      }
      if (section === "acceptance_documents" && isExistingContract) {
        status = "APPROVED";
      }
      return { section, status };
    });

    const sectionWithAmendmentFromItems = new Set<string>();
    for (const item of reviewItems) {
      if (item.status === "AMENDMENT_REQUESTED") {
        const section =
          item.item_type === "invoice" ? "invoice_details" : getSectionForScopeKey(item.item_id);
        sectionWithAmendmentFromItems.add(section);
      }
    }

    return baseSections.map((s) => {
      const fromItems = sectionWithAmendmentFromItems.has(s.section);
      const status =
        s.status === "APPROVED" || s.status === "REJECTED"
          ? s.status
          : fromItems
            ? "AMENDMENT_REQUESTED"
            : s.status;
      return { section: s.section, status };
    });
  }, [
    app?.application_reviews,
    app?.application_review_items,
    effectiveTabDescriptors,
    isExistingContract,
    visibleReviewSectionsFromApi,
  ]);

  const sectionStatusMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of reviewSections) {
      m.set(s.section, s.status);
    }
    return m;
  }, [reviewSections]);
  const requiredReviewSections = React.useMemo(() => {
    const fromApi = (app as { required_review_sections?: unknown } | undefined)
      ?.required_review_sections;
    if (Array.isArray(fromApi)) {
      const normalized = fromApi.filter((s): s is string => typeof s === "string");
      if (normalized.length > 0) return normalized;
    }
    return effectiveTabDescriptors.map((d) => d.reviewSection);
  }, [app, effectiveTabDescriptors]);

  const tabPrerequisitesFromApi = React.useMemo(() => {
    const raw = (app as { review_section_prerequisites?: unknown } | undefined)
      ?.review_section_prerequisites;
    if (!raw || typeof raw !== "object") return undefined;
    const record = raw as Record<string, unknown>;
    const normalized: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!Array.isArray(value)) continue;
      const prereqs = value.filter((v): v is string => typeof v === "string");
      normalized[key] = prereqs;
    }
    return normalized;
  }, [app]);
  const allSectionsApproved = React.useMemo(
    () =>
      requiredReviewSections.length > 0 &&
      requiredReviewSections.every((section) => sectionStatusMap.get(section) === "APPROVED"),
    [requiredReviewSections, sectionStatusMap]
  );

  const hasRejectedSection = React.useMemo(
    () => requiredReviewSections.some((section) => sectionStatusMap.get(section) === "REJECTED"),
    [requiredReviewSections, sectionStatusMap]
  );
  const originationPhase = React.useMemo(() => {
    if (!app) return "underReview" as const;
    const invoices = (app.invoices ?? []) as Array<{
      status?: string;
      contract_id?: string | null;
      offer_details?: unknown;
    }>;
    const standalone = invoices.find((invoice) => !invoice.contract_id);
    const offerAcceptanceStatus =
      getOfferAcceptanceFromOfferDetails(
        (app.contract as { offer_details?: unknown } | null)?.offer_details
      )?.status ??
      getOfferAcceptanceFromOfferDetails(standalone?.offer_details)?.status ??
      null;
    return resolveOriginationPhase(
      buildOriginationPhaseInput({
        applicationStatus: app.status,
        contract: app.contract as { status?: string | null } | null,
        invoices,
        offerAcceptanceStatus,
        signingEnvelopes,
      })
    );
  }, [app, signingEnvelopes]);
  const canPhaseReject = canRejectApplication(originationPhase);
  const facilityInForceNoInvoices = isCompletedWithNoApprovedInvoices(
    String(app?.status ?? ""),
    ((app?.invoices ?? []) as Array<{ status?: string }>).map((invoice) => String(invoice.status ?? ""))
  );
  const availableReviewSections = React.useMemo(
    () => new Set(effectiveTabDescriptors.map((d) => d.reviewSection)),
    [effectiveTabDescriptors]
  );

  const handleApproveSection = (section: string) => {
    setNoteDialog({ open: true, action: "approve", section: section as ReviewSectionId });
  };

  const handleRejectItem = async (remark: string) => {
    const d = noteDialog;
    if (!d || !("itemType" in d)) return;
    try {
      await rejectItem.mutateAsync({
        applicationId,
        itemType: d.itemType,
        itemId: d.itemId,
        remark,
      });
      toast.success("Item rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
      throw err;
    }
  };

  const handleAddPendingAmendmentItem = async (remark: string) => {
    const d = noteDialog;
    if (!d || !("itemType" in d)) return;
    try {
      await addPendingAmendment.mutateAsync({
        applicationId,
        scope: "item",
        remark,
        itemType: d.itemType,
        itemId: d.itemId,
      });
      toast.success("Added to amendment list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add amendment");
      throw err;
    }
  };

  const handleRequestAcceptanceDocumentChange = async (remark: string) => {
    const d = noteDialog;
    if (!d || !("itemType" in d)) return;
    try {
      await requestAmendmentReviewItem.mutateAsync({
        applicationId,
        itemType: d.itemType,
        itemId: d.itemId,
        remark,
      });
      toast.success("Change requested — issuer has been notified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request change");
      throw err;
    }
  };

  const handleAddPendingAmendmentSection = async (remark: string) => {
    const d = noteDialog;
    if (!d || !("section" in d)) return;
    try {
      await addPendingAmendment.mutateAsync({
        applicationId,
        scope: "section",
        scopeKey: d.section,
        remark,
      });
      toast.success("Added to amendment list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add amendment");
      throw err;
    }
  };

  const handleNoteDialogConfirm = async (remark: string) => {
    const d = noteDialog;
    if (!d) return;
    if ("section" in d) {
      if (d.action === "approve") {
        try {
          await approveSection.mutateAsync({
            applicationId,
            section: d.section,
            remark: remark || undefined,
          });
          toast.success("Section approved");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to approve");
          throw err;
        }
      } else if (d.action === "reject") {
        await rejectSection.mutateAsync({ applicationId, section: d.section, remark });
        toast.success("Section rejected");
      } else {
        await handleAddPendingAmendmentSection(remark);
      }
    } else if ("itemType" in d) {
      if (d.action === "approve") {
        try {
          await approveItem.mutateAsync({
            applicationId,
            itemType: d.itemType,
            itemId: d.itemId,
            remark: remark || undefined,
          });
          toast.success("Item approved");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to approve");
          throw err;
        }
      } else if (d.action === "reject") {
        await handleRejectItem(remark);
      } else if (d.itemId.startsWith("acceptance_documents:")) {
        await handleRequestAcceptanceDocumentChange(remark);
      } else {
        await handleAddPendingAmendmentItem(remark);
      }
    }
  };

  const noteDialogIsSection = noteDialog && "section" in noteDialog;
  const noteDialogIsApprove = noteDialog?.action === "approve";
  const noteDialogIsAcceptanceChange =
    !!noteDialog &&
    "itemType" in noteDialog &&
    noteDialog.action === "amend" &&
    noteDialog.itemId.startsWith("acceptance_documents:");
  const sectionLabel = noteDialogIsSection
    ? noteDialog.section === "contract_details" && isInvoiceOnly
      ? "Customer"
      : getReviewTabLabel(noteDialog.section)
    : "";
  const noteDialogTitle = noteDialogIsApprove
    ? noteDialogIsSection
      ? `Approve ${sectionLabel}?`
      : "Approve item?"
    : noteDialogIsSection
      ? noteDialog.action === "reject"
        ? `Reject ${sectionLabel}?`
        : `Request Amendment for ${sectionLabel}?`
      : noteDialog?.action === "reject"
        ? "Reject item?"
        : noteDialogIsAcceptanceChange
          ? "Request change?"
          : "Request amendment?";
  const noteDialogDescription = noteDialogIsApprove
    ? "Add an optional remark to record your review decision."
    : noteDialogIsAcceptanceChange
      ? "The issuer will be notified to update this acceptance document. A remark is required and will be shown to them."
      : noteDialogIsSection
        ? noteDialog.action === "reject"
          ? "This will reject the section. A remark is required."
          : "Add this section to the amendment list. A remark is required. Use the Request Amendment button to review and send all amendments."
        : "Add this item to the amendment list. A remark is required. Use the Request Amendment button to review and send all amendments.";
  const noteDialogSubmitLabel = noteDialogIsApprove
    ? "Approve"
    : noteDialog?.action === "reject"
      ? "Reject"
      : noteDialogIsAcceptanceChange
        ? "Request change"
        : "Add to List";
  const noteDialogCommonReasons =
    noteDialog && noteDialog.action === "reject"
      ? "section" in noteDialog
        ? getSectionRejectCommonReasons(noteDialog.section)
        : noteDialog.itemType === "invoice"
          ? getSectionRejectCommonReasons("invoice_details")
          : []
      : [];
  const noteDialogPending =
    approveSection.isPending ||
    approveItem.isPending ||
    rejectSection.isPending ||
    addPendingAmendment.isPending ||
    requestAmendmentReviewItem.isPending ||
    rejectItem.isPending;

  const handleConfirmRejectApplication = async () => {
    try {
      await updateStatus.mutateAsync({ id: applicationId, status: "REJECTED" });
      toast.success("Application rejected successfully");
      setRejectApplicationDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleResetToUnderReview = async () => {
    try {
      await updateStatus.mutateAsync({
        id: applicationId,
        status: "UNDER_REVIEW",
      });
      toast.success("Application reset to under review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset status");
    }
  };

  const requestedAmount = React.useMemo(() => {
    if (!app) return 0;
    if (app.invoices && app.invoices.length > 0) {
      return (app.invoices as { details?: Record<string, unknown> }[]).reduce(
        (sum: number, inv) => {
          const details = inv.details as Record<string, unknown> | undefined;
          const invoiceValue = parseFloat(String(details?.value ?? 0));
          const financingRatio = parseFloat(String(details?.financing_ratio_percent ?? 80));
          return sum + (invoiceValue * financingRatio) / 100;
        },
        0
      );
    }
    if (app.contract?.contract_details) {
      const cd = app.contract.contract_details as Record<string, unknown>;
      return parseFloat(String(cd?.value ?? cd?.approved_facility ?? 0));
    }
    return 0;
  }, [app]);

  return (
    <RequirePermission permission="applications.view">
      <>
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
            {isLoading ? <PageSkeleton /> : null}

            {error ? (
              <div className="py-8 text-center text-destructive">
                Error loading application: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : null}

            {app ? (
              <div className="space-y-6">
                <ApplicationDetailHero
                  productKey={productKey}
                  title={app.issuer_organization.name || "Unnamed organization"}
                  applicationId={app.id}
                  displayReference={(app as { displayReference?: string | null }).displayReference}
                  productName={currentProductName}
                  productImageS3Key={currentProductImageS3Key}
                  status={app.status}
                  structureLabel={applicationFinancingStructureLabel(
                    (app.financing_structure as { structure_type?: string } | null)?.structure_type
                  )}
                  directorPending={
                    !isFinalApplicationForAmlGate &&
                    computeHasPendingDirectorShareholder(applicationPeople)
                  }
                  requestedAmount={requestedAmount}
                  ownerName={`${app.issuer_organization.owner.first_name} ${app.issuer_organization.owner.last_name}`}
                  email={app.issuer_organization.owner.email}
                  paymaster={applicationPaymasterName({
                    contract: app.contract,
                    company_details: (app as { company_details?: Record<string, unknown> }).company_details,
                  })}
                  productVersion={
                    typeof (app as { product_version?: number }).product_version === "number"
                      ? String((app as { product_version: number }).product_version)
                      : "—"
                  }
                  submittedAt={app.submitted_at ?? null}
                  updatedAt={app.updated_at}
                  isReviewable={isReviewable}
                  canAppManage={canAppManage}
                  pendingAmendmentCount={pendingAmendments.length}
                  allSectionsApproved={allSectionsApproved}
                  hasRejectedSection={hasRejectedSection}
                  actionPending={updateStatus.isPending}
                  onResetToUnderReview={() => void handleResetToUnderReview()}
                  onRequestAmendment={() => setAmendmentModalOpen(true)}
                  onRejectApplication={() => setRejectApplicationDialogOpen(true)}
                  rejectBlockedByPhase={!canPhaseReject}
                  statusLabel={facilityInForceNoInvoices ? "Facility approved" : undefined}
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(380px,440px)]">
                  <div className="min-w-0 space-y-6">
                    <ApplicationReviewTabs
                    sections={reviewSections}
                    tabDescriptors={effectiveTabDescriptors}
                    defaultTabId={defaultReviewTabId}
                    tabValue={activeReviewTabId}
                    onTabValueChange={setReviewTabValue}
                  >
                    {effectiveTabDescriptors.map((descriptor) => {
                      const applicationWithdrawn = app?.status === "WITHDRAWN";
                      const isContractExistingContract =
                        descriptor.reviewSection === "contract_details" && isExistingContract;
                      const isAcceptanceExistingContract =
                        descriptor.reviewSection === "acceptance_documents" && isExistingContract;
                      const sectionPermission = SECTION_PERMISSION_MAP[descriptor.reviewSection];
                      const canManageSection = sectionPermission ? can(sectionPermission) : true;
                      const tabUnlocked = isTabUnlocked(
                        descriptor.reviewSection,
                        sectionStatusMap,
                        availableReviewSections,
                        tabPrerequisitesFromApi,
                        structureType
                      );
                      const actionLocked =
                        applicationWithdrawn ||
                        isContractExistingContract ||
                        isAcceptanceExistingContract ||
                        !tabUnlocked ||
                        !canManageSection;
                      const actionLockTooltip = actionLocked
                        ? !canManageSection
                          ? "You do not have permission to perform this action."
                          : applicationWithdrawn
                            ? "Application withdrawn"
                            : isContractExistingContract
                              ? "Facility was approved in a prior application"
                              : isAcceptanceExistingContract
                                ? "Acceptance was completed when the linked facility was approved"
                                : getTabUnlockTooltip(
                                  descriptor.reviewSection,
                                  sectionStatusMap,
                                  availableReviewSections,
                                  tabPrerequisitesFromApi,
                                  isInvoiceOnly ? { contract_details: "Customer" } : undefined,
                                  structureType
                                )
                        : undefined;
                      const sectionStatus = sectionStatusMap.get(descriptor.reviewSection);
                      return (
                        <ApplicationReviewTabContent key={descriptor.id} value={descriptor.id}>
                          <SectionContent
                            descriptor={descriptor}
                            app={app}
                            liveApplicationId={applicationId}
                            productWorkflow={reviewProductWorkflow}
                            productVersion={
                              typeof (app as { product_version?: number }).product_version === "number"
                                ? (app as { product_version: number }).product_version
                                : null
                            }
                            canManageSigning={canAppManage}
                            isReviewable={isReviewable}
                            approveSectionPending={approveSection.isPending}
                            approveItemPending={approveItem.isPending}
                            viewDocumentPending={viewDocumentPending}
                            isActionLocked={actionLocked}
                            actionLockTooltip={actionLockTooltip}
                            sectionStatus={sectionStatus}
                            sectionStatusMap={sectionStatusMap}
                            onResetSectionToPending={async (section) => {
                              try {
                                await resetSectionToPending.mutateAsync({ applicationId, section });
                                toast.success("Section reset to pending");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to reset section"
                                );
                              }
                            }}
                            onApproveSection={handleApproveSection}
                            onRejectSection={(s) =>
                              setNoteDialog({ open: true, action: "reject", section: s })
                            }
                            onRequestAmendmentSection={(s) =>
                              setNoteDialog({ open: true, action: "amend", section: s })
                            }
                            onViewDocument={handleViewDocument}
                            onDownloadDocument={handleDownloadDocument}
                            onDownloadAllDocuments={handleDownloadAllDocuments}
                            downloadAllDocumentsPending={downloadAllDocumentsPending}
                            onApproveItem={async (itemId, itemType) => {
                              setNoteDialog({
                                open: true,
                                action: "approve",
                                itemType,
                                itemId,
                              });
                            }}
                            onRejectItem={(itemId, itemType) =>
                              setNoteDialog({
                                open: true,
                                action: "reject",
                                itemType,
                                itemId,
                              })
                            }
                            onRequestAmendmentItem={(itemId, itemType) =>
                              setNoteDialog({
                                open: true,
                                action: "amend",
                                itemType,
                                itemId,
                              })
                            }
                            onResetItemToPending={async (itemId, itemType) => {
                              try {
                                await resetItemToPending.mutateAsync({
                                  applicationId,
                                  itemType,
                                  itemId,
                                });
                                toast.success("Item reset to pending");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to reset item"
                                );
                              }
                            }}
                            onAddSectionComment={async (section, comment) => {
                              await addSectionComment.mutateAsync({
                                applicationId,
                                section,
                                comment,
                              });
                              toast.success("Comment posted");
                            }}
                            onSendContractOffer={async ({ offeredFacility, facilityFeeRatePercent }) => {
                              try {
                                await sendContractOffer.mutateAsync({
                                  applicationId,
                                  offeredFacility,
                                  facilityFeeRatePercent,
                                });
                                if (hasAcceptanceTab) {
                                  toast.success("Facility offer sent — continue on Acceptance");
                                  goToAcceptanceTab();
                                } else {
                                  toast.success("Facility offer sent");
                                }
                              } catch (err) {
                                toast.error(
                                  mapAdminCapacityActionError(
                                    err,
                                    "Failed to send facility offer"
                                  ).message
                                );
                              }
                            }}
                            onSendInvoiceOffer={async ({
                              invoiceId,
                              offeredAmount,
                              offeredRatioPercent,
                              offeredProfitRatePercent,
                              platformFeeRatePercent,
                              risk_rating,
                              feeScheduleMode,
                              facilityFeeCollectAmount,
                              additionalFees,
                            }) => {
                              try {
                                await sendInvoiceOffer.mutateAsync({
                                  applicationId,
                                  invoiceId,
                                  offeredAmount,
                                  offeredRatioPercent,
                                  offeredProfitRatePercent,
                                  platformFeeRatePercent,
                                  risk_rating,
                                  feeScheduleMode,
                                  facilityFeeCollectAmount,
                                  additionalFees,
                                });
                                if (isInvoiceOnly && hasAcceptanceTab) {
                                  toast.success("Invoice offer sent — continue on Acceptance");
                                  goToAcceptanceTab();
                                } else {
                                  toast.success("Invoice offer sent");
                                }
                              } catch (err) {
                                toast.error(
                                  mapAdminCapacityActionError(
                                    err,
                                    "Failed to send invoice offer"
                                  ).message
                                );
                              }
                            }}
                            sendContractOfferPending={sendContractOffer.isPending}
                            sendInvoiceOfferPending={sendInvoiceOffer.isPending}
                            invoiceRatioLimits={invoiceRatioLimits}
                            platformFeeRateCapPercent={platformFeeRateCapPercent}
                            productDefaultFacilityFeeRatePercent={productDefaultFacilityFeeRatePercent}
                            minMonthsReviewToMaturityForOffer={minMonthsReviewToMaturityForOffer}
                            onViewSignedInvoiceOffer={handleViewSignedInvoiceOffer}
                            onViewSignedContractOffer={handleViewSignedContractOffer}
                            onTriggerGuarantorAml={canAppManage ? async (guarantorId) => {
                              try {
                                await startGuarantorAml.mutateAsync({
                                  applicationId,
                                  clientGuarantorId: guarantorId,
                                });
                                toast.success("AML screening started");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to start AML screening"
                                );
                              }
                            } : undefined}
                          />
                        </ApplicationReviewTabContent>
                      );
                    })}
                  </ApplicationReviewTabs>
                </div>

                <div className="min-w-0 space-y-6">
                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base">Related Records</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <RelatedRecordLink
                        label="Issuer Organization"
                        value={app.issuer_organization_id}
                        href={
                          can("organizations.view")
                            ? orgHref("issuer", app.issuer_organization_id)
                            : null
                        }
                        display={
                          app.issuer_organization.name
                            ? `${app.issuer_organization.name} (${app.issuer_organization_id})`
                            : app.issuer_organization_id
                        }
                      />
                      <RelatedRecordLink
                        label="Facility ID"
                        value={applicationContractId}
                        href={applicationContractId ? `/contracts/${encodeURIComponent(applicationContractId)}` : null}
                      />
                      {linkedNotes.length > 0 ? (
                        linkedNotes.map((note) => (
                          <RelatedRecordLink
                            key={note.id}
                            label="Note ID"
                            value={note.id}
                            href={`/notes/${encodeURIComponent(note.id)}`}
                            display={`${note.note_reference} (${note.id})`}
                          />
                        ))
                      ) : (
                        <RelatedRecordLink label="Note ID" value={null} />
                      )}
                    </CardContent>
                  </Card>

                  <ReviewSummaryCard sections={reviewSections} />

                  <RecentActivityCard
                    reviewTabSections={reviewSections}
                    events={
                      (app.application_review_events as {
                        event_type: string;
                        scope_key: string | null;
                        new_status: string;
                        remark: string | null;
                        created_at: string;
                      }[]) ?? []
                    }
                    remarks={
                      (app.application_review_remarks as {
                        scope_key: string;
                        action_type: string;
                        remark: string;
                        created_at: string;
                      }[]) ?? []
                    }
                    applicationId={applicationId}
                    productKey={productKey}
                    sectionLabelOverrides={isInvoiceOnly ? { contract_details: "Customer" } : undefined}
                    visibleReviewSections={app.visible_review_sections}
                  />
                </div>
              </div>
            </div>
            ) : null}
        </div>
      </div>

      <ApplicationReviewRemarkDialog
        open={noteDialog.open}
        onOpenChange={(open) =>
          setNoteDialog((prev) =>
            prev ? { ...prev, open } : { open: false, action: "reject", section: "financial" }
          )
        }
        title={noteDialogTitle}
        description={noteDialogDescription}
        submitLabel={noteDialogSubmitLabel}
        variant={noteDialog?.action === "reject" ? "destructive" : "default"}
        optional={noteDialog?.action === "approve"}
        commonReasons={noteDialogCommonReasons}
        onConfirm={handleNoteDialogConfirm}
        isPending={noteDialogPending}
      />

      <AmendmentReviewModal
        open={amendmentModalOpen}
        onOpenChange={setAmendmentModalOpen}
        items={pendingAmendments}
        onRemove={async (scope, scopeKey) => {
          await removePendingAmendment.mutateAsync({ applicationId, scope, scopeKey });
        }}
        onSubmit={async () => {
          await submitAmendmentRequest.mutateAsync({ applicationId });
          toast.success("Amendment request sent to issuer");
          setAmendmentModalOpen(false);
        }}
        isRemovePending={removePendingAmendment.isPending}
        isSubmitPending={submitAmendmentRequest.isPending}
      />

      <AlertDialog open={rejectApplicationDialogOpen} onOpenChange={setRejectApplicationDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject the application. The issuer will be notified and will need to submit a
              new application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => void handleConfirmRejectApplication()}
            >
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    </RequirePermission>
  );
}
