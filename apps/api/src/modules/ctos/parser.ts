/**
 * SECTION: CTOS report XML → structured JSON
 * WHY: Persist column-per-json slices; aligned with apps/api/src/ctos-test/ctos.new.ts
 * INPUT: raw XML string from CTOS
 * OUTPUT: CtosReportParsed
 * WHERE USED: ctos report service on insert
 */

import { parseStringPromise } from "xml2js";
import {
  CTOS_ACCOUNT_NUMERIC_CODENAMES,
  type CtosFinancialYearRow,
  type CtosReportParsed,
} from "./types";

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

function firstArrayEl(x: unknown): unknown {
  return Array.isArray(x) ? x[0] : undefined;
}

function xmlText(node: unknown): string | null {
  if (node === null || node === undefined || node === "") return null;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    if (node.length === 0) return null;
    return xmlText(node[0]);
  }
  if (typeof node === "object" && node !== null && "_" in node) {
    const inner = (node as { _: unknown })._;
    if (inner === null || inner === undefined || inner === "") return null;
    return xmlText(inner);
  }
  return null;
}

/**
 * Calendar year from CTOS `pldd` only (YYYY-MM-DD or DD-MM-YYYY).
 */
export function parseYearFromPldd(pldd: string | null): number | null {
  if (!pldd || typeof pldd !== "string") return null;
  const s = pldd.trim();
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
  return null;
}

function enqStatusMeta(node: unknown): { code: string | null; message: string | null } {
  if (node == null) return { code: null, message: null };
  if (typeof node === "string") return { code: null, message: node };
  const o = node as { $?: { code?: string }; _?: string };
  const message = o._ != null && o._ !== "" ? String(o._) : null;
  return { code: o.$?.code ?? null, message };
}

function pickEnquiryError(
  headerStatus: unknown,
  enqSumStatus: unknown,
  hasEnquiry: boolean
): { code: string; message: string } | null {
  const h = enqStatusMeta(headerStatus);
  if (h.code != null && h.code !== "1") {
    return { code: h.code, message: h.message ?? "" };
  }
  const s = enqStatusMeta(enqSumStatus);
  if (s.code != null && s.code !== "1") {
    return { code: s.code, message: s.message ?? "" };
  }
  if (!hasEnquiry) {
    if (h.code === "1" && s.code === "1") return null;
    if (h.code === "1" && s.code == null) return null;
    if (s.code === "1" && h.code == null) return null;
    return {
      code: h.code ?? s.code ?? "unknown",
      message: h.message ?? s.message ?? "No enquiry payload",
    };
  }
  return null;
}

function flattenSectionRecords(sectionNode: Record<string, unknown> | undefined): unknown[] {
  const rec = sectionNode?.record;
  if (rec == null) return [];
  return Array.isArray(rec) ? rec : [rec];
}

function parseMsicRows(companyNode: Record<string, unknown> | undefined) {
  if (!companyNode) return [];
  const raw = safeGet(companyNode, ["msic_ssms", 0, "msic_ssm"]);
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((row) => {
    const x = row as Record<string, unknown>;
    const attrs = x.$ as { code?: string; priority?: string } | undefined;
    return {
      code: attrs?.code ?? null,
      priority: attrs?.priority ?? null,
      description: xmlText(x._) ?? xmlText(safeGet(x, ["_", 0])),
    };
  });
}

function parsePartners(companyNode: Record<string, unknown> | undefined) {
  if (!companyNode) return [];
  const raw = safeGet(companyNode, ["partners", 0, "partner"]) || [];
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((p: unknown) => {
    const x = p as Record<string, unknown>;
    return {
      name: xmlText(safeGet(x, ["name", 0])),
      ic_lcno: xmlText(safeGet(x, ["ic_lcno", 0])),
      nic_brno: xmlText(safeGet(x, ["nic_brno", 0])),
      addr: xmlText(safeGet(x, ["addr", 0])),
    };
  });
}

function mapLegalRecord(r: unknown, sourceSection: "d" | "d2" | "d4") {
  const x = r as Record<string, unknown>;
  const attrs = x.$ as { rpttype?: string; status?: string } | undefined;
  const cedNode = safeGet(x, ["cedcon", 0]) as Record<string, unknown> | undefined;
  const cedcon = cedNode
    ? {
        name: xmlText(safeGet(cedNode, ["name", 0])),
        add1: xmlText(safeGet(cedNode, ["add1", 0])),
        add2: xmlText(safeGet(cedNode, ["add2", 0])),
        add3: xmlText(safeGet(cedNode, ["add3", 0])),
        add4: xmlText(safeGet(cedNode, ["add4", 0])),
        tel: xmlText(safeGet(cedNode, ["tel", 0])),
        ref: xmlText(safeGet(cedNode, ["ref", 0])),
      }
    : null;

  const odRaw = safeGet(x, ["other_defendants", 0, "other_defendant"]) || [];
  const odArr = Array.isArray(odRaw) ? odRaw : odRaw ? [odRaw] : [];
  const other_defendants = odArr.map((od: unknown) => {
    const o = od as Record<string, unknown>;
    return {
      name: xmlText(safeGet(o, ["name", 0])),
      ic_lcno: xmlText(safeGet(o, ["ic_lcno", 0])),
      nic_brno: xmlText(safeGet(o, ["nic_brno", 0])),
    };
  });

  return {
    source_section: sourceSection,
    case_type: attrs?.rpttype ?? null,
    title: xmlText(safeGet(x, ["title", 0])),
    special_remark: xmlText(safeGet(x, ["special_remark", 0])),
    name: xmlText(safeGet(x, ["name", 0])),
    addr: xmlText(safeGet(x, ["addr", 0])),
    case_no: xmlText(safeGet(x, ["case_no", 0])),
    court_detail: xmlText(safeGet(x, ["court_detail", 0])),
    hear_date: xmlText(safeGet(x, ["hear_date", 0])),
    amount: toNumber(safeGet(x, ["amount", 0])),
    remark1: xmlText(safeGet(x, ["remark1", 0])),
    lawyer: xmlText(safeGet(x, ["lawyer", 0])),
    settlement: xmlText(safeGet(x, ["settlement", 0])),
    latest_status: xmlText(safeGet(x, ["latest_status", 0])),
    subject_cmt: xmlText(safeGet(x, ["subject_cmt", 0])),
    cra_cmt: xmlText(safeGet(x, ["cra_cmt", 0])),
    status: attrs?.status ?? xmlText(safeGet(x, ["status", 0])),
    action: {
      date: xmlText(safeGet(x, ["action", 0, "date", 0])),
      source_detail: xmlText(safeGet(x, ["action", 0, "source_detail", 0])),
    },
    cedcon,
    other_defendants,
    dates: {
      action_date: xmlText(safeGet(x, ["action", 0, "date", 0])),
      notice_date: xmlText(safeGet(x, ["notice", 0, "date", 0])),
      petition_date: xmlText(safeGet(x, ["petition", 0, "date", 0])),
      order_date: xmlText(safeGet(x, ["order", 0, "date", 0])),
    },
  };
}

function buildAccountCodenames(acc: Record<string, unknown>): CtosFinancialYearRow["account"] {
  const account = {} as CtosFinancialYearRow["account"];
  for (const key of CTOS_ACCOUNT_NUMERIC_CODENAMES) {
    account[key] = toNumber(safeGet(acc, [key, 0]));
  }
  return account;
}

function buildSummaryJsonSlice(
  summary: Record<string, unknown> | undefined,
  enqSum0: { $?: { ptype?: string }; fico_index?: unknown[] } | undefined,
  dcheqFlag: number | null
) {
  const ficoIndexNode = enqSum0?.fico_index?.[0] ?? {};
  const ficoObj = ficoIndexNode as { $?: { score?: string }; fico_factor?: unknown[] };
  const ficoScore = toNumber(ficoObj?.$?.score);
  const ficoFactors = (Array.isArray(ficoObj?.fico_factor) ? ficoObj.fico_factor : [])
    .map((f: unknown) => (typeof f === "string" ? f : (f as { _?: string })?._))
    .filter((f): f is string => Boolean(f));

  return {
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
      raw_flag: dcheqFlag,
    },
  };
}

export async function parseCtosReportXml(xmlStr: string): Promise<CtosReportParsed> {
  console.log("Parsing CTOS XML, byte length:", xmlStr.length);

  const parsed = await parseStringPromise(xmlStr, { explicitArray: true });
  const report0 = (parsed as { report?: { enq_report?: unknown[] } })?.report?.enq_report?.[0] as
    | {
        header?: unknown[];
        summary?: unknown[];
        enquiry?: unknown[];
      }
    | undefined;

  const header0 = report0?.header?.[0] as Record<string, unknown> | undefined;
  const headerStatus = firstArrayEl(header0?.enq_status);

  const sumTop = report0?.summary?.[0] as { enq_sum?: unknown[] } | undefined;
  const enqSum0 = sumTop?.enq_sum?.[0] as
    | { $?: { ptype?: string; pcode?: string }; fico_index?: unknown[]; enq_status?: unknown[] }
    | undefined;

  const enquiryList = report0?.enquiry;
  const hasEnquiry = Array.isArray(enquiryList) && enquiryList.length > 0;
  const enquiry = (hasEnquiry ? enquiryList![0] : {}) as Record<string, unknown>;

  const enqSumStatus = firstArrayEl((enqSum0 as Record<string, unknown> | undefined)?.enq_status);

  const isIndividual = enqSum0?.$?.ptype === "I";
  const ptype = enqSum0?.$?.ptype ?? null;
  const pcode = enqSum0?.$?.pcode ?? null;

  const sumRec = enqSum0 as Record<string, unknown> | undefined;
  const nameFromSum = xmlText(safeGet(sumRec ?? {}, ["name", 0]));
  const icLcFromSum = xmlText(safeGet(sumRec ?? {}, ["ic_lcno", 0]));
  const nicBrFromSum = xmlText(safeGet(sumRec ?? {}, ["nic_brno", 0]));

  if (!hasEnquiry) {
    const summarySlice = buildSummaryJsonSlice(undefined, enqSum0, null);
    // ===============================
    // SECTION: CTOS DEBUG LOG
    // WHY: Track CTOS flow step-by-step (prod vs local issue)
    // INPUT: request / response / token
    // OUTPUT: console logs only
    // WHERE USED: CTOS integration flow
    // ===============================
    const parsedResultNoEnquiry = {
      raw_xml: xmlStr,
      summary_json: {
        ...summarySlice,
        enquiry_error: pickEnquiryError(headerStatus, enqSumStatus, false),
      },
      person_json: isIndividual
        ? {
            name: nameFromSum,
            nic_brno: nicBrFromSum,
            ic_lcno: icLcFromSum,
            nationality: null,
            birth_date: null,
            addr: null,
          }
        : null,
      company_json: !isIndividual
        ? {
            ptype,
            pcode,
            name: nameFromSum,
            brn_ssm: null,
            ic_lcno: icLcFromSum,
            nic_brno: nicBrFromSum,
            additional_registration_no: null,
            status: null,
            type_of_business: null,
            comp_type: null,
            comp_category: null,
            address: {
              full: null,
              line1: null,
              line2: null,
              city: null,
              state: null,
              postcode: null,
            },
            msic_ssms: [],
            partners: [],
            directors: [],
          }
        : null,
      legal_json: { cases: [] },
      ccris_json: {
        summary: {
          total_limit: null,
          total_outstanding: null,
        },
      },
      financials_json: [],
    };
    console.log("CTOS PARSED RESULT:", parsedResultNoEnquiry);
    {
      const pe = parsedResultNoEnquiry as unknown as Record<string, unknown>;
      if (pe.entities) {
        console.log("CTOS MULTIPLE ENTITIES DETECTED:", pe.entities);
      }
    }
    console.log("CTOS FINAL OUTPUT TO UI (parser, no-enquiry):", {
      raw_xml_len: parsedResultNoEnquiry.raw_xml.length,
      has_company_json: Boolean(parsedResultNoEnquiry.company_json),
    });
    return parsedResultNoEnquiry;
  }

  const summary = (enquiry.section_summary as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const sectionA = (enquiry.section_a as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const sectionDNode = (enquiry.section_d as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const sectionD2Node = (enquiry.section_d2 as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  const sectionD4Node = (enquiry.section_d4 as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;

  const accountsNode = safeGet(sectionA, ["record", 0, "accounts", 0]) as Record<string, unknown> | undefined;
  const accountsList = Array.isArray(accountsNode?.account)
    ? (accountsNode.account as unknown[])
    : accountsNode?.account
      ? [accountsNode.account]
      : [];

  const ccris = (enquiry.section_ccris as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;

  const companyNode = (safeGet(sectionA, ["record", 0]) ??
    safeGet(sectionA, ["company", 0]) ??
    safeGet(sectionA, ["person", 0])) as Record<string, unknown> | undefined;

  const address = {
    full:
      xmlText(safeGet(companyNode, ["addr", 0, "_"])) ??
      xmlText(safeGet(companyNode, ["addr", 0])) ??
      xmlText(safeGet(companyNode, ["addr1", 0, "_"])) ??
      xmlText(safeGet(companyNode, ["addr1", 0])),
    line1: xmlText(safeGet(companyNode, ["addr_breakdown", 0, "addr1", 0])),
    line2: xmlText(safeGet(companyNode, ["addr_breakdown", 0, "addr2", 0])),
    city: xmlText(safeGet(companyNode, ["addr_breakdown", 0, "city", 0])),
    state: xmlText(safeGet(companyNode, ["addr_breakdown", 0, "state", 0])),
    postcode: xmlText(safeGet(companyNode, ["addr_breakdown", 0, "postcode", 0])),
  };

  const directorsRaw = safeGet(companyNode, ["directors", 0, "director"]) || [];
  const directorsArr = Array.isArray(directorsRaw) ? directorsRaw : directorsRaw ? [directorsRaw] : [];

  const directors = directorsArr.map((d: unknown) => {
    const x = d as Record<string, unknown>;
    return {
      name: xmlText(safeGet(x, ["name", 0])),
      alias: xmlText(safeGet(x, ["alias", 0])),
      ic_lcno: xmlText(safeGet(x, ["ic_lcno", 0])),
      nic_brno: xmlText(safeGet(x, ["nic_brno", 0])),
      /** ENQWS-style codes: DO, SO, DS, AD, AS (see admin CTOS cross-check mapping). */
      position: xmlText(safeGet(x, ["position", 0])),
      addr: xmlText(safeGet(x, ["addr", 0])),
      appoint: xmlText(safeGet(x, ["appoint", 0])),
      resign_date: xmlText(safeGet(x, ["resign_date", 0])),
      equity: toNumber(safeGet(x, ["equity", 0])),
      equity_percentage: toNumber(safeGet(x, ["equity_percentage", 0])),
      remark: xmlText(safeGet(x, ["remark", 0])),
      party_type: xmlText(safeGet(x, ["party_type", 0])),
    };
  });

  const msic_ssms = parseMsicRows(companyNode);
  const partners = parsePartners(companyNode);

  const seenYears = new Set<number>();
  const accountsForFinancials: unknown[] = [];
  for (const acc of accountsList) {
    const a = acc as Record<string, unknown>;
    const plddRaw = safeGet(a, ["pldd", 0]);
    const plddStr = plddRaw != null ? String(plddRaw) : null;
    const year = parseYearFromPldd(plddStr);
    if (year === null) continue;
    if (seenYears.has(year)) continue;
    seenYears.add(year);
    accountsForFinancials.push(acc);
  }

  const financialsArray: CtosFinancialYearRow[] = isIndividual
    ? []
    : accountsForFinancials
        .map((accounts: unknown) => {
          const acc = accounts as Record<string, unknown>;
          const pldd = xmlText(safeGet(acc, ["pldd", 0]));
          const bsdd = xmlText(safeGet(acc, ["bsdd", 0]));
          const plddCalYear = parseYearFromPldd(pldd);
          const financialYear =
            plddCalYear != null && Number.isFinite(plddCalYear) ? plddCalYear : null;
          return {
            financial_year: financialYear,
            dates: { pldd, bsdd },
            account: buildAccountCodenames(acc),
          };
        })
        .filter((row) => row.financial_year !== null);

  const totalLimit = toNumber(
    safeGet(ccris, ["summary", 0, "liabilities", 0, "borrower", 0, "$", "total_limit"])
  );
  const totalOutstanding = toNumber(safeGet(ccris, ["summary", 0, "liabilities", 0, "borrower", 0, "_"]));

  const legalCases = [
    ...flattenSectionRecords(sectionDNode).map((r) => mapLegalRecord(r, "d")),
    ...flattenSectionRecords(sectionD2Node).map((r) => mapLegalRecord(r, "d2")),
    ...flattenSectionRecords(sectionD4Node).map((r) => mapLegalRecord(r, "d4")),
  ];

  const dcheqRaw = safeGet(summary, ["dcheqs", 0, "$", "entity"]);
  const dcheqFlag = toNumber(dcheqRaw);

  const summarySlice = buildSummaryJsonSlice(summary, enqSum0, dcheqFlag);

  const finalEnquiryError = pickEnquiryError(headerStatus, enqSumStatus, true);

  // ===============================
  // SECTION: CTOS DEBUG LOG
  // WHY: Track CTOS flow step-by-step (prod vs local issue)
  // INPUT: request / response / token
  // OUTPUT: console logs only
  // WHERE USED: CTOS integration flow
  // ===============================
  const parsedResultFull = {
    raw_xml: xmlStr,
    summary_json: {
      ...summarySlice,
      enquiry_error: finalEnquiryError,
    },
    person_json: isIndividual
      ? {
          name: xmlText(safeGet(companyNode, ["name", 0, "_"])) ?? xmlText(safeGet(companyNode, ["name", 0])),
          nic_brno: xmlText(safeGet(companyNode, ["nic_brno", 0])),
          ic_lcno: xmlText(safeGet(companyNode, ["ic_lcno", 0])),
          nationality: xmlText(safeGet(companyNode, ["nationality", 0])),
          birth_date: xmlText(safeGet(companyNode, ["birth_date", 0])),
          addr:
            xmlText(safeGet(companyNode, ["addr", 0, "_"])) ??
            xmlText(safeGet(companyNode, ["addr", 0])) ??
            xmlText(safeGet(companyNode, ["addr1", 0, "_"])) ??
            xmlText(safeGet(companyNode, ["addr1", 0])),
        }
      : null,
    company_json: isIndividual
      ? null
      : {
          ptype,
          pcode,
          name: xmlText(safeGet(companyNode, ["name", 0, "_"])) ?? xmlText(safeGet(companyNode, ["name", 0])),
          brn_ssm: xmlText(safeGet(companyNode, ["brn_ssm", 0])),
          ic_lcno: xmlText(safeGet(companyNode, ["ic_lcno", 0])),
          nic_brno: xmlText(safeGet(companyNode, ["nic_brno", 0])),
          additional_registration_no: xmlText(safeGet(companyNode, ["additional_registration_no", 0])),
          status: xmlText(safeGet(companyNode, ["status", 0])),
          type_of_business: xmlText(safeGet(companyNode, ["type_of_business", 0])),
          comp_type:
            xmlText(safeGet(companyNode, ["comp_type", 0, "_"])) ??
            xmlText(safeGet(companyNode, ["comp_type", 0])),
          comp_category:
            xmlText(safeGet(companyNode, ["comp_category", 0, "_"])) ??
            xmlText(safeGet(companyNode, ["comp_category", 0])),
          address,
          msic_ssms,
          partners,
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
  console.log("CTOS PARSED RESULT:", parsedResultFull);
  {
    const pe = parsedResultFull as unknown as Record<string, unknown>;
    if (pe.entities) {
      console.log("CTOS MULTIPLE ENTITIES DETECTED:", pe.entities);
    }
  }
  if (directors.length > 1) {
    console.log("CTOS MULTIPLE ENTITIES DETECTED (directors count):", directors.length);
  }
  console.log("CTOS FINAL OUTPUT TO UI (parser, full):", {
    person_json: parsedResultFull.person_json != null,
    company_name:
      !isIndividual && parsedResultFull.company_json
        ? (parsedResultFull.company_json as { name?: unknown }).name
        : null,
    financials_json_count: parsedResultFull.financials_json.length,
  });
  return parsedResultFull;
}
