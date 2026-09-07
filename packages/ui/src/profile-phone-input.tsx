"use client";

import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { normalizeProfilePhone } from "@cashsouk/types";
import { cn } from "./lib/utils";

export function ProfilePhoneInput({
  id,
  value,
  onChange,
  disabled,
  className,
  error,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}) {
  const normalized = normalizeProfilePhone(value);
  return (
    <PhoneInput
      id={id}
      international
      defaultCountry="MY"
      value={normalized ?? undefined}
      onChange={(next) => onChange(next ?? "")}
      disabled={disabled}
      aria-invalid={error || undefined}
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-ui shadow-sm",
        "[&>input]:border-0 [&>input]:bg-transparent [&>input]:text-ui [&>input]:outline-none [&>input]:shadow-none",
        "[&_*]:focus-visible:outline-none [&_*]:focus-visible:ring-0",
        error ? "border-destructive" : null,
        disabled ? "cursor-not-allowed bg-muted text-muted-foreground" : null,
        className
      )}
    />
  );
}
