"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Soft grey surface for system / reused read-only values. */
export const PROSPECTUS_READONLY_SURFACE =
  "rounded-xl border border-border bg-muted/30 px-4 py-3";

type SourceProps = { source?: string };

export function ProspectusReadOnlyField({
  label,
  value,
  source,
  className,
}: {
  label: string;
  value: string;
  source?: string;
  className?: string;
}) {
  return (
    <div className={cn(PROSPECTUS_READONLY_SURFACE, "min-w-0", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-[17px] font-medium leading-7 text-foreground">
        {value}
      </div>
      {source ? (
        <div className="mt-1.5 text-xs text-muted-foreground">{source}</div>
      ) : null}
    </div>
  );
}

export function ProspectusReusedField({
  label,
  value,
  source = "From another Prospectus section",
  className,
}: {
  label: string;
  value: string;
  source?: string;
  className?: string;
}) {
  return (
    <ProspectusReadOnlyField
      label={label}
      value={value}
      source={source}
      className={className}
    />
  );
}

export function ProspectusInfoGrid({
  children,
  columns = 3,
}: {
  children: React.ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {children}
    </div>
  );
}

export function ProspectusSectionShell({
  title,
  status,
  optional,
  missingCount,
  children,
}: {
  title: string;
  status?: "complete" | "incomplete" | "optional";
  optional?: boolean;
  missingCount?: number;
  children: React.ReactNode;
}) {
  const statusLabel = optional
    ? "Optional"
    : missingCount != null && missingCount > 0
      ? `${missingCount} required missing`
      : status === "complete"
        ? "Complete"
        : status === "incomplete"
          ? "Incomplete"
          : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pb-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {statusLabel ? (
          <span
            className={cn(
              "text-xs font-medium",
              optional
                ? "text-muted-foreground"
                : missingCount != null && missingCount > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground"
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ProspectusEditableTextField({
  label,
  value,
  onChange,
  disabled,
  required,
  optional,
  placeholder,
  type = "text",
  suffix,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        {optional ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
        ) : null}
      </Label>
      <div className="flex items-center gap-1.5">
        {prefix ? <span className="text-xs text-muted-foreground">{prefix}</span> : null}
        <Input
          className="h-11"
          type={type}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

export function ProspectusEditableTextarea({
  label,
  value,
  onChange,
  disabled,
  required,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Textarea
        className="min-h-[6rem] text-[17px] leading-7"
        rows={rows}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function ProspectusOptionSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  required,
  optional,
}: {
  label: string;
  value: string | null | undefined;
  options: Array<{ key: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        {optional ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
        ) : null}
      </Label>
      <Select
        disabled={disabled}
        value={value ?? undefined}
        onValueChange={onChange}
      >
        <SelectTrigger className="h-11">
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ProspectusPageHeader({
  title,
  subtitle,
  completionLabel,
  dirty,
}: {
  title: string;
  subtitle?: string;
  completionLabel?: string;
  dirty?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {completionLabel ? <span>{completionLabel}</span> : null}
        {dirty ? <span className="font-medium text-amber-700">Unsaved changes</span> : null}
      </div>
    </div>
  );
}

export type { SourceProps };
