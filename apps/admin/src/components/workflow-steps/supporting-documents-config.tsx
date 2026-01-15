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
import { PlusIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface DocumentCategory {
  name: string;
  documents: DocumentItem[];
}

interface DocumentItem {
  title: string;
}

interface SupportingDocumentsConfig {
  categories?: DocumentCategory[];
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
  const [expandedCategories, setExpandedCategories] = React.useState<Set<number>>(new Set());

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
    // Auto-expand newly added category
    setExpandedCategories(new Set([...expandedCategories, existingCategories.length]));
  };

  const toggleCategory = (catIndex: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(catIndex)) {
      newExpanded.delete(catIndex);
    } else {
      newExpanded.add(catIndex);
    }
    setExpandedCategories(newExpanded);
  };

  const removeCategory = (catIndex: number) => {
    const newCategories = existingCategories.filter((_, index) => index !== catIndex);
    // Filter out empty categories before saving
    const filteredCategories = filterEmptyCategories(newCategories);
    onChange({ ...config, categories: filteredCategories.length > 0 ? filteredCategories : undefined });
  };

  return (
    <div className="p-3 sm:p-5 rounded-lg border bg-card">
      <div className="mb-4 sm:mb-5">
        <Label className="text-sm sm:text-base font-semibold">
          Add Supporting Documents
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Organize documents by category
        </p>
      </div>

      <div className="space-y-4 sm:space-y-5">
        {/* Document Categories */}
        {existingCategories.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {existingCategories.map((category, catIndex) => {
              const isExpanded = expandedCategories.has(catIndex);
              return (
                <div key={catIndex} className="space-y-3">
                  {/* Category Header */}
                  <div className="flex items-center justify-between pb-2 border-b gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCategory(catIndex)}
                      className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                      )}
                      <Label className="text-xs sm:text-sm font-semibold cursor-pointer truncate">
                        {category.name} ({category.documents.length})
                      </Label>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCategory(catIndex)}
                      className="h-9 w-9 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Document List and Add Document - Collapsible */}
                  {isExpanded && (
                    <>
                      {/* Document List */}
                      {category.documents.length > 0 && (
                        <div className="space-y-3 sm:space-y-4 max-h-64 overflow-y-auto">
                          {category.documents.map((doc, docIndex) => {
                            const isMultiLine = doc.title.includes('\n') || doc.title.length > 60;
                            return (
                              <div key={docIndex} className={`flex gap-2 sm:gap-3 group p-2 sm:p-2.5 rounded-md border border-transparent hover:border-destructive transition-all ${isMultiLine ? 'items-start' : 'items-center'}`}>
                                <span className="text-xs sm:text-sm text-foreground font-medium w-3 sm:w-2 shrink-0">{docIndex + 1}.</span>
                                <p className="text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-line flex-1 min-w-0 break-words">{doc.title}</p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeDocument(catIndex, docIndex)}
                                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-8 w-8 sm:h-7 sm:w-7 p-0 shrink-0"
                                >
                                  <TrashIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-destructive" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Document */}
                      <div className="pt-3 border-t">
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
                          className="h-10 sm:h-10 text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Category */}
        {availableCategories.length > 0 && (
          <div className="space-y-2 pt-3 border-t">
            <Label className="text-xs sm:text-sm font-medium">
              {existingCategories.length === 0 ? "Add New Category" : "Add Another Category"}
            </Label>
            <Popover open={openCategoryPopover} onOpenChange={setOpenCategoryPopover}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 sm:h-10 justify-start text-sm"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  <span className="truncate">Select category to add</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-56 p-2" align="start" side="top">
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
            {existingCategories.length === 0 && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add document categories and configure required documents for each
              </p>
            )}
          </div>
        )}

        {/* Empty State */}
        {existingCategories.length === 0 && availableCategories.length === 0 && (
          <div className="text-center py-6 sm:py-8 border-2 border-dashed rounded-lg">
            <p className="text-xs sm:text-sm text-muted-foreground">
              All categories have been added
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

