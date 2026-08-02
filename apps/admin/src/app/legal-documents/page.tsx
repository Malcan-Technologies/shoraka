"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { SystemHealthIndicator } from "../../components/system-health-indicator";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { uploadFileToS3 } from "../../hooks/use-site-documents";
import {
  DocumentIcon,
  ArrowPathIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  LEGAL_DOCUMENT_DEFAULT_AUDIENCE,
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
  type LegalDocumentAudience,
  type LegalDocumentDefinitionResponse,
  type LegalDocumentType,
  type LegalDocumentVersionResponse,
  type LegalDocumentVersionSummary,
} from "@cashsouk/types";
import { RequirePermission } from "../../components/require-permission";
import { usePermissions } from "../../hooks/use-permissions";
import {
  audienceLabel,
  buildArchiveDialogCopy,
  buildCreateDefinitionPayload,
  buildEditDefinitionPayload,
  buildPublishDialogTitle,
  canRestoreArchivedVersion,
  createFormDefaultsForAvailableTypes,
  documentCurrentStatus,
  documentCurrentVersion,
  EXISTING_LEGAL_TYPE_CREATE_MESSAGE,
  existingLegalDocumentTypes,
  availableLegalDocumentTypes,
  formatLegalDate,
  formatLegalFileSize,
  getLegalDocumentRowActions,
  hasLegalVersionHistory,
  isOnlyActivePublishedVersion,
  latestDraftVersion,
  latestPublishedVersion,
  legalDocumentDisplayName,
  legalRowVersionLabel,
  legalStatusBadgeVariant,
  matchesClientFilters,
  nextCreateOrchestrationAfterDefinition,
  onboardingBadgeLabel,
  onboardingBadgeVariant,
  OPERATIONAL_AUDIENCES,
  resetCreateOrchestration,
  shouldSkipDefinitionCreate,
  statusLabel,
  validateLegalPdfFile,
  websiteBadgeVariant,
  websiteVisibilityLabel,
  type CreateOrchestrationState,
  type LegalRowIconAction,
} from "../../lib/legal-documents-admin";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ITEMS_PER_PAGE = 20;

const LEGAL_TYPES = LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

type ListResponse = {
  documents: LegalDocumentDefinitionResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

const emptyCreateForm = () => ({
  type: "PDPA_NOTICE_AND_CONSENT" as LegalDocumentType,
  audience: LEGAL_DOCUMENT_DEFAULT_AUDIENCE.PDPA_NOTICE_AND_CONSENT,
  requiredForOnboarding: true,
  publicVisibility: false,
  file: null as File | null,
});

function ReacceptanceOptions({
  value,
  onChange,
  name,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  name: string;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <p className="text-sm font-medium">
        Require existing users to accept this version again?
      </p>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name={name}
          className="mt-1 accent-primary"
          checked={!value}
          onChange={() => onChange(false)}
        />
        <span className="text-sm">
          <span className="font-medium">No</span>
          <span className="mt-0.5 block text-muted-foreground">
            Only new or incomplete users must accept this version.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name={name}
          className="mt-1 accent-primary"
          checked={value}
          onChange={() => onChange(true)}
        />
        <span className="text-sm">
          <span className="font-medium">Yes</span>
          <span className="mt-0.5 block text-muted-foreground">
            Existing applicable users must accept this version before starting new
            transactions.
          </span>
        </span>
      </label>
    </div>
  );
}

export default function LegalDocumentsPage() {
  const { can } = usePermissions();
  const canManage = can("document_management.manage");
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = React.useState(false);

  const [selectedDefinition, setSelectedDefinition] =
    React.useState<LegalDocumentDefinitionResponse | null>(null);
  const [selectedVersion, setSelectedVersion] =
    React.useState<LegalDocumentVersionSummary | null>(null);
  const [uploadMode, setUploadMode] = React.useState<"new" | "replace">("new");
  const [reacceptanceRequired, setReacceptanceRequired] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [createFileError, setCreateFileError] = React.useState<string | null>(null);
  const [uploadFileError, setUploadFileError] = React.useState<string | null>(null);
  const [createOrchestration, setCreateOrchestration] =
    React.useState<CreateOrchestrationState>(resetCreateOrchestration());

  const [createForm, setCreateForm] = React.useState(emptyCreateForm);
  const [editForm, setEditForm] = React.useState({
    audience: "BOTH" as LegalDocumentAudience,
    requiredForOnboarding: true,
    publicVisibility: false,
  });
  const [versionFile, setVersionFile] = React.useState<File | null>(null);

  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "legal-documents", page, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(ITEMS_PER_PAGE),
      });
      if (searchQuery) params.set("search", searchQuery);
      const result = await apiClient.get<ListResponse>(
        `/v1/admin/legal-documents?${params.toString()}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load legal documents");
      }
      return result.data;
    },
  });

  const { data: typeCatalog = [] } = useQuery({
    queryKey: ["admin", "legal-documents", "type-catalog"],
    queryFn: async () => {
      const result = await apiClient.get<ListResponse>(
        "/v1/admin/legal-documents?page=1&pageSize=100"
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load legal document types");
      }
      return result.data.documents;
    },
    enabled: createDialogOpen,
  });

  const existingTypes = React.useMemo(
    () => existingLegalDocumentTypes(typeCatalog),
    [typeCatalog]
  );
  const availableTypes = React.useMemo(
    () => availableLegalDocumentTypes(typeCatalog),
    [typeCatalog]
  );

  const documents = (data?.documents ?? []).filter((doc) =>
    matchesClientFilters(doc, {
      audience: "all",
      status: statusFilter,
      publicVisibility: "all",
      onboarding: "all",
    })
  );
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const hasActiveFilters = Boolean(searchQuery) || statusFilter !== "all";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "legal-documents"] });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPage(1);
  };

  const uploadDraftVersion = async (
    definitionId: string,
    file: File
  ): Promise<{ versionNumber: number; versionId: string }> => {
    const uploadUrlResult = await apiClient.post<{
      uploadUrl: string;
      s3Key: string;
      version: number;
    }>(`/v1/admin/legal-documents/${definitionId}/versions/upload-url`, {
      fileName: file.name,
      contentType: "application/pdf",
      fileSize: file.size,
    });
    if (!uploadUrlResult.success) {
      throw new Error(uploadUrlResult.error?.message || "Failed to get upload URL");
    }

    await uploadFileToS3(uploadUrlResult.data.uploadUrl, file);

    const confirmResult = await apiClient.post<{ version: LegalDocumentVersionResponse }>(
      `/v1/admin/legal-documents/${definitionId}/versions`,
      {
        s3Key: uploadUrlResult.data.s3Key,
        fileName: file.name,
        contentType: "application/pdf",
        fileSize: file.size,
      }
    );
    if (!confirmResult.success) {
      throw new Error(confirmResult.error?.message || "Failed to save draft version");
    }
    return {
      versionNumber: confirmResult.data.version.version,
      versionId: confirmResult.data.version.id,
    };
  };

  /** Replace PDF on an existing Draft — same version number. */
  const replaceDraftPdfInPlace = async (
    versionId: string,
    file: File
  ): Promise<{ versionNumber: number; versionId: string }> => {
    const uploadUrlResult = await apiClient.post<{
      uploadUrl: string;
      s3Key: string;
      version: number;
    }>(`/v1/admin/legal-documents/versions/${versionId}/upload-url`, {
      fileName: file.name,
      contentType: "application/pdf",
      fileSize: file.size,
    });
    if (!uploadUrlResult.success) {
      throw new Error(uploadUrlResult.error?.message || "Failed to get upload URL");
    }

    await uploadFileToS3(uploadUrlResult.data.uploadUrl, file);

    const confirmResult = await apiClient.post<{ version: LegalDocumentVersionResponse }>(
      `/v1/admin/legal-documents/versions/${versionId}/replace-file`,
      {
        s3Key: uploadUrlResult.data.s3Key,
        fileName: file.name,
        contentType: "application/pdf",
        fileSize: file.size,
      }
    );
    if (!confirmResult.success) {
      throw new Error(confirmResult.error?.message || "Failed to replace draft PDF");
    }
    return {
      versionNumber: confirmResult.data.version.version,
      versionId: confirmResult.data.version.id,
    };
  };

  const publishVersionById = async (versionId: string, requireReaccept: boolean) => {
    const result = await apiClient.post(
      `/v1/admin/legal-documents/versions/${versionId}/publish`,
      { reacceptanceRequired: requireReaccept }
    );
    if (!result.success) {
      throw new Error(result.error?.message || "Failed to publish version");
    }
  };

  const handleCreateDocument = async () => {
    if (existingTypes.has(createForm.type)) {
      toast.error(EXISTING_LEGAL_TYPE_CREATE_MESSAGE, {
        action: {
          label: "Go to existing document",
          onClick: () => goToExistingDocument(createForm.type),
        },
      });
      return;
    }
    if (availableTypes.length === 0) {
      toast.error("All legal document types have already been added.", {
        description: "Use Upload new version on an existing row.",
      });
      return;
    }
    const pdfCheck = validateLegalPdfFile(createForm.file);
    if (!pdfCheck.ok) {
      setCreateFileError(pdfCheck.error);
      return;
    }
    setCreateFileError(null);
    setSaving(true);

    let orchestration = createOrchestration;
    let definitionCreated = Boolean(orchestration.definitionId);
    const displayName = legalDocumentDisplayName(createForm.type);

    try {
      let definitionId = orchestration.definitionId;
      let definitionTitle = orchestration.definitionTitle ?? displayName;

      if (!shouldSkipDefinitionCreate(orchestration)) {
        const result = await apiClient.post<{ document: LegalDocumentDefinitionResponse }>(
          "/v1/admin/legal-documents",
          buildCreateDefinitionPayload(createForm)
        );
        if (!result.success) {
          throw new Error(result.error?.message || "Failed to create legal document");
        }
        orchestration = nextCreateOrchestrationAfterDefinition(result.data.document);
        setCreateOrchestration(orchestration);
        definitionId = orchestration.definitionId;
        definitionTitle = orchestration.definitionTitle ?? displayName;
        definitionCreated = true;
      }

      if (!definitionId) {
        throw new Error("Legal document was not created");
      }

      await uploadDraftVersion(definitionId, pdfCheck.file);

      toast.success("Saved as draft", {
        description: `"${definitionTitle}" is ready to review and publish when you are.`,
      });
      setCreateDialogOpen(false);
      setCreateForm(emptyCreateForm());
      setCreateOrchestration(resetCreateOrchestration());
      invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      const isExistingType =
        message.includes("already exists") ||
        message.includes(EXISTING_LEGAL_TYPE_CREATE_MESSAGE);
      toast.error(isExistingType ? EXISTING_LEGAL_TYPE_CREATE_MESSAGE : "Save failed", {
        description: isExistingType
          ? undefined
          : definitionCreated
            ? `${message} Details were saved — choose the PDF again and retry Save as Draft.`
            : message,
        action: isExistingType
          ? {
              label: "Go to existing document",
              onClick: () => goToExistingDocument(createForm.type),
            }
          : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditDefinition = async () => {
    if (!selectedDefinition) return;
    setSaving(true);
    try {
      const result = await apiClient.patch<{ document: LegalDocumentDefinitionResponse }>(
        `/v1/admin/legal-documents/${selectedDefinition.id}`,
        buildEditDefinitionPayload({
          type: selectedDefinition.type,
          audience: editForm.audience,
          requiredForOnboarding: editForm.requiredForOnboarding,
          publicVisibility: editForm.publicVisibility,
        })
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update document");
      }
      toast.success("Settings updated");
      setEditDialogOpen(false);
      setSelectedDefinition(null);
      invalidate();
    } catch (error) {
      toast.error("Update failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadVersion = async () => {
    if (!selectedDefinition) return;
    const pdfCheck = validateLegalPdfFile(versionFile);
    if (!pdfCheck.ok) {
      setUploadFileError(pdfCheck.error);
      return;
    }
    setUploadFileError(null);
    setUploading(true);
    try {
      if (uploadMode === "replace") {
        const draft = latestDraftVersion(selectedDefinition);
        if (!draft) {
          throw new Error("No draft version to replace");
        }
        const replaced = await replaceDraftPdfInPlace(draft.id, pdfCheck.file);
        toast.success("Draft PDF replaced.", {
          description: `v${replaced.versionNumber} updated. Version number unchanged.`,
        });
      } else {
        const uploaded = await uploadDraftVersion(selectedDefinition.id, pdfCheck.file);
        toast.success("New draft version created.", {
          description: `v${uploaded.versionNumber} saved as draft.`,
        });
      }
      setUploadDialogOpen(false);
      setSelectedDefinition(null);
      setVersionFile(null);
      invalidate();
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedVersion || !selectedDefinition) return;
    setPublishing(true);
    try {
      await publishVersionById(selectedVersion.id, reacceptanceRequired);
      toast.success("Published", {
        description: reacceptanceRequired
          ? `"${legalDocumentDisplayName(selectedDefinition.type)}" is live. Existing users must accept again before new transactions.`
          : `"${legalDocumentDisplayName(selectedDefinition.type)}" is live for new or incomplete onboarding.`,
      });
      setPublishDialogOpen(false);
      setSelectedDefinition(null);
      setSelectedVersion(null);
      setReacceptanceRequired(false);
      invalidate();
    } catch (error) {
      toast.error("Publish failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleArchiveVersion = async () => {
    if (!selectedDefinition || !selectedVersion) return;
    try {
      const result = await apiClient.post(
        `/v1/admin/legal-documents/versions/${selectedVersion.id}/archive`,
        {}
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to archive version");
      }
      toast.success("Legal document version archived.");
      setArchiveConfirmOpen(false);
      setSelectedDefinition(null);
      setSelectedVersion(null);
      invalidate();
    } catch (error) {
      toast.error("Archive failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleRestoreVersion = async (
    _doc: LegalDocumentDefinitionResponse,
    version: LegalDocumentVersionSummary
  ) => {
    try {
      const result = await apiClient.post<{ version: LegalDocumentVersionResponse }>(
        `/v1/admin/legal-documents/versions/${version.id}/restore`,
        {}
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to restore version");
      }
      toast.success("Legal document version restored.");
      invalidate();
    } catch (error) {
      toast.error("Restore failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleDownload = async (version: LegalDocumentVersionSummary) => {
    try {
      const result = await apiClient.get<{ downloadUrl: string; fileName?: string }>(
        `/v1/admin/legal-documents/versions/${version.id}/download`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "PDF unavailable");
      }
      const link = document.createElement("a");
      link.href = result.data.downloadUrl;
      link.download = result.data.fileName || version.fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error("Download failed", {
        description:
          error instanceof Error ? error.message : `Could not download ${version.fileName}`,
      });
    }
  };

  const openCreateDialog = () => {
    setCreateFileError(null);
    setCreateOrchestration(resetCreateOrchestration());
    setCreateForm(emptyCreateForm());
    setCreateDialogOpen(true);
  };

  React.useEffect(() => {
    if (!createDialogOpen || createOrchestration.definitionId) return;
    const defaults = createFormDefaultsForAvailableTypes(availableTypes);
    if (defaults) {
      setCreateForm((prev) =>
        existingTypes.has(prev.type) ? { ...defaults, file: prev.file } : prev
      );
    }
  }, [availableTypes, createDialogOpen, createOrchestration.definitionId, existingTypes]);

  const goToExistingDocument = (type: LegalDocumentType) => {
    const existing =
      typeCatalog.find((doc) => doc.type === type) ??
      documents.find((doc) => doc.type === type);
    setCreateDialogOpen(false);
    setCreateOrchestration(resetCreateOrchestration());
    clearFilters();
    if (existing) {
      openUploadDialog(existing, "new");
    } else {
      toast.message(EXISTING_LEGAL_TYPE_CREATE_MESSAGE);
    }
  };

  const openEditDialog = (doc: LegalDocumentDefinitionResponse) => {
    setSelectedDefinition(doc);
    setEditForm({
      audience: doc.audience === "PUBLIC" ? "BOTH" : doc.audience,
      requiredForOnboarding: doc.requiredForOnboarding,
      publicVisibility: doc.publicVisibility,
    });
    setEditDialogOpen(true);
  };

  const openUploadDialog = (doc: LegalDocumentDefinitionResponse, mode: "new" | "replace") => {
    setSelectedDefinition(doc);
    setUploadMode(mode);
    setVersionFile(null);
    setUploadFileError(null);
    setUploadDialogOpen(true);
  };

  const openPublishDialog = (
    doc: LegalDocumentDefinitionResponse,
    version: LegalDocumentVersionSummary
  ) => {
    setSelectedDefinition(doc);
    setSelectedVersion(version);
    setReacceptanceRequired(false);
    setPublishDialogOpen(true);
  };

  const openHistory = (doc: LegalDocumentDefinitionResponse) => {
    setSelectedDefinition(doc);
    setHistoryOpen(true);
  };

  const openArchiveConfirm = (
    doc: LegalDocumentDefinitionResponse,
    version: LegalDocumentVersionSummary
  ) => {
    setSelectedDefinition(doc);
    setSelectedVersion(version);
    setArchiveConfirmOpen(true);
  };

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <RequirePermission permission="document_management.view">
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Legal Documents</h1>
          <div className="ml-auto">
            <SystemHealthIndicator />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="w-full space-y-6 px-2 py-8 md:px-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Legal Documents</h1>
                <p className="mt-1 text-[15px] leading-7 text-muted-foreground">
                  PDFs for onboarding acceptance and optional website links
                </p>
              </div>
              <Button
                onClick={openCreateDialog}
                disabled={!canManage}
                title={!canManage ? "You do not have permission to perform this action." : undefined}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Legal Document
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by type…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 rounded-xl pl-9"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 gap-2 rounded-xl">
                    <FunnelIcon className="h-4 w-4" />
                    Status
                    {statusFilter !== "all" ? (
                      <Badge variant="secondary" className="ml-1">
                        1
                      </Badge>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                    <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="DRAFT">Draft</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="PUBLISHED">Published</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="ARCHIVED">Archived</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {hasActiveFilters ? (
                <Button variant="ghost" onClick={clearFilters} className="h-11 gap-2 rounded-xl">
                  <XMarkIcon className="h-4 w-4" />
                  Clear
                </Button>
              ) : null}

              <Button
                variant="outline"
                onClick={() => invalidate()}
                disabled={isLoading}
                className="h-11 gap-2 rounded-xl"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Reload
              </Button>

              <Badge variant="secondary" className="h-11 rounded-xl px-4 text-sm">
                {totalCount} {totalCount === 1 ? "document" : "documents"}
              </Badge>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Document</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                        <DocumentIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p>No legal documents yet</p>
                        <p className="mt-1 text-sm">
                          Add a PDF for onboarding, and optionally link it on the website.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => {
                      const current = documentCurrentVersion(doc);
                      const status = documentCurrentStatus(doc);
                      const draft = latestDraftVersion(doc);
                      const published = latestPublishedVersion(doc);
                      const versionLabel = legalRowVersionLabel(doc);
                      const canRestore = current
                        ? canRestoreArchivedVersion(current, doc)
                        : false;
                      const actions = getLegalDocumentRowActions(status, {
                        hasCurrentVersion: Boolean(current),
                        hasDraft: Boolean(draft),
                        canRestore,
                      });
                      const showHistory = hasLegalVersionHistory(doc);
                      const deniedTitle =
                        "You do not have permission to perform this action.";

                      const renderIconAction = (action: LegalRowIconAction) => {
                        switch (action) {
                          case "download":
                            return current ? (
                              <Button
                                key={action}
                                variant="ghost"
                                size="sm"
                                title="Download"
                                onClick={() => void handleDownload(current)}
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                              </Button>
                            ) : null;
                          case "edit":
                            return (
                              <Button
                                key={action}
                                variant="ghost"
                                size="sm"
                                title={!canManage ? deniedTitle : "Edit details"}
                                disabled={!canManage}
                                onClick={() => openEditDialog(doc)}
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </Button>
                            );
                          case "replaceDraft":
                            return (
                              <Button
                                key={action}
                                variant="ghost"
                                size="sm"
                                title={!canManage ? deniedTitle : "Replace draft PDF"}
                                disabled={!canManage}
                                onClick={() => openUploadDialog(doc, "replace")}
                              >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                              </Button>
                            );
                          case "uploadNew":
                            return (
                              <Button
                                key={action}
                                variant="ghost"
                                size="sm"
                                title={!canManage ? deniedTitle : "Upload new version"}
                                disabled={!canManage}
                                onClick={() => openUploadDialog(doc, "new")}
                              >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                              </Button>
                            );
                          case "restore":
                            return current ? (
                              <Button
                                key={action}
                                variant="ghost"
                                size="sm"
                                title={!canManage ? deniedTitle : "Restore"}
                                disabled={!canManage}
                                onClick={() => void handleRestoreVersion(doc, current)}
                              >
                                <ArrowUturnLeftIcon className="h-4 w-4" />
                              </Button>
                            ) : null;
                          case "archive":
                            return current ? (
                              <Button
                                key={action}
                                variant="ghost"
                                size="sm"
                                title={!canManage ? deniedTitle : "Archive"}
                                disabled={!canManage}
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => openArchiveConfirm(doc, current)}
                              >
                                <ArchiveBoxIcon className="h-4 w-4" />
                              </Button>
                            ) : null;
                          default:
                            return null;
                        }
                      };

                      return (
                        <TableRow
                          key={doc.id}
                          className={status === "ARCHIVED" ? "opacity-60" : undefined}
                        >
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <DocumentIcon className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="truncate font-medium"
                                  title={legalDocumentDisplayName(doc.type)}
                                >
                                  {legalDocumentDisplayName(doc.type)}
                                </p>
                                <p
                                  className="truncate text-xs text-muted-foreground"
                                  title={current?.fileName ?? undefined}
                                >
                                  {current?.fileName ?? "No PDF yet"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {current || published || draft ? (
                              showHistory ? (
                                <button
                                  type="button"
                                  className={
                                    versionLabel === "No published version"
                                      ? "text-muted-foreground underline-offset-2 hover:underline"
                                      : "text-primary underline-offset-2 hover:underline"
                                  }
                                  title="Version history"
                                  onClick={() => openHistory(doc)}
                                >
                                  {versionLabel}
                                </button>
                              ) : (
                                <span
                                  className={
                                    versionLabel === "No published version"
                                      ? "text-muted-foreground"
                                      : undefined
                                  }
                                >
                                  {versionLabel}
                                </span>
                              )
                            ) : (
                              <span className="text-muted-foreground">No published version</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={legalStatusBadgeVariant(status)}>
                              {statusLabel(status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{audienceLabel(doc.audience)}</TableCell>
                          <TableCell>
                            <Badge variant={onboardingBadgeVariant(doc.requiredForOnboarding)}>
                              {onboardingBadgeLabel(doc.requiredForOnboarding)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={websiteBadgeVariant(doc.publicVisibility)}>
                              {websiteVisibilityLabel(doc.publicVisibility)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatLegalDate(doc.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {actions.icons
                                .filter((action) => action !== "archive")
                                .map((action) => renderIconAction(action))}
                              {actions.showPublishButton && draft ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={!canManage}
                                  title={!canManage ? deniedTitle : "Publish"}
                                  className="text-primary hover:text-primary"
                                  onClick={() => openPublishDialog(doc, draft)}
                                >
                                  <CheckCircleIcon className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {actions.icons
                                .filter((action) => action === "archive")
                                .map((action) => renderIconAction(action))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Add Legal Document */}
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open && !saving) {
              setCreateForm(emptyCreateForm());
              setCreateFileError(null);
              if (!shouldSkipDefinitionCreate(createOrchestration)) {
                setCreateOrchestration(resetCreateOrchestration());
              }
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Add Legal Document</DialogTitle>
              <DialogDescription>Upload a PDF and save it as a draft.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {createOrchestration.definitionId ? (
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  Details were saved. Choose the PDF again and click Save as Draft.
                </div>
              ) : null}

              <section className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Document type</h3>
                {availableTypes.length === 0 ? (
                  <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    <p>All legal document types have already been added.</p>
                    <p>Use Upload new version on an existing row, including archived documents.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="legal-type">Type</Label>
                    <Select
                      value={createForm.type}
                      disabled={Boolean(createOrchestration.definitionId)}
                      onValueChange={(value) => {
                        const type = value as LegalDocumentType;
                        if (existingTypes.has(type)) return;
                        setCreateForm((prev) => ({
                          ...prev,
                          type,
                          audience: LEGAL_DOCUMENT_DEFAULT_AUDIENCE[type],
                        }));
                      }}
                    >
                      <SelectTrigger id="legal-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEGAL_TYPES.map((type) => {
                          const alreadyAdded = existingTypes.has(type.value);
                          return (
                            <SelectItem
                              key={type.value}
                              value={type.value}
                              disabled={alreadyAdded}
                            >
                              {alreadyAdded ? `${type.label} (Already added)` : type.label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The type name is used as the display name everywhere. Types already added are
                      disabled — use Upload new version on that row instead.
                    </p>
                  </div>
                )}
              </section>

              {availableTypes.length > 0 ? (
              <>
              <section className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Audience and visibility</h3>
                <div className="space-y-2">
                  <Label htmlFor="legal-audience">Audience</Label>
                  <Select
                    value={createForm.audience}
                    disabled={Boolean(createOrchestration.definitionId)}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        audience: value as LegalDocumentAudience,
                      }))
                    }
                  >
                    <SelectTrigger id="legal-audience">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATIONAL_AUDIENCES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {audienceLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose who this document applies to.
                  </p>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="pr-4">
                    <Label htmlFor="legal-onboarding">Required during onboarding</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      New users must accept this before completing onboarding.
                    </p>
                  </div>
                  <Switch
                    id="legal-onboarding"
                    checked={createForm.requiredForOnboarding}
                    disabled={Boolean(createOrchestration.definitionId)}
                    onCheckedChange={(checked) =>
                      setCreateForm((prev) => ({ ...prev, requiredForOnboarding: checked }))
                    }
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="pr-4">
                    <Label htmlFor="legal-website">Show on public website</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      After publishing, users can open the PDF without logging in.
                    </p>
                  </div>
                  <Switch
                    id="legal-website"
                    checked={createForm.publicVisibility}
                    disabled={Boolean(createOrchestration.definitionId)}
                    onCheckedChange={(checked) =>
                      setCreateForm((prev) => ({ ...prev, publicVisibility: checked }))
                    }
                  />
                </div>
              </section>

              <section className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">File</h3>
                <div className="space-y-2">
                  <Label htmlFor="legal-pdf">PDF file</Label>
                  <Input
                    id="legal-pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setCreateForm((prev) => ({ ...prev, file }));
                      const check = validateLegalPdfFile(file);
                      setCreateFileError(check.ok ? null : check.error);
                    }}
                  />
                  {createForm.file ? (
                    <p className="text-sm text-muted-foreground">
                      {createForm.file.name} ({formatLegalFileSize(createForm.file.size)})
                    </p>
                  ) : null}
                  {createFileError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {createFileError}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    PDF only. Version numbers are assigned automatically.
                  </p>
                </div>
              </section>
              </>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setCreateOrchestration(resetCreateOrchestration());
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreateDocument()}
                disabled={saving || !canManage || availableTypes.length === 0}
              >                {saving ? (
                  <>
                    <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save as Draft"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit details</DialogTitle>
              <DialogDescription>
                Change who this applies to, onboarding, and website visibility. To change the PDF,
                use Upload new version.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedDefinition ? (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <p className="font-medium">
                    {legalDocumentDisplayName(selectedDefinition.type)}
                  </p>
                  <p className="text-xs text-muted-foreground">Display name comes from the type.</p>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="edit-audience">Audience</Label>
                <Select
                  value={editForm.audience}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      audience: value as LegalDocumentAudience,
                    }))
                  }
                >
                  <SelectTrigger id="edit-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_AUDIENCES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {audienceLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose who this document applies to.
                </p>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="pr-4">
                  <Label htmlFor="edit-onboarding">Required during onboarding</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New users must accept this before completing onboarding.
                  </p>
                </div>
                <Switch
                  id="edit-onboarding"
                  checked={editForm.requiredForOnboarding}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({ ...prev, requiredForOnboarding: checked }))
                  }
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="pr-4">
                  <Label htmlFor="edit-website">Show on public website</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    After publishing, users can open the PDF without logging in.
                  </p>
                </div>
                <Switch
                  id="edit-website"
                  checked={editForm.publicVisibility}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({ ...prev, publicVisibility: checked }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleEditDefinition()} disabled={saving || !canManage}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>
                {uploadMode === "replace" ? "Replace draft PDF" : "Upload new version"}
              </DialogTitle>
              <DialogDescription>
                {selectedDefinition
                  ? uploadMode === "replace"
                    ? `Replace the PDF for “${legalDocumentDisplayName(selectedDefinition.type)}”. The version number stays the same.`
                    : `Upload a PDF for “${legalDocumentDisplayName(selectedDefinition.type)}”. It saves as a new draft version.`
                  : "Upload a PDF draft."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="upload-pdf">PDF file</Label>
                <Input
                  id="upload-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setVersionFile(file);
                    const check = validateLegalPdfFile(file);
                    setUploadFileError(check.ok ? null : check.error);
                  }}
                />
                {versionFile ? (
                  <p className="text-sm text-muted-foreground">
                    {versionFile.name} ({formatLegalFileSize(versionFile.size)})
                  </p>
                ) : null}
                {uploadFileError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {uploadFileError}
                  </p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button onClick={() => void handleUploadVersion()} disabled={uploading || !canManage}>
                {uploading ? "Saving..." : "Save as Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Publish existing draft */}
        <Dialog
          open={publishDialogOpen}
          onOpenChange={(open) => {
            setPublishDialogOpen(open);
            if (!open) {
              setSelectedVersion(null);
              setReacceptanceRequired(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>
                {selectedDefinition && selectedVersion
                  ? buildPublishDialogTitle(
                      selectedDefinition.type,
                      selectedVersion.version
                    )
                  : "Publish version?"}
              </DialogTitle>
              <DialogDescription>
                This version will become live for the users it applies to.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <ReacceptanceOptions
                name="row-reacceptance"
                value={reacceptanceRequired}
                onChange={setReacceptanceRequired}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handlePublish()} disabled={publishing}>
                {publishing ? "Publishing..." : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {selectedDefinition && selectedVersion
                  ? buildArchiveDialogCopy({
                      name: legalDocumentDisplayName(selectedDefinition.type),
                      version: selectedVersion.version,
                      isPublished: selectedVersion.status === "PUBLISHED",
                      isOnlyPublished: isOnlyActivePublishedVersion(
                        selectedDefinition,
                        selectedVersion
                      ),
                      reacceptanceRequired: selectedVersion.reacceptanceRequired,
                    }).title
                  : "Archive version?"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {(selectedDefinition && selectedVersion
                    ? buildArchiveDialogCopy({
                        name: legalDocumentDisplayName(selectedDefinition.type),
                        version: selectedVersion.version,
                        isPublished: selectedVersion.status === "PUBLISHED",
                        isOnlyPublished: isOnlyActivePublishedVersion(
                          selectedDefinition,
                          selectedVersion
                        ),
                        reacceptanceRequired: selectedVersion.reacceptanceRequired,
                      }).paragraphs
                    : ["This version will become inactive immediately."]
                  ).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleArchiveVersion()}
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Version history</SheetTitle>
              <SheetDescription>
                {selectedDefinition
                  ? `PDF versions for “${legalDocumentDisplayName(selectedDefinition.type)}”. Numbers are automatic.`
                  : "PDF versions"}
              </SheetDescription>
            </SheetHeader>
            {selectedDefinition && canManage ? (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHistoryOpen(false);
                    openUploadDialog(selectedDefinition, "new");
                  }}
                >
                  Upload new version
                </Button>
              </div>
            ) : null}
            <div className="mt-6 space-y-3">
              {(selectedDefinition?.versions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No versions yet.</p>
              ) : (
                (selectedDefinition?.versions ?? [])
                  .slice()
                  .sort((a, b) => b.version - a.version)
                  .map((version) => (
                    <div key={version.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">v{version.version}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {version.fileName}
                          </p>
                        </div>
                        <Badge
                          variant={
                            version.status === "PUBLISHED"
                              ? "default"
                              : version.status === "DRAFT"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {statusLabel(version.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        <div>Uploaded {formatLegalDate(version.createdAt)}</div>
                        {version.publishedAt ? (
                          <div>Published {formatLegalDate(version.publishedAt)}</div>
                        ) : null}
                        {version.archivedAt ? (
                          <div>Archived {formatLegalDate(version.archivedAt)}</div>
                        ) : null}
                        <div>
                          Re-accept asked: {version.reacceptanceRequired ? "Yes" : "No"}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDownload(version)}
                        >
                          Download
                        </Button>
                        {selectedDefinition &&
                        canRestoreArchivedVersion(version, selectedDefinition) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canManage}
                            onClick={() =>
                              void handleRestoreVersion(selectedDefinition, version)
                            }
                          >
                            Restore
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
    </RequirePermission>
  );
}
