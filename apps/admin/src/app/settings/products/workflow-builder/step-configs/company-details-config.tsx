"use client";

import { BaseStepConfig } from "./base-step-config";

export function CompanyDetailsConfig({ config, onChange }: { config: unknown; onChange: (config: unknown) => void }) {
  return <BaseStepConfig config={config} onChange={onChange} stepTitle="Company Details" />;
}
