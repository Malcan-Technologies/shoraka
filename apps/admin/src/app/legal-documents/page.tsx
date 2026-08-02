"use client";

import * as React from "react";
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
import {
  useSiteDocuments,
  useRequestUploadUrl,
  useCreateSiteDocument,
  useUpdateSiteDocument,
  useRequestReplaceUrl,
  useConfirmReplace,
  useArchiveSiteDocument,
  useRestoreSiteDocument,
  useDownloadSiteDocument,
  usePublishSiteDocument,
  uploadFileToS3,
} from "../../hooks/use-site-documents";
import {
  DocumentIcon,
  ArrowPathIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  ArrowUpTrayIcon,
  ArrowUturnLeftIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { SiteDocumentType, SiteDocumentResponse } from "@cashsouk/types";
import {
  LEGAL_DOCUMENT_DEFAULT_AUDIENCE,
  LEGAL_DOCUMENT_TYPE_LABELS,
  ONBOARDING_LEGAL_DOCUMENT_TYPES,
  type LegalDocumentAudience,
  type LegalDocumentStatus,
  type OnboardingLegalDocumentType,
} from "@cashsouk/types";
import { RequirePermission } from "../../components/require-permission";
import { usePermissions } from "../../hooks/use-permissions";

const LEGAL_TYPES = ONBOARDING_LEGAL_DOCUMENT_TYPES.map((value) => ({
  value,
  label: LEGAL_DOCUMENT_TYPE_LABELS[value],
}));

const AUDIENCES: { value: LegalDocumentAudience; label: string }[] = [
  { value: "PUBLIC", label: "Public" },
  { value: "ISSUER", label: "Issuer" },
  { value: "INVESTOR", label: "Investor" },
  { value: "BOTH", label: "Issuer & Investor" },
];

const STATUSES: { value: LegalDocumentStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
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

const ITEMS_PER_PAGE = 10;

export default function LegalDocumentsPage() {
  const { can } = usePermissions();
  const canManage = can("document_management.manage");
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<LegalDocumentStatus | "all">("all");

  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = React.useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false);
  const [selectedDocument, setSelectedDocument] = React.useState<SiteDocumentResponse | null>(null);
  const [reacceptanceRequired, setReacceptanceRequired] = React.useState(false);

  const [uploadForm, setUploadForm] = React.useState({
    type: "PDPA_NOTICE" as OnboardingLegalDocumentType,
    title: "",
    description: "",
    audience: "BOTH" as LegalDocumentAudience,
    acceptanceRequired: true,
    openBeforeAcceptRequired: true,
    showInAccount: false,
    file: null as File | null,
  });
  const [editForm, setEditForm] = React.useState({
    title: "",
    description: "",
    audience: "BOTH" as LegalDocumentAudience,
    acceptanceRequired: true,
    openBeforeAcceptRequired: true,
    showInAccount: false,
  });
  const [replaceFile, setReplaceFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const requestUploadUrl = useRequestUploadUrl();
  const createDocument = useCreateSiteDocument();
  const updateDocument = useUpdateSiteDocument();
  const requestReplaceUrl = useRequestReplaceUrl();
  const confirmReplace = useConfirmReplace();
  const archiveDocument = useArchiveSiteDocument();
  const restoreDocument = useRestoreSiteDocument();
  const downloadDocument = useDownloadSiteDocument();
  const publishDocument = usePublishSiteDocument();

  const { data, isLoading } = useSiteDocuments({
    page,
    pageSize: ITEMS_PER_PAGE,
    type: typeFilter !== "all" ? (typeFilter as SiteDocumentType) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    includeInactive: true,
    search: searchQuery || undefined,
  });

  const documents = (data?.documents || []).filter((doc) =>
    ONBOARDING_LEGAL_DOCUMENT_TYPES.includes(doc.type as OnboardingLegalDocumentType)
  );
  const totalCount = data?.pagination.totalCount || 0;
  const totalPages = data?.pagination.totalPages || 0;

  const handleUploadDocument = async () => {
    if (!uploadForm.file) return;

    setUploading(true);
    try {
      const uploadData = await requestUploadUrl.mutateAsync({
        type: uploadForm.type,
        title: uploadForm.title,
        description: uploadForm.description || undefined,
        fileName: uploadForm.file.name,
        contentType: "application/pdf",
        fileSize: uploadForm.file.size,
        showInAccount: uploadForm.showInAccount,
        audience: uploadForm.audience,
        acceptanceRequired: uploadForm.acceptanceRequired,
        openBeforeAcceptRequired: uploadForm.openBeforeAcceptRequired,
      });

      await uploadFileToS3(uploadData.uploadUrl, uploadForm.file);

      await createDocument.mutateAsync({
        type: uploadForm.type,
        title: uploadForm.title,
        description: uploadForm.description || undefined,
        fileName: uploadForm.file.name,
        s3Key: uploadData.s3Key,
        contentType: "application/pdf",
        fileSize: uploadForm.file.size,
        showInAccount: uploadForm.showInAccount,
        audience: uploadForm.audience,
        acceptanceRequired: uploadForm.acceptanceRequired,
        openBeforeAcceptRequired: uploadForm.openBeforeAcceptRequired,
      });

      toast.success("Draft uploaded", {
        description: `"${uploadForm.title}" was saved as a draft. Publish it when ready.`,
      });

      setUploadForm({
        type: "PDPA_NOTICE",
        title: "",
        description: "",
        audience: "BOTH",
        acceptanceRequired: true,
        openBeforeAcceptRequired: true,
        showInAccount: false,
        file: null,
      });
      setUploadDialogOpen(false);
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEditDocument = async () => {
    if (!selectedDocument) return;

    try {
      await updateDocument.mutateAsync({
        id: selectedDocument.id,
        data: {
          title: editForm.title || undefined,
          description: editForm.description,
          showInAccount: editForm.showInAccount,
          audience: editForm.audience,
          acceptanceRequired: editForm.acceptanceRequired,
          openBeforeAcceptRequired: editForm.openBeforeAcceptRequired,
        },
      });
      toast.success("Document updated");
      setEditDialogOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      toast.error("Update failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleReplaceFile = async () => {
    if (!selectedDocument || !replaceFile) return;

    setUploading(true);
    try {
      const replaceData = await requestReplaceUrl.mutateAsync({
        id: selectedDocument.id,
        data: {
          fileName: replaceFile.name,
          contentType: "application/pdf",
          fileSize: replaceFile.size,
        },
      });

      await uploadFileToS3(replaceData.uploadUrl, replaceFile);

      await confirmReplace.mutateAsync({
        id: selectedDocument.id,
        data: {
          s3Key: replaceData.s3Key,
          fileName: replaceFile.name,
          fileSize: replaceFile.size,
        },
      });

      toast.success("New draft version created", {
        description: `"${selectedDocument.title}" was uploaded as a new draft. Publish it when ready.`,
      });

      setReplaceDialogOpen(false);
      setSelectedDocument(null);
      setReplaceFile(null);
    } catch (error) {
      toast.error("Replace failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedDocument) return;
    try {
      await publishDocument.mutateAsync({
        id: selectedDocument.id,
        reacceptanceRequired,
      });
      toast.success("Document published", {
        description: reacceptanceRequired
          ? `"${selectedDocument.title}" published. Existing users must re-accept before new transactions.`
          : `"${selectedDocument.title}" published. Only new users must accept this version.`,
      });
      setPublishDialogOpen(false);
      setSelectedDocument(null);
      setReacceptanceRequired(false);
    } catch (error) {
      toast.error("Publish failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleArchive = async (id: string, title: string) => {
    try {
      await archiveDocument.mutateAsync(id);
      toast.success("Document archived", { description: `"${title}" has been archived.` });
    } catch (error) {
      toast.error("Archive failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleRestore = async (id: string, title: string) => {
    try {
      await restoreDocument.mutateAsync(id);
      toast.success("Document restored", { description: `"${title}" has been restored.` });
    } catch (error) {
      toast.error("Restore failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const result = await downloadDocument.mutateAsync(id);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Download failed", {
        description: error instanceof Error ? error.message : `Could not download ${fileName}`,
      });
    }
  };

  const openEditDialog = (doc: SiteDocumentResponse) => {
    setSelectedDocument(doc);
    setEditForm({
      title: doc.title,
      description: doc.description || "",
      audience: doc.audience || "PUBLIC",
      acceptanceRequired: doc.acceptance_required ?? true,
      openBeforeAcceptRequired: doc.open_before_accept_required ?? true,
      showInAccount: doc.show_in_account,
    });
    setEditDialogOpen(true);
  };

  const openReplaceDialog = (doc: SiteDocumentResponse) => {
    setSelectedDocument(doc);
    setReplaceFile(null);
    setReplaceDialogOpen(true);
  };

  const openPublishDialog = (doc: SiteDocumentResponse) => {
    setSelectedDocument(doc);
    setReacceptanceRequired(false);
    setPublishDialogOpen(true);
  };

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
                Publish onboarding and re-acceptance PDFs. Generic site files stay on Documents.
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
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as LegalDocumentStatus | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              disabled={!canManage}
              title={!canManage ? "You do not have permission to perform this action." : undefined}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Upload legal PDF
            </Button>
          </div>

          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accept</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
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
                      <p>No legal documents found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id} className={doc.status === "ARCHIVED" ? "opacity-60" : ""}>
                      <TableCell>
                        <div>
                          <p className="truncate text-sm font-medium" title={doc.title}>
                            {doc.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground" title={doc.file_name}>
                            {doc.file_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {LEGAL_DOCUMENT_TYPE_LABELS[doc.type as OnboardingLegalDocumentType] ||
                            doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{doc.audience}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            doc.status === "PUBLISHED"
                              ? "default"
                              : doc.status === "DRAFT"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {doc.acceptance_required ? "Required" : "Optional"}
                        {doc.reacceptance_required ? " · Re-accept" : ""}
                      </TableCell>
                      <TableCell className="text-sm">v{doc.version}</TableCell>
                      <TableCell className="text-sm">{formatDate(doc.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc.id, doc.file_name)}
                            title="Download"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                          </Button>
                          {doc.status === "DRAFT" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPublishDialog(doc)}
                              disabled={!canManage || publishDocument.isPending}
                              className="text-primary"
                            >
                              Publish
                            </Button>
                          ) : null}
                          {doc.status !== "ARCHIVED" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(doc)}
                                disabled={!canManage}
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openReplaceDialog(doc)}
                                disabled={!canManage}
                                title="Upload new draft version"
                              >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleArchive(doc.id, doc.title)}
                                disabled={!canManage}
                              >
                                <ArchiveBoxIcon className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(doc.id, doc.title)}
                              disabled={!canManage}
                            >
                              <ArrowUturnLeftIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
              setSelectedDocument(null);
              setReacceptanceRequired(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Publish document</DialogTitle>
              <DialogDescription>
                {selectedDocument
                  ? `Publish “${selectedDocument.title}” (v${selectedDocument.version}) for users.`
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
                      Only new users must accept this version.
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
                      Existing users must accept before starting new transactions.
                    </span>
                  </span>
                </label>
              </fieldset>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handlePublish()} disabled={publishDocument.isPending}>
                {publishDocument.isPending ? "Publishing…" : "Publish"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Upload legal document</DialogTitle>
              <DialogDescription>
                Creates a draft PDF. Publish it to require acceptance during onboarding.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select
                  value={uploadForm.type}
                  onValueChange={(value: OnboardingLegalDocumentType) =>
                    setUploadForm((f) => ({
                      ...f,
                      type: value,
                      audience: LEGAL_DOCUMENT_DEFAULT_AUDIENCE[value],
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
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select
                  value={uploadForm.audience}
                  onValueChange={(value: LegalDocumentAudience) =>
                    setUploadForm((f) => ({ ...f, audience: value }))
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
              <div className="space-y-2">
                <Label>PDF File</Label>
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setUploadForm((f) => ({ ...f, file: e.target.files?.[0] || null }))
                  }
                />
                {uploadForm.file && (
                  <p className="text-sm text-muted-foreground">
                    {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="legal-accept-required">Required during onboarding</Label>
                <Switch
                  id="legal-accept-required"
                  checked={uploadForm.acceptanceRequired}
                  onCheckedChange={(checked) =>
                    setUploadForm((f) => ({ ...f, acceptanceRequired: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="legal-open-required">Must open PDF before accept</Label>
                <Switch
                  id="legal-open-required"
                  checked={uploadForm.openBeforeAcceptRequired}
                  onCheckedChange={(checked) =>
                    setUploadForm((f) => ({ ...f, openBeforeAcceptRequired: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="legal-show-account">Show in Account Documents tab</Label>
                <Switch
                  id="legal-show-account"
                  checked={uploadForm.showInAccount}
                  onCheckedChange={(checked) =>
                    setUploadForm((f) => ({ ...f, showInAccount: checked }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleUploadDocument()}
                disabled={uploading || !uploadForm.file || !uploadForm.title}
              >
                {uploading ? (
                  <>
                    <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload draft"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Edit legal document</DialogTitle>
              <DialogDescription>Update metadata. Use Replace to upload a new PDF version.</DialogDescription>
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
                <Label>Required during onboarding</Label>
                <Switch
                  checked={editForm.acceptanceRequired}
                  onCheckedChange={(checked) =>
                    setEditForm((f) => ({ ...f, acceptanceRequired: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Must open PDF before accept</Label>
                <Switch
                  checked={editForm.openBeforeAcceptRequired}
                  onCheckedChange={(checked) =>
                    setEditForm((f) => ({ ...f, openBeforeAcceptRequired: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show in Account Documents tab</Label>
                <Switch
                  checked={editForm.showInAccount}
                  onCheckedChange={(checked) =>
                    setEditForm((f) => ({ ...f, showInAccount: checked }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleEditDocument()} disabled={updateDocument.isPending}>
                {updateDocument.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload new draft version</DialogTitle>
              <DialogDescription>
                Creates a new draft for <strong>{selectedDocument?.title}</strong>. Publish when ready.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Current version</p>
                <p className="font-medium">
                  v{selectedDocument?.version} - {selectedDocument?.file_name}
                </p>
              </div>
              <div className="space-y-2">
                <Label>New PDF File</Label>
                <Input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setReplaceFile(e.target.files?.[0] || null)
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReplaceDialogOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button onClick={() => void handleReplaceFile()} disabled={uploading || !replaceFile}>
                {uploading ? "Uploading..." : "Create draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </RequirePermission>
  );
}
