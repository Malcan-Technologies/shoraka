"use client";

import * as React from "react";
import { Textarea } from "../../../../../components/ui/textarea";
import { Button } from "../../../../../components/ui/button";
import { ChevronUpIcon, ChevronDownIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

const CONFIG_KEY = "declarations";

function getDeclarations(config: unknown): string[] {
  const c = config as Record<string, unknown> | undefined;
  const raw = c?.[CONFIG_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

export function DeclarationsConfig({ config, onChange }: { config: unknown; onChange: (config: unknown) => void }) {
  const base = (config as Record<string, unknown>) ?? {};
  const [declarations, setDeclarations] = React.useState<string[]>(() => getDeclarations(config));

  React.useEffect(() => {
    setDeclarations(getDeclarations(config));
  }, [config]);

  const persist = React.useCallback(
    (next: string[]) => {
      onChange({ ...base, [CONFIG_KEY]: next });
    },
    [base, onChange]
  );

  const updateAt = (index: number, value: string) => {
    const next = [...declarations];
    next[index] = value;
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
    const next = [...declarations, ""];
    setDeclarations(next);
    persist(next);
  };

  return (
    <div className="grid gap-3 pt-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <PlusIcon className="h-4 w-4 shrink-0" />
          Add declaration
        </Button>
      </div>
      {declarations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No declarations yet. Add one to get started.</p>
      ) : (
        <ul className="grid gap-3">
          {declarations.map((text, index) => (
            <li key={index} className="flex gap-3 py-2.5 px-0">
              <span className="flex h-8 w-6 shrink-0 items-center justify-center text-xs font-medium text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Textarea
                  id={`declaration-${index}`}
                  value={text}
                  onChange={(e) => updateAt(index, e.target.value)}
                  placeholder="e.g. I confirm that the information provided is accurate."
                  className="text-sm min-h-[80px] resize-y"
                />
                <div className="flex shrink-0 items-center justify-end gap-0.5">
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
