"use client";

import { BaseStepConfig } from "./base-step-config";

export function SupportingDocumentsConfig({ config, onChange }: { config: unknown; onChange: (config: unknown) => void }) {
  return <BaseStepConfig config={config} onChange={onChange} stepTitle="Supporting Documents" />;
}
