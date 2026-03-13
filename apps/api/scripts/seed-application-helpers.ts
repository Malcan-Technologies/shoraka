/**
 * Shared helpers for application seed scripts.
 * Generates randomized but valid application/invoice/contract data.
 */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const COMPANY_PREFIXES = ["Acme", "Global", "Pacific", "Summit", "Vertex", "Nexus", "Prime"];
const COMPANY_SUFFIXES = ["Trading", "Industries", "Solutions", "Enterprises", "Group"];

export function randomCompanyName(): string {
  return `${randomFrom(COMPANY_PREFIXES)} ${randomFrom(COMPANY_SUFFIXES)} Sdn Bhd`;
}

export function randomInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const seq = randomInt(1000, 9999);
  return `INV-${year}-${seq}`;
}

export function randomInvoiceValue(): number {
  const amounts = [15000, 25000, 35000, 50000, 75000, 100000, 120000];
  return randomFrom(amounts);
}

export function randomFinancingRatio(): number {
  return randomInt(60, 80);
}

export function randomMaturityDate(): string {
  const now = new Date();
  const daysAhead = randomInt(30, 180);
  const d = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function randomContractValue(): number {
  return randomInt(100000, 500000);
}

export interface InvoiceDetailsInput {
  number: string;
  value: number;
  financing_ratio_percent: number;
  maturity_date: string;
}

export function buildInvoiceDetails(input: InvoiceDetailsInput): Record<string, unknown> {
  return {
    number: input.number,
    value: input.value,
    financing_ratio_percent: input.financing_ratio_percent,
    maturity_date: input.maturity_date,
    due_date: input.maturity_date,
    document: {
      file_name: `invoice-${input.number}.pdf`,
      s3_key: `applications/seed/invoice-${input.number}.pdf`,
    },
  };
}

export function generateInvoiceDetailsList(count: number): InvoiceDetailsInput[] {
  const seen = new Set<string>();
  const list: InvoiceDetailsInput[] = [];

  for (let i = 0; i < count; i++) {
    let num = randomInvoiceNumber();
    while (seen.has(num)) {
      num = randomInvoiceNumber();
    }
    seen.add(num);
    list.push({
      number: num,
      value: randomInvoiceValue(),
      financing_ratio_percent: randomFinancingRatio(),
      maturity_date: randomMaturityDate(),
    });
  }
  return list;
}
