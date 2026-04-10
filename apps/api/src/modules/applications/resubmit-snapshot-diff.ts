/**
 * SECTION: Resubmit snapshot diff
 * WHY: Admin timeline shows what the issuer changed between submissions (paths + before/after values).
 * INPUT: Two revision snapshots (previous vs next).
 * OUTPUT: Section list, per-field paths, serialized previous_value / next_value for UI.
 * WHERE USED: amendments resubmit flow → APPLICATION_RESUBMITTED metadata; admin activity timeline.
 */

const MAX_FIELD_PATHS = 80;
const MAX_SERIALIZED_VALUE_CHARS = 5000;

const APPLICATION_JSON_KEYS = [
  "financing_type",
  "financing_structure",
  "company_details",
  "business_details",
  "financial_statements",
  "supporting_documents",
  "declarations",
  "review_and_submit",
  "last_completed_step",
  "contract_id",
] as const;

const SECTION_LABELS: Record<(typeof APPLICATION_JSON_KEYS)[number], string> = {
  financing_type: "Financing type",
  financing_structure: "Financing structure",
  company_details: "Company details",
  business_details: "Business details",
  financial_statements: "Financial statements",
  supporting_documents: "Supporting documents",
  declarations: "Declarations",
  review_and_submit: "Review and submit",
  last_completed_step: "Application progress",
  contract_id: "Linked contract",
};

/** Prisma-managed timestamps — differ on every touch; not user "contract page" edits. */
const VOLATILE_SNAPSHOT_KEYS = new Set(["created_at", "updated_at"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Normalize for stable JSON compare (sorted keys; Date → ISO string). */
function normalizeForCompare(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(normalizeForCompare);
  const obj = v as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = normalizeForCompare(obj[k]);
  }
  return sorted;
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  return (
    JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b))
  );
}

function getSnapshotApplication(snapshot: unknown): Record<string, unknown> | null {
  if (!isPlainObject(snapshot)) return null;
  const app = snapshot.application;
  if (!isPlainObject(app)) return null;
  return app;
}

/** Drop volatile keys recursively on contract/invoice plain objects (shallow recurse). */
function stripVolatileTimestamps(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stripVolatileTimestamps);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value)) {
    if (VOLATILE_SNAPSHOT_KEYS.has(k)) continue;
    out[k] = stripVolatileTimestamps(value[k]);
  }
  return out;
}

type FieldChangeLeaf = { path: string; prev: unknown; next: unknown };

function collectFieldChangeLeaves(
  prev: unknown,
  next: unknown,
  basePath: string,
  out: FieldChangeLeaf[],
  maxPaths: number
): void {
  if (out.length >= maxPaths) return;
  if (deepEqualJson(prev, next)) return;

  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) {
      out.push({ path: `${basePath}.length`, prev: prev.length, next: next.length });
      return;
    }
    for (let i = 0; i < prev.length; i++) {
      if (out.length >= maxPaths) return;
      collectFieldChangeLeaves(prev[i], next[i], `${basePath}[${i}]`, out, maxPaths);
    }
    return;
  }

  if (
    isPlainObject(prev) &&
    isPlainObject(next) &&
    !Array.isArray(prev) &&
    !Array.isArray(next)
  ) {
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const k of Array.from(keys).sort()) {
      if (out.length >= maxPaths) return;
      const p = basePath ? `${basePath}.${k}` : k;
      collectFieldChangeLeaves(prev[k], next[k], p, out, maxPaths);
    }
    return;
  }

  out.push({ path: basePath, prev, next });
}

function serializeSnapshotValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    const normalized = normalizeForCompare(value);
    if (typeof normalized === "object" && normalized !== null) {
      const pretty = JSON.stringify(normalized, null, 2);
      if (pretty.length <= MAX_SERIALIZED_VALUE_CHARS) return pretty;
      const compact = JSON.stringify(normalized);
      return compact.length <= MAX_SERIALIZED_VALUE_CHARS
        ? compact
        : `${compact.slice(0, MAX_SERIALIZED_VALUE_CHARS - 3)}...`;
    }
    const s = JSON.stringify(normalized);
    return s.length > MAX_SERIALIZED_VALUE_CHARS
      ? `${s.slice(0, MAX_SERIALIZED_VALUE_CHARS - 3)}...`
      : s;
  } catch {
    return String(value);
  }
}

/** Last path segment as a short label (e.g. authorized_rep_ic → "Authorized Rep IC"). */
function fieldLabelFromPath(path: string): string {
  const segments = path.split(/\.|\[|\]/).filter((s) => s.length > 0);
  const nonIndex = segments.filter((s) => !/^\d+$/.test(s));
  const leaf = nonIndex.length > 0 ? nonIndex[nonIndex.length - 1]! : path;
  const words = leaf.split("_");
  const last = words[words.length - 1];
  if (words.length > 0 && last != null && last.toLowerCase() === "ic") {
    words[words.length - 1] = "IC";
  }
  return words
    .map((w) =>
      w.length === 0
        ? w
        : w === "IC"
          ? "IC"
          : w.length <= 3 && w === w.toUpperCase()
            ? w
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(" ");
}

function pathToSectionKey(path: string): string {
  const first = path.split(/[.[\]]/)[0];
  if (
    first &&
    (APPLICATION_JSON_KEYS as readonly string[]).includes(first)
  ) {
    return first;
  }
  if (path.startsWith("contract")) return "contract";
  if (path.startsWith("invoices")) return "invoices";
  return first || "unknown";
}

function sectionLabelForKey(sectionKey: string): string {
  if (sectionKey === "contract") return "Contract";
  if (sectionKey === "invoices") return "Invoices";
  const k = sectionKey as (typeof APPLICATION_JSON_KEYS)[number];
  return SECTION_LABELS[k] ?? sectionKey;
}

export type ResubmitFieldChange = {
  path: string;
  section_key: string;
  section_label: string;
  field_label: string;
  previous_value: string;
  next_value: string;
};

export type ResubmitChangeSummary = {
  changedSectionKeys: string[];
  changedSectionLabels: string[];
  contractChanged: boolean;
  invoicesChanged: boolean;
  field_changes: ResubmitFieldChange[];
  activitySummary: string;
};

export function summarizeResubmitSnapshotDiff(
  previousSnapshot: unknown,
  nextSnapshot: unknown
): ResubmitChangeSummary {
  const fieldLeaves: FieldChangeLeaf[] = [];
  const field_changes: ResubmitFieldChange[] = [];

  const prevApp = getSnapshotApplication(previousSnapshot);
  const nextApp = getSnapshotApplication(nextSnapshot);

  console.log("[resubmit-diff] start", {
    hasPrevApp: !!prevApp,
    hasNextApp: !!nextApp,
  });

  if (prevApp && nextApp) {
    for (const key of APPLICATION_JSON_KEYS) {
      collectFieldChangeLeaves(prevApp[key], nextApp[key], key, fieldLeaves, MAX_FIELD_PATHS);
    }
  }

  const prevContractRaw = isPlainObject(previousSnapshot)
    ? previousSnapshot.contract
    : undefined;
  const nextContractRaw = isPlainObject(nextSnapshot) ? nextSnapshot.contract : undefined;

  const prevContract = prevContractRaw != null ? stripVolatileTimestamps(prevContractRaw) : null;
  const nextContract = nextContractRaw != null ? stripVolatileTimestamps(nextContractRaw) : null;

  const contractEqualAfterStrip = deepEqualJson(prevContract, nextContract);
  console.log("[resubmit-diff] contract compare", {
    hadPrev: prevContractRaw != null,
    hadNext: nextContractRaw != null,
    equalAfterStrippingVolatile: contractEqualAfterStrip,
  });

  let contractChanged = !contractEqualAfterStrip;
  if (!contractEqualAfterStrip) {
    const contractLeaves: FieldChangeLeaf[] = [];
    collectFieldChangeLeaves(
      prevContract,
      nextContract,
      "contract",
      contractLeaves,
      MAX_FIELD_PATHS
    );
    console.log(
      "[resubmit-diff] contract differing paths (sample)",
      contractLeaves.slice(0, 20).map((l) => l.path)
    );
    fieldLeaves.push(...contractLeaves);
  }

  const prevInvRaw =
    isPlainObject(previousSnapshot) && Array.isArray(previousSnapshot.invoices)
      ? previousSnapshot.invoices
      : [];
  const nextInvRaw =
    isPlainObject(nextSnapshot) && Array.isArray(nextSnapshot.invoices)
      ? nextSnapshot.invoices
      : [];

  const prevInv = stripVolatileTimestamps(prevInvRaw) as unknown[];
  const nextInv = stripVolatileTimestamps(nextInvRaw) as unknown[];

  const invoicesEqualAfterStrip = deepEqualJson(prevInv, nextInv);
  console.log("[resubmit-diff] invoices compare", {
    prevCount: prevInv.length,
    nextCount: nextInv.length,
    equalAfterStrippingVolatile: invoicesEqualAfterStrip,
  });

  let invoicesChanged = !invoicesEqualAfterStrip;
  if (!invoicesEqualAfterStrip) {
    const prevById = new Map<string, unknown>();
    const nextById = new Map<string, unknown>();
    for (const row of prevInv) {
      if (isPlainObject(row) && typeof row.id === "string") prevById.set(row.id, row);
    }
    for (const row of nextInv) {
      if (isPlainObject(row) && typeof row.id === "string") nextById.set(row.id, row);
    }
    const allIds = new Set([...prevById.keys(), ...nextById.keys()]);
    for (const id of allIds) {
      if (fieldLeaves.length >= MAX_FIELD_PATHS) break;
      const a = prevById.get(id) ?? null;
      const b = nextById.get(id) ?? null;
      collectFieldChangeLeaves(a, b, `invoices[${id}]`, fieldLeaves, MAX_FIELD_PATHS);
    }
  }

  for (const leaf of fieldLeaves) {
    const section_key = pathToSectionKey(leaf.path);
    const previous_value = serializeSnapshotValue(leaf.prev);
    const next_value = serializeSnapshotValue(leaf.next);
    field_changes.push({
      path: leaf.path,
      section_key,
      section_label: sectionLabelForKey(section_key),
      field_label: fieldLabelFromPath(leaf.path),
      previous_value,
      next_value,
    });
  }

  console.log(
    "[resubmit-diff] value preview (first change)",
    field_changes[0] ?? "no field changes"
  );

  const sectionOrder = new Map<string, number>();
  let ord = 0;
  for (const k of APPLICATION_JSON_KEYS) {
    sectionOrder.set(k, ord++);
  }
  sectionOrder.set("contract", 100);
  sectionOrder.set("invoices", 101);

  const changedSectionKeys = [...new Set(field_changes.map((f) => f.section_key))].sort(
    (a, b) => (sectionOrder.get(a) ?? 99) - (sectionOrder.get(b) ?? 99)
  );
  const changedSectionLabels = changedSectionKeys.map(sectionLabelForKey);

  contractChanged = field_changes.some((f) => f.section_key === "contract");
  invoicesChanged = field_changes.some((f) => f.section_key === "invoices");

  const uniqueLabels = [...new Set(changedSectionLabels)];
  const activitySummary =
    uniqueLabels.length > 0
      ? `Changes: ${uniqueLabels.join(", ")}`
      : "Changes: (none detected — compare snapshots if needed)";

  console.log("[resubmit-diff] summary", {
    sections: changedSectionKeys,
    pathCount: field_changes.length,
    activitySummary,
  });

  return {
    changedSectionKeys,
    changedSectionLabels: uniqueLabels,
    contractChanged,
    invoicesChanged,
    field_changes,
    activitySummary,
  };
}
