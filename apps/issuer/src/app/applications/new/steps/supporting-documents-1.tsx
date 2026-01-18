"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@cashsouk/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
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
    <div className="space-y-6">
      {categories.map((category, categoryIndex) => {
        const [isOpen, setIsOpen] = React.useState(true);
        const status = getCategoryStatus(categoryIndex);
        const isComplete = status.uploadedCount === status.totalCount && status.totalCount > 0;

        return (
          <Card key={categoryIndex}>
            <Collapsible
              open={isOpen}
              onOpenChange={setIsOpen}
              className="space-y-0"
            >
              <CardContent className="p-0">
                <div className="border-b px-6 py-4">
                  <CollapsibleTrigger className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-2.5">
                      {isOpen ? (
                        <ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                    </div>
                    <span
                      className={
                        isComplete
                          ? "text-sm text-green-700 font-medium"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {status.uploadedCount}/{status.totalCount} {isComplete ? "files uploaded" : "files required"}
                    </span>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="px-6 py-5">
                  <div className="space-y-4">
                    {category.documents.map((document, documentIndex) => {
                      const key = `${categoryIndex}-${documentIndex}`;
                      const isUploaded = isDocumentUploaded(categoryIndex, documentIndex);
                      const fileIsUploading = isUploading(key);
                      const file = uploadedFiles[key];

                      return (
                        <div key={documentIndex} className="flex items-center justify-between py-1">
                          <Label
                            htmlFor={`file-${key}`}
                            className="text-base font-normal flex-1"
                          >
                            {document.title}
                          </Label>

                          {isUploaded && file && !fileIsUploading ? (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={true}
                                className="rounded-none pointer-events-none"
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
                                  {file.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFile(categoryIndex, documentIndex);
                                  }}
                                  className="text-muted-foreground hover:text-destructive transition-colors h-7 w-7 p-0 flex-shrink-0 flex items-center justify-center"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <Label
                                htmlFor={`file-${key}`}
                                className="text-sm text-primary cursor-pointer hover:underline font-normal"
                              >
                                Upload file
                              </Label>
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </CardContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
