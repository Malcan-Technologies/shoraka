import {
  CurlecGatewayAccount,
  GatewayPaymentPurpose,
  Prisma,
} from "@prisma/client";

const PURPOSE_SEARCH_ALIASES: Array<{ purpose: GatewayPaymentPurpose; terms: string[] }> = [
  {
    purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
    terms: ["investor deposit", "deposit", "investor_deposit"],
  },
  {
    purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
    terms: [
      "issuer registration fee",
      "issuer onboarding",
      "onboarding fee",
      "issuer_onboarding_fee",
    ],
  },
  {
    purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
    terms: [
      "application processing fee",
      "processing fee",
      "application_processing_fee",
    ],
  },
  {
    purpose: GatewayPaymentPurpose.FACILITY_FEE,
    terms: ["facility fee", "facility_fee", "upfront facility fee"],
  },
  {
    purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES,
    terms: [
      "late payment charges",
      "excess late charges",
      "excess_late_charges",
      "late charges",
    ],
  },
];

export function matchPurposesFromSearch(term: string): GatewayPaymentPurpose[] {
  const normalized = term.trim().toLowerCase();
  if (!normalized || normalized.length < 3) return [];
  return PURPOSE_SEARCH_ALIASES.filter(({ purpose, terms }) => {
    if (purpose.toLowerCase() === normalized) return true;
    return terms.some(
      (alias) => alias === normalized || alias.includes(normalized) || normalized.includes(alias)
    );
  }).map(({ purpose }) => purpose);
}

export function matchGatewayAccountsFromSearch(term: string): CurlecGatewayAccount[] {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];
  const matches: CurlecGatewayAccount[] = [];
  if (normalized === "operating" || normalized.includes("operating")) {
    matches.push(CurlecGatewayAccount.OPERATING);
  }
  if (
    normalized === "pool" ||
    normalized === "investor_pool" ||
    normalized.includes("investor pool") ||
    normalized.includes("investor_pool")
  ) {
    matches.push(CurlecGatewayAccount.INVESTOR_POOL);
  }
  return matches;
}

/** Exact amount match after stripping optional RM/MYR prefix and commas. */
export function parseSearchAmount(term: string): Prisma.Decimal | null {
  const cleaned = term
    .trim()
    .replace(/,/g, "")
    .replace(/^(myr|rm)\s*/i, "")
    .replace(/\s+/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(cleaned)) return null;
  try {
    return new Prisma.Decimal(cleaned);
  } catch {
    return null;
  }
}

/**
 * Displayed corporate org name comes from
 * `corporate_onboarding_data.basicInfo.businessName` (Json).
 * Prisma 5 JSON filters are case-sensitive, so we mirror the Notes list pattern:
 * query the common case variants in one OR clause (still a single SQL query).
 */
export function buildCorporateBusinessNameJsonFilters(term: string): Array<{
  corporate_onboarding_data: {
    path: string[];
    string_contains: string;
  };
}> {
  const query = term.trim();
  if (!query) return [];

  const variants = [
    ...new Set([
      query,
      query.toLowerCase(),
      query.toUpperCase(),
      query.replace(/\b\w/g, (char) => char.toUpperCase()),
    ]),
  ];

  return variants.map((variant) => ({
    corporate_onboarding_data: {
      path: ["basicInfo", "businessName"],
      string_contains: variant,
    },
  }));
}

function buildOrgNameSearchOr(term: string): Prisma.InvestorOrganizationWhereInput {
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { first_name: { contains: term, mode: "insensitive" } },
      { middle_name: { contains: term, mode: "insensitive" } },
      { last_name: { contains: term, mode: "insensitive" } },
      { registration_number: { contains: term, mode: "insensitive" } },
      { legal_name_on_id: { contains: term, mode: "insensitive" } },
      ...buildCorporateBusinessNameJsonFilters(term),
    ],
  };
}

function buildIssuerOrgNameSearchOr(term: string): Prisma.IssuerOrganizationWhereInput {
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { first_name: { contains: term, mode: "insensitive" } },
      { middle_name: { contains: term, mode: "insensitive" } },
      { last_name: { contains: term, mode: "insensitive" } },
      { registration_number: { contains: term, mode: "insensitive" } },
      ...buildCorporateBusinessNameJsonFilters(term),
    ],
  };
}

/** Case-insensitive partial match across payment and org fields; amount is exact. */
export function buildGatewayPaymentSearchOr(
  search: string
): Prisma.GatewayPaymentWhereInput[] {
  const term = search.trim();
  if (!term) return [];

  const or: Prisma.GatewayPaymentWhereInput[] = [
    { id: { contains: term, mode: "insensitive" } },
    { curlec_order_id: { contains: term, mode: "insensitive" } },
    { curlec_payment_id: { contains: term, mode: "insensitive" } },
    { payer_name: { contains: term, mode: "insensitive" } },
    { refund_reference: { contains: term, mode: "insensitive" } },
    { settlement_id: { contains: term, mode: "insensitive" } },
    { investor_organization: buildOrgNameSearchOr(term) },
    { issuer_organization: buildIssuerOrgNameSearchOr(term) },
  ];

  for (const purpose of matchPurposesFromSearch(term)) {
    or.push({ purpose });
  }
  for (const gatewayAccount of matchGatewayAccountsFromSearch(term)) {
    or.push({ gatewayAccount });
  }

  const amount = parseSearchAmount(term);
  if (amount) {
    or.push({ amount });
  }

  return or;
}
