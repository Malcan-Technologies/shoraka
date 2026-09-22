"use client";

import Link from "next/link";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { applicationFlowAmendmentTargetSurfaceClassName } from "@/app/(application-flow)/applications/components/form-control";
import {
  PROFILE_PEOPLE_HREF,
} from "@cashsouk/types";
import type { IssuerDirectorOption } from "./issuer-directors";
import {
  AuthorizedRepIcField,
  authorizedRepRowGridClass,
  authorizedRepRowGridReadOnlyClass,
} from "./authorized-rep-fields";
import {
  ISSUER_DIRECTOR_PERSON_EMAIL_FIELD_HINT,
  PROFILE_PEOPLE_ACCESS_LINK_LABEL,
} from "./issuer-offer-reps-blocker";

type IssuerAuthorizedRepresentativesCardProps = {
  companyName: string;
  directors: IssuerDirectorOption[];
  selectedMatchKeys: string[];
  onChange: (matchKeys: string[]) => void;
  showSealApplier?: boolean;
  sealApplierMatchKey?: string | null;
  onSealApplierChange?: (matchKey: string | null) => void;
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
  showSealApplier = false,
  sealApplierMatchKey = null,
  onSealApplierChange,
  readOnly = false,
  isLoading = false,
  highlighted = false,
  remark = null,
}: IssuerAuthorizedRepresentativesCardProps) {
  const usedKeys = new Set(selectedMatchKeys.filter(Boolean));
  const availableToAdd = directors.filter((director) => !usedKeys.has(director.matchKey));
  const canAdd = !readOnly && availableToAdd.length > 0;
  const rows = selectedMatchKeys.length > 0 ? selectedMatchKeys : [""];
  const selectedDirectors = selectedMatchKeys
    .map((key) => directors.find((director) => director.matchKey === key))
    .filter((director): director is IssuerDirectorOption => Boolean(director));

  const updateRow = (index: number, matchKey: string) => {
    const previous = rows[index];
    const next = [...rows];
    next[index] = matchKey;
    onChange(next.filter(Boolean));
    if (previous && previous === sealApplierMatchKey && previous !== matchKey) {
      onSealApplierChange?.(null);
    }
  };

  const removeRow = (index: number) => {
    const removed = rows[index];
    onChange(rows.filter((_, rowIndex) => rowIndex !== index).filter(Boolean));
    if (removed && removed === sealApplierMatchKey) {
      onSealApplierChange?.(null);
    }
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
          Select the directors who will represent this company. Everyone named here must sign.
          CashSouk will review this list with the Board Resolution.
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
            const icFieldId = `issuer-rep-ic-${index}`;
            return (
              <div
                key={`${selectedKey || "empty"}-${index}`}
                className={readOnly ? authorizedRepRowGridReadOnlyClass : authorizedRepRowGridClass}
              >
                <div className="min-w-0 space-y-1.5">
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
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={emailFieldId} className="text-meta text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id={emailFieldId}
                    value={selected?.email ?? ""}
                    placeholder="Add Person Email on People & Access"
                    readOnly
                    disabled
                    tabIndex={-1}
                    className="rounded-xl bg-muted text-ui select-none"
                  />
                  {selected && !selected.email.trim() ? (
                    <p className="text-meta text-destructive">
                      {ISSUER_DIRECTOR_PERSON_EMAIL_FIELD_HINT}{" "}
                      <Link
                        href={PROFILE_PEOPLE_HREF}
                        className="font-medium underline underline-offset-2"
                      >
                        {PROFILE_PEOPLE_ACCESS_LINK_LABEL}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <AuthorizedRepIcField id={icFieldId} value={selected?.ic_number ?? ""} readOnly />
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
          {showSealApplier && selectedDirectors.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-ui font-medium text-foreground">Applies company seal</p>
              <p className="text-meta text-muted-foreground">
                Choose one director to apply the organisation seal on the Facility Agreement and
                Deed of Assignment.
              </p>
              <RadioGroup
                value={sealApplierMatchKey ?? ""}
                onValueChange={(value) => onSealApplierChange?.(value || null)}
                disabled={readOnly}
                className="space-y-2"
                aria-label="Applies company seal"
              >
                {selectedDirectors.map((director) => (
                  <label
                    key={director.matchKey}
                    className="flex items-center gap-2 text-ui text-foreground"
                  >
                    <RadioGroupItem value={director.matchKey} />
                    <span>{director.name}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
