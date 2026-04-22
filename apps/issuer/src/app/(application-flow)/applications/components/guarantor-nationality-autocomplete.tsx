"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import {
  REGTANK_ISO3166_COUNTRIES,
  regtankNationalityDisplayLabel,
  isRegtankIso3166Code,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formSelectTriggerClassName,
  formInputDisabledClassName,
} from "@/app/(application-flow)/applications/components/form-control";

const REGTANK_BY_NAME = [...REGTANK_ISO3166_COUNTRIES].sort((a, b) =>
  a.name.localeCompare(b.name)
);

/** Fewer rows on first open than a full Select; typing narrows quickly. */
const INITIAL_VISIBLE = 48;
const MAX_FILTERED = 120;

function useFilteredCountries(search: string) {
  return React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      const rows = REGTANK_BY_NAME.slice(0, INITIAL_VISIBLE);
      return {
        rows,
        hint: `Type to search — ${REGTANK_BY_NAME.length} countries available`,
      } as const;
    }
    const rows = REGTANK_BY_NAME.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    ).slice(0, MAX_FILTERED);
    return {
      rows,
      hint:
        rows.length >= MAX_FILTERED
          ? "Showing first matches — keep typing to narrow"
          : rows.length === 0
            ? "No matches"
            : null,
    } as const;
  }, [search]);
}

export const GuarantorNationalityAutocomplete = React.memo(
  function GuarantorNationalityAutocomplete({
    id,
    nationality,
    readOnly,
    hasAttemptedSave,
    onNationalityChange,
    labelClassName,
  }: {
    id: string;
    nationality: string;
    readOnly: boolean;
    hasAttemptedSave: boolean;
    onNationalityChange: (code: string) => void;
    labelClassName: string;
  }) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const [activeIndex, setActiveIndex] = React.useState(0);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);

    const { rows, hint } = useFilteredCountries(search);

    React.useEffect(() => {
      if (!open) return;
      setSearch("");
      setActiveIndex(0);
      const raf = requestAnimationFrame(() => searchInputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }, [open]);

    React.useEffect(() => {
      setActiveIndex((i) => (rows.length === 0 ? 0 : Math.min(i, rows.length - 1)));
    }, [rows.length, search]);

    const display =
      nationality.trim() && isRegtankIso3166Code(nationality.trim())
        ? regtankNationalityDisplayLabel(nationality.trim())
        : null;

    const pick = (code: string) => {
      onNationalityChange(code);
      setOpen(false);
    };

    const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && rows.length > 0) {
        e.preventDefault();
        const c = rows[activeIndex];
        if (c) pick(c.code);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };

    React.useEffect(() => {
      if (!open || rows.length === 0) return;
      const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, open, rows.length]);

    const listId = `${id}-listbox`;
    const searchId = `${id}-search`;

    return (
      <div className="space-y-2 w-full min-w-0">
        <Label htmlFor={id} className={labelClassName}>
          Nationality
        </Label>
        <PopoverPrimitive.Root open={open} onOpenChange={(v) => !readOnly && setOpen(v)}>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              id={id}
              disabled={readOnly}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              className={cn(
                "flex h-11 w-full items-center justify-between gap-2 whitespace-nowrap px-4 py-2 text-sm shadow-sm ring-offset-background [&>span]:line-clamp-1",
                formSelectTriggerClassName,
                readOnly && formInputDisabledClassName
              )}
            >
              <span className={cn(!display && "text-muted-foreground")}>
                {display ?? "Search country…"}
              </span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              collisionPadding={12}
              className={cn(
                "z-50 w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,20rem)] max-w-[min(100vw-2rem,28rem)] rounded-xl border bg-popover p-2 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
              )}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <Input
                ref={searchInputRef}
                id={searchId}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Type country name or code…"
                className="mb-2 h-9 rounded-lg"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls={listId}
                aria-activedescendant={
                  rows[activeIndex] ? `${id}-opt-${rows[activeIndex].code}` : undefined
                }
                onPointerDown={(e) => e.stopPropagation()}
              />
              {hint ? (
                <p className="mb-2 px-1 text-xs text-muted-foreground">{hint}</p>
              ) : null}
              <div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label="Countries"
                className="max-h-[min(20rem,55vh)] overflow-y-auto overscroll-contain rounded-lg border border-border/60"
              >
                {rows.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No matches
                  </p>
                ) : (
                  rows.map((c, i) => {
                    const selected = c.code === nationality;
                    const active = i === activeIndex;
                    return (
                      <button
                        key={c.code}
                        id={`${id}-opt-${c.code}`}
                        type="button"
                        role="option"
                        data-index={i}
                        aria-selected={selected}
                        className={cn(
                          "relative flex w-full items-center rounded-lg py-2 pl-2 pr-8 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                          active && "bg-accent/70",
                          selected && "bg-accent/40"
                        )}
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => pick(c.code)}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {c.name} ({c.code})
                        </span>
                        {selected ? (
                          <CheckIcon
                            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
        {hasAttemptedSave &&
        (!nationality.trim() || !isRegtankIso3166Code(nationality.trim())) ? (
          <p className="text-xs text-destructive">Select a nationality</p>
        ) : null}
      </div>
    );
  }
);
