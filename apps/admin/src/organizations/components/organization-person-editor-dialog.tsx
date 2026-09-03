"use client";

import * as React from "react";
import { toast } from "sonner";
import type { OrganizationPartyProfileDto } from "@cashsouk/types";
import {
  SC_IDENTITY_PREFIX_LABELS,
  SC_IDENTITY_PREFIXES,
  SC_SHARE_TYPE_LABELS,
  SC_SHARE_TYPES,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PartyEditorValues = {
  name: string;
  identityPrefix: string;
  identityNumber: string;
  entityType: "INDIVIDUAL" | "CORPORATE";
  isDirector: boolean;
  isShareholder: boolean;
  isBoard: boolean;
  isManagement: boolean;
  shareholdingPercentage: string;
  shareType: string;
};

export function partyToEditorValues(party: OrganizationPartyProfileDto): PartyEditorValues {
  return {
    name: party.name ?? "",
    identityPrefix: party.identityPrefix ?? "",
    identityNumber: party.identityNumber ?? "",
    entityType: party.entityType,
    isDirector: party.isDirector,
    isShareholder: party.isShareholder,
    isBoard: party.isBoard,
    isManagement: party.isManagement,
    shareholdingPercentage: party.shareholdingPercentage ?? "",
    shareType: party.shareType ?? "",
  };
}

const emptyValues: PartyEditorValues = {
  name: "",
  identityPrefix: "NRIC",
  identityNumber: "",
  entityType: "INDIVIDUAL",
  isDirector: false,
  isShareholder: false,
  isBoard: false,
  isManagement: false,
  shareholdingPercentage: "",
  shareType: "ORDINARY",
};

export function OrganizationPersonEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  initial,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initial?: PartyEditorValues | null;
  isSaving: boolean;
  onSave: (values: PartyEditorValues) => Promise<void>;
}) {
  const [values, setValues] = React.useState<PartyEditorValues>(initial ?? emptyValues);

  React.useEffect(() => {
    if (open) setValues(initial ?? emptyValues);
  }, [open, initial]);

  const set = <K extends keyof PartyEditorValues>(key: K, value: PartyEditorValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name" value={values.name} onChange={(name) => set("name", name)} />
          <div className="space-y-1.5">
            <Label className="text-ui">Entity</Label>
            <Select
              value={values.entityType}
              onValueChange={(entityType: "INDIVIDUAL" | "CORPORATE") => {
                set("entityType", entityType);
                if (entityType === "CORPORATE") {
                  setValues((current) => ({
                    ...current,
                    entityType,
                    identityPrefix: "ROC",
                    isDirector: false,
                    isBoard: false,
                    isManagement: false,
                    isShareholder: true,
                  }));
                }
              }}
            >
              <SelectTrigger className="h-10 text-ui">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                <SelectItem value="CORPORATE">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-ui">Identity type</Label>
              <Select
                value={values.identityPrefix || undefined}
                onValueChange={(identityPrefix) => set("identityPrefix", identityPrefix)}
              >
                <SelectTrigger className="h-10 text-ui">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {SC_IDENTITY_PREFIXES.map((prefix) => (
                    <SelectItem key={prefix} value={prefix}>
                      {SC_IDENTITY_PREFIX_LABELS[prefix]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              label="Identity number"
              value={values.identityNumber}
              onChange={(identityNumber) => set("identityNumber", identityNumber)}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-ui">Roles</legend>
            {(
              [
                ["isDirector", "Director"],
                ["isBoard", "Board"],
                ["isManagement", "Management"],
                ["isShareholder", "Shareholder"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-ui">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={values[key]}
                  disabled={values.entityType === "CORPORATE" && key !== "isShareholder"}
                  onChange={(event) => set(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {values.isShareholder ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Shareholding %"
                value={values.shareholdingPercentage}
                onChange={(shareholdingPercentage) => set("shareholdingPercentage", shareholdingPercentage)}
              />
              <div className="space-y-1.5">
                <Label className="text-ui">Share type</Label>
                <Select
                  value={values.shareType || undefined}
                  onValueChange={(shareType) => set("shareType", shareType)}
                >
                  <SelectTrigger className="h-10 text-ui">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SC_SHARE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SC_SHARE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10"
            disabled={isSaving}
            onClick={() => {
              if (!values.name.trim()) {
                toast.error("Name is required");
                return;
              }
              if (!values.isDirector && !values.isShareholder && !values.isBoard && !values.isManagement) {
                toast.error("Select at least one role");
                return;
              }
              void onSave(values);
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
