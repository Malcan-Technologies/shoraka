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
import { Textarea } from "../../components/ui/textarea";
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
  EyeIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  ArrowUpTrayIcon,
  ArchiveBoxIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  LEGAL_DOCUMENT_DEFAULT_AUDIENCE,
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
  type LegalDocumentAudience,
  type LegalDocumentDefinitionResponse,
  type LegalDocumentType,
  type LegalDocumentVersionSummary,
} from "@cashsouk/types";
import { RequirePermission } from "../../components/require-permission";
import { usePermissions } from "../../hooks/use-permissions";
import {
  audienceLabel,
  buildCreateDefinitionPayload,
  buildPublishDialogTitle,
  documentCurrentStatus,
  documentCurrentVersion,
  formatLegalDate,
  formatLegalFileSize,
  latestDraftVersion,
  latestPublishedVersion,
  matchesClientFilters,
  nextCreateOrchestrationAfterDefinition,
  resetCreateOrchestration,
  shouldSkipDefinitionCreate,
  statusLabel,
  validateLegalPdfFile,
  type CreateOrchestrationState,
} from "../../lib/legal-documents-admin";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ITEMS_PER_PAGE = 20;

const LEGAL_TYPES = LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

const AUDIENCES: { value: LegalDocumentAudience; label: string }[] = [
  { value: "PUBLIC", label: audienceLabel("PUBLIC") },
  { value: "ISSUER", label: audienceLabel("ISSUER") },
  { value: "INVESTOR", label: audienceLabel("INVESTOR") },
  { value: "BOTH", label: audienceLabel("BOTH") },
];

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
  title: "",
  description: "",
  audience: LEGAL_DOCUMENT_DEFAULT_AUDIENCE.PDPA_NOTICE_AND_CONSENT,
  requiredForOnboarding: true,
  publicVisibility: false,
  file: null as File | null,
  versionNote: "1",
});

export default function LegalDocumentsPage() {
  const { can } = usePermissions();
  const canManage = can("document_management.manage");
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [audienceFilter, setAudienceFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = React.useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = React.useState(false);

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
    title: "",
    description: "",
    audience: "BOTH" as LegalDocumentAudience,
    requiredForOnboarding: true,
    publicVisibility: false,
  });
  const [versionFile, setVersionFile] = React.useState<File | null>(null);
  const [versionLabel, setVersionLabel] = React.useState("");

  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "legal-documents", page, typeFilter, searchQuery, audienceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(ITEMS_PER_PAGE),
      });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (audienceFilter !== "all") params.set("audience", audienceFilter);
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

  const hasActiveFilters =
    Boolean(searchQuery) ||
    typeFilter !== "all" ||
    audienceFilter !== "all" ||
    statusFilter !== "all";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "legal-documents"] });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setAudienceFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const uploadDraftVersion = async (definitionId: string, file: File) => {
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

    const confirmResult = await apiClient.post(
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
    return uploadUrlResult.data.version;
  };

  const handleCreateDocument = async () => {
    if (!createForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const pdfCheck = validateLegalPdfFile(createForm.file);
    if (!pdfCheck.ok) {
      setCreateFileError(pdfCheck.error);
      return;
    }
    setCreateFileError(null);
    setSaving(true);
    let definitionCreatedInAttempt = Boolean(createOrchestration.definitionId);
    try {
      let definitionId = createOrchestration.definitionId;
      let definitionTitle = createOrchestration.definitionTitle ?? createForm.title.trim();

      if (!shouldSkipDefinitionCreate(createOrchestration)) {
        const result = await apiClient.post<{ document: LegalDocumentDefinitionResponse }>(
          "/v1/admin/legal-documents",
          buildCreateDefinitionPayload(createForm)
        );
        if (!result.success) {
          throw new Error(result.error?.message || "Failed to create legal document");
        }
        const next = nextCreateOrchestrationAfterDefinition(result.data.document);
        setCreateOrchestration(next);
        definitionId = next.definitionId;
        definitionTitle = next.definitionTitle ?? createForm.title.trim();
        definitionCreatedInAttempt = true;
      }

      if (!definitionId) {
        throw new Error("Legal document was not created");
      }

      await uploadDraftVersion(definitionId, pdfCheck.file);

      toast.success("Legal document saved as draft", {
        description: `"${definitionTitle}" is ready to review and publish.`,
      });
      setCreateDialogOpen(false);
      setCreateForm(emptyCreateForm());
      setCreateOrchestration(resetCreateOrchestration());
      invalidate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      toast.error("Save failed", {
        description: definitionCreatedInAttempt
          ? `${message} The document definition was saved — choose the PDF again and retry Save as Draft.`
          : message,
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
        {
          title: editForm.title.trim() || undefined,
          description: editForm.description.trim() || null,
          audience: editForm.audience,
          requiredForOnboarding: editForm.requiredForOnboarding,
          publicVisibility: editForm.publicVisibility,
        }
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update document");
      }
      toast.success("Details updated");
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
        if (draft) {
          const archiveResult = await apiClient.post(
            `/v1/admin/legal-documents/versions/${draft.id}/archive`,
            {}
          );
          if (!archiveResult.success) {
            throw new Error(archiveResult.error?.message || "Failed to archive previous draft");
          }
        }
      }

      const versionNumber = await uploadDraftVersion(selectedDefinition.id, pdfCheck.file);
      toast.success(uploadMode === "replace" ? "Draft PDF replaced" : "New draft version saved", {
        description: `"${selectedDefinition.title}" v${versionNumber} saved as draft.`,
      });
      setUploadDialogOpen(false);
      setSelectedDefinition(null);
      setVersionFile(null);
      setVersionLabel("");
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
      const result = await apiClient.post(
        `/v1/admin/legal-documents/versions/${selectedVersion.id}/publish`,
        { reacceptanceRequired }
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to publish version");
      }
      toast.success("Version published", {
        description: reacceptanceRequired
          ? `"${selectedDefinition.title}" published. Existing applicable users must accept before new transactions.`
          : `"${selectedDefinition.title}" published. Only new or incomplete users must accept this version.`,
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
      toast.success("Version archived", {
        description: `"${selectedDefinition.title}" v${selectedVersion.version} archived.`,
      });
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

  const handleViewOrDownload = async (
    version: LegalDocumentVersionSummary,
    mode: "view" | "download"
  ) => {
    try {
      const result = await apiClient.get<{ downloadUrl: string }>(
        `/v1/admin/legal-documents/versions/${version.id}/download`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "PDF unavailable");
      }
      window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
      if (mode === "download") {
        // Presigned URL opens in a new tab; browser handles download disposition from storage.
      }
    } catch (error) {
      toast.error(mode === "view" ? "Unable to open PDF" : "Download failed", {
        description: error instanceof Error ? error.message : `Could not open ${version.fileName}`,
      });
    }
  };

  const openCreateDialog = () => {
    setCreateForm(emptyCreateForm());
    setCreateFileError(null);
    setCreateOrchestration(resetCreateOrchestration());
    setCreateDialogOpen(true);
  };

  const openEditDialog = (doc: LegalDocumentDefinitionResponse) => {
    setSelectedDefinition(doc);
    setEditForm({
      title: doc.title,
      description: doc.description || "",
      audience: doc.audience,
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
    const nextVersion = Math.max(0, ...(doc.versions ?? []).map((v) => v.version)) + 1;
    setVersionLabel(String(nextVersion));
    if (mode === "replace" && latestDraftVersion(doc)) {
      setReplaceConfirmOpen(true);
    } else {
      setUploadDialogOpen(true);
    }
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
  }, [searchQuery, typeFilter, audienceFilter, statusFilter]);

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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Legal Documents</h1>
                <p className="mt-1 text-[15px] leading-7 text-muted-foreground">
                  Manage onboarding and public legal documents
                </p>
              </div>
              <Button
                variant="action"
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
                  placeholder="Search legal documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 rounded-xl pl-9"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 gap-2 rounded-xl">
                    <FunnelIcon className="h-4 w-4" />
                    Document Type
                    {typeFilter !== "all" ? (
                      <Badge variant="secondary" className="ml-1">
                        1
                      </Badge>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Document Type</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={typeFilter} onValueChange={setTypeFilter}>
                    <DropdownMenuRadioItem value="all">All Types</DropdownMenuRadioItem>
                    {LEGAL_TYPES.map((type) => (
                      <DropdownMenuRadioItem key={type.value} value={type.value}>
                        {type.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 gap-2 rounded-xl">
                    <FunnelIcon className="h-4 w-4" />
                    Audience
                    {audienceFilter !== "all" ? (
                      <Badge variant="secondary" className="ml-1">
                        1
                      </Badge>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Audience</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={audienceFilter} onValueChange={setAudienceFilter}>
                    <DropdownMenuRadioItem value="all">All Audiences</DropdownMenuRadioItem>
                    {AUDIENCES.map((item) => (
                      <DropdownMenuRadioItem key={item.value} value={item.value}>
                        {item.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

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
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                    <DropdownMenuRadioItem value="all">All Statuses</DropdownMenuRadioItem>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead>Public</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-5 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-12" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-10" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="ml-auto h-8 w-24" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                        <DocumentIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p>No legal documents yet</p>
                        <p className="mt-1 text-sm">
                          Add the first legal document to prepare onboarding and public legal access.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => {
                      const current = documentCurrentVersion(doc);
                      const status = documentCurrentStatus(doc);
                      const draft = latestDraftVersion(doc);
                      const published = latestPublishedVersion(doc);
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
                                <p className="truncate text-sm font-medium" title={doc.title}>
                                  {doc.title}
                                </p>
                                <p
                                  className="truncate text-xs text-muted-foreground"
                                  title={current?.fileName}
                                >
                                  {current?.fileName ?? "No PDF yet"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="outline">
                              {LEGAL_DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{audienceLabel(doc.audience)}</TableCell>
                          <TableCell className="text-sm">
                            {current ? `v${current.version}` : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge
                              variant={
                                status === "PUBLISHED"
                                  ? "default"
                                  : status === "DRAFT"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {statusLabel(status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {doc.requiredForOnboarding ? (
                              <Badge variant="secondary">Required</Badge>
                            ) : (
                              <span className="text-muted-foreground">Optional</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {doc.publicVisibility ? (
                              <Badge variant="secondary">Yes</Badge>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatLegalDate(doc.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {current ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleViewOrDownload(current, "view")}
                                  title="View PDF"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {published ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleViewOrDownload(published, "download")}
                                  title="Download PDF"
                                >
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openHistory(doc)}
                                title="Version history"
                              >
                                <ClockIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(doc)}
                                disabled={!canManage}
                                title={
                                  !canManage
                                    ? "You do not have permission to perform this action."
                                    : "Edit details"
                                }
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  openUploadDialog(doc, draft ? "replace" : "new")
                                }
                                disabled={!canManage}
                                title={
                                  !canManage
                                    ? "You do not have permission to perform this action."
                                    : draft
                                      ? "Replace PDF"
                                      : "Upload new version"
                                }
                              >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                              </Button>
                              {draft ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openPublishDialog(doc, draft)}
                                  disabled={!canManage}
                                  className="text-primary"
                                  title="Publish"
                                >
                                  Publish
                                </Button>
                              ) : null}
                              {current && current.status !== "ARCHIVED" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openArchiveConfirm(doc, current)}
                                  disabled={!canManage}
                                  title={
                                    !canManage
                                      ? "You do not have permission to perform this action."
                                      : "Archive"
                                  }
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ArchiveBoxIcon className="h-4 w-4" />
                                </Button>
                              ) : null}
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
              <DialogDescription>
                Create the legal document and upload its first PDF version.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {createOrchestration.definitionId ? (
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  Document details were saved. Choose the PDF again and click Save as Draft to finish
                  without creating a duplicate.
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="legal-type">Document Type</Label>
                <Select
                  value={createForm.type}
                  disabled={Boolean(createOrchestration.definitionId)}
                  onValueChange={(value) => {
                    const type = value as LegalDocumentType;
                    setCreateForm((prev) => ({
                      ...prev,
                      type,
                      audience: LEGAL_DOCUMENT_DEFAULT_AUDIENCE[type],
                      title: prev.title || LEGAL_DOCUMENT_TYPE_LABELS[type],
                    }));
                  }}
                >
                  <SelectTrigger id="legal-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEGAL_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-title">Title</Label>
                <Input
                  id="legal-title"
                  value={createForm.title}
                  disabled={Boolean(createOrchestration.definitionId)}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-description">Description</Label>
                <Textarea
                  id="legal-description"
                  value={createForm.description}
                  disabled={Boolean(createOrchestration.definitionId)}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                />
              </div>
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
                    {AUDIENCES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="pr-4">
                  <Label htmlFor="legal-onboarding">Required for onboarding</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New users must accept this document before continuing onboarding.
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
                  <Label htmlFor="legal-public">Publicly visible</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Published versions can be opened without logging in through the public website.
                  </p>
                </div>
                <Switch
                  id="legal-public"
                  checked={createForm.publicVisibility}
                  disabled={Boolean(createOrchestration.definitionId)}
                  onCheckedChange={(checked) =>
                    setCreateForm((prev) => ({ ...prev, publicVisibility: checked }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-pdf">PDF File</Label>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal-version">Version</Label>
                <Input
                  id="legal-version"
                  value={createForm.versionNote}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, versionNote: e.target.value }))
                  }
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">
                  Informational only. The system assigns the next version number on save.
                </p>
              </div>
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
                disabled={saving || !canManage}
              >
                {saving ? (
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

        {/* Edit details */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Details</DialogTitle>
              <DialogDescription>Update the document metadata.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                />
              </div>
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
                    {AUDIENCES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="pr-4">
                  <Label htmlFor="edit-onboarding">Required for onboarding</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New users must accept this document before continuing onboarding.
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
                  <Label htmlFor="edit-public">Publicly visible</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Published versions can be opened without logging in through the public website.
                  </p>
                </div>
                <Switch
                  id="edit-public"
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
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload / replace version */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {uploadMode === "replace" ? "Replace Draft PDF" : "Upload New Version"}
              </DialogTitle>
              <DialogDescription>
                {selectedDefinition
                  ? `Save a draft PDF for “${selectedDefinition.title}”.`
                  : "Upload a draft PDF version."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="upload-pdf">PDF File</Label>
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
              <div className="space-y-2">
                <Label htmlFor="upload-version">Version</Label>
                <Input
                  id="upload-version"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Informational only. The system assigns the next version number on save.
                </p>
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
              <Button
                onClick={() => void handleUploadVersion()}
                disabled={uploading || !canManage}
              >
                {uploading ? (
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

        {/* Publish */}
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
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>
                {selectedDefinition && selectedVersion
                  ? buildPublishDialogTitle(
                      selectedDefinition.title,
                      LEGAL_DOCUMENT_TYPE_LABELS[selectedDefinition.type],
                      selectedVersion.version
                    )
                  : "Publish version?"}
              </DialogTitle>
              <DialogDescription>
                This version will become the current version shown to applicable users.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <p className="text-sm font-medium">
                Require existing users to accept this version again?
              </p>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="reacceptance"
                  className="mt-1"
                  checked={!reacceptanceRequired}
                  onChange={() => setReacceptanceRequired(false)}
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
                  name="reacceptance"
                  className="mt-1"
                  checked={reacceptanceRequired}
                  onChange={() => setReacceptanceRequired(true)}
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

        {/* Replace confirm */}
        <AlertDialog open={replaceConfirmOpen} onOpenChange={setReplaceConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace draft PDF?</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedDefinition
                  ? `The current draft for “${selectedDefinition.title}” will be archived, then your new PDF will be saved as a draft.`
                  : "The current draft will be archived before uploading the new PDF."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setReplaceConfirmOpen(false);
                  setUploadDialogOpen(true);
                }}
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Archive confirm */}
        <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {selectedDefinition && selectedVersion
                  ? `Archive ${selectedDefinition.title} v${selectedVersion.version}?`
                  : "Archive version?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {selectedVersion?.status === "PUBLISHED"
                  ? "This is the current published version. Archiving it removes it as the live version for applicable users until another version is published."
                  : "Archived versions stay in history and are no longer active drafts."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleArchiveVersion()}>
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Version history */}
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Version History</SheetTitle>
              <SheetDescription>
                {selectedDefinition
                  ? `Versions for “${selectedDefinition.title}”.`
                  : "Legal document versions"}
              </SheetDescription>
            </SheetHeader>
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
                          <p className="text-sm font-medium">Version {version.version}</p>
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
                          Re-acceptance required: {version.reacceptanceRequired ? "Yes" : "No"}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleViewOrDownload(version, "view")}
                          title="View"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleViewOrDownload(version, "download")}
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </Button>
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
