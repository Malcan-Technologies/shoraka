"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DocumentIcon, XMarkIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { StepComponentProps } from "../step-components";
import { useApplication, useUpdateApplication } from "@/hooks/use-applications";
import { useRequestApplicationDocumentUploadUrl } from "@/hooks/use-application-documents";

/**
 * Supporting Documents Step Component
 * 
 * This component allows users to upload required supporting documents
 * for their loan application.
 * 
 * Step ID: "supporting-documents-1" or "supporting_documents_1"
 * File name: supporting-documents-1.tsx
 */
export default function SupportingDocumentsStep({
  stepConfig,
  applicationId,
  onDataChange,
}: StepComponentProps) {
  // Get document categories from step config
  // stepConfig.categories is an array like:
  // [
  //   { name: "Buyer Docs", documents: [{ title: "Document 1" }] },
  //   { name: "Financial Docs", documents: [{ title: "Document 2" }] }
  // ]
  const categories = React.useMemo(() => {
    if (!stepConfig || !stepConfig.categories || !Array.isArray(stepConfig.categories)) {
      return [];
    }
    return stepConfig.categories as Array<{
      name: string;
      documents: Array<{ title: string }>;
    }>;
  }, [stepConfig]);

  // Fetch existing application data
  const { data: application } = useApplication(applicationId);
  const updateApplication = useUpdateApplication();

  // Load existing uploaded files from application
  // The data structure is: { categories: [{ name: "...", documents: [{ title: "...", file: {...} }] }] }
  const existingData = React.useMemo(() => {
    if (!application?.supportingDocuments) {
      return null;
    }
    return application.supportingDocuments as {
      categories?: Array<{
        name: string;
        documents: Array<{
          title: string;
          file?: {
            name: string;
            size: number;
            uploadedAt: string;
          };
        }>;
      }>;
    } | null;
  }, [application]);

  // Track uploaded files (already uploaded to S3)
  // Structure: { "categoryIndex-documentIndex": { name, size, uploadedAt, s3Key } }
  const [uploadedFiles, setUploadedFiles] = React.useState<
    Record<string, { name: string; size: number; uploadedAt: string; s3Key?: string }>
  >({});

  // Track selected files (not yet uploaded - stored as File objects)
  // Structure: { "categoryIndex-documentIndex": File }
  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});

  // Track files being uploaded (for loading states)
  const [uploadingFiles, setUploadingFiles] = React.useState<Set<string>>(new Set());

  // Hook to request upload URLs
  const requestUploadUrl = useRequestApplicationDocumentUploadUrl();

  // Load existing files when application data loads
  React.useEffect(() => {
    if (existingData?.categories) {
      const files: Record<string, { name: string; size: number; uploadedAt: string; s3Key?: string }> = {};
      
      existingData.categories.forEach((category, catIndex) => {
        category.documents.forEach((doc, docIndex) => {
          if (doc.file) {
            const key = `${catIndex}-${docIndex}`;
            files[key] = {
              name: doc.file.name,
              size: doc.file.size,
              uploadedAt: doc.file.uploadedAt,
              s3Key: (doc.file as any).s3Key, // S3 key if it exists
            };
          }
        });
      });
      
      setUploadedFiles(files);
    }
  }, [existingData]);

  // Handle file selection (store file, don't upload yet)
  const handleFileChange = (categoryIndex: number, documentIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // Check file type
    const allowedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      toast.error("File type not allowed. Please upload PDF, DOC, DOCX, JPG, or PNG files.");
      return;
    }

    // Create a key to identify this file
    const key = `${categoryIndex}-${documentIndex}`;

    // Store the file (will be uploaded when user clicks "Save and continue")
    setSelectedFiles((prev) => ({
      ...prev,
      [key]: file,
    }));

    // Also update uploadedFiles to show the file is selected (but not uploaded yet)
    setUploadedFiles((prev) => ({
      ...prev,
      [key]: {
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString().split("T")[0],
        // No s3Key yet - will be added after upload
      },
    }));

    toast.success("File selected. Click 'Save and continue' to upload.");
  };

  // Upload files to S3 (called when user clicks "Save and continue")
  const uploadFilesToS3 = React.useCallback(async () => {
    if (!applicationId || Object.keys(selectedFiles).length === 0) {
      return;
    }

    const uploadPromises = Object.entries(selectedFiles).map(async ([key, file]) => {
      // Set uploading state
      setUploadingFiles((prev) => new Set(prev).add(key));

      try {
        // Get content type from file
        const contentType = file.type || "application/octet-stream";

        // Request presigned upload URL from API
        const uploadUrlData = await requestUploadUrl.mutateAsync({
          applicationId,
          input: {
            fileName: file.name,
            contentType,
            fileSize: file.size,
          },
        });

        // Upload file to S3 using presigned URL
        const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": contentType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to S3");
        }

        // Update uploadedFiles with S3 key
        setUploadedFiles((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            s3Key: uploadUrlData.s3Key,
          },
        }));

        return { key, success: true };
      } catch (error) {
        console.error(`Upload error for ${key}:`, error);
        return { key, success: false, error };
      } finally {
        // Remove uploading state
        setUploadingFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    });

    const results = await Promise.all(uploadPromises);
    
    // Check if all uploads succeeded
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      toast.error(`${failed.length} file(s) failed to upload`);
      throw new Error("Some files failed to upload");
    }

    // Clear selected files after successful upload
    setSelectedFiles({});
    
    toast.success("All files uploaded successfully");
  }, [applicationId, selectedFiles, requestUploadUrl]);

  // Store upload function in a ref so it doesn't change on every render
  const uploadFilesRef = React.useRef(uploadFilesToS3);
  React.useEffect(() => {
    uploadFilesRef.current = uploadFilesToS3;
  }, [uploadFilesToS3]);

  // Handle file removal
  const handleRemoveFile = (categoryIndex: number, documentIndex: number) => {
    const key = `${categoryIndex}-${documentIndex}`;
    
    setUploadedFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[key];
      return newFiles;
    });

    toast.success("File removed");
  };

  // Check if a document has been uploaded or selected
  const isDocumentUploaded = (categoryIndex: number, documentIndex: number): boolean => {
    const key = `${categoryIndex}-${documentIndex}`;
    return key in uploadedFiles;
  };

  // Check if a document has an S3 key (actually uploaded)
  const isDocumentUploadedToS3 = (categoryIndex: number, documentIndex: number): boolean => {
    const key = `${categoryIndex}-${documentIndex}`;
    return uploadedFiles[key]?.s3Key !== undefined;
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Save data to application when files change
  // Only save files that have been uploaded to S3 (have s3Key)
  React.useEffect(() => {
    if (!applicationId || !onDataChange) return;

    // Build the data structure to save
    // Only include files that have been uploaded to S3
    const dataToSave = {
      categories: categories.map((category, catIndex) => ({
        name: category.name,
        documents: category.documents.map((doc, docIndex) => {
          const key = `${catIndex}-${docIndex}`;
          const file = uploadedFiles[key];
          
          // Only include file if it has an S3 key (uploaded to S3)
          return {
            title: doc.title,
            ...(file?.s3Key && {
              file: {
                name: file.name,
                size: file.size,
                uploadedAt: file.uploadedAt,
                s3Key: file.s3Key,
              },
            }),
          };
        }),
      })),
    };

    // Send to parent component
    // Also store the upload function so parent can call it
    onDataChange({
      supportingDocuments: dataToSave,
      _uploadFiles: uploadFilesRef.current, // Internal function for parent to call
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles, categories, applicationId]);

  // Show message if no categories configured
  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              No documents required for this application.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Supporting Documents</CardTitle>
          <CardDescription>
            Please upload the required documents for your loan application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {categories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="space-y-4">
              {/* Category Header */}
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">{category.name}</h3>
              </div>

              {/* Documents in this category */}
              <div className="space-y-4">
                {category.documents.map((document, documentIndex) => {
                  const key = `${categoryIndex}-${documentIndex}`;
                  const isUploaded = isDocumentUploaded(categoryIndex, documentIndex);
                  const isUploading = uploadingFiles.has(key);
                  const file = uploadedFiles[key];

                  return (
                    <div key={documentIndex} className="space-y-3">
                      {/* Document Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`file-${key}`}
                              className="text-sm font-medium"
                            >
                              {document.title}
                            </Label>
                            {isUploading && (
                              <Badge variant="outline" className="text-xs">
                                Uploading...
                              </Badge>
                            )}
                            {isUploaded && !isUploading && (
                              <Badge
                                variant="outline"
                                className={
                                  isDocumentUploadedToS3(categoryIndex, documentIndex)
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-yellow-50 text-yellow-700 border-yellow-200"
                                }
                              >
                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                {isDocumentUploadedToS3(categoryIndex, documentIndex)
                                  ? "Uploaded"
                                  : "Selected"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Uploaded File Display or Upload Input */}
                      {isUploaded && file && !isUploading ? (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-3 flex-1">
                            <DocumentIcon className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)} • Uploaded on{" "}
                                {file.uploadedAt}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveFile(categoryIndex, documentIndex)
                            }
                            className="text-destructive hover:text-destructive"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            id={`file-${key}`}
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={(e) =>
                              handleFileChange(categoryIndex, documentIndex, e)
                            }
                            className="cursor-pointer"
                            disabled={isUploading}
                          />
                          <p className="text-xs text-muted-foreground">
                            Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
