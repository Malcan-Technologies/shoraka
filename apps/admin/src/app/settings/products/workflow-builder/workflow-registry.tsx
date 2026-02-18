"use client";

/**
 * Single place for workflow-builder step wiring.
 *
 * --- HOW TO ADD A NEW STEP ---
 * 1. packages/types: Add key to APPLICATION_STEP_KEYS and entry to STEP_KEY_DISPLAY.
 * 2. Here: Either add that key to STEPS_WITHOUT_CONFIG (no card config UI), or add a config
 *    component below and register it in STEP_CONFIG_MAP.
 * 3. product-form-helpers.ts: If the step has required fields, add a case in getRequiredStepErrors().
 * 4. product-form-helpers.ts: If the step needs a default in the payload (e.g. invoice_details),
 *    add a case in buildPayloadFromSteps().
 *
 * --- WHERE OUTPUT GOES TO DB ---
 * Payload is built in product-form-helpers.ts buildPayloadFromSteps().
 * The dialog calls that and sends the result to the API (createProduct / updateProduct).
 * API: apps/api products-controller → repository → DB (workflow column as JSON).
 */

import * as React from "react";
import type { ApplicationStepKey } from "@cashsouk/types";
import { APPLICATION_STEP_KEYS, STEP_KEY_DISPLAY, getStepKeyFromStepId } from "@cashsouk/types";
import { FinancingTypeConfig } from "./step-configs/financing-type-config";
import { FinancingStructureConfig } from "./step-configs/financing-structure-config";
import { ContractDetailsConfig } from "./step-configs/contract-details-config";
import { CompanyDetailsConfig } from "./step-configs/company-details-config";
import { BusinessDetailsConfig } from "./step-configs/business-details-config";
import { SupportingDocumentsConfig } from "./step-configs/supporting-documents-config";
import { DeclarationsConfig } from "./step-configs/declarations-config";
import { ReviewAndSubmitConfig } from "./step-configs/review-and-submit-config";
import { InvoiceDetailsConfig } from "./step-configs/invoice-details-config";

export { APPLICATION_STEP_KEYS, STEP_KEY_DISPLAY, getStepKeyFromStepId };
export type { ApplicationStepKey };

/** Steps that don't show a config panel in the card (no expand / no form). */
export const STEPS_WITHOUT_CONFIG = new Set<ApplicationStepKey>([
  "financing_structure",
  "contract_details",
  "company_details",
  "business_details",
  "review_and_submit",
]);

type ConfigComponentProps = { config: unknown; onChange: (config: unknown) => void };

/** Step key → component that renders that step's config form. */
export const STEP_CONFIG_MAP: Partial<Record<ApplicationStepKey, React.ComponentType<ConfigComponentProps>>> = {
  financing_type: FinancingTypeConfig,
  financing_structure: FinancingStructureConfig,
  contract_details: ContractDetailsConfig,
  company_details: CompanyDetailsConfig,
  business_details: BusinessDetailsConfig,
  supporting_documents: SupportingDocumentsConfig,
  declarations: DeclarationsConfig,
  review_and_submit: ReviewAndSubmitConfig,
  invoice_details: InvoiceDetailsConfig,
};
