import { diffCorporateEntities, directorKycMaterialChange } from "./diff";

/**
 * Mirrors the FOR UPDATE + re-read + material-diff pattern used by COD WAIT_FOR_APPROVAL
 * and admin corporate-entity refresh: concurrent identical payloads must produce one
 * SOT write and one audit event. Serialization here stands in for Postgres row locks.
 */
function createRowLock() {
  let chain = Promise.resolve();
  return async <T>(fn: () => Promise<T> | T): Promise<T> => {
    const run = () => Promise.resolve(fn());
    const next = chain.then(run, run);
    chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
}

describe("lock-then-diff concurrency", () => {
  it("two concurrent identical director KYC updates write one audit", async () => {
    let json: unknown = {
      directors: [{ eodRequestId: "EOD1", kycStatus: "PENDING", kycId: undefined }],
    };
    let audits = 0;
    const withLock = createRowLock();
    const incoming = {
      directors: [{ eodRequestId: "EOD1", kycStatus: "APPROVED", kycId: "KYC1" }],
    };

    const apply = () =>
      withLock(async () => {
        const diff = directorKycMaterialChange(json, incoming);
        if (!diff.changed) return;
        json = incoming;
        audits += 1;
      });

    await Promise.all([apply(), apply()]);
    expect(audits).toBe(1);
    expect(directorKycMaterialChange(json, incoming).changed).toBe(false);
  });

  it("two concurrent identical corporate-entity updates write one audit", async () => {
    let json: unknown = { directors: [], shareholders: [], corporateShareholders: [] };
    let audits = 0;
    const withLock = createRowLock();
    const incoming = {
      directors: [{ eodRequestId: "EOD1", personalInfo: { fullName: "Ada" } }],
      shareholders: [],
      corporateShareholders: [],
    };

    const apply = () =>
      withLock(async () => {
        const diff = diffCorporateEntities(json, incoming);
        if (!diff.changed) return;
        json = incoming;
        audits += 1;
      });

    await Promise.all([apply(), apply()]);
    expect(audits).toBe(1);
    expect(diffCorporateEntities(json, incoming).changed).toBe(false);
  });
});
