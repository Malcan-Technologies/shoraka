"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { applicationFlowAmendmentTargetSurfaceClassName } from "@/app/(application-flow)/applications/components/form-control";
import type { IssuerDirectorOption } from "./issuer-directors";

type IssuerAuthorizedRepresentativesCardProps = {
  companyName: string;
  directors: IssuerDirectorOption[];
  selectedMatchKeys: string[];
  onChange: (matchKeys: string[]) => void;
  readOnly?: boolean;
  isLoading?: boolean;
  highlighted?: boolean;
  remark?: string | null;
};

export function IssuerAuthorizedRepresentativesCard({
  companyName,
  directors,
  selectedMatchKeys,
  onChange,
  readOnly = false,
  isLoading = false,
  highlighted = false,
  remark = null,
}: IssuerAuthorizedRepresentativesCardProps) {
  const usedKeys = new Set(selectedMatchKeys.filter(Boolean));
  const availableToAdd = directors.filter((director) => !usedKeys.has(director.matchKey));
  const canAdd = !readOnly && availableToAdd.length > 0;
  const rows = selectedMatchKeys.length > 0 ? selectedMatchKeys : [""];

  const updateRow = (index: number, matchKey: string) => {
    const next = [...rows];
    next[index] = matchKey;
    onChange(next.filter(Boolean));
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index).filter(Boolean));
  };

  const addRow = () => {
    const nextDirector = availableToAdd[0];
    if (!nextDirector) return;
    onChange([...selectedMatchKeys.filter(Boolean), nextDirector.matchKey]);
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl bg-background p-3",
        highlighted
          ? applicationFlowAmendmentTargetSurfaceClassName
          : "border border-border"
      )}
    >
      <div className="min-w-0">
        <p className="text-card-title text-foreground">Issuer company</p>
        <p className="text-ui text-muted-foreground">{companyName}</p>
        <p className="mt-1 text-meta text-muted-foreground">
          Select the directors who may represent this company. CashSouk will review this list with
          the Board Resolution.
        </p>
        {highlighted ? (
          <p className="mt-2 text-ui text-foreground">
            {remark?.trim() ? remark : "CashSouk requested a change to this list."}
          </p>
        ) : null}
      </div>
      {isLoading ? (
        <p className="text-ui text-muted-foreground">Loading directors…</p>
      ) : directors.length === 0 ? (
        <p className="text-ui text-destructive">
          No directors are available on the company profile. Add directors before submitting.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((selectedKey, index) => {
            const selectable = directors.filter(
              (director) =>
                director.matchKey === selectedKey || !usedKeys.has(director.matchKey)
            );
            const selected = directors.find((director) => director.matchKey === selectedKey);
            const nameFieldId = `issuer-rep-name-${index}`;
            const emailFieldId = `issuer-rep-email-${index}`;
            return (
              <div key={`${selectedKey || "empty"}-${index}`} className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor={nameFieldId} className="text-meta text-muted-foreground">
                      Director
                    </Label>
                    <Select
                      value={selectedKey || undefined}
                      disabled={readOnly}
                      onValueChange={(matchKey) => updateRow(index, matchKey)}
                    >
                      <SelectTrigger id={nameFieldId} className="rounded-xl text-ui">
                        <SelectValue placeholder="Select director" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectable.map((director) => (
                          <SelectItem key={director.matchKey} value={director.matchKey}>
                            {director.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={emailFieldId} className="text-meta text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id={emailFieldId}
                      value={selected?.email ?? ""}
                      readOnly
                      disabled
                      tabIndex={-1}
                      className="rounded-xl bg-muted text-ui select-none"
                    />
                  </div>
                  {!readOnly ? (
                    <div className="flex items-end pb-1">
                      <button
                        type="button"
                        aria-label="Remove director"
                        disabled={rows.filter(Boolean).length <= 1 && Boolean(selectedKey)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-transparent hover:text-destructive disabled:opacity-40"
                        onClick={() => removeRow(index)}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl hover:bg-muted hover:text-foreground"
              disabled={!canAdd}
              onClick={addRow}
            >
              Add director
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
