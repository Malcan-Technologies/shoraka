/**
 * SECTION: CTOS report XML → structured JSON
 * WHY: Persist column-per-json slices; no business scoring here
 * INPUT: raw XML string from CTOS
 * OUTPUT: CtosReportParsed (financials_json includes reporting_year per row)
 * WHERE USED: ctos report service on insert
 */

import { parseStringPromise } from "xml2js";
import type { CtosFinancialYearRow, CtosReportParsed } from "./types";

function safeGet(obj: unknown, path: (string | number)[]): unknown {
  try {
    const val = path.reduce((o, k) => (o as Record<string, unknown>)?.[k as string], obj);
    return val === undefined || val === "" ? null : val;
  } catch {
    return null;
  }
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toBoolean(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  if (v === "1" || v === 1) return true;
  if (v === "0" || v === 0) return false;
  return null;
}

/**
 * Calendar year from CTOS date: YYYY-MM-DD or DD-MM-YYYY
 */
export function parseReportingYearFromCtosDates(
  financialYearEnd: string | null,
  balanceSheetDate: string | null
): number | null {
  for (const raw of [balanceSheetDate, financialYearEnd]) {
    if (!raw || typeof raw !== "string") continue;
    const s = raw.trim();
    const iso = s.match(/^(\d{4})-\d{2}-\d{2}$/);
    if (iso) {
      const y = Number(iso[1]);
      if (y >= 1900 && y <= 2100) return y;
    }
    const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmy) {
      const y = Number(dmy[3]);
      if (y >= 1900 && y <= 2100) return y;
    }
  }
  return null;
}

export async function parseCtosReportXml(xmlStr: string): Promise<CtosReportParsed> {
  const parsed = await parseStringPromise(xmlStr, { explicitArray: true });
  const report = (parsed as { report?: { enq_report?: unknown[] } })?.report?.enq_report?.[0] as
    | { enquiry?: unknown[]; summary?: unknown[] }
    | undefined;
  const enquiry = (report?.enquiry?.[0] ?? {}) as Record<string, unknown>;

  const sumTop = report?.summary?.[0] as { enq_sum?: unknown[] } | undefined;
  const enqSum0 = sumTop?.enq_sum?.[0] as { $?: { ptype?: string }; fico_index?: unknown[] } | undefined;
  const isIndividual = enqSum0?.$?.ptype === "I";

  const summary = (enquiry?.section_summary as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const sectionA = (enquiry?.section_a as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const sectionDNode = (enquiry?.section_d as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const sectionD2Node = (enquiry?.section_d2 as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const accountsNode = safeGet(sectionA, ["record", 0, "accounts", 0]) as Record<string, unknown> | undefined;
  const accountsList = Array.isArray(accountsNode?.account)
    ? (accountsNode.account as unknown[])
    : accountsNode?.account
      ? [accountsNode.account]
      : [];

  const ccris = (enquiry?.section_ccris as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;

  const companyNode = (safeGet(sectionA, ["record", 0]) ??
    safeGet(sectionA, ["company", 0]) ??
    safeGet(sectionA, ["person", 0])) as Record<string, unknown> | undefined;

  const address = {
    full:
      (safeGet(companyNode, ["addr", 0, "_"]) ?? safeGet(companyNode, ["addr", 0])) ||
      (safeGet(companyNode, ["addr1", 0, "_"]) ?? safeGet(companyNode, ["addr1", 0])) ||
      null,
    line1: safeGet(companyNode, ["addr_breakdown", 0, "addr1", 0]),
    line2: safeGet(companyNode, ["addr_breakdown", 0, "addr2", 0]),
    city: safeGet(companyNode, ["addr_breakdown", 0, "city", 0]),
    state: safeGet(companyNode, ["addr_breakdown", 0, "state", 0]),
    postcode: safeGet(companyNode, ["addr_breakdown", 0, "postcode", 0]),
  };

  const directorsRaw = safeGet(companyNode, ["directors", 0, "director"]) || [];
  const directorsArr = Array.isArray(directorsRaw) ? directorsRaw : directorsRaw ? [directorsRaw] : [];

  const directors = directorsArr.map((d: unknown) => {
    const x = d as Record<string, unknown>;
    return {
      name: safeGet(x, ["name", 0]),
      alias: safeGet(x, ["alias", 0]),
      ic_lcno: safeGet(x, ["ic_lcno", 0]),
      nic_brno: safeGet(x, ["nic_brno", 0]),
      position: safeGet(x, ["position", 0]),
      addr: safeGet(x, ["addr", 0]),
      appoint: safeGet(x, ["appoint", 0]),
      resign_date: safeGet(x, ["resign_date", 0]),
      equity: toNumber(safeGet(x, ["equity", 0])),
      equity_percentage: toNumber(safeGet(x, ["equity_percentage", 0])),
      remark: safeGet(x, ["remark", 0]),
      party_type: safeGet(x, ["party_type", 0]),
    };
  });

  const seenPlyears = new Set<number>();
  const accountsForFinancials: unknown[] = [];
  for (const acc of accountsList) {
    const year = toNumber(safeGet(acc as Record<string, unknown>, ["plyear", 0]));
    if (year === null || year === 0) continue;
    if (seenPlyears.has(year)) continue;
    seenPlyears.add(year);
    accountsForFinancials.push(acc);
  }

  const financialsArray: CtosFinancialYearRow[] = isIndividual
    ? []
    : accountsForFinancials
        .map((accounts: unknown) => {
          const acc = accounts as Record<string, unknown>;
          const plddRaw = safeGet(acc, ["pldd", 0]);
          const bsddRaw = safeGet(acc, ["bsdd", 0]);
          const pldd = plddRaw != null ? String(plddRaw) : null;
          const bsdd = bsddRaw != null ? String(bsddRaw) : null;
          const reportingYear = parseReportingYearFromCtosDates(pldd, bsdd);

          const plyearAmt = toNumber(safeGet(acc, ["plyear", 0]));

          return {
            reporting_year: reportingYear,
            financial_year_end_date: pldd,
            balance_sheet_date: bsdd,
            balance_sheet: {
              fixed_assets: toNumber(safeGet(acc, ["bsfatot", 0])),
              other_assets: toNumber(safeGet(acc, ["othass", 0])),
              current_assets: toNumber(safeGet(acc, ["bscatot", 0])),
              non_current_assets: toNumber(safeGet(acc, ["bsclbank", 0])),
              total_assets: toNumber(safeGet(acc, ["totass", 0])),
              current_liabilities: toNumber(safeGet(acc, ["curlib", 0])),
              long_term_liabilities: toNumber(safeGet(acc, ["bsslltd", 0])),
              non_current_liabilities: toNumber(safeGet(acc, ["bsclstd", 0])),
              total_liabilities: toNumber(safeGet(acc, ["totlib", 0])),
              equity: toNumber(safeGet(acc, ["bsqpuc", 0])),
            },
            profit_and_loss: {
              revenue: toNumber(safeGet(acc, ["turnover", 0])),
              profit_before_tax: toNumber(safeGet(acc, ["plnpbt", 0])),
              profit_after_tax: toNumber(safeGet(acc, ["plnpat", 0])),
              net_dividend: toNumber(safeGet(acc, ["plnetdiv", 0])),
              profit_line_amount: plyearAmt,
            },
          };
        })
        .filter((row) => row.reporting_year !== null);

  const totalLimit = toNumber(
    safeGet(ccris, ["summary", 0, "liabilities", 0, "borrower", 0, "$", "total_limit"])
  );
  const totalOutstanding = toNumber(safeGet(ccris, ["summary", 0, "liabilities", 0, "borrower", 0, "_"]));

  const recordsD = sectionDNode?.record;
  const recordsD2 = sectionD2Node?.record;
  const flatD = recordsD == null ? [] : Array.isArray(recordsD) ? recordsD : [recordsD];
  const flatD2 = recordsD2 == null ? [] : Array.isArray(recordsD2) ? recordsD2 : [recordsD2];
  const sectionDRecords = [...flatD, ...flatD2];
  const legalCases = sectionDRecords.map((r: unknown) => {
    const x = r as Record<string, unknown>;
    return {
      title: safeGet(x, ["title", 0]),
      case_type: x?.$ && typeof x.$ === "object" ? (x.$ as { rpttype?: string }).rpttype ?? null : null,
      status:
        (x?.$ && typeof x.$ === "object" ? (x.$ as { status?: string }).status : null) ??
        safeGet(x, ["status", 0]),
      amount: toNumber(safeGet(x, ["amount", 0])),
      dates: {
        action_date: safeGet(x, ["action", 0, "date", 0]),
        notice_date: safeGet(x, ["notice", 0, "date", 0]),
        petition_date: safeGet(x, ["petition", 0, "date", 0]),
        order_date: safeGet(x, ["order", 0, "date", 0]),
      },
    };
  });

  const dcheqRaw = safeGet(summary, ["dcheqs", 0, "$", "entity"]);
  const dcheqFlag = toNumber(dcheqRaw);

  const ficoIndexNode = enqSum0?.fico_index?.[0] ?? {};
  const ficoObj = ficoIndexNode as { $?: { score?: string }; fico_factor?: unknown[] };
  const ficoScore = toNumber(ficoObj?.$?.score);
  const ficoFactors = (Array.isArray(ficoObj?.fico_factor) ? ficoObj.fico_factor : [])
    .map((f: unknown) => (typeof f === "string" ? f : (f as { _?: string })?._))
    .filter((f): f is string => Boolean(f));

  console.log("Parsed CTOS XML, financial year rows:", financialsArray.length);

  return {
    raw_xml: xmlStr,
    summary_json: {
      fico_score: ficoScore,
      fico_factors: ficoFactors,
      bankruptcy: toBoolean(safeGet(summary, ["ctos", 0, "bankruptcy", 0, "$", "status"])),
      legal: {
        total_cases: toNumber(safeGet(summary, ["ctos", 0, "legal", 0, "$", "total"])),
        total_amount: toNumber(safeGet(summary, ["ctos", 0, "legal", 0, "$", "value"])),
      },
      ccris: {
        applications: toNumber(safeGet(summary, ["ccris", 0, "application", 0, "$", "total"])),
        approved: toNumber(safeGet(summary, ["ccris", 0, "application", 0, "$", "approved"])),
        pending: toNumber(safeGet(summary, ["ccris", 0, "application", 0, "$", "pending"])),
        arrears: toNumber(safeGet(summary, ["ccris", 0, "facility", 0, "$", "arrears"])),
      },
      dcheqs: {
        has_history: dcheqFlag !== null ? dcheqFlag > 0 : null,
        raw_flag: dcheqFlag,
      },
    },
    person_json: isIndividual
      ? {
          name: (() => {
            const v = safeGet(companyNode, ["name", 0, "_"]) ?? safeGet(companyNode, ["name", 0]);
            return v == null ? null : String(v);
          })(),
          ic_no: (() => {
            const v = safeGet(companyNode, ["nic_brno", 0]) ?? safeGet(companyNode, ["ic_lcno", 0]);
            return v == null ? null : String(v);
          })(),
          nationality: (() => {
            const v = safeGet(companyNode, ["nationality", 0]);
            return v == null ? null : String(v);
          })(),
          birth_date: (() => {
            const v = safeGet(companyNode, ["birth_date", 0]);
            return v == null ? null : String(v);
          })(),
          address: (() => {
            const v =
              (safeGet(companyNode, ["addr", 0, "_"]) ?? safeGet(companyNode, ["addr", 0])) ||
              (safeGet(companyNode, ["addr1", 0, "_"]) ?? safeGet(companyNode, ["addr1", 0])) ||
              null;
            return v == null ? null : String(v);
          })(),
        }
      : null,
    company_json: isIndividual
      ? null
      : {
          name: safeGet(companyNode, ["name", 0, "_"]) ?? safeGet(companyNode, ["name", 0]),
          registration_no: safeGet(companyNode, ["brn_ssm", 0]) ?? safeGet(companyNode, ["ic_lcno", 0]),
          status: safeGet(companyNode, ["status", 0]),
          business_type: safeGet(companyNode, ["type_of_business", 0]),
          company_type: safeGet(companyNode, ["comp_type", 0, "_"]) ?? safeGet(companyNode, ["comp_type", 0]),
          company_category:
            safeGet(companyNode, ["comp_category", 0, "_"]) ?? safeGet(companyNode, ["comp_category", 0]),
          address,
          directors,
        },
    legal_json: { cases: legalCases },
    ccris_json: {
      summary: {
        total_limit: totalLimit,
        total_outstanding: totalOutstanding,
      },
    },
    financials_json: financialsArray,
  };
}
