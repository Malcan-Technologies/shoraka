"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "../../components/ui/dropdown-menu";
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
  uploadFileToS3,
} from "../../hooks/use-site-documents";
import {
  DocumentIcon,
  ArrowPathIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  ArrowUpTrayIcon,
  ArrowUturnLeftIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { SiteDocumentType, SiteDocumentResponse } from "@cashsouk/types";

const DOCUMENT_TYPES: { value: SiteDocumentType; label: string }[] = [
  { value: "TERMS_AND_CONDITIONS", label: "Terms & Conditions" },
  { value: "PRIVACY_POLICY", label: "Privacy Policy" },
  { value: "RISK_DISCLOSURE", label: "Risk Disclosure" },
  { value: "PLATFORM_AGREEMENT", label: "Platform Agreement" },
  { value: "INVESTOR_GUIDE", label: "Investor Guide" },
  { value: "ISSUER_GUIDE", label: "Issuer Guide" },
  { value: "OTHER", label: "Other" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function getDocumentTypeLabel(type: SiteDocumentType): string {
  return DOCUMENT_TYPES.find((t) => t.value === type)?.label || type;
}

const ITEMS_PER_PAGE = 10;

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [includeInactive, setIncludeInactive] = React.useState(false);

  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = React.useState(false);
  const [selectedDocument, setSelectedDocument] = React.useState<SiteDocumentResponse | null>(null);

  // Form state
  const [uploadForm, setUploadForm] = React.useState({
    type: "TERMS_AND_CONDITIONS" as SiteDocumentType,
    title: "",
    description: "",
    showInAccount: false,
    file: null as File | null,
  });
  const [editForm, setEditForm] = React.useState({
    title: "",
    description: "",
    showInAccount: false,
  });
  const [replaceFile, setReplaceFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // Mutations
  const requestUploadUrl = useRequestUploadUrl();
  const createDocument = useCreateSiteDocument();
  const updateDocument = useUpdateSiteDocument();
  const requestReplaceUrl = useRequestReplaceUrl();
  const confirmReplace = useConfirmReplace();
  const archiveDocument = useArchiveSiteDocument();
  const restoreDocument = useRestoreSiteDocument();
  const downloadDocument = useDownloadSiteDocument();

  const { data, isLoading } = useSiteDocuments({
    page,
    pageSize: ITEMS_PER_PAGE,
    type: typeFilter !== "all" ? (typeFilter as SiteDocumentType) : undefined,
    includeInactive,
    search: searchQuery || undefined,
  });

  const documents = data?.documents || [];
  const totalCount = data?.pagination.totalCount || 0;
  const totalPages = data?.pagination.totalPages || 0;

  const handleClearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setIncludeInactive(false);
    setPage(1);
  };

  const handleUploadDocument = async () => {
    if (!uploadForm.file) return;

    setUploading(true);
    try {
      // 1. Request presigned upload URL
      const uploadData = await requestUploadUrl.mutateAsync({
        type: uploadForm.type,
        title: uploadForm.title,
        description: uploadForm.description || undefined,
        fileName: uploadForm.file.name,
        contentType: "application/pdf",
        fileSize: uploadForm.file.size,
        showInAccount: uploadForm.showInAccount,
      });

      // 2. Upload file directly to S3
      await uploadFileToS3(uploadData.uploadUrl, uploadForm.file);

      // 3. Create document record
      await createDocument.mutateAsync({
        type: uploadForm.type,
        title: uploadForm.title,
        description: uploadForm.description || undefined,
        fileName: uploadForm.file.name,
        s3Key: uploadData.s3Key,
        contentType: "application/pdf",
        fileSize: uploadForm.file.size,
        showInAccount: uploadForm.showInAccount,
      });

      toast.success("Document uploaded", {
        description: `"${uploadForm.title}" has been uploaded successfully.`,
      });

      // Reset and close
      setUploadForm({
        type: "TERMS_AND_CONDITIONS",
        title: "",
        description: "",
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
        },
      });
      toast.success("Document updated", {
        description: `"${editForm.title}" has been updated successfully.`,
      });
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
      // 1. Request presigned replace URL
      const replaceData = await requestReplaceUrl.mutateAsync({
        id: selectedDocument.id,
        data: {
          fileName: replaceFile.name,
          contentType: "application/pdf",
          fileSize: replaceFile.size,
        },
      });

      // 2. Upload new file to S3
      await uploadFileToS3(replaceData.uploadUrl, replaceFile);

      // 3. Confirm replacement
      await confirmReplace.mutateAsync({
        id: selectedDocument.id,
        data: {
          s3Key: replaceData.s3Key,
          fileName: replaceFile.name,
          fileSize: replaceFile.size,
        },
      });

      toast.success("Document replaced", {
        description: `"${selectedDocument.title}" has been updated to a new version.`,
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

  const handleArchive = async (id: string, title: string) => {
    try {
      await archiveDocument.mutateAsync(id);
      toast.success("Document archived", {
        description: `"${title}" has been archived.`,
      });
    } catch (error) {
      toast.error("Archive failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const result = await downloadDocument.mutateAsync(id);
      // Open the presigned URL in a new tab or trigger download
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error("Download failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleRestore = async (id: string, title: string) => {
    try {
      await restoreDocument.mutateAsync(id);
      toast.success("Document restored", {
        description: `"${title}" has been restored.`,
      });
    } catch (error) {
      toast.error("Restore failed", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const openEditDialog = (doc: SiteDocumentResponse) => {
    setSelectedDocument(doc);
    setEditForm({
      title: doc.title,
      description: doc.description || "",
      showInAccount: doc.show_in_account,
    });
    setEditDialogOpen(true);
  };

  const openReplaceDialog = (doc: SiteDocumentResponse) => {
    setSelectedDocument(doc);
    setReplaceFile(null);
    setReplaceDialogOpen(true);
  };

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, typeFilter, includeInactive]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Site Documents</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Document Management</h1>
              <p className="text-[15px] leading-7 text-muted-foreground mt-1">
                Upload and manage site-wide documents like Terms & Conditions, Privacy Policy, etc.
              </p>
            </div>
            <Button variant="action" onClick={() => setUploadDialogOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Document Type
                  {typeFilter !== "all" && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Document Type</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={typeFilter} onValueChange={setTypeFilter}>
                  <DropdownMenuRadioItem value="all">All Types</DropdownMenuRadioItem>
                  {DOCUMENT_TYPES.map((type) => (
                    <DropdownMenuRadioItem key={type.value} value={type.value}>
                      {type.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 rounded-xl">
                  <FunnelIcon className="h-4 w-4" />
                  Status
                  {includeInactive && (
                    <Badge variant="secondary" className="ml-1">
                      1
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={includeInactive}
                  onCheckedChange={setIncludeInactive}
                >
                  Show archived documents
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {(searchQuery || typeFilter !== "all" || includeInactive) && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="gap-2 h-11 rounded-xl"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ["admin", "site-documents"],
                });
              }}
              disabled={isLoading}
              className="gap-2 h-11 rounded-xl"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Reload
            </Button>

            <Badge variant="secondary" className="h-11 px-4 rounded-xl text-sm">
              {totalCount} {totalCount === 1 ? "document" : "documents"}
            </Badge>
          </div>

          {/* Documents Table */}
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Account Tab</TableHead>
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
                        <Skeleton className="h-5 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-24 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <DocumentIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No documents found</p>
                      <p className="text-sm mt-1">Upload your first document to get started</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id} className={!doc.is_active ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <DocumentIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                          </div>
                          {!doc.is_active && (
                            <Badge variant="secondary" className="ml-2">
                              Archived
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getDocumentTypeLabel(doc.type)}</Badge>
                      </TableCell>
                      <TableCell>v{doc.version}</TableCell>
                      <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell>
                        {doc.show_in_account ? (
                          <Badge variant="secondary">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(doc.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {doc.is_active ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(doc.id, doc.file_name)}
                                title="Download"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(doc)}
                                title="Edit"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openReplaceDialog(doc)}
                                title="Replace File"
                              >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleArchive(doc.id, doc.title)}
                                title="Archive"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ArchiveBoxIcon className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(doc.id, doc.title)}
                              title="Restore"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload New Document</DialogTitle>
            <DialogDescription>
              Upload a PDF document to make it available site-wide.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">Document Type</Label>
              <Select
                value={uploadForm.type}
                onValueChange={(value: SiteDocumentType) =>
                  setUploadForm((f) => ({ ...f, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={uploadForm.title}
                onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Terms and Conditions"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the document..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">PDF File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setUploadForm((f) => ({
                    ...f,
                    file: e.target.files?.[0] || null,
                  }))
                }
              />
              {uploadForm.file && (
                <p className="text-sm text-muted-foreground">
                  {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show-in-account">Show in Account Documents tab</Label>
              <Switch
                id="show-in-account"
                checked={uploadForm.showInAccount}
                onCheckedChange={(checked) =>
                  setUploadForm((f) => ({ ...f, showInAccount: checked }))
                }
              />
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
              onClick={handleUploadDocument}
              disabled={uploading || !uploadForm.file || !uploadForm.title || !uploadForm.type}
            >
              {uploading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update the document metadata. To replace the file, use the Replace button.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-show-in-account">Show in Account Documents tab</Label>
              <Switch
                id="edit-show-in-account"
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
            <Button
              onClick={handleEditDocument}
              disabled={updateDocument.isPending || !editForm.title}
            >
              {updateDocument.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace File Dialog */}
      <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Replace Document File</DialogTitle>
            <DialogDescription>
              Upload a new version of <strong>{selectedDocument?.title}</strong>. This will
              increment the version number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Current version</p>
              <p className="font-medium">
                v{selectedDocument?.version} - {selectedDocument?.file_name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-file">New PDF File</Label>
              <Input
                id="replace-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setReplaceFile(e.target.files?.[0] || null)
                }
              />
              {replaceFile && (
                <p className="text-sm text-muted-foreground">
                  {replaceFile.name} ({formatFileSize(replaceFile.size)})
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplaceDialogOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleReplaceFile} disabled={uploading || !replaceFile}>
              {uploading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                  Replace
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
