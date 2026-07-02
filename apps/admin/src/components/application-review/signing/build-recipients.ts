/**
 * Pure helpers for the admin signing panel: read the product's signing template out of
 * the workflow JSON, and pre-fill recipient bindings from the application's directors
 * (people) and guarantors so the admin only has to review/adjust before sending.
 */
import {
  SIGNING_TEMPLATE_WORKFLOW_KEY,
  parseSigningTemplateConfig,
  type RecipientBinding,
  type SigningTemplateConfig,
  type SigningTemplateRole,
} from "@cashsouk/types";
import type { ApplicationPersonRow } from "@cashsouk/types";

/** Find and parse the signing template stored inside Product.workflow steps. */
export function readSigningTemplate(workflow: unknown): SigningTemplateConfig {
  const steps = Array.isArray(workflow) ? workflow : [];
  for (const step of steps) {
    const config = (step as { config?: Record<string, unknown> } | null)?.config;
    if (config && config[SIGNING_TEMPLATE_WORKFLOW_KEY] != null) {
      return parseSigningTemplateConfig(config[SIGNING_TEMPLATE_WORKFLOW_KEY]);
    }
  }
  return parseSigningTemplateConfig(null);
}

function directorsFrom(people: ApplicationPersonRow[]): { name: string; email: string }[] {
  return people
    .filter((p) => p.roles.some((r) => r.toUpperCase() === "DIRECTOR"))
    .map((p) => ({ name: p.name ?? "", email: p.email ?? "" }));
}

interface RawGuarantor {
  id?: string;
  name?: string;
  business_name?: string;
  email?: string;
  ic_number?: string;
}

function guarantorsFrom(
  guarantors: unknown
): { name: string; email: string; ic_number?: string; application_guarantor_id?: string }[] {
  const list = Array.isArray(guarantors) ? (guarantors as RawGuarantor[]) : [];
  return list.map((g) => ({
    name: g.name || g.business_name || "",
    email: g.email || "",
    ic_number: g.ic_number,
    application_guarantor_id: g.id,
  }));
}

function blankBinding(role: SigningTemplateRole): RecipientBinding {
  return { role_key: role.key, name: "", email: "" };
}

/**
 * Build an initial, editable set of recipient bindings for a template. Directors and
 * guarantors are matched to roles by `source_hint`; every other role gets a blank row
 * per its `min_count` so the admin can fill it in.
 */
export function buildInitialBindings(
  template: SigningTemplateConfig,
  people: ApplicationPersonRow[],
  guarantors: unknown
): RecipientBinding[] {
  const directors = directorsFrom(people);
  const guarantorRows = guarantorsFrom(guarantors);
  const bindings: RecipientBinding[] = [];

  for (const role of template.roles) {
    let prefilled: RecipientBinding[] = [];
    if (role.source_hint === "issuer_director") {
      prefilled = directors.map((d) => ({ role_key: role.key, name: d.name, email: d.email }));
    } else if (role.source_hint === "guarantor") {
      prefilled = guarantorRows.map((g) => ({
        role_key: role.key,
        name: g.name,
        email: g.email,
        ic_number: g.ic_number ?? null,
        application_guarantor_id: g.application_guarantor_id ?? null,
      }));
    }

    // Respect max_count and ensure at least min_count editable rows.
    if (role.max_count != null) prefilled = prefilled.slice(0, role.max_count);
    while (prefilled.length < role.min_count) prefilled.push(blankBinding(role));
    if (prefilled.length === 0) prefilled.push(blankBinding(role));

    bindings.push(...prefilled);
  }

  return bindings;
}
