"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "./money";

/**
 * MONEY INPUT COMPONENT
 *
 * What: A reusable money input that enforces strict formatting rules.
 * Why: Centralize money input logic (validation, formatting, prefix handling).
 * Data: Manages UI state as string; parent responsible for parsing to number before API call.
 *
 * Key invariants:
 * - While typing: raw value only (no decimals unless user types them)
 * - On blur: format with commas + 2 decimal places
 * - On focus: strip commas for easy editing; decimals preserved
 * - Parent must use parseMoney(value) before sending to API
 *
 * Props:
 * - value: string — current input value (unformatted)
 * - onValueChange: (next: string) => void — called on onChange/onBlur
 * - placeholder?: string — input placeholder
 * - disabled?: boolean — disable input
 * - className?: string — wrapper div className
 * - inputClassName?: string — Input component className
 * - prefix?: string — optional prefix (e.g. "RM"); shown inside input on left
 * - maxIntDigits?: number — max digits before decimal (default 12)
 * - allowEmpty?: boolean — allow empty string (default true)
 * - allowNegative?: boolean — allow negative numbers (default false)
 */
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
}

export function MoneyInput({
  value,
  onValueChange,
  placeholder = "0.00",
  disabled = false,
  className,
  inputClassName,
  prefix = "",
  maxIntDigits = 12,
  allowEmpty = true,
  allowNegative = false,
}: MoneyInputProps) {
  /**
   * Validation helper
   *
   * What: Validates raw input and returns acceptance decision.
   * Why: Strict parsing avoids invalid money formats.
   * Regex: ^-?\d{0,12}(\.\d{0,2})?$ — max 12 digits before decimal, max 2 decimal places.
   */
  const isValidMoneyInput = (raw: string): boolean => {
    if (raw === "") return allowEmpty;

    const regex = allowNegative ? /^-?\d{0,12}(\.\d{0,2})?$/ : /^\d{0,12}(\.\d{0,2})?$/;
    if (!regex.test(raw)) return false;

    const [intPart] = raw.replace(/^-/, "").split(".");
    if (intPart.length > maxIntDigits) return false;

    return true;
  };

  /**
   * onChange handler
   *
   * What: Handle user typing; validate but do NOT auto-format.
   * Why: Format only on blur to keep typing smooth; avoid replacing cursor position mid-type.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // remove existing commas (user may paste formatted value)
    const unformatted = raw.replace(/,/g, "");

    // validate and update
    if (isValidMoneyInput(unformatted)) {
      onValueChange(unformatted);
    }
  };

  /**
   * onBlur handler
   *
   * What: Format display on blur; convert to formatted string with commas + 2dp.
   * Why: Show formatted only when not typing; decimals appear only after blur.
   */
  const handleBlur = () => {
    if (value === "" && allowEmpty) {
      return;
    }

    if (value !== "") {
      const formatted = formatMoney(value);
      onValueChange(formatted);
    }
  };

  /**
   * onFocus handler
   *
   * What: Strip commas when focusing so user can type without comma in the way.
   * Why: Formatted "1,234.56" becomes "1234.56" for easy editing; decimals preserved.
   */
  const handleFocus = () => {
    if (value.includes(",")) {
      onValueChange(value.replace(/,/g, ""));
    }
  };

  /**
   * Prefix handling
   *
   * What: Optional prefix (e.g. "RM") displayed inside input on left.
   * Why: Improves UX; prefix is not part of value, just visual affordance.
   */
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
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(inputClassName, hasPrefixDisplay && "pl-12")}
      />
    </div>
  );
}
