"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { toast } from "sonner";
import type { StepComponentProps } from "../step-components";
import { useApplication } from "@/hooks/use-applications";
import { useS3Upload } from "@/hooks/use-s3-upload";

export default function SupportingDocumentsStep({
  stepConfig,
  applicationId,
  onDataChange,
}: StepComponentProps) {
  const categories = React.useMemo(() => {
    if (!stepConfig || !stepConfig.categories || !Array.isArray(stepConfig.categories)) {
      return [];
    }
    return stepConfig.categories as Array<{
      name: string;
      documents: Array<{ title: string }>;
    }>;
  }, [stepConfig]);

  const { data: application } = useApplication(applicationId);

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

  const [uploadedFiles, setUploadedFiles] = React.useState<
    Record<string, { name: string; size: number; uploadedAt: string; s3Key?: string }>
  >({});

  const [selectedFiles, setSelectedFiles] = React.useState<Record<string, File>>({});

  const { uploadFiles: uploadFilesToS3Hook, isUploading } = useS3Upload(applicationId);

  React.useEffect(() => {
    if (existingData?.categories) {
      const files: Record<string, { name: string; size: number; uploadedAt: string; s3Key?: string }> = {};
      
      existingData.categories.forEach((category, catIndex) => {
        category.documents.forEach((doc, docIndex) => {
          if (doc.file) {
            const s3Key = (doc.file as Record<string, unknown>).s3_key || (doc.file as Record<string, unknown>).s3Key;
            const fileName = (doc.file as Record<string, unknown>).file_name || (doc.file as Record<string, unknown>).name;
            
            if (s3Key) {
              const key = `${catIndex}-${docIndex}`;
              files[key] = {
                name: fileName as string,
                size: ((doc.file as Record<string, unknown>).size as number) || 0,
                uploadedAt: ((doc.file as Record<string, unknown>).uploadedAt as string) || new Date().toISOString().split("T")[0],
                s3Key: s3Key as string,
              };
            }
          }
        });
      });
      
      setUploadedFiles(files);
    }
  }, [existingData]);

  const handleFileChange = (categoryIndex: number, documentIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB");
      return;
    }

    const allowedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      toast.error("File type not allowed. Please upload PDF, DOC, DOCX, JPG, or PNG files.");
      return;
    }

    const key = `${categoryIndex}-${documentIndex}`;

    setSelectedFiles((prev) => ({
      ...prev,
      [key]: file,
    }));

    setUploadedFiles((prev) => ({
      ...prev,
      [key]: {
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString().split("T")[0],
      },
    }));

    toast.success("File selected. Click 'Save and continue' to upload.");
  };

  const uploadFilesToS3 = React.useCallback(async (): Promise<{ supportingDocuments: unknown } | null> => {
    if (!applicationId || Object.keys(selectedFiles).length === 0) {
      return null;
    }

    const filesMap = new Map(Object.entries(selectedFiles));
    const uploadResults = await uploadFilesToS3Hook(filesMap);

    if (uploadResults.size === 0) {
      throw new Error("Failed to upload files");
    }

    setSelectedFiles({});
    
    const updatedFiles: typeof uploadedFiles = { ...uploadedFiles };
    uploadResults.forEach((result, key) => {
      if (updatedFiles[key]) {
        updatedFiles[key] = {
          ...updatedFiles[key],
          s3Key: result.s3_key,
        };
      }
    });
    setUploadedFiles(updatedFiles);

    const freshData = {
      categories: categories.map((category, catIndex) => ({
        name: category.name,
        documents: category.documents.map((doc, docIndex) => {
          const fileKey = `${catIndex}-${docIndex}`;
          const uploadResult = uploadResults.get(fileKey);
          const existingFile = uploadedFiles[fileKey];
          
          const s3Key = uploadResult?.s3_key || existingFile?.s3Key;
          const fileName = uploadResult?.file_name || existingFile?.name;
          
          if (s3Key && fileName) {
            return {
              title: doc.title,
              file: {
                file_name: fileName,
                s3_key: s3Key,
              },
            };
          }
          
          return { title: doc.title };
        }),
      })),
    };
    
    if (onDataChange) {
      onDataChange({
        supportingDocuments: freshData,
        _uploadFiles: uploadFilesRef.current,
      });
    }
    
    return { supportingDocuments: freshData };
  }, [applicationId, selectedFiles, uploadFilesToS3Hook, categories, uploadedFiles, onDataChange]);

  const uploadFilesRef = React.useRef(uploadFilesToS3);
  React.useEffect(() => {
    uploadFilesRef.current = uploadFilesToS3;
  }, [uploadFilesToS3]);

  const handleRemoveFile = (categoryIndex: number, documentIndex: number) => {
    const key = `${categoryIndex}-${documentIndex}`;
    
    setUploadedFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[key];
      return newFiles;
    });

    setSelectedFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[key];
      return newFiles;
    });

    toast.success("File removed");
  };

  const isDocumentUploaded = (categoryIndex: number, documentIndex: number): boolean => {
    const key = `${categoryIndex}-${documentIndex}`;
    return key in uploadedFiles;
  };

  const isDocumentUploadedToS3 = (categoryIndex: number, documentIndex: number): boolean => {
    const key = `${categoryIndex}-${documentIndex}`;
    return uploadedFiles[key]?.s3Key !== undefined;
  };

  React.useEffect(() => {
    if (!applicationId || !onDataChange) return;

    const dataToSave = {
      categories: categories.map((category, catIndex) => ({
        name: category.name,
        documents: category.documents.map((doc, docIndex) => {
          const key = `${catIndex}-${docIndex}`;
          const file = uploadedFiles[key];
          
          return {
            title: doc.title,
            ...(file?.s3Key && {
              file: {
                file_name: file.name,
                s3_key: file.s3Key,
              },
            }),
          };
        }),
      })),
    };

    onDataChange({
      supportingDocuments: dataToSave,
      _uploadFiles: uploadFilesRef.current,
    });
  }, [uploadedFiles, categories, applicationId, onDataChange]);

  const getCategoryStatus = (categoryIndex: number) => {
    let uploadedCount = 0;
    const totalCount = categories[categoryIndex]?.documents.length || 0;
    
    categories[categoryIndex]?.documents.forEach((_, docIndex) => {
      if (isDocumentUploadedToS3(categoryIndex, docIndex)) {
        uploadedCount++;
      }
    });
    
    return { uploadedCount, totalCount };
  };

  if (categories.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-center py-8">
          No documents required for this application.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {categories.map((category, categoryIndex) => {
        const status = getCategoryStatus(categoryIndex);
        const isComplete = status.uploadedCount === status.totalCount && status.totalCount > 0;

        return (
          <div key={categoryIndex}>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h3 className="font-semibold">{category.name}</h3>
              <div className={isComplete ? "text-sm text-primary font-medium" : "text-sm text-muted-foreground font-medium"}>
                {isComplete ? (
                  <>
                    <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                    {status.uploadedCount}/{status.totalCount} files uploaded
                  </>
                ) : (
                  <>
                    {status.uploadedCount}/{status.totalCount} files required
                  </>
                )}
              </div>
            </div>
            <ul className="space-y-2 mt-4">
              {category.documents.map((document, documentIndex) => {
                const key = `${categoryIndex}-${documentIndex}`;
                const isUploaded = isDocumentUploaded(categoryIndex, documentIndex);
                const fileIsUploading = isUploading(key);
                const file = uploadedFiles[key];

                return (
                  <li key={documentIndex} className="flex justify-between text-sm">
                    <span>{document.title}</span>
                    {isUploaded && file && !fileIsUploading ? (
                      <span className="text-muted-foreground">{file.name}</span>
                    ) : (
                      <label htmlFor={`file-${key}`} className="text-accent font-medium cursor-pointer hover:underline">
                        Upload file
                        <Input
                          id={`file-${key}`}
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) =>
                            handleFileChange(categoryIndex, documentIndex, e)
                          }
                          className="hidden"
                          disabled={fileIsUploading}
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
