"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  firstIssueMessage,
  humanizeApiValidationMessage,
  isProfileValidationError,
  issuesByField,
  omitRecordId,
  type ComrepFieldIssue,
} from "@cashsouk/types";
import { PlusIcon } from "@heroicons/react/24/outline";
import { EmptyState, Tabs, TabsList, TabsTrigger } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ShorakaFilterOption = { id: string; label: string };

export function ShorakaRecordSection<T extends { id?: string }>({
  title,
  description,
  icon,
  addLabel,
  emptyTitle,
  emptyMessage,
  rows,
  canManage,
  filters,
  filter,
  onFilterChange,
  renderCard,
  blank,
  fields,
  dialogTitle,
  onCreate,
  onUpdate,
  onDelete,
  validate,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  addLabel: string;
  emptyTitle: string;
  emptyMessage: string;
  rows: T[];
  canManage: boolean;
  filters?: ShorakaFilterOption[];
  filter?: string;
  onFilterChange?: (value: string) => void;
  renderCard: (row: T) => { title: string; subtitle?: string; meta?: React.ReactNode };
  blank: () => Partial<T>;
  fields: (row: T, set: (next: T) => void, disabled: boolean, errors: Record<string, string>) => React.ReactNode;
  dialogTitle: (mode: "add" | "view" | "edit") => string;
  onCreate: (body: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  validate?: (row: T) => ComrepFieldIssue[];
}) {
  const [editing, setEditing] = React.useState<T | null>(null);
  const [mode, setMode] = React.useState<"add" | "view" | "edit">("add");
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const readOnly = mode === "view";

  const openAdd = () => {
    setMode("add");
    setErrors({});
    setEditing({ ...(blank() as T) });
  };

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={icon}
        title={title}
        description={description}
        actions={
          canManage ? (
            <Button type="button" className="h-10 gap-1.5" onClick={openAdd}>
              <PlusIcon className="h-4 w-4" />
              {addLabel}
            </Button>
          ) : null
        }
      />
      <CardContent className="space-y-4">
        {filters && filter && onFilterChange ? (
          <Tabs value={filter} onValueChange={onFilterChange}>
            <TabsList className="h-10">
              {filters.map((option) => (
                <TabsTrigger key={option.id} value={option.id}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            message={emptyMessage}
            action={
              canManage ? (
                <Button type="button" className="h-10 gap-1.5" onClick={openAdd}>
                  <PlusIcon className="h-4 w-4" />
                  {addLabel}
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const card = renderCard(row);
              return (
                <div key={row.id ?? card.title} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-ui font-medium">{card.title}</p>
                      {card.subtitle ? (
                        <p className="text-meta text-muted-foreground">{card.subtitle}</p>
                      ) : null}
                      {card.meta}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMode("view");
                          setErrors({});
                          setEditing(row);
                        }}
                      >
                        View
                      </Button>
                      {canManage ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMode("edit");
                              setErrors({});
                              setEditing(row);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!row.id) return;
                              try {
                                await onDelete(row.id);
                                toast.success("Removed");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? humanizeApiValidationMessage(err.message)
                                    : "Failed"
                                );
                              }
                            }}
                          >
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {editing ? (
        <Dialog open onOpenChange={(open) => { if (!open) setEditing(null); }}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>{dialogTitle(mode)}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">{fields(editing, setEditing, readOnly, errors)}</div>
            <DialogFooter>
              {readOnly ? (
                <Button className="h-10" variant="outline" onClick={() => setEditing(null)}>
                  Close
                </Button>
              ) : (
                <>
                  <Button className="h-10" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button
                    className="h-10"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        if (validate && editing) {
                          const issues = validate(editing);
                          if (issues.length > 0) {
                            setErrors(issuesByField(issues));
                            toast.error(firstIssueMessage(issues));
                            return;
                          }
                        }
                        setErrors({});
                        setSaving(true);
                        const body = omitRecordId({ ...editing } as Record<string, unknown>);
                        if (mode === "add" || !editing.id) await onCreate(body);
                        else await onUpdate(editing.id, body);
                        setEditing(null);
                        toast.success("Saved");
                      } catch (err) {
                        if (isProfileValidationError(err) && Object.keys(err.fieldErrors).length > 0) {
                          setErrors(err.fieldErrors);
                        }
                        toast.error(
                          err instanceof Error
                            ? humanizeApiValidationMessage(err.message)
                            : "Failed"
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
