"use client";

import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Switch } from "../../../../../components/ui/switch";

export interface BaseStepConfigProps {
  config: unknown;
  onChange: (config: unknown) => void;
  stepTitle: string;
}

export function getBaseConfig(config: unknown): { label?: string; required?: boolean } {
  const c = config as Record<string, unknown> | undefined;
  return { label: (c?.label as string) ?? "", required: (c?.required as boolean) ?? false };
}

/** Shared config UI: label + required. Each step type can extend or replace. */
export function BaseStepConfig({ config, onChange, stepTitle }: BaseStepConfigProps) {
  const { label, required } = getBaseConfig(config);
  const update = (updates: Partial<{ label: string; required: boolean }>) => {
    onChange({ ...getBaseConfig(config), ...updates });
  };
  return (
    <div className="grid gap-3 pt-2 min-w-0">
      <div className="grid gap-2">
        <Label>Label</Label>
        <Input
          value={label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder={stepTitle}
          className="min-w-0"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={required} onCheckedChange={(checked) => update({ required: !!checked })} />
        <Label className="text-sm font-normal">Required</Label>
      </div>
    </div>
  );
}
