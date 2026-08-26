"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const authorizedRepRowGridClass =
  "grid gap-2 min-w-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(9rem,10.5rem)_auto]";

export const authorizedRepRowGridReadOnlyClass =
  "grid gap-2 min-w-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(9rem,10.5rem)]";

type AuthorizedRepIcFieldProps = {
  id: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
};

export function AuthorizedRepIcField({
  id,
  value,
  onChange,
  readOnly = false,
}: AuthorizedRepIcFieldProps) {
  const locked = readOnly || !onChange;
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-meta text-muted-foreground">
        IC number
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        readOnly={locked}
        disabled={locked}
        tabIndex={locked ? -1 : undefined}
        onChange={
          locked
            ? undefined
            : (event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 12))
        }
        placeholder={locked ? undefined : "901212101234"}
        className={cn("rounded-xl text-ui", locked && "bg-muted select-none")}
      />
    </div>
  );
}
