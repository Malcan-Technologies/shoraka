"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formInputDisabledClassName } from "@/app/(application-flow)/applications/components/form-control";

export type TextareaWithCharCountProps = {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  maxLength: number;
  className: string;
  countLabel: string;
  disabled?: boolean;
  rows?: number;
};

/**
 * Textarea with a non-overlapping character count below the field (issuer business step, offer decline, etc.).
 */
export function TextareaWithCharCount({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  className,
  countLabel,
  disabled,
  rows,
}: TextareaWithCharCountProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={cn(className, disabled && formInputDisabledClassName)}
        disabled={disabled}
      />
      <p className="shrink-0 text-right text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {countLabel}
      </p>
    </div>
  );
}
