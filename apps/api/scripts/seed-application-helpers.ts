/**
 * Shared helpers for application seed scripts.
 * Generates randomized but valid application/invoice/contract data.
 * Matches structure of production applications (e.g. cmmk5fh77001vu60ut7tk3apd).
 */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

function random12Digit(): string {
  return String(randomInt(100000000000, 999999999999));
}

export interface InvoiceDetailsInput {
  number: string;
  value: number;
  financing_ratio_percent: number;
  maturity_date: string;
}

export function buildInvoiceDetails(input: InvoiceDetailsInput): Record<string, unknown> {
  const fileName = `invoice-${input.number}.pdf`;
  const s3Key = `applications/seed/invoice-${input.number}.pdf`;
  return {
    number: input.number,
    value: input.value,
    financing_ratio_percent: input.financing_ratio_percent,
    maturity_date: input.maturity_date,
    due_date: input.maturity_date,
    document: {
      file_name: fileName,
      s3_key: s3Key,
      file_size: randomInt(15000, 250000),
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

/** company_details: contact_person + issuer_organization_id. */
export function buildCompanyDetails(issuerOrganizationId: string): Record<string, unknown> {
  return {
    contact_person: {
      ic: `${randomInt(600101, 990131)}-${randomInt(10, 99)}-${randomInt(1000, 9999)}`,
      name: `Ahmad bin ${randomFrom(["Hassan", "Rahman", "Ibrahim", "Salleh"])}`,
      contact: `0${randomInt(12, 19)}${randomInt(1000000, 9999999)}`,
      position: randomFrom(["Director", "Finance Manager", "Managing Director"]),
    },
    issuer_organization_id: issuerOrganizationId,
  };
}

/** business_details: about_your_business, why_raising_funds, declaration_confirmed, guarantors. */
export function buildBusinessDetails(): Record<string, unknown> {
  return {
    about_your_business: {
      what_does_company_do:
        "We manufacture industrial equipment and provide maintenance services for mining and construction sectors.",
      main_customers:
        "Large enterprises in oil & gas, mining, and infrastructure. Top customers include major conglomerates.",
      single_customer_over_50_revenue: false,
    },
    why_raising_funds: {
      financing_for: "Working capital to fulfill a new contract with a major client.",
      how_funds_used: "60% for inventory, 25% for payroll, 15% for equipment maintenance.",
      business_plan: "Expand capacity by 20% in the next 12 months.",
      risks_delay_repayment: "Supply chain delays may affect delivery. We maintain buffer stock.",
      backup_plan: "We have a revolving credit facility with our bank.",
      raising_on_other_p2p: false,
      platform_name: null,
      amount_raised: null,
      same_invoice_used: null,
      accounting_software: "Xero",
    },
    declaration_confirmed: true,
    isDeclarationConfirmed: true,
    guarantors: [
      {
        guarantor_id: "g-individual-ahmadhassan850315101234",
        guarantor_type: "individual" as const,
        email: "ahmad.hassan@example.com",
        first_name: "Ahmad",
        last_name: "Hassan",
        ic_number: "850315-10-1234",
        relationship: "director_shareholder" as const,
      },
      {
        guarantor_id: "g-company-abc1234567a",
        guarantor_type: "company" as const,
        email: "compliance@abcholdings.my",
        company_name: "ABC Holdings Sdn Bhd",
        ssm_number: "1234567-A",
        relationship: "parent_company" as const,
      },
    ],
  };
}

/** financial_statements: v2 questionnaire + unaudited_by_year (numbers per field). */
export function buildFinancialStatements(): Record<string, unknown> {
  const today = new Date();
  const closing = formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
  const currentYear = parseInt(closing.slice(0, 4), 10);
  const turnover = randomInt(500000, 5000000);
  const plnpat = randomInt(100000, 500000);
  const plyear = randomInt(100000, 300000);
  const yearBlock = () => ({
    pldd: closing,
    bsfatot: randomInt(100000, 500000),
    othass: randomInt(20000, 100000),
    bscatot: randomInt(100000, 300000),
    bsclbank: randomInt(20000, 100000),
    curlib: randomInt(50000, 200000),
    bsslltd: randomInt(30000, 150000),
    bsclstd: randomInt(10000, 50000),
    bsqpuc: randomInt(50000, 300000),
    turnover,
    plnpbt: Math.round(plnpat * 1.2),
    plnpat,
    plnetdiv: randomInt(10000, 100000),
    plyear,
  });
  return {
    questionnaire: { last_closing_date: closing, is_submitted_to_ssm: false },
    unaudited_by_year: {
      [String(currentYear)]: yearBlock(),
      [String(currentYear - 1)]: yearBlock(),
    },
  };
}

/** supporting_documents: categories with documents (file: s3_key, file_name). */
export function buildSupportingDocuments(): Record<string, unknown> {
  const categories = [
    {
      id: "legal_docs",
      title: "Legal",
      documents: [
        { id: `doc-${randomInt(1000, 9999)}`, title: "Business Registration Certificate", file: { s3_key: "applications/seed/legal/registration.pdf", file_name: "Business Registration Certificate.pdf" } },
        { id: `doc-${randomInt(1000, 9999)}`, title: "Board Resolution", file: { s3_key: "applications/seed/legal/board-resolution.pdf", file_name: "Board Resolution.pdf" } },
      ],
    },
    {
      id: "financial_docs",
      title: "Financial Docs",
      documents: [
        { id: `doc-${randomInt(1000, 9999)}`, title: "Latest Management Account", file: { s3_key: "applications/seed/financial/management-account.pdf", file_name: "Latest Management Account.pdf" } },
      ],
    },
    {
      id: "compliance_docs",
      title: "Compliance",
      documents: [
        { id: `doc-${randomInt(1000, 9999)}`, title: "Company Secretary Letter", file: { s3_key: "applications/seed/compliance/secretary-letter.pdf", file_name: "Company Secretary Letter.pdf" } },
      ],
    },
  ];
  return { supporting_documents: { categories } };
}

/** declarations: array of { checked: true }, areAllDeclarationsChecked. */
export function buildDeclarations(count = 3): Record<string, unknown> {
  const declarations = Array.from({ length: count }, () => ({ checked: true }));
  return { declarations, areAllDeclarationsChecked: true };
}

/** Contract contract_details: title, value, number, document, start_date, end_date, financing, description. */
export function buildContractDetails(): Record<string, unknown> {
  const value = randomContractValue();
  const financing = Math.round(value * (randomInt(60, 80) / 100));
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 6);
  return {
    title: "Supply Agreement",
    value,
    number: `CON-${Date.now().toString(36).toUpperCase()}`,
    document: { s3_key: "applications/seed/contract/master-agreement.pdf", file_name: "Master Agreement.pdf", file_size: 45678 },
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    financing,
    description: "Supply of goods and services under master agreement.",
  };
}

/** Contract customer_details: name, country, entity_type, ssm_number, document, is_related_party. */
export function buildCustomerDetails(): Record<string, unknown> {
  return {
    name: randomCompanyName(),
    country: "MY",
    entity_type: "Private Limited Company (Sdn Bhd)",
    ssm_number: random12Digit(),
    document: { s3_key: "applications/seed/customer/ssm.pdf", file_name: "SSM Certificate.pdf", file_size: 12345 },
    is_related_party: "no",
  };
}

/** review_and_submit: empty object (step stores nothing substantive). */
export function buildReviewAndSubmit(): Record<string, unknown> {
  return {};
}
