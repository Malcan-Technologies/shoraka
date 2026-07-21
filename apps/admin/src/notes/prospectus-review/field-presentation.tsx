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
import type { ComponentType } from "react";
import { ProspectusSectionTitle } from "@/notes/prospectus-review/section-title";

/** Soft grey surface for system / reused read-only values. */
export const PROSPECTUS_READONLY_SURFACE =
  "rounded-xl border border-border bg-muted/30 px-4 py-3";

const LABEL_CLASS = "text-sm font-medium text-foreground";
const VALUE_CLASS = "mt-1 break-words text-sm font-medium leading-6 text-foreground";
const INPUT_CLASS = "h-11 text-sm";

export function ProspectusReadOnlyField({
  label,
  value,
  source,
  className,
}: {
  label: string;
  value: string;
  /** Internal source metadata — tooltip only, never visible body text. */
  source?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(PROSPECTUS_READONLY_SURFACE, "min-w-0", className)}
      title={source}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={VALUE_CLASS}>{value}</div>
    </div>
  );
}

export function ProspectusReusedField({
  label,
  value,
  source,
  className,
}: {
  label: string;
  value: string;
  /** Optional internal source — tooltip only, not visible card text. */
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
  icon,
  optional,
  missingCount,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  optional?: boolean;
  missingCount?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <ProspectusSectionTitle
        title={title}
        icon={icon}
        optional={optional}
        missingCount={missingCount}
      />
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
  incomplete,
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
  incomplete?: boolean;
}) {
  const showIncomplete = Boolean(required && incomplete && !disabled);
  return (
    <div className="space-y-1.5">
      <Label className={LABEL_CLASS}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        {optional ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
        ) : null}
      </Label>
      <div className="flex items-center gap-1.5">
        {prefix ? <span className="text-xs text-muted-foreground">{prefix}</span> : null}
        <Input
          className={cn(
            INPUT_CLASS,
            showIncomplete && "border-amber-500/70 focus-visible:ring-amber-500/40"
          )}
          type={type}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
      {showIncomplete ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">Required</p>
      ) : null}
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
  placeholder,
  incomplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  incomplete?: boolean;
}) {
  const showIncomplete = Boolean(required && incomplete && !disabled);
  return (
    <div className="space-y-1.5">
      <Label className={LABEL_CLASS}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Textarea
        className={cn(
          "min-h-[6rem] text-sm leading-6",
          showIncomplete && "border-amber-500/70 focus-visible:ring-amber-500/40"
        )}
        rows={rows}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {showIncomplete ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">Required</p>
      ) : null}
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
  placeholder = "Select…",
  incomplete,
}: {
  label: string;
  value: string | null | undefined;
  options: Array<{ key: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  incomplete?: boolean;
}) {
  const empty = !value || !String(value).trim();
  const showIncomplete = Boolean(required && incomplete && empty && !disabled);
  return (
    <div className="space-y-1.5">
      <Label className={LABEL_CLASS}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        {optional ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
        ) : null}
      </Label>
      <Select disabled={disabled} value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger
          className={cn(
            INPUT_CLASS,
            showIncomplete && "border-amber-500/70 focus-visible:ring-amber-500/40"
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showIncomplete ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">Required</p>
      ) : null}
    </div>
  );
}

export function ProspectusPageHeader({
  title,
  completionLabel,
}: {
  title: string;
  completionLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {completionLabel ? (
        <span className="text-xs text-muted-foreground">{completionLabel}</span>
      ) : null}
    </div>
  );
}
