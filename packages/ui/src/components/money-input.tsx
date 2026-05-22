"use client";

import * as React from "react";
import { Input } from "./input";
import { cn } from "../lib/utils";
import { formatMoney } from "../lib/money";

interface MoneyInputProps {
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  prefix?: string;
  maxIntDigits?: number;
  allowEmpty?: boolean;
  allowNegative?: boolean;
  /** Fires after blur formatting is applied (comma + 2dp). Empty string when field was left empty and allowEmpty. */
  onBlurComplete?: (formattedValue: string) => void;
}

function stripCommas(value: string): string {
  return value.replace(/,/g, "");
}

export function MoneyInput({
  value,
  onValueChange,
  placeholder = "0.00",
  disabled = false,
  className,
  inputClassName,
  prefix = "",
  maxIntDigits = 15,
  allowEmpty = true,
  allowNegative = false,
  onBlurComplete,
}: MoneyInputProps) {
  const isValidMoneyInput = (raw: string): boolean => {
    if (raw === "") return allowEmpty;
    const charPattern = allowNegative ? /^-?[\d,]*\.?\d{0,2}$/ : /^[\d,]*\.?\d{0,2}$/;
    if (!charPattern.test(raw)) return false;
    if ((raw.match(/\./g) ?? []).length > 1) return false;

    const numeric = stripCommas(raw);
    if (numeric === "" || numeric === "-" || numeric === ".") return true;

    const intDigits = numeric.replace(/^-/, "").split(".")[0] ?? "";
    if (intDigits.length > maxIntDigits) return false;
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const numeric = stripCommas(raw);

    if (numeric === "" && allowEmpty) {
      onValueChange("");
      return;
    }

    const intOnly = numeric.replace(/^-/, "").split(".")[0] ?? "";
    if (intOnly.length > maxIntDigits) {
      const input = e.target as HTMLInputElement;
      const pos = Math.min(value.length, input.selectionStart ?? value.length);
      requestAnimationFrame(() => {
        input.setSelectionRange(pos, pos);
      });
      return;
    }

    if (isValidMoneyInput(raw)) {
      onValueChange(raw);
    }
  };

  const handleBlur = () => {
    if (stripCommas(value) === "" && allowEmpty) {
      onBlurComplete?.("");
      return;
    }
    if (value !== "") {
      const formatted = formatMoney(value);
      onValueChange(formatted);
      onBlurComplete?.(formatted);
    }
  };

  const hasPrefixDisplay = prefix && prefix.trim().length > 0;

  return (
    <div className={cn("relative w-full flex items-center", className)}>
      {hasPrefixDisplay && (
        <div className="absolute left-4 inset-y-0 flex items-center text-muted-foreground font-medium text-sm pointer-events-none">
          {prefix}
        </div>
      )}
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(inputClassName, hasPrefixDisplay && "pl-12")}
      />
    </div>
  );
}
