"use client";

import * as React from "react";
import { DeclarationRichTextEditor } from "@cashsouk/ui/declaration-rich-text";
import { cn } from "@/lib/utils";
import { Button } from "../../../../../components/ui/button";
import { FIELD_GAP, SECTION_GAP } from "../product-form-input-styles";
import { ChevronUpIcon, ChevronDownIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

const CONFIG_KEY = "declarations";

/** Each declaration is an object so we can add fields later (e.g. required, id). */
export interface DeclarationItemShape {
  text: string;
}

function getDeclarations(config: unknown): DeclarationItemShape[] {
  const c = config as Record<string, unknown> | undefined;
  const raw = c?.[CONFIG_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { text: item };
    if (item != null && typeof item === "object" && "text" in item)
      return { text: String((item as { text: unknown }).text ?? "") };
    return { text: "" };
  });
}

export function DeclarationsConfig({ config, onChange }: { config: unknown; onChange: (config: unknown) => void }) {
  const base = (config as Record<string, unknown>) ?? {};
  const [declarations, setDeclarations] = React.useState<DeclarationItemShape[]>(() => getDeclarations(config));

  React.useEffect(() => {
    setDeclarations(getDeclarations(config));
  }, [config]);

  const persist = React.useCallback(
    (next: DeclarationItemShape[]) => {
      onChange({ ...base, [CONFIG_KEY]: next.map((d) => ({ text: d.text })) });
    },
    [base, onChange]
  );

  const updateAt = (index: number, value: string) => {
    const next = [...declarations];
    next[index] = { ...next[index], text: value };
    setDeclarations(next);
    persist(next);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...declarations];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setDeclarations(next);
    persist(next);
  };

  const moveDown = (index: number) => {
    if (index >= declarations.length - 1) return;
    const next = [...declarations];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setDeclarations(next);
    persist(next);
  };

  const remove = (index: number) => {
    const next = declarations.filter((_, i) => i !== index);
    setDeclarations(next);
    persist(next);
  };

  const add = () => {
    const next = [...declarations, { text: "" }];
    setDeclarations(next);
    persist(next);
  };

  return (
    <div className={cn("grid pt-2 min-w-0 text-sm leading-6", SECTION_GAP)}>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <PlusIcon className="h-4 w-4 shrink-0" />
          Add declaration
        </Button>
      </div>
      {declarations.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-6">No declarations yet. Add one to get started.</p>
      ) : (
        <ul className={cn("grid", SECTION_GAP)}>
          {declarations.map((item, index) => (
            <li key={index} className={cn("flex py-2.5 px-0 min-w-0", FIELD_GAP, "sm:gap-3")}>
              <span className="flex h-8 w-6 shrink-0 items-center justify-center text-sm font-medium text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <div className={cn("flex min-w-0 flex-1 flex-col", FIELD_GAP)}>
                <DeclarationRichTextEditor
                  id={`declaration-${index}`}
                  value={item.text}
                  onChange={(html) => updateAt(index, html)}
                  placeholder="e.g. I confirm that the information provided is accurate."
                  className="min-w-0"
                />
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <ChevronUpIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => moveDown(index)}
                    disabled={index === declarations.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                    aria-label="Remove declaration"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
