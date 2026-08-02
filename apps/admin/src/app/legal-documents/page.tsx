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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Skeleton } from "../../components/ui/skeleton";
import { uploadFileToS3 } from "../../hooks/use-site-documents";
import {
  DocumentIcon,
  ArrowPathIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  LEGAL_DOCUMENT_DEFAULT_AUDIENCE,
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
  type LegalDocumentAudience,
  type LegalDocumentDefinitionResponse,
  type LegalDocumentType,
  type LegalDocumentVersionStatus,
  type LegalDocumentVersionSummary,
} from "@cashsouk/types";
import { RequirePermission } from "../../components/require-permission";
import { usePermissions } from "../../hooks/use-permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const LEGAL_TYPES = LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

const AUDIENCES: { value: LegalDocumentAudience; label: string }[] = [
  { value: "PUBLIC", label: "Public" },
  { value: "ISSUER", label: "Issuer" },
  { value: "INVESTOR", label: "Investor" },
  { value: "BOTH", label: "Issuer & Investor" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function versionStatusVariant(
  status: LegalDocumentVersionStatus
): "default" | "secondary" | "outline" {
  if (status === "PUBLISHED") return "default";
  if (status === "DRAFT") return "secondary";
  return "outline";
}

type ListResponse = {
  documents: LegalDocumentDefinitionResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export default function LegalDocumentsPage() {
  const { can } = usePermissions();
  const canManage = can("document_management.manage");
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [uploadVersionDialogOpen, setUploadVersionDialogOpen] = React.useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false);

  const [selectedDefinition, setSelectedDefinition] =
    React.useState<LegalDocumentDefinitionResponse | null>(null);
  const [selectedVersion, setSelectedVersion] =
    React.useState<LegalDocumentVersionSummary | null>(null);
  const [reacceptanceRequired, setReacceptanceRequired] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  const [createForm, setCreateForm] = React.useState({
    type: "PDPA_NOTICE_AND_CONSENT" as LegalDocumentType,
    title: "",
    description: "",
    audience: "BOTH" as LegalDocumentAudience,
    requiredForOnboarding: true,
    publicVisibility: false,
  });
  const [editForm, setEditForm] = React.useState({
    title: "",
    description: "",
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
    queryKey: ["admin", "legal-documents", page, typeFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (typeFilter !== "all") params.set("type", typeFilter);
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

  const documents = data?.documents ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "legal-documents"] });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateDefinition = async () => {
    if (!createForm.title.trim()) return;
    setSaving(true);
    try {
      const result = await apiClient.post<{ document: LegalDocumentDefinitionResponse }>(
        "/v1/admin/legal-documents",
        {
          type: createForm.type,
          title: createForm.title.trim(),
          description: createForm.description.trim() || undefined,
          audience: createForm.audience,
          requiredForOnboarding: createForm.requiredForOnboarding,
          publicVisibility: createForm.publicVisibility,
        }
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to create definition");
      }
      toast.success("Definition created", {
        description: `"${createForm.title}" is ready. Upload a draft PDF next.`,
      });
      setCreateDialogOpen(false);
      setCreateForm({
        type: "PDPA_NOTICE_AND_CONSENT",
        title: "",
        description: "",
        audience: "BOTH",
        requiredForOnboarding: true,
        publicVisibility: false,
      });
      invalidate();
      setSelectedDefinition(result.data.document);
      setVersionFile(null);
      setUploadVersionDialogOpen(true);
    } catch (error) {
      toast.error("Create failed", {
        description: error instanceof Error ? error.message : "An error occurred",
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
        throw new Error(result.error?.message || "Failed to update definition");
      }
      toast.success("Definition updated");
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
    if (!selectedDefinition || !versionFile) return;
    setUploading(true);
    try {
      const uploadUrlResult = await apiClient.post<{
        uploadUrl: string;
        s3Key: string;
      }>(`/v1/admin/legal-documents/${selectedDefinition.id}/versions/upload-url`, {
        fileName: versionFile.name,
        contentType: "application/pdf",
        fileSize: versionFile.size,
      });
      if (!uploadUrlResult.success) {
        throw new Error(uploadUrlResult.error?.message || "Failed to get upload URL");
      }

      await uploadFileToS3(uploadUrlResult.data.uploadUrl, versionFile);

      const confirmResult = await apiClient.post(
        `/v1/admin/legal-documents/${selectedDefinition.id}/versions`,
        {
          s3Key: uploadUrlResult.data.s3Key,
          fileName: versionFile.name,
          contentType: "application/pdf",
          fileSize: versionFile.size,
        }
      );
      if (!confirmResult.success) {
        throw new Error(confirmResult.error?.message || "Failed to create draft version");
      }

      toast.success("Draft version uploaded", {
        description: `"${selectedDefinition.title}" draft is ready. Publish when ready.`,
      });
      setUploadVersionDialogOpen(false);
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
          : `"${selectedDefinition.title}" published. Only users who have not completed the applicable legal step must accept.`,
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

  const handleArchiveVersion = async (
    definition: LegalDocumentDefinitionResponse,
    version: LegalDocumentVersionSummary
  ) => {
    try {
      const result = await apiClient.post(
        `/v1/admin/legal-documents/versions/${version.id}/archive`,
        {}
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to archive version");
      }
      toast.success("Version archived", {
        description: `"${definition.title}" v${version.version} archived.`,
      });
      invalidate();
    } catch (error) {
      toast.error("Archive failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleDownloadVersion = async (version: LegalDocumentVersionSummary) => {
    try {
      const result = await apiClient.get<{ downloadUrl: string }>(
        `/v1/admin/legal-documents/versions/${version.id}/download`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Download unavailable");
      }
      window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Download failed", {
        description: error instanceof Error ? error.message : `Could not download ${version.fileName}`,
      });
    }
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

  const openUploadVersionDialog = (doc: LegalDocumentDefinitionResponse) => {
    setSelectedDefinition(doc);
    setVersionFile(null);
    setUploadVersionDialogOpen(true);
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

  const latestPublished = (doc: LegalDocumentDefinitionResponse) =>
    (doc.versions ?? []).find((v) => v.status === "PUBLISHED");

  const draftVersion = (doc: LegalDocumentDefinitionResponse) =>
    (doc.versions ?? []).find((v) => v.status === "DRAFT");

  return (
    <RequirePermission permission="document_management.view">
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Legal Documents</h1>
              <p className="text-sm text-muted-foreground">
                Create definitions, upload draft PDFs, then publish with optional re-acceptance.
              </p>
            </div>
            <SystemHealthIndicator />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-sm flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search legal documents…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  setTypeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All legal types</SelectItem>
                  {LEGAL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={!canManage}
              title={!canManage ? "You do not have permission to perform this action." : undefined}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              New definition
            </Button>
          </div>

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[320px]">Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <DocumentIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>No legal document definitions yet</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.flatMap((doc) => {
                    const published = latestPublished(doc);
                    const draft = draftVersion(doc);
                    const expanded = expandedIds.has(doc.id);
                    const versions = doc.versions ?? [];
                    const rows = [
                      <TableRow key={doc.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="flex max-w-full items-start gap-2 text-left"
                            onClick={() => toggleExpanded(doc.id)}
                          >
                            {expanded ? (
                              <ChevronDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium" title={doc.title}>
                                {doc.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {versions.length} version{versions.length === 1 ? "" : "s"}
                                {draft ? " · draft ready" : ""}
                              </p>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {LEGAL_DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{doc.audience}</TableCell>
                        <TableCell className="text-sm">
                          {doc.requiredForOnboarding ? "Required" : "Optional"}
                          {doc.publicVisibility ? " · Public" : ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {published ? `v${published.version}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(doc.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {draft ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPublishDialog(doc, draft)}
                                disabled={!canManage}
                                className="text-primary"
                              >
                                Publish
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(doc)}
                              disabled={!canManage}
                              title="Edit definition"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openUploadVersionDialog(doc)}
                              disabled={!canManage}
                              title="Upload draft version"
                            >
                              <ArrowUpTrayIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>,
                    ];

                    if (expanded) {
                      if (versions.length === 0) {
                        rows.push(
                          <TableRow key={`${doc.id}-empty`} className="bg-muted/30">
                            <TableCell colSpan={7} className="py-3 pl-12 text-sm text-muted-foreground">
                              No versions yet. Upload a draft PDF.
                            </TableCell>
                          </TableRow>
                        );
                      } else {
                        for (const version of versions) {
                          rows.push(
                            <TableRow key={version.id} className="bg-muted/30">
                              <TableCell className="pl-12">
                                <p className="text-sm font-medium">Version {version.version}</p>
                                <p className="truncate text-xs text-muted-foreground" title={version.fileName}>
                                  {version.fileName} · {formatFileSize(version.fileSize)}
                                </p>
                              </TableCell>
                              <TableCell colSpan={2} />
                              <TableCell>
                                <Badge variant={versionStatusVariant(version.status)}>
                                  {version.status}
                                </Badge>
                                {version.reacceptanceRequired ? (
                                  <span className="ml-2 text-xs text-muted-foreground">Re-accept</span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-sm">
                                {version.publishedAt
                                  ? formatDate(version.publishedAt)
                                  : formatDate(version.createdAt)}
                              </TableCell>
                              <TableCell className="text-sm" />
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleDownloadVersion(version)}
                                    title="Download"
                                  >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                  </Button>
                                  {version.status === "DRAFT" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openPublishDialog(doc, version)}
                                      disabled={!canManage}
                                      className="text-primary"
                                    >
                                      Publish
                                    </Button>
                                  ) : null}
                                  {version.status !== "ARCHIVED" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => void handleArchiveVersion(doc, version)}
                                      disabled={!canManage}
                                      title="Archive version"
                                    >
                                      <ArchiveBoxIcon className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                      }
                    }

                    return rows;
                  })
                )}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {totalCount} result{totalCount === 1 ? "" : "s"}
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
            )}
          </div>
        </div>

        <Dialog
          open={publishDialogOpen}
          onOpenChange={(open) => {
            setPublishDialogOpen(open);
            if (!open) {
              setSelectedDefinition(null);
              setSelectedVersion(null);
              setReacceptanceRequired(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Publish version</DialogTitle>
              <DialogDescription>
                {selectedDefinition && selectedVersion
                  ? `Publish “${selectedDefinition.title}” (v${selectedVersion.version}) for users.`
                  : "Publish this draft version."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">
                  Require existing users to re-accept this version?
                </legend>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="reacceptance"
                    className="mt-1"
                    checked={!reacceptanceRequired}
                    onChange={() => setReacceptanceRequired(false)}
                  />
                  <span className="text-sm leading-relaxed">
                    <span className="font-medium">No</span>
                    <br />
                    <span className="text-muted-foreground">
                      only users who have not completed the applicable legal step must accept this
                      version.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="reacceptance"
                    className="mt-1"
                    checked={reacceptanceRequired}
                    onChange={() => setReacceptanceRequired(true)}
                  />
                  <span className="text-sm leading-relaxed">
                    <span className="font-medium">Yes</span>
                    <br />
                    <span className="text-muted-foreground">
                      existing applicable users must accept this version before starting new
                      transactions.
                    </span>
                  </span>
                </label>
              </fieldset>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handlePublish()} disabled={publishing}>
                {publishing ? "Publishing…" : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>New legal document definition</DialogTitle>
              <DialogDescription>
                Creates the document type entry. You can upload a draft PDF right after.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(value: LegalDocumentType) =>
                    setCreateForm((f) => ({
                      ...f,
                      type: value,
                      audience: LEGAL_DOCUMENT_DEFAULT_AUDIENCE[value],
                      title: f.title || LEGAL_DOCUMENT_TYPE_LABELS[value],
                    }))
                  }
                >
                  <SelectTrigger>
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
                <Label>Title</Label>
                <Input
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select
                  value={createForm.audience}
                  onValueChange={(value: LegalDocumentAudience) =>
                    setCreateForm((f) => ({ ...f, audience: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map((audience) => (
                      <SelectItem key={audience.value} value={audience.value}>
                        {audience.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="legal-required-onboarding">Required for onboarding</Label>
                <Switch
                  id="legal-required-onboarding"
                  checked={createForm.requiredForOnboarding}
                  onCheckedChange={(checked) =>
                    setCreateForm((f) => ({ ...f, requiredForOnboarding: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="legal-public-visibility">Publicly visible</Label>
                <Switch
                  id="legal-public-visibility"
                  checked={createForm.publicVisibility}
                  onCheckedChange={(checked) =>
                    setCreateForm((f) => ({ ...f, publicVisibility: checked }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreateDefinition()}
                disabled={saving || !createForm.title.trim()}
              >
                {saving ? (
                  <>
                    <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create definition"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Edit definition</DialogTitle>
              <DialogDescription>
                Update metadata. Use Upload to add a new draft PDF version.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select
                  value={editForm.audience}
                  onValueChange={(value: LegalDocumentAudience) =>
                    setEditForm((f) => ({ ...f, audience: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map((audience) => (
                      <SelectItem key={audience.value} value={audience.value}>
                        {audience.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Required for onboarding</Label>
                <Switch
                  checked={editForm.requiredForOnboarding}
                  onCheckedChange={(checked) =>
                    setEditForm((f) => ({ ...f, requiredForOnboarding: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Publicly visible</Label>
                <Switch
                  checked={editForm.publicVisibility}
                  onCheckedChange={(checked) =>
                    setEditForm((f) => ({ ...f, publicVisibility: checked }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleEditDefinition()} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={uploadVersionDialogOpen} onOpenChange={setUploadVersionDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload draft version</DialogTitle>
              <DialogDescription>
                Upload a PDF draft for <strong>{selectedDefinition?.title}</strong>. Publish when
                ready.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>PDF File</Label>
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setVersionFile(e.target.files?.[0] || null)
                  }
                />
                {versionFile ? (
                  <p className="text-sm text-muted-foreground">
                    {versionFile.name} ({formatFileSize(versionFile.size)})
                  </p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUploadVersionDialogOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleUploadVersion()}
                disabled={uploading || !versionFile}
              >
                {uploading ? (
                  <>
                    <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Upload draft"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </RequirePermission>
  );
}
