"use client";

import type { ApplicationStepKey } from "../workflow-registry";
import { STEP_CONFIG_MAP } from "../workflow-registry";

/** Renders the config UI for a step. stepKey picks which form; extraProps passed through (e.g. onPendingImageChange). */
export interface StepConfigEditorProps {
  stepKey: ApplicationStepKey;
  config: unknown;
  onChange: (config: unknown) => void;
  extraProps?: Record<string, unknown>;
}

export function StepConfigEditor({ stepKey, config, onChange, extraProps }: StepConfigEditorProps) {
  const Component = STEP_CONFIG_MAP[stepKey];
  if (!Component) return null;
  return <Component config={config} onChange={onChange} {...extraProps} />;
}
