"use client";

import * as React from "react";
import type { ApplicationStepKey } from "@cashsouk/types";
import { FinancingTypeConfig } from "./financing-type-config";
import { FinancingStructureConfig } from "./financing-structure-config";
import { ContractDetailsConfig } from "./contract-details-config";
import { InvoiceDetailsConfig } from "./invoice-details-config";
import { CompanyDetailsConfig } from "./company-details-config";
import { BusinessDetailsConfig } from "./business-details-config";
import { SupportingDocumentsConfig } from "./supporting-documents-config";
import { DeclarationsConfig } from "./declarations-config";
import { ReviewAndSubmitConfig } from "./review-and-submit-config";

export interface StepConfigEditorProps {
  stepKey: ApplicationStepKey;
  config: unknown;
  onChange: (config: unknown) => void;
  /** Extra props for the step config component (e.g. onPendingImageChange for financing_type). */
  extraProps?: Record<string, unknown>;
}

const STEP_CONFIG_MAP: Record<ApplicationStepKey, React.ComponentType<{ config: unknown; onChange: (config: unknown) => void }>> = {
  financing_type: FinancingTypeConfig,
  financing_structure: FinancingStructureConfig,
  contract_details: ContractDetailsConfig,
  invoice_details: InvoiceDetailsConfig,
  company_details: CompanyDetailsConfig,
  business_details: BusinessDetailsConfig,
  supporting_documents: SupportingDocumentsConfig,
  declarations: DeclarationsConfig,
  review_and_submit: ReviewAndSubmitConfig,
};

/** Renders the correct config UI for a step key. */
export function StepConfigEditor({ stepKey, config, onChange, extraProps }: StepConfigEditorProps) {
  const Component = STEP_CONFIG_MAP[stepKey];
  if (!Component) return null;
  return <Component config={config} onChange={onChange} {...extraProps} />;
}
