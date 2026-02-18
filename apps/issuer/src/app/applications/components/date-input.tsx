import * as React from "react";
import { format, parse, parseISO, isValid } from "date-fns";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarPopover } from "./calendar-popover";

export function DateInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  value: string; // ISO yyyy-MM-dd
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  /* ============================================================
     Sync ISO → d/M/yyyy
     ============================================================ */
  React.useEffect(() => {
    if (!value) {
      setInputValue("");
      return;
    }

    try {
      const d = parseISO(value);
      if (isValid(d)) {
        setInputValue(format(d, "dd/MM/yyyy"));

      }
    } catch {
      setInputValue("");
    }
  }, [value]);

  /* ============================================================
     Manual typing
     ============================================================ */

     function formatAsDateMask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  let result = day;

  if (digits.length > 2) result += "/" + month;
  if (digits.length > 4) result += "/" + year;

  return result;
}

     const handleManualChange = (raw: string) => {
  const masked = formatAsDateMask(raw);
  setInputValue(masked);

  if (masked.length === 10) {
    const parsed = parse(masked, "dd/MM/yyyy", new Date());

    if (isValid(parsed)) {
      onChange(format(parsed, "yyyy-MM-dd"));
    }
  }
};


  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div className="relative">
          <input
            id={id}
            type="text"
            value={inputValue}
            placeholder={placeholder || "12/4/2025"}
            onChange={(e) => handleManualChange(e.target.value)}
            className={cn(
              "w-full px-3 h-9 rounded-md border border-input text-sm pr-9 bg-background",
              className
            )}
          />

          <CalendarIcon
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
          />
        </div>
      </PopoverPrimitive.Trigger>

<PopoverPrimitive.Portal>
  <PopoverPrimitive.Content
    side="bottom"
    align="start"
    sideOffset={6}
    collisionPadding={8}
    className="z-50"
    onOpenAutoFocus={(e) => e.preventDefault()}
  >
    <CalendarPopover
      selected={value || undefined}
      onSelect={(iso) => {
        onChange(iso);
        setOpen(false);
      }}
    />
  </PopoverPrimitive.Content>
</PopoverPrimitive.Portal>

    </PopoverPrimitive.Root>
  );
}
