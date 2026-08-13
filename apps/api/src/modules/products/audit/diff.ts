export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a as Record<string, unknown>).sort();
  const keysB = Object.keys(b as Record<string, unknown>).sort();
  if (keysA.length !== keysB.length || keysA.some((k, i) => k !== keysB[i])) return false;
  return keysA.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

function compactAuditValue(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(compactAuditValue);

  const obj = value as Record<string, unknown>;
  if (typeof obj.s3_key === "string") {
    const compact: Record<string, unknown> = { s3_key: obj.s3_key };
    if (typeof obj.fileName === "string") compact.fileName = obj.fileName;
    else if (typeof obj.file_name === "string") compact.fileName = obj.file_name;
    return compact;
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(obj)) {
    out[key] = compactAuditValue(nested);
  }
  return out;
}

type WorkflowStep = {
  id?: string;
  name?: string;
  config?: unknown;
};

function asSteps(workflow: unknown): WorkflowStep[] {
  if (!Array.isArray(workflow)) return [];
  return workflow as WorkflowStep[];
}

function stepId(step: WorkflowStep, index: number): string {
  return typeof step.id === "string" && step.id.length > 0 ? step.id : `index:${index}`;
}

function stepName(step: WorkflowStep): string {
  return typeof step.name === "string" ? step.name : "";
}

function stepConfig(step: WorkflowStep): Record<string, unknown> {
  return step.config && typeof step.config === "object" && !Array.isArray(step.config)
    ? (step.config as Record<string, unknown>)
    : {};
}

export type WorkflowStepDiff = {
  stepOrder?: { before: string[]; after: string[] };
  added?: { id: string; name: string }[];
  removed?: { id: string; name: string }[];
  changed?: Array<{
    id: string;
    name: string;
    changedConfigKeys: string[];
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }>;
};

export function diffWorkflow(beforeWorkflow: unknown, afterWorkflow: unknown): WorkflowStepDiff | null {
  if (deepEqual(beforeWorkflow, afterWorkflow)) return null;

  const beforeSteps = asSteps(beforeWorkflow);
  const afterSteps = asSteps(afterWorkflow);
  const beforeIds = beforeSteps.map(stepId);
  const afterIds = afterSteps.map(stepId);

  const beforeById = new Map(beforeSteps.map((step, i) => [stepId(step, i), { step, index: i }]));
  const afterById = new Map(afterSteps.map((step, i) => [stepId(step, i), { step, index: i }]));

  const added: { id: string; name: string }[] = [];
  const removed: { id: string; name: string }[] = [];
  const changed: NonNullable<WorkflowStepDiff["changed"]> = [];

  for (const [id, { step, index }] of afterById) {
    if (!beforeById.has(id)) {
      added.push({ id, name: stepName(step) || `index:${index}` });
    }
  }
  for (const [id, { step, index }] of beforeById) {
    if (!afterById.has(id)) {
      removed.push({ id, name: stepName(step) || `index:${index}` });
    }
  }

  for (const [id, afterEntry] of afterById) {
    const beforeEntry = beforeById.get(id);
    if (!beforeEntry) continue;

    const beforeCfg = stepConfig(beforeEntry.step);
    const afterCfg = stepConfig(afterEntry.step);
    const beforeNm = stepName(beforeEntry.step);
    const afterNm = stepName(afterEntry.step);
    const keys = new Set([...Object.keys(beforeCfg), ...Object.keys(afterCfg)]);
    const changedConfigKeys: string[] = [];
    const beforePick: Record<string, unknown> = {};
    const afterPick: Record<string, unknown> = {};

    if (beforeNm !== afterNm) {
      changedConfigKeys.push("name");
      beforePick.name = beforeNm;
      afterPick.name = afterNm;
    }

    for (const key of keys) {
      if (deepEqual(beforeCfg[key], afterCfg[key])) continue;
      changedConfigKeys.push(key);
      beforePick[key] = compactAuditValue(beforeCfg[key]);
      afterPick[key] = compactAuditValue(afterCfg[key]);
    }

    if (changedConfigKeys.length > 0) {
      changed.push({
        id,
        name: afterNm || beforeNm,
        changedConfigKeys,
        before: beforePick,
        after: afterPick,
      });
    }
  }

  const diff: WorkflowStepDiff = {};
  if (!deepEqual(beforeIds, afterIds)) {
    diff.stepOrder = { before: beforeIds, after: afterIds };
  }
  if (added.length > 0) diff.added = added;
  if (removed.length > 0) diff.removed = removed;
  if (changed.length > 0) diff.changed = changed;

  return Object.keys(diff).length > 0 ? diff : { stepOrder: { before: beforeIds, after: afterIds } };
}

export type ProductScalarSnapshot = {
  productCode: string | null;
  marketplaceListingDurationDays: number | null;
  serviceFeeRatePercent: number | null;
  defaultFacilityFeeRatePercent: number | null;
  categoryDisplayOrder: number | null;
  productDisplayOrder: number | null;
};

export function diffProductScalars(
  before: ProductScalarSnapshot,
  after: ProductScalarSnapshot
): { changedFields: string[]; before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedFields: string[] = [];
  const beforeOut: Record<string, unknown> = {};
  const afterOut: Record<string, unknown> = {};

  (Object.keys(before) as Array<keyof ProductScalarSnapshot>).forEach((key) => {
    if (deepEqual(before[key], after[key])) return;
    changedFields.push(key);
    beforeOut[key] = before[key];
    afterOut[key] = after[key];
  });

  return { changedFields, before: beforeOut, after: afterOut };
}

export function splitWorkflowDiff(diff: WorkflowStepDiff): {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  if (diff.stepOrder) {
    before.stepOrder = diff.stepOrder.before;
    after.stepOrder = diff.stepOrder.after;
  }
  if (diff.removed && diff.removed.length > 0) before.removed = diff.removed;
  if (diff.added && diff.added.length > 0) after.added = diff.added;
  if (diff.changed && diff.changed.length > 0) {
    before.changed = diff.changed.map((step) => ({
      id: step.id,
      name: step.name,
      changedConfigKeys: step.changedConfigKeys,
      values: step.before,
    }));
    after.changed = diff.changed.map((step) => ({
      id: step.id,
      name: step.name,
      changedConfigKeys: step.changedConfigKeys,
      values: step.after,
    }));
  }

  return { before, after };
}

export function mergeUpdatedDiff(
  scalar: { changedFields: string[]; before: Record<string, unknown>; after: Record<string, unknown> },
  workflowDiff: WorkflowStepDiff | null
): { changedFields: string[]; before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedFields = [...scalar.changedFields];
  const before = { ...scalar.before };
  const after = { ...scalar.after };

  if (workflowDiff) {
    const split = splitWorkflowDiff(workflowDiff);
    changedFields.push("workflow");
    before.workflow = split.before;
    after.workflow = split.after;
  }

  if (changedFields.length === 0) return null;
  return { changedFields, before, after };
}
