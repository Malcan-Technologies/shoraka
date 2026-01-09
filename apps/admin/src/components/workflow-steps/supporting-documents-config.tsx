"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

interface DocumentCategory {
  name: string;
  documents: DocumentItem[];
}

interface DocumentItem {
  title: string;
  required: boolean;
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
  const categories = config.categories || DEFAULT_CATEGORIES;

  const [newDocTitle, setNewDocTitle] = React.useState<{ [key: number]: string }>({});

  const toggleDocument = (catIndex: number, docIndex: number) => {
    const newCategories = [...categories];
    newCategories[catIndex].documents[docIndex].required =
      !newCategories[catIndex].documents[docIndex].required;
    onChange({ ...config, categories: newCategories });
  };

  const addDocument = (catIndex: number) => {
    const title = newDocTitle[catIndex]?.trim();
    if (!title) return;

    const newCategories = [...categories];
    newCategories[catIndex].documents.push({ title, required: true });
    onChange({ ...config, categories: newCategories });
    setNewDocTitle({ ...newDocTitle, [catIndex]: "" });
  };

  const removeDocument = (catIndex: number, docIndex: number) => {
    const newCategories = [...categories];
    newCategories[catIndex].documents.splice(docIndex, 1);
    onChange({ ...config, categories: newCategories });
  };

  const totalDocs = categories.reduce((sum, cat) => sum + cat.documents.length, 0);
  const requiredDocs = categories.reduce(
    (sum, cat) => sum + cat.documents.filter((d) => d.required).length,
    0
  );

  return (
    <div className="space-y-5 pt-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Configure supporting documents
        </p>
        <p className="text-xs text-muted-foreground">
          Organize documents by category and mark which are required
        </p>
      </div>

      {/* Document Categories */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Document Categories</Label>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {categories.map((category, catIndex) => (
            <div key={catIndex} className="p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">{category.name}</p>
                <span className="text-xs text-muted-foreground">
                  {category.documents.filter((d) => d.required).length}/{category.documents.length} required
                </span>
              </div>

              {/* Document List */}
              {category.documents.length > 0 && (
                <div className="space-y-2 mb-3">
                  {category.documents.map((doc, docIndex) => (
                    <div key={docIndex} className="flex items-center gap-2 pl-2 group">
                      <Checkbox
                        checked={doc.required}
                        onCheckedChange={() => toggleDocument(catIndex, docIndex)}
                        className="mt-0.5"
                      />
                      <span className="flex-1 text-xs">{doc.title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          doc.required
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {doc.required ? "Required" : "Optional"}
                      </span>
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
                  className="h-8 text-xs bg-background"
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
          ))}
        </div>
      </div>

      <div className="pt-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
        {totalDocs === 0
          ? `No documents configured yet`
          : `${requiredDocs} required / ${totalDocs} total documents`}
      </div>
    </div>
  );
}

