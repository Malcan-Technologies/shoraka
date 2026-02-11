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
 * - UI state is always a string (can be "", "12", "12.3", "12.34", "1,234.56")
 * - onChange does NOT auto-format; only onBlur applies formatMoney()
 * - Formatting is display-only; never store formatted values in DB
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
}: MoneyInputProps) {
  /**
   * Validation helper
   *
   * What: Validates raw input and returns acceptance decision.
   * Why: Strict parsing avoids invalid money formats.
   */
  const isValidMoneyInput = (raw: string): boolean => {
    // empty is valid if allowed
    if (raw === "") return allowEmpty;

    // digits + optional decimal (max 2 dp)
    if (!/^\d+(\.\d{0,2})?$/.test(raw)) return false;

    // enforce max integer digits
    const [intPart] = raw.split(".");
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
   * Why: Better UX (show formatted only when not typing) + prepare for display.
   */
  const handleBlur = () => {
    if (value === "" && allowEmpty) {
      // keep empty
      return;
    }

    if (value !== "") {
      // apply formatMoney to add commas + 2dp
      const formatted = formatMoney(value);
      onValueChange(formatted);
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
    <div className={cn("relative w-full h-full flex items-center", className)}>
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
