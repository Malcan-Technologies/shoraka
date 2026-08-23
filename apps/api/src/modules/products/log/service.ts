/**
 * S3 key helpers used by the product controller to delete files on update.
 * Product audit persistence lives in ./audit (ProductAuditLog).
 */

const PRODUCT_S3_PREFIX = "products/";
const SUPPORTING_CATEGORIES = ["financial_docs", "legal_docs", "compliance_docs", "others"];

export function getProductS3KeysFromWorkflow(workflow: unknown): string[] {
  const keys = new Set<string>();
  function walk(obj: unknown) {
    if (obj == null) return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        if (k === "s3_key" && typeof v === "string") {
          const path = v.trim();
          if (path.startsWith(PRODUCT_S3_PREFIX)) keys.add(path);
        } else {
          walk(v);
        }
      }
    }
  }
  walk(workflow);
  return [...keys];
}

function stepId(step: unknown): string {
  const s = step as { id?: string };
  return s?.id ?? "";
}

function stepConfig(step: unknown): Record<string, unknown> {
  const s = step as { config?: unknown };
  const c = s?.config;
  return (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
}

export function getReplacedProductS3Keys(oldWorkflow: unknown[], newWorkflow: unknown[]): string[] {
  const keys = new Set<string>();
  const oldSteps = Array.isArray(oldWorkflow) ? oldWorkflow : [];
  const newSteps = Array.isArray(newWorkflow) ? newWorkflow : [];

  const oldFinancing = oldSteps.find((s) => stepId(s).startsWith("financing_type"));
  const newFinancing = newSteps.find((s) => stepId(s).startsWith("financing_type"));
  const oldC = oldFinancing ? stepConfig(oldFinancing) : {};
  const newC = newFinancing ? stepConfig(newFinancing) : {};
  const oldImg = oldC.image as { s3_key?: string } | undefined;
  const newImg = newC.image as { s3_key?: string } | undefined;
  const oldKey = (oldImg?.s3_key ?? (oldC.s3_key as string))?.trim();
  const newKey = (newImg?.s3_key ?? (newC.s3_key as string))?.trim() ?? "";
  if (oldKey && oldKey !== newKey && oldKey.startsWith(PRODUCT_S3_PREFIX)) {
    keys.add(oldKey);
  }

  const oldSupport = oldSteps.find((s) => stepId(s).startsWith("supporting_documents"));
  const newSupport = newSteps.find((s) => stepId(s).startsWith("supporting_documents"));
  const oldSupportC = oldSupport ? stepConfig(oldSupport) : {};
  const newSupportC = newSupport ? stepConfig(newSupport) : {};
  for (const cat of SUPPORTING_CATEGORIES) {
    const oldList = (oldSupportC[cat] as Array<{ template?: { s3_key?: string } }>) ?? [];
    const newList = (newSupportC[cat] as Array<{ template?: { s3_key?: string } }>) ?? [];
    const n = Math.max(oldList.length, newList.length);
    for (let i = 0; i < n; i++) {
      const oldItem = oldList[i];
      const newItem = newList[i];
      const oldT = oldItem?.template?.s3_key?.trim();
      const newT = newItem?.template?.s3_key?.trim() ?? "";
      if (oldT && oldT !== newT && oldT.startsWith(PRODUCT_S3_PREFIX)) {
        keys.add(oldT);
      }
    }
  }
  return [...keys];
}
