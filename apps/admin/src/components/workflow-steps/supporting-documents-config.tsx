"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

interface DocumentCategory {
  name: string;
  documents: DocumentItem[];
}

interface DocumentItem {
  title: string;
}

interface SupportingDocumentsConfig {
  categories?: DocumentCategory[];
  maxFiles?: number;
  maxFileSize?: number;
}

interface SupportingDocumentsConfigProps {
  config: SupportingDocumentsConfig;
  onChange: (config: SupportingDocumentsConfig) => void;
}

const DEFAULT_CATEGORIES: DocumentCategory[] = [
  {
    name: "Buyer Docs",
    documents: [],
  },
  {
    name: "Financial Docs",
    documents: [],
  },
  {
    name: "Legal Docs",
    documents: [],
  },
  {
    name: "Compliance Docs",
    documents: [],
  },
  {
    name: "Others",
    documents: [],
  },
];

export function SupportingDocumentsConfig({ config, onChange }: SupportingDocumentsConfigProps) {
  // Start with categories that have documents, or empty array
  const existingCategories = config.categories || [];
  const existingCategoryNames = new Set(existingCategories.map(c => c.name));
  
  // Get available categories (those not yet added)
  const availableCategories = DEFAULT_CATEGORIES.filter(
    cat => !existingCategoryNames.has(cat.name)
  );

  const [newDocTitle, setNewDocTitle] = React.useState<{ [key: number]: string }>({});
  const [openCategoryPopover, setOpenCategoryPopover] = React.useState(false);

  // Filter out categories with no documents before saving
  const filterEmptyCategories = (cats: DocumentCategory[]): DocumentCategory[] => {
    return cats.filter(cat => cat.documents && cat.documents.length > 0);
  };

  const addDocument = (catIndex: number) => {
    const docTitle = newDocTitle[catIndex]?.trim();
    if (!docTitle) return;

    const newCategories = [...existingCategories];
    newCategories[catIndex].documents.push({ title: docTitle });
    // Filter out empty categories before saving
    const filteredCategories = filterEmptyCategories(newCategories);
    onChange({ ...config, categories: filteredCategories.length > 0 ? filteredCategories : undefined });
    setNewDocTitle({ ...newDocTitle, [catIndex]: "" });
  };

  const removeDocument = (catIndex: number, docIndex: number) => {
    const newCategories = [...existingCategories];
    newCategories[catIndex].documents.splice(docIndex, 1);
    // Filter out empty categories before saving
    const filteredCategories = filterEmptyCategories(newCategories);
    onChange({ ...config, categories: filteredCategories.length > 0 ? filteredCategories : undefined });
  };

  const addCategory = (categoryName: string) => {
    const categoryToAdd = DEFAULT_CATEGORIES.find(cat => cat.name === categoryName);
    if (!categoryToAdd) return;

    const newCategories = [...existingCategories, { ...categoryToAdd, documents: [] }];
    onChange({ ...config, categories: newCategories });
    setOpenCategoryPopover(false);
  };

  const removeCategory = (catIndex: number) => {
    const newCategories = existingCategories.filter((_, index) => index !== catIndex);
    // Filter out empty categories before saving
    const filteredCategories = filterEmptyCategories(newCategories);
    onChange({ ...config, categories: filteredCategories.length > 0 ? filteredCategories : undefined });
  };

  const totalDocs = existingCategories.reduce((sum, cat) => sum + cat.documents.length, 0);

  return (
    <div className="space-y-5 pt-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Configure supporting documents
        </p>
        <p className="text-xs text-muted-foreground">
          Organize documents by category
        </p>
      </div>

      {/* Document Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Document Categories</Label>
          {availableCategories.length > 0 && (
            <Popover open={openCategoryPopover} onOpenChange={setOpenCategoryPopover}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <PlusIcon className="h-3 w-3 mr-1.5" />
                  Add Category
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  <p className="text-xs font-medium px-2 py-1.5 text-muted-foreground">
                    Select Category
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    {availableCategories.map((category) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => addCategory(category.name)}
                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {existingCategories.length === 0 ? (
            <div className="p-6 rounded-lg border-2 border-dashed border-border bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground">
                No categories added yet. Use the "Add Category" button above to get started.
              </p>
            </div>
          ) : (
            existingCategories.map((category, catIndex) => (
              <div key={catIndex} className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{category.name}</p>
                    <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                      {category.documents.length}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCategory(catIndex)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>

              {/* Document List */}
              {category.documents.length > 0 && (
                <div className="space-y-2 mb-3">
                  {category.documents.map((doc, docIndex) => (
                    <div key={docIndex} className="flex items-center gap-2 pl-2 group">
                      <span className="flex-1 text-xs">{doc.title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDocument(catIndex, docIndex)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      >
                        <TrashIcon className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Document */}
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Add document title..."
                  value={newDocTitle[catIndex] || ""}
                  onChange={(e) => setNewDocTitle({ ...newDocTitle, [catIndex]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDocument(catIndex);
                    }
                  }}
                  className="h-10 bg-background flex-1 text-sm"
                />
                <Button
                  type="button"
                  onClick={() => addDocument(catIndex)}
                  size="sm"
                  disabled={!newDocTitle[catIndex]?.trim()}
                  className="h-8 px-2"
                >
                  <PlusIcon className="h-3 w-3" />
                </Button>
              </div>
            </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
        {totalDocs === 0
          ? `No documents configured yet`
          : `${totalDocs} document${totalDocs !== 1 ? 's' : ''} configured`}
      </div>
    </div>
  );
}

