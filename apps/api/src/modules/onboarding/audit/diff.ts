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
  kycStatus?: string;
  kycId?: string;
};

function directorRows(value: unknown): DirectorKycRow[] {
  const rec = asRecord(value);
  const directors = rec?.directors;
  if (!Array.isArray(directors)) return [];
  return directors.map((row) => {
    const item = asRecord(row) ?? {};
    return {
      eodRequestId: typeof item.eodRequestId === "string" ? item.eodRequestId : undefined,
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
  const prevById = new Map(prev.map((row, i) => [row.eodRequestId || `idx:${i}`, row]));
  let changedCount = 0;
  let previousKycStatus: string | undefined;
  let newKycStatus: string | undefined;

  next.forEach((row, i) => {
    const id = row.eodRequestId || `idx:${i}`;
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
