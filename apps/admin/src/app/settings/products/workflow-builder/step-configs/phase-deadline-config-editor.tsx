"use client";

import * as React from "react";
import type { PhaseDeadlineConfig } from "@cashsouk/types";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { INPUT_CLASS } from "../product-form-input-styles";

export function PhaseDeadlineConfigEditor({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: PhaseDeadlineConfig;
  onChange: (next: PhaseDeadlineConfig) => void;
}) {
  const updateDays = (raw: string) => {
    const days = Math.max(1, Number.parseInt(raw, 10) || 1);
    const reminders = (value.reminders ?? []).filter((r) => r.days_before_expiry < days);
    onChange({ days, reminders });
  };

  const updateReminder = (index: number, raw: string) => {
    const daysBefore = Math.max(0, Number.parseInt(raw, 10) || 0);
    const reminders = [...(value.reminders ?? [])];
    reminders[index] = { days_before_expiry: daysBefore };
    onChange({ ...value, reminders });
  };

  const addReminder = () => {
    const used = new Set((value.reminders ?? []).map((r) => r.days_before_expiry));
    let candidate = 1;
    while (candidate < value.days && used.has(candidate)) candidate += 1;
    if (candidate >= value.days) candidate = 0;
    if (used.has(candidate)) return;
    onChange({
      ...value,
      reminders: [...(value.reminders ?? []), { days_before_expiry: candidate }],
    });
  };

  const removeReminder = (index: number) => {
    onChange({
      ...value,
      reminders: (value.reminders ?? []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">
          Days are Malaysia calendar days. The deadline is the end of the last valid day (11:59 PM).
          Reminders fire on the configured platform delivery hour.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Days until expiry</Label>
        <Input
          type="number"
          min={1}
          className={INPUT_CLASS}
          value={value.days}
          onChange={(e) => updateDays(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">Reminders (days before expiry)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addReminder}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add reminder
          </Button>
        </div>
        {(value.reminders ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No reminders configured.</p>
        ) : (
          <ul className="space-y-2">
            {(value.reminders ?? []).map((reminder, index) => (
              <li key={`${reminder.days_before_expiry}-${index}`} className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={Math.max(0, value.days - 1)}
                  className={INPUT_CLASS}
                  value={reminder.days_before_expiry}
                  onChange={(e) => updateReminder(index, e.target.value)}
                />
                <span className="shrink-0 text-sm text-muted-foreground">days before</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeReminder(index)}
                  aria-label="Remove reminder"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
