/** Pure helpers for resolving the application that originated a contract facility. */

const TERMINAL_ORIGIN_APPLICATION_STATUSES = new Set<string>(["COMPLETED"]);

export type FinancingStructureJson = {
  structure_type?: string | null;
} | null | undefined;

export function isNewContractFinancingStructure(
  financingStructure: FinancingStructureJson
): boolean {
  return financingStructure?.structure_type === "new_contract";
}

export function pickEarliestOriginatingApplication<
  T extends { id: string; submitted_at: Date | null; updated_at: Date },
>(candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const aSubmitted = a.submitted_at?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bSubmitted = b.submitted_at?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted;
    return a.updated_at.getTime() - b.updated_at.getTime();
  })[0];
}

export function isTerminalOriginatingApplicationStatus(status: string): boolean {
  return TERMINAL_ORIGIN_APPLICATION_STATUSES.has(status);
}
