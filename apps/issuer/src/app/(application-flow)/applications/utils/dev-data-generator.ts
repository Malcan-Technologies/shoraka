// DEV TEST DATA GENERATOR
// Safe to delete. Used only for development testing.

import { formatMoney } from "../components/money";
import { format, subDays, addDays } from "date-fns";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random number with decimals (0–2 dp). Fits MoneyInput: max 15 int digits, 2 decimal places. */
function randomDecimal(min: number, max: number, decimals = 2): number {
  const raw = min + Math.random() * (max - min);
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}

/** Random value that can be negative (for P&L: plminin, plnpbt, plnpat, plyear). Includes decimals. */
function randomMoneyAllowNegative(min: number, max: number): number {
  const val = randomDecimal(Math.abs(min), Math.abs(max));
  return Math.random() < 0.5 ? val : -val;
}

function random12Digit(): string {
  return String(randomInt(100000000000, 999999999999));
}

function randomString(prefix: string): string {
  return `${prefix}-${randomInt(10000, 99999)}`;
}

/** Customer data for contract step. */
export function generateCustomerData(): Record<string, unknown> {
  return {
    name: "ABC Sdn Bhd",
    entity_type: "Private Limited Company (Sdn Bhd)",
    ssm_number: random12Digit(),
    country: "MY",
    is_related_party: "no",
    document: null,
  };
}

/** Contract data for contract step. Start must be before end; financing <= value. */
export function generateContractData(): Record<string, unknown> {
  const today = new Date();
  const startDate = subDays(today, randomInt(60, 90));
  const endDate = subDays(today, randomInt(0, 30));
  const value = randomDecimal(100000, 1000000);
  const financing = Math.min(randomDecimal(10000, value * 0.8), value);
  return {
    title: "Supply Agreement",
    description: "Supply of goods and services",
    number: randomString("CON"),
    value: formatMoney(value),
    start_date: format(startDate, "d/M/yyyy"),
    end_date: format(endDate, "d/M/yyyy"),
    financing: formatMoney(financing),
    document: null,
  };
}

/**
 * Financial statements data. All 15 fields.
 * - turnover: >= 0 (validation rule)
 * - plminin, plnpbt, plnpat, plyear: may be negative
 * - plnetdiv: positive only (no allowNegative in form)
 * - All money: 2 decimal places, max 15 int digits
 */
export function generateFinancialData(): Record<string, unknown> {
  const today = new Date();
  const fyEnd = format(subDays(today, 180), "dd/MM/yyyy");
  const dataUntil = format(subDays(today, 30), "dd/MM/yyyy");
  const turnover = randomDecimal(500000, 5000000);
  const plnpat = randomMoneyAllowNegative(10000, 500000);
  const plminin = randomMoneyAllowNegative(0, 50000);
  const plyear = randomMoneyAllowNegative(10000, 200000);
  return {
    pldd: fyEnd,
    bsdd: dataUntil,
    bsfatot: formatMoney(randomDecimal(100000, 500000)),
    othass: formatMoney(randomDecimal(20000, 100000)),
    bscatot: formatMoney(randomDecimal(100000, 300000)),
    bsclbank: formatMoney(randomDecimal(20000, 100000)),
    curlib: formatMoney(randomDecimal(50000, 200000)),
    bsslltd: formatMoney(randomDecimal(30000, 150000)),
    bsclstd: formatMoney(randomDecimal(10000, 50000)),
    bsqpuc: formatMoney(randomDecimal(50000, 300000)),
    turnover: formatMoney(turnover),
    plnpbt: formatMoney(plnpat * 1.2),
    plnpat: formatMoney(plnpat),
    plminin: formatMoney(plminin),
    plnetdiv: formatMoney(randomDecimal(10000, Math.abs(plyear) * 0.5)),
    plyear: formatMoney(plyear),
  };
}

/** Invoice row shape for invoice details step. */
export interface InvoiceRowInput {
  id: string;
  isPersisted: boolean;
  number: string;
  value: string;
  maturity_date: string;
  financing_ratio_percent?: number;
  status?: string;
  document?: { file_name: string; file_size: number; s3_key?: string } | null;
}

/** Invoice data for invoice details step. Maturity today or future; value > 0; financing_ratio 60–80. Random count 1–5. */
export function generateInvoiceData(): { invoices: InvoiceRowInput[] } {
  const today = new Date();
  const count = randomInt(1, 5);
  const invoices: InvoiceRowInput[] = [];
  const usedNumbers = new Set<string>();

  for (let i = 0; i < count; i++) {
    let number = randomString("INV");
    while (usedNumbers.has(number)) {
      number = randomString("INV");
    }
    usedNumbers.add(number);

    const maturityDate = format(addDays(today, randomInt(7, 90)), "d/M/yyyy");
    const value = randomDecimal(50000, 500000);

    invoices.push({
      id: crypto.randomUUID(),
      isPersisted: false,
      number,
      value: formatMoney(value),
      maturity_date: maturityDate,
      financing_ratio_percent: randomInt(60, 80),
      status: "DRAFT",
      document: null,
    });
  }

  return { invoices };
}

/** Financing structure data. Picks structure type; uses first contract if existing_contract. */
export function generateFinancingStructureData(
  approvedContractIds?: string[]
): Record<string, unknown> {
  const types = ["new_contract", "invoice_only"] as const;
  const hasExisting = approvedContractIds && approvedContractIds.length > 0;
  const options = hasExisting
    ? (["new_contract", "invoice_only", "existing_contract"] as const)
    : types;
  const idx = randomInt(0, options.length - 1);
  const structure_type = options[idx];
  return {
    structure_type,
    existing_contract_id:
      structure_type === "existing_contract" && approvedContractIds?.length
        ? approvedContractIds[0]
        : null,
  };
}

/** Contract details step: contract + customer. */
export function generateContractDetailsData(): Record<string, unknown> {
  return {
    contract: generateContractData(),
    customer: generateCustomerData(),
  };
}

/** All step data for Fill Entire Application. */
export function generateAllDataForSteps(options?: {
  approvedContractIds?: string[];
}): Record<string, Record<string, unknown>> {
  const approvedIds = options?.approvedContractIds;
  return {
    financing_structure: generateFinancingStructureData(approvedIds),
    contract_details: generateContractDetailsData(),
    financial_statements: generateFinancialData(),
    invoice_details: generateInvoiceData(),
  };
}
