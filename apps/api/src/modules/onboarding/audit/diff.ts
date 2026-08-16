export type CorporateEntitiesBucket = {
  directors?: unknown[];
  shareholders?: unknown[];
  corporateShareholders?: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function entityKey(row: unknown, index: number): string {
  const rec = asRecord(row);
  if (!rec) return `idx:${index}`;
  const personal = asRecord(rec.personalInfo);
  const gov =
    (typeof personal?.governmentIdNumber === "string" && personal.governmentIdNumber) ||
    (typeof rec.governmentIdNumber === "string" && rec.governmentIdNumber) ||
    "";
  const eod = typeof rec.eodRequestId === "string" ? rec.eodRequestId : "";
  const name =
    (typeof personal?.fullName === "string" && personal.fullName) ||
    (typeof rec.fullName === "string" && rec.fullName) ||
    (typeof rec.businessName === "string" && rec.businessName) ||
    "";
  return `${eod}|${gov}|${name}`.toLowerCase() || `idx:${index}`;
}

function bucketMap(rows: unknown[] | undefined): Map<string, unknown> {
  const map = new Map<string, unknown>();
  (rows ?? []).forEach((row, index) => {
    map.set(entityKey(row, index), row);
  });
  return map;
}

function jsonStable(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function diffCorporateEntities(
  before: unknown,
  after: unknown
): { changed: boolean; addedCount: number; removedCount: number; updatedCount: number } {
  const beforeRec = asRecord(before) as CorporateEntitiesBucket | null;
  const afterRec = asRecord(after) as CorporateEntitiesBucket | null;
  if (jsonStable(beforeRec) === jsonStable(afterRec)) {
    return { changed: false, addedCount: 0, removedCount: 0, updatedCount: 0 };
  }

  let addedCount = 0;
  let removedCount = 0;
  let updatedCount = 0;
  const keys: Array<keyof CorporateEntitiesBucket> = [
    "directors",
    "shareholders",
    "corporateShareholders",
  ];
  for (const key of keys) {
    const prev = bucketMap(beforeRec?.[key]);
    const next = bucketMap(afterRec?.[key]);
    for (const [id, row] of next) {
      const prior = prev.get(id);
      if (!prior) addedCount += 1;
      else if (jsonStable(prior) !== jsonStable(row)) updatedCount += 1;
    }
    for (const id of prev.keys()) {
      if (!next.has(id)) removedCount += 1;
    }
  }

  const changed = addedCount + removedCount + updatedCount > 0 || jsonStable(beforeRec) !== jsonStable(afterRec);
  return { changed, addedCount, removedCount, updatedCount };
}

type DirectorKycRow = {
  eodRequestId?: string;
  shareholderEodRequestId?: string;
  partyKey?: string;
  name?: string;
  kycStatus?: string;
  kycId?: string;
};

const DIRECTOR_KYC_FINAL_STATUSES = new Set(["APPROVED", "REJECTED"]);

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeKycStatus(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function directorIdentity(row: DirectorKycRow, index: number): string {
  return row.eodRequestId || row.shareholderEodRequestId || row.partyKey || `idx:${index}`;
}

function directorRows(value: unknown): DirectorKycRow[] {
  const rec = asRecord(value);
  const directors = rec?.directors;
  if (!Array.isArray(directors)) return [];
  return directors.map((row) => {
    const item = asRecord(row) ?? {};
    return {
      eodRequestId: optionalString(item.eodRequestId),
      shareholderEodRequestId: optionalString(item.shareholderEodRequestId),
      partyKey: optionalString(item.partyKey),
      name: optionalString(item.name),
      kycStatus: typeof item.kycStatus === "string" ? item.kycStatus : undefined,
      kycId: typeof item.kycId === "string" ? item.kycId : undefined,
    };
  });
}

export function directorKycMaterialChange(
  before: unknown,
  after: unknown
): { changed: boolean; changedCount: number; directorCount: number; previousKycStatus?: string; newKycStatus?: string } {
  const prev = directorRows(before);
  const next = directorRows(after);
  const prevById = new Map(prev.map((row, i) => [directorIdentity(row, i), row]));
  let changedCount = 0;
  let previousKycStatus: string | undefined;
  let newKycStatus: string | undefined;

  next.forEach((row, i) => {
    const id = directorIdentity(row, i);
    const prior = prevById.get(id);
    if (!prior) {
      changedCount += 1;
      newKycStatus = row.kycStatus;
      return;
    }
    if (prior.kycStatus !== row.kycStatus || prior.kycId !== row.kycId) {
      changedCount += 1;
      previousKycStatus = prior.kycStatus;
      newKycStatus = row.kycStatus;
    }
  });

  if (prev.length !== next.length) {
    changedCount = Math.max(changedCount, Math.abs(prev.length - next.length));
  }

  return {
    changed: changedCount > 0,
    changedCount,
    directorCount: next.length,
    previousKycStatus,
    newKycStatus,
  };
}

export type DirectorKycFinalOutcome = {
  eodRequestId?: string;
  partyKey?: string;
  directorName?: string;
  previousKycStatus?: string;
  newKycStatus: string;
};

/**
 * Per-director APPROVED/REJECTED transitions only.
 * First JSON seed / new director rows and intermediate statuses are excluded.
 */
export function directorKycFinalOutcomes(before: unknown, after: unknown): DirectorKycFinalOutcome[] {
  const prev = directorRows(before);
  const next = directorRows(after);
  const prevById = new Map(prev.map((row, i) => [directorIdentity(row, i), row]));
  const outcomes: DirectorKycFinalOutcome[] = [];

  next.forEach((row, i) => {
    const prior = prevById.get(directorIdentity(row, i));
    if (!prior) return;

    const previousNormalized = normalizeKycStatus(prior.kycStatus);
    const nextNormalized = normalizeKycStatus(row.kycStatus);
    if (!DIRECTOR_KYC_FINAL_STATUSES.has(nextNormalized)) return;
    if (previousNormalized === nextNormalized) return;

    outcomes.push({
      newKycStatus: row.kycStatus ?? nextNormalized,
      ...(row.eodRequestId || row.shareholderEodRequestId
        ? { eodRequestId: row.eodRequestId || row.shareholderEodRequestId }
        : {}),
      ...(row.partyKey ? { partyKey: row.partyKey } : {}),
      ...(row.name ? { directorName: row.name } : {}),
      ...(prior.kycStatus ? { previousKycStatus: prior.kycStatus } : {}),
    });
  });

  return outcomes;
}
