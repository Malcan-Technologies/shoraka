// DEV TEST DATA GENERATOR
// Safe to delete. Used only for development testing.

import { formatMoney } from "../components/money";
import { format, subDays, addDays } from "date-fns";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

/** Contract data for contract step. Start must be before end. */
export function generateContractData(): Record<string, unknown> {
  const today = new Date();
  const startDate = subDays(today, randomInt(60, 90));
  const endDate = subDays(today, randomInt(0, 30));
  const value = randomInt(100000, 1000000);
  const financing = Math.floor(value * 0.2);
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

/** Financial statements data. */
export function generateFinancialData(): Record<string, unknown> {
  const today = new Date();
  const fyEnd = format(subDays(today, 180), "dd/MM/yyyy");
  const dataUntil = format(subDays(today, 30), "dd/MM/yyyy");
  const turnover = randomInt(500000, 5000000);
  const plnpat = randomInt(50000, 500000);
  const bsqpuc = randomInt(50000, 300000);
  const plyear = randomInt(30000, 200000);
  return {
    pldd: fyEnd,
    bsdd: dataUntil,
    bsfatot: formatMoney(randomInt(100000, 500000)),
    othass: formatMoney(randomInt(20000, 100000)),
    bscatot: formatMoney(randomInt(100000, 300000)),
    bsclbank: formatMoney(randomInt(20000, 100000)),
    curlib: formatMoney(randomInt(50000, 200000)),
    bsslltd: formatMoney(randomInt(30000, 150000)),
    bsclstd: formatMoney(randomInt(10000, 50000)),
    bsqpuc: formatMoney(bsqpuc),
    turnover: formatMoney(turnover),
    plnpbt: formatMoney(plnpat * 1.2),
    plnpat: formatMoney(plnpat),
    plminin: formatMoney(0),
    plnetdiv: formatMoney(plyear * 0.3),
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

/** Invoice data for invoice details step. Maturity must be today or future. */
export function generateInvoiceData(): { invoices: InvoiceRowInput[] } {
  const today = new Date();
  const maturityDate = format(addDays(today, randomInt(7, 90)), "yyyy-MM-dd");
  const value = randomInt(50000, 500000);
  return {
    invoices: [
      {
        id: crypto.randomUUID(),
        isPersisted: false,
        number: randomString("INV"),
        value: formatMoney(value),
        maturity_date: maturityDate,
        financing_ratio_percent: 70,
        status: "DRAFT",
        document: null,
      },
    ],
  };
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
