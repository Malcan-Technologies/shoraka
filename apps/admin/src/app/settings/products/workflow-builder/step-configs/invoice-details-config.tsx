"use client";

import { BaseStepConfig } from "./base-step-config";

export function InvoiceDetailsConfig({ config, onChange }: { config: unknown; onChange: (config: unknown) => void }) {
  return <BaseStepConfig config={config} onChange={onChange} stepTitle="Invoice Details" />;
}
