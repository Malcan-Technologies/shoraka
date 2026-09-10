/**
 * Maps RegTank COD form display areas onto CashSouk declaration columns.
 *
 * Personal onboarding uses "Wealth Declaration" / "Compliance Declarations".
 * The issuer corporate form stores PEP/compliance questions under
 * "Transaction Information" (PDF title: Compliance Declarations) and has no
 * Beneficiary Account Information area.
 */

export type CodDeclarationArea = {
  displayArea?: string;
  content?: unknown;
};

function asArea(value: unknown): CodDeclarationArea | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as CodDeclarationArea;
}

function areaName(area: CodDeclarationArea | null): string {
  return typeof area?.displayArea === "string" ? area.displayArea.trim() : "";
}

export function isCodTransactionInformationArea(data: unknown): boolean {
  const area = asArea(data);
  return areaName(area).toLowerCase() === "transaction information";
}

export function parseRegTankCodDeclarations(displayAreas: unknown): {
  wealthDeclaration: CodDeclarationArea | null;
  complianceDeclaration: CodDeclarationArea | null;
} {
  const areas = Array.isArray(displayAreas) ? displayAreas.map(asArea).filter(Boolean) : [];
  const find = (name: string): CodDeclarationArea | null =>
    areas.find((area) => areaName(area).toLowerCase() === name.toLowerCase()) ?? null;

  const wealthNamed = find("Wealth Declaration");
  const complianceNamed = find("Compliance Declarations");
  const transaction = find("Transaction Information");
  const beneficiary = find("Beneficiary Account Information");

  return {
    wealthDeclaration: wealthNamed,
    complianceDeclaration: complianceNamed || transaction || beneficiary,
  };
}
