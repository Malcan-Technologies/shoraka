import type { Product } from "@cashsouk/types";
import { APPLICATION_STEP_KEYS, STEP_KEY_DISPLAY } from "@cashsouk/types";

/** Single workflow step: id matches API stepId (e.g. financing_type_1), name is display label. */
export interface WorkflowStepShape {
  id: string;
  name: string;
  config?: unknown;
}

/** Default workflow: all 9 steps in APPLICATION_STEP_KEYS order, id = `${key}_1`, name from STEP_KEY_DISPLAY. */
export function getDefaultWorkflowSteps(): WorkflowStepShape[] {
  return APPLICATION_STEP_KEYS.map((key) => ({
    id: `${key}_1`,
    name: STEP_KEY_DISPLAY[key].title,
  }));
}

/** Normalize product workflow to steps with id and name; use default if empty. */
export function normalizeWorkflowSteps(raw: unknown[] | null | undefined): WorkflowStepShape[] {
  if (!raw?.length) return getDefaultWorkflowSteps();
  const steps = raw.map((step) => {
    const s = step as { id?: string; name?: string; config?: unknown };
    const name = s?.name?.trim() ?? stepDisplayName(step);
    return {
      id: s?.id ?? "",
      name: name !== "—" ? name : "Step",
      config: s?.config,
    };
  }).filter((s) => s.id);
  return steps.length ? steps : getDefaultWorkflowSteps();
}

/** Get display name from first workflow step: config.name or config.type.name. Never shows id. */
export function productName(p: Product): string {
  const first = p.workflow?.[0] as {
    config?: { name?: string; type?: { name?: string } };
  } | undefined;
  const name =
    first?.config?.name?.trim() ?? first?.config?.type?.name?.trim();
  return name ?? "—";
}

/** Set product name in first workflow step (config.name and config.type.name). Creates config if missing. */
export function workflowWithName(workflow: unknown[], name: string): unknown[] {
  const next = JSON.parse(JSON.stringify(workflow)) as unknown[];
  const first = next[0] as { config?: { name?: string; type?: { name?: string } } } | undefined;
  if (!first) return next;
  if (!first.config) first.config = {};
  const config = first.config as { name?: string; type?: { name?: string } };
  config.name = name;
  if (config.type && typeof config.type === "object") {
    config.type = { ...config.type, name };
  } else {
    config.type = { name };
  }
  return next;
}

/** Get step display name from workflow step (config.name, config.type.name, or step.name). */
export function stepDisplayName(step: unknown): string {
  const s = step as { config?: { name?: string; type?: { name?: string } }; name?: string } | undefined;
  const fromConfig = s?.config?.name?.trim() ?? s?.config?.type?.name?.trim();
  return fromConfig ?? s?.name?.trim() ?? "—";
}
