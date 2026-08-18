"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentCheckIcon,
  ClipboardIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminOrganizationAddressInput } from "@cashsouk/types";

export function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="flex items-start gap-3 py-2">
      {Icon ? (
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-meta text-muted-foreground">{label}</div>
        <div className="break-words text-ui font-medium">{value}</div>
      </div>
    </div>
  );
}

export function CopyableField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [copied, setCopied] = React.useState(false);

  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="flex items-start gap-3 py-2">
      {Icon ? (
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-meta text-muted-foreground">{label}</div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="group mt-0.5 inline-flex cursor-pointer items-center gap-1.5 rounded border bg-background px-2 py-1 text-ui font-medium transition-colors hover:bg-muted"
          title="Click to copy"
        >
          <span className="break-words text-left">{value}</span>
          {copied ? (
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 shrink-0 text-status-success-text" />
          ) : (
            <ClipboardIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}

export function ReadField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="space-y-1.5 py-2">
      <div className="text-meta text-muted-foreground">{label}</div>
      <div className="break-words text-ui font-medium">{empty ? "—" : value}</div>
    </div>
  );
}

export function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  id?: string;
}) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5 py-2">
      <Label htmlFor={fieldId} className="text-meta text-muted-foreground">
        {label}
      </Label>
      {multiline ? (
        <Textarea
          id={fieldId}
          className="text-ui"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
        />
      ) : (
        <Input
          id={fieldId}
          className="text-ui"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

export function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || "";
    if (lastPart.length > 30) {
      return `${parsed.hostname}/.../${lastPart.substring(0, 25)}...`;
    }
    if (pathParts.length > 2) {
      return `${parsed.hostname}/.../${lastPart}`;
    }
    return `${parsed.hostname}${parsed.pathname.substring(0, 40)}${parsed.pathname.length > 40 ? "..." : ""}`;
  } catch {
    return url.substring(0, 40) + (url.length > 40 ? "..." : "");
  }
}

export interface FormField {
  fieldName: string;
  fieldType: string;
  fieldValue: string | boolean | string[] | null;
  alias?: string;
  cn?: boolean;
}

export interface FormData {
  content?: FormField[];
  displayArea?: string;
}

export function isFormData(data: unknown): data is FormData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.content) &&
    obj.content.length > 0 &&
    obj.content.every(
      (item: unknown) => typeof item === "object" && item !== null && "fieldName" in item
    )
  );
}

const COPYABLE_FIELD_PATTERNS = [
  /bank.*account.*number/i,
  /account.*number/i,
  /phone/i,
  /mobile/i,
  /email/i,
];

function isCopyableField(fieldName: string): boolean {
  return COPYABLE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

function CopyableFormValue({ value, fieldName }: { value: string; fieldName: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${fieldName} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="group inline-flex cursor-pointer items-center gap-1.5 rounded border bg-background px-2 py-1 font-medium transition-colors hover:bg-muted"
      title="Click to copy"
    >
      <span>{value}</span>
      {copied ? (
        <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-status-success-text" />
      ) : (
        <ClipboardIcon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
      )}
    </button>
  );
}

export function FormFieldValue({ field }: { field: FormField }): React.ReactNode {
  const { fieldValue, fieldType, fieldName } = field;

  if (fieldValue === null || fieldValue === undefined || fieldValue === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  if (fieldType === "checkbox" && typeof fieldValue === "boolean") {
    return fieldValue ? (
      <span className="font-medium text-status-success-text">✓ Yes</span>
    ) : (
      <span className="text-muted-foreground">No</span>
    );
  }

  if (fieldType === "multi-checkbox" && Array.isArray(fieldValue)) {
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {fieldValue.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </div>
    );
  }

  if (fieldType === "picklist" && typeof fieldValue === "string") {
    const lowerValue = fieldValue.toLowerCase();
    if (lowerValue === "yes") return <span className="font-medium text-status-success-text">✓ Yes</span>;
    if (lowerValue === "no") return <span className="text-muted-foreground">No</span>;
    return <Badge variant="secondary">{fieldValue}</Badge>;
  }

  if (typeof fieldValue === "string" && isUrl(fieldValue)) {
    return (
      <a
        href={fieldValue}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <LinkIcon className="h-3 w-3" />
        <span className="max-w-[200px] truncate">{shortenUrl(fieldValue)}</span>
        <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
      </a>
    );
  }

  if (typeof fieldValue === "string" && isCopyableField(fieldName)) {
    return <CopyableFormValue value={fieldValue} fieldName={field.alias || fieldName} />;
  }

  return <span className="font-medium">{String(fieldValue)}</span>;
}

function isSophisticatedInvestorCriteriaField(fieldName: string, alias?: string): boolean {
  const name = (fieldName || "").toLowerCase();
  const aliasLower = (alias || "").toLowerCase();
  return (
    name.includes("net assets") ||
    aliasLower.includes("net assets") ||
    name.includes("annual income") ||
    aliasLower.includes("annual income") ||
    name.includes("net personal investment portfolio") ||
    name.includes("net joint investment portfolio") ||
    name.includes("rm1,000,000") ||
    name.includes("professional qualification") ||
    aliasLower.includes("professional qualification") ||
    name.includes("experience categories") ||
    aliasLower.includes("experience categories")
  );
}

export function FormDataFields({
  data,
  editing = false,
  onFieldValueChange,
}: {
  data: FormData;
  editing?: boolean;
  onFieldValueChange?: (index: number, value: string) => void;
}) {
  const fields = data.content || [];
  const displayArea = data.displayArea || "";
  const isComplianceDeclaration = displayArea.toLowerCase().includes("compliance");

  const visibleFields = fields.filter((field) => {
    if (field.fieldType === "header") return field.fieldName.trim().length > 0;
    return true;
  });

  return (
    <div className="space-y-1">
      {isComplianceDeclaration ? (
        <p className="mb-2 text-meta text-muted-foreground">
          Fields marked with a star (★) are used to determine sophisticated investor status.
        </p>
      ) : null}
      {visibleFields.map((field, idx) => {
        if (field.fieldType === "header") {
          const isSection =
            field.fieldName.endsWith(":") ||
            field.fieldName.includes("Declaration") ||
            field.fieldName.includes("Categories") ||
            field.fieldName.includes("Status");
          return (
            <div
              key={`${field.fieldName}-${idx}`}
              className={
                isSection
                  ? "border-t pt-3 pb-1 text-meta font-semibold text-foreground first:border-0 first:pt-0"
                  : "pl-2 text-meta text-muted-foreground"
              }
            >
              {field.fieldName}
            </div>
          );
        }

        const displayName = field.alias || field.fieldName;
        const isCriteriaField =
          isComplianceDeclaration &&
          isSophisticatedInvestorCriteriaField(field.fieldName, field.alias);
        const originalIndex = fields.indexOf(field);
        const stringValue =
          field.fieldValue === null || field.fieldValue === undefined
            ? ""
            : String(field.fieldValue);

        return (
          <div
            key={`${field.fieldName}-${idx}`}
            className={`flex flex-col border-b py-1.5 last:border-0 ${isCriteriaField ? "-mx-4 rounded bg-violet-50 px-4 dark:bg-violet-950/20" : ""}`}
          >
            <div className="flex items-center gap-1 text-meta text-muted-foreground">
              {isCriteriaField ? <span className="text-violet-500">★</span> : null}
              {displayName}
            </div>
            <div className="text-ui">
              {editing && onFieldValueChange ? (
                <Input
                  className="mt-1 text-ui"
                  value={stringValue}
                  onChange={(event) => onFieldValueChange(originalIndex, event.target.value)}
                />
              ) : (
                <FormFieldValue field={field} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function JsonObjectFields({ data }: { data: Record<string, unknown> }) {
  const renderValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string" && isUrl(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <LinkIcon className="h-3 w-3" />
          <span className="max-w-[200px] truncate">{shortenUrl(value)}</span>
          <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
        </a>
      );
    }
    if (typeof value === "object") {
      return (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-meta">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return String(value);
  };

  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="border-b pb-2 last:border-0 last:pb-0">
          <div className="text-meta capitalize text-muted-foreground">{key.replace(/_/g, " ")}</div>
          <div className="text-ui">{renderValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

export function JsonFields({
  data,
  editing = false,
  onFieldValueChange,
}: {
  data: Record<string, unknown>;
  editing?: boolean;
  onFieldValueChange?: (index: number, value: string) => void;
}) {
  if (isFormData(data)) {
    return (
      <FormDataFields data={data} editing={editing} onFieldValueChange={onFieldValueChange} />
    );
  }
  return <JsonObjectFields data={data} />;
}

export function formatAddressDisplay(address?: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string | null;
}): string {
  if (!address) return "—";
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.postalCode,
    address.state,
    address.country,
  ].filter((part) => part && part.trim() !== "");
  return parts.length > 0 ? parts.join(", ") : "—";
}

export type AddressDraft = {
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
};

export function emptyAddress(): AddressDraft {
  return { line1: "", line2: "", city: "", postalCode: "", state: "", country: "" };
}

export function addressToDraft(address?: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string | null;
} | null): AddressDraft {
  if (!address) return emptyAddress();
  return {
    line1: address.line1 ?? "",
    line2: address.line2 ?? "",
    city: address.city ?? "",
    postalCode: address.postalCode ?? "",
    state: address.state ?? "",
    country: address.country ?? "",
  };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function draftToAddress(draft: AddressDraft): AdminOrganizationAddressInput {
  return {
    line1: emptyToNull(draft.line1),
    line2: emptyToNull(draft.line2),
    city: emptyToNull(draft.city),
    postalCode: emptyToNull(draft.postalCode),
    state: emptyToNull(draft.state),
    country: emptyToNull(draft.country),
  };
}

export function EditableAddressFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: AddressDraft;
  onChange: (next: AddressDraft) => void;
}) {
  const prefix = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <p className="text-meta font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <EditableField
            id={`${prefix}-line1`}
            label="Address Line 1"
            value={value.line1}
            onChange={(line1) => onChange({ ...value, line1 })}
          />
        </div>
        <div className="sm:col-span-2">
          <EditableField
            id={`${prefix}-line2`}
            label="Address Line 2"
            value={value.line2}
            onChange={(line2) => onChange({ ...value, line2 })}
          />
        </div>
        <EditableField
          id={`${prefix}-city`}
          label="City"
          value={value.city}
          onChange={(city) => onChange({ ...value, city })}
        />
        <EditableField
          id={`${prefix}-postal`}
          label="Postal Code"
          value={value.postalCode}
          onChange={(postalCode) => onChange({ ...value, postalCode })}
        />
        <EditableField
          id={`${prefix}-state`}
          label="State"
          value={value.state}
          onChange={(state) => onChange({ ...value, state })}
        />
        <EditableField
          id={`${prefix}-country`}
          label="Country"
          value={value.country}
          onChange={(country) => onChange({ ...value, country })}
        />
      </div>
    </div>
  );
}

export function hasJsonContent(data: Record<string, unknown> | null | undefined): boolean {
  return Boolean(data && Object.keys(data).length > 0);
}

export function fieldValueToString(value: FormField["fieldValue"]): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return value.join(", ");
}
