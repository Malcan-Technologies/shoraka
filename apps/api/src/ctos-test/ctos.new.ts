/**
 * Standalone CTOS test harness: XML → JSON for local verification only.
 * Extract/coerce only; no scoring. One derived field: calendar year from pldd only;
 * dedupe by that year (first <account> kept). Financial account uses CTOS tag allowlist only.
 * Omitted by policy — not stored: tabledt, gear, bsqmint, plminin.
 */

import fs from "fs";
import axios from "axios";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { parseStringPromise } from "xml2js";

/**21 numeric CTOS <account> tags (plus pldd/bsdd in dates; financial_year = pldd calendar year minus 1). */
const ACCOUNT_NUMERIC_CODENAMES = [
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "totass",
  "curlib",
  "bsslltd",
  "bsclstd",
  "totlib",
  "bsqpuc",
  "turnover",
  "plnpbt",
  "plnpat",
  "plnetdiv",
  "plyear",
  "networth",
  "turnover_growth",
  "profit_margin",
  "return_on_equity",
  "currat",
  "workcap",
] as const;

const DEFAULT_BUSINESS_OWNER = {
  ownerNic: "720330027845",
  ownerName: "HAFIY HAMDAN",
};

/**
 * Harness-only: what to print. Edit `mode` when debugging.
 * - multiple_entities_only — only rows where enq_sum status is 2; full multi-entity dump (incl. raw XML).
 * - all — every test row: case line, final raw_xml, parsed JSON (raw_xml omitted in JSON); if multi, extra multi-entity block + first_pass raw.
 * - all_no_raw_xml — every row: case line, parsed JSON (no raw_xml); if multi, metadata only (no XML strings).
 * - raw_xml_final_only — every row: one case line + final raw_xml only.
 * - silent — no per-row logs; one line summary at end.
 */
type HarnessLogMode =
  | "multiple_entities_only"
  | "all"
  | "all_no_raw_xml"
  | "raw_xml_final_only"
  | "silent";

const HARNESS_LOG: { mode: HarnessLogMode } = {
  mode: "all",
};

function stringifyParsedOmitRawXml(parsed: Awaited<ReturnType<typeof parseCtosReportXmlLocal>>): string {
  return JSON.stringify(parsed, (k, v) => (k === "raw_xml" ? undefined : v), 2);
}

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

function parseYearFromPldd(pldd: string | null): number | null {
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

function buildAccountCodenames(acc: Record<string, unknown>): Record<string, number | null> {
  const account: Record<string, number | null> = {};
  for (const key of ACCOUNT_NUMERIC_CODENAMES) {
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function oneRecordBlock(
  typeCode: string,
  typeVal: string,
  icLc: string,
  nicBr: string,
  name: string,
  refNo: string,
  confirmEntity?: string | null
) {
  const confirmLine =
    confirmEntity != null && confirmEntity !== ""
      ? `\n    <confirm_entity>${escapeXml(confirmEntity)}</confirm_entity>`
      : "";
  return `
  <records>
    <type code="${typeCode}">${typeVal}</type>
    <ic_lc>${icLc}</ic_lc>
    <nic_br>${nicBr}</nic_br>
    <name>${name}</name>
    <ref_no>${refNo}</ref_no>
    <include_ctos>1</include_ctos>
    <include_ccris>1</include_ccris>
    <include_fico>1</include_fico>${confirmLine}
  </records>`;
}

async function parseCtosReportXmlLocal(xmlStr: string) {
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
    return {
      raw_xml: xmlStr,
      summary_json: {
        ...summarySlice,
        enquiry_error: pickEnquiryError(headerStatus, enqSumStatus, false),
      },
      person_json:
        isIndividual
          ? {
              name: nameFromSum,
              nic_brno: nicBrFromSum,
              ic_lcno: icLcFromSum,
              nationality: null,
              birth_date: null,
              addr: null,
            }
          : null,
      company_json:
        !isIndividual
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

  const financialsArray = isIndividual
    ? []
    : accountsForFinancials
        .map((accounts: unknown) => {
          const acc = accounts as Record<string, unknown>;
          const pldd = xmlText(safeGet(acc, ["pldd", 0]));
          const bsdd = xmlText(safeGet(acc, ["bsdd", 0]));
          const plddCalYear = parseYearFromPldd(pldd);
          const financialYear =
            plddCalYear != null && Number.isFinite(plddCalYear) ? plddCalYear - 1 : null;
          if (financialYear != null) {
            console.log("CTOS pldd calendar year:", plddCalYear, "financial_year:", financialYear);
          }
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

  return {
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
}

type TestRow =
  | { kind: "company"; name: string; reg: string }
  | { kind: "business"; name: string; reg: string; ownerNic?: string; ownerName?: string }
  | { kind: "individual"; name: string; nic: string };

const CONFIG = {
  clientId: "Shor_jwt",
  username: "shor_uat",
  password: "sMV524D_~49237(Sh",
  tokenUrl: "https://uat-sso.ctos.com.my/auth/realms/CTOSNET/protocol/openid-connect/token",
  soapUrl: "https://uat-integration.ctos.com.my/ctos_secure/Proxy",
  privateKeyPath: "./rsa-private.cer",
  companyCode: "SHORUAT",
  accountNo: "SHORUAT",
  userId: "shor_uat",
};

/**
 * Business rows: CTOS requires a second record (11/I owner). Optional ownerNic/ownerName per row;
 * otherwise DEFAULT_BUSINESS_OWNER (UAT placeholder — replace with real owner per entity when known).
 */
const TEST_CASES: TestRow[] = [
  // ===================== PRIORITY TEST CASES =====================
  { kind: "company", name: "9 HEARTS SDN BHD", reg: "202002117123" },
  { kind: "company", name: "COTC SDN BHD", reg: "202002117124" },
  { kind: "company", name: "KINGSLAND SDN BHD", reg: "202002117125" },
  { kind: "company", name: "STRAWBERRY PINK SDN BHD", reg: "199701999962" },
  { kind: "company", name: "PITAYA PIN K SDN BHD", reg: "199701090962" },
  { kind: "company", name: "GOLD SDN BHD", reg: "202002117127" },
  { kind: "company", name: "SILVER SDN BHD", reg: "202002117126" },

  { kind: "individual", name: "KHANIP", nic: "820508105871" },
  { kind: "business", name: "LITI INTER P", reg: "911109090103" },

  // ===================== OLD TEST CASES (TEMP DISABLED) =====================
  /*
  { kind: "company", name: "REDIAL ONE SDN BHD", reg: "200501525124" },
  { kind: "company", name: "GINSENGA CHICKEN RESTAURANTSA SDN BHD", reg: "200001020876" },
  { kind: "company", name: "SHINING SDN BHD", reg: "198501006938" },
  { kind: "company", name: "Harry SDN BHD", reg: "198601005678" },
  { kind: "company", name: "BrightNova Solutions Sdn. Bhd.", reg: "202501234567" },
  { kind: "company", name: "Vertex Quantum Technologies Sdn. Bhd.", reg: "202501998877" },
  { kind: "company", name: "Orion Crest Holdings Sdn. Bhd.", reg: "202001556432" },
  { kind: "company", name: "QuantumEdge Solutions Sdn. Bhd.", reg: "202501447890" },
  { kind: "company", name: "ApexStar Holdings Sdn. Bhd.", reg: "202001223344" },
  { kind: "company", name: "AeroNova Solutions Sdn. Bhd.", reg: "202501889900" },
  { kind: "company", name: "THE FOURSQUARE GOSPEL CHURCH BHD.", reg: "198401018032" },
  { kind: "company", name: "INTRALIGHT SDN BHD", reg: "201301000165" },
  { kind: "company", name: "SIEW HUI CONSTRUCTION BERHAD", reg: "198401005456" },
  { kind: "company", name: "LUFFY'S CONSTRUCTION BERHAD", reg: "198401005123" },
  { kind: "company", name: "ZORO'S CONSTRUCTION BERHAD", reg: "198401005124" },
  { kind: "company", name: "ELEGANT RAY RAY (M) SDN. BHD.", reg: "199001010123" },

  { kind: "business", name: "BLANC ENTERPRISE", reg: "190003594012" },
  { kind: "business", name: "DAHLIA RIZAL ENTERPRISE", reg: "190203155179" },
  { kind: "business", name: "ALPHA MAJU ENTERPRISE", reg: "190403983543" },
  { kind: "business", name: "JAMES BOND ENTERPRISE", reg: "192403950452" },
  { kind: "business", name: "CASHMIRA ENTERPRISE", reg: "192803228303" },
  { kind: "business", name: "BATISTE ENTERPRISE", reg: "193003261657" },
  { kind: "business", name: "BINTANG MAJU SERVICES", reg: "190003274306" },

  { kind: "individual", name: "SITI NORHALIZA BINTI ABDUL RAHMAD", nic: "881108085746" },
  { kind: "individual", name: "LEE CHOONG WEI", nic: "780120085849" },
  { kind: "individual", name: "HAFIY HAMDAN", nic: "720330027845" },
  { kind: "individual", name: "CHEW MEI QI", nic: "741214265249" },
  { kind: "individual", name: "NG KEAT HAW", nic: "810324145789" },
  { kind: "individual", name: "Jonathan Chan", nic: "820106017731" },
  { kind: "individual", name: "WONG JIA XIN", nic: "661007322268" },
  { kind: "individual", name: "TAN CHONG MIN", nic: "750706081234" },
  { kind: "individual", name: "Wan Mohd Najib Azahari", nic: "771015087483" },
  { kind: "individual", name: "VIGNESH RAJ", nic: "800706217043" },
  { kind: "individual", name: "KIRAN CHANDRASEKAR", nic: "870227082659" },
  { kind: "individual", name: "Siti Hajar Binti Mohd Zain", nic: "870515051120" },
  */
];

function generateJWT() {
  const key = fs.readFileSync(CONFIG.privateKeyPath);
  return jwt.sign(
    {
      jti: uuidv4(),
      sub: CONFIG.clientId,
      iss: CONFIG.clientId,
      aud: CONFIG.tokenUrl,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    },
    key,
    { algorithm: "RS256" }
  );
}

async function getToken() {
  const res = await axios.post(
    CONFIG.tokenUrl,
    new URLSearchParams({
      grant_type: "password",
      client_id: CONFIG.clientId,
      username: CONFIG.username,
      password: CONFIG.password,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: generateJWT(),
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data.access_token;
}

const wrapSoap = (inner: string) => `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.proxy.xml.ctos.com.my/">
  <soapenv:Body>
    <ws:request>
      <input>${inner.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</input>
    </ws:request>
  </soapenv:Body>
</soapenv:Envelope>
`;

const wrapSoapRequestConfirm = (inner: string) => `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.proxy.xml.ctos.com.my/">
  <soapenv:Body>
    <ws:requestConfirm>
      <input>${inner.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</input>
    </ws:requestConfirm>
  </soapenv:Body>
</soapenv:Envelope>
`;

type EntityCandidateHarness = {
  key: string | null;
  status: string | null;
  code: string | null;
  ent_name: string | null;
  id_no1: string | null;
  id_no2: string | null;
};

type MultipleEntitiesHarnessInfo = {
  firstPassXml: string;
  enqSumStatusCode: string | null;
  enqSumStatusMessage: string | null;
  entityCandidates: EntityCandidateHarness[];
  pickedEntityKey: string | null;
  didRequestConfirm: boolean;
};

async function parseEnqSumStatusAndEntityCandidates(xmlStr: string): Promise<{
  enqSumStatusCode: string | null;
  enqSumStatusMessage: string | null;
  entityCandidates: EntityCandidateHarness[];
}> {
  const parsed = await parseStringPromise(xmlStr, { explicitArray: true });
  const report0 = (parsed as { report?: { enq_report?: unknown[] } })?.report?.enq_report?.[0] as
    | { summary?: unknown[]; entities?: unknown[] }
    | undefined;
  const sumTop = report0?.summary?.[0] as { enq_sum?: unknown[] } | undefined;
  const enqSum0 = sumTop?.enq_sum?.[0] as Record<string, unknown> | undefined;
  const enqSumStatus = firstArrayEl(enqSum0?.enq_status);
  const sumMeta = enqStatusMeta(enqSumStatus);

  const entityCandidates: EntityCandidateHarness[] = [];
  const entitiesTop = report0?.entities?.[0] as Record<string, unknown> | undefined;
  const subjectsRaw = entitiesTop?.subject;
  const subjects = Array.isArray(subjectsRaw) ? subjectsRaw : subjectsRaw ? [subjectsRaw] : [];
  for (const subj of subjects) {
    const s = subj as Record<string, unknown>;
    const entRaw = s.entity;
    const ents = Array.isArray(entRaw) ? entRaw : entRaw ? [entRaw] : [];
    for (const e of ents) {
      const x = e as Record<string, unknown>;
      const attrs = x.$ as { key?: string; status?: string; code?: string } | undefined;
      entityCandidates.push({
        key: attrs?.key != null && String(attrs.key).trim() !== "" ? String(attrs.key).trim() : null,
        status: attrs?.status ?? null,
        code: attrs?.code ?? null,
        ent_name: xmlText(safeGet(x, ["ent_name", 0])),
        id_no1: xmlText(safeGet(x, ["id_no1", 0])),
        id_no2: xmlText(safeGet(x, ["id_no2", 0])),
      });
    }
  }
  return {
    enqSumStatusCode: sumMeta.code,
    enqSumStatusMessage: sumMeta.message,
    entityCandidates,
  };
}

async function fetchReportXmlWithAutoEntityConfirm(test: TestRow): Promise<{
  finalXml: string;
  multipleEntities: MultipleEntitiesHarnessInfo | null;
}> {
  const inner1 = buildXML(test);
  let reportXml = await callCTOS(wrapSoap(inner1));
  const detail = await parseEnqSumStatusAndEntityCandidates(reportXml);
  const entityKeys = detail.entityCandidates.map((c) => c.key).filter((k): k is string => k != null);

  if (detail.enqSumStatusCode !== "2") {
    return { finalXml: reportXml, multipleEntities: null };
  }

  const baseMulti = (): MultipleEntitiesHarnessInfo => ({
    firstPassXml: reportXml,
    enqSumStatusCode: detail.enqSumStatusCode,
    enqSumStatusMessage: detail.enqSumStatusMessage,
    entityCandidates: detail.entityCandidates,
    pickedEntityKey: null,
    didRequestConfirm: false,
  });

  if (entityKeys.length === 0) {
    return { finalXml: reportXml, multipleEntities: baseMulti() };
  }

  const picked = entityKeys[0];
  const firstPassXml = reportXml;
  const inner2 = buildXML(test, picked);
  reportXml = await callCTOS(wrapSoapRequestConfirm(inner2));
  return {
    finalXml: reportXml,
    multipleEntities: {
      firstPassXml,
      enqSumStatusCode: detail.enqSumStatusCode,
      enqSumStatusMessage: detail.enqSumStatusMessage,
      entityCandidates: detail.entityCandidates,
      pickedEntityKey: picked,
      didRequestConfirm: true,
    },
  };
}

async function callCTOS(xml: string) {
  const token = await getToken();
  const res = await axios.post(CONFIG.soapUrl, xml, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/xml",
    },
  });
  const match = res.data.match(/<return>([\s\S]*?)<\/return>/);
  if (!match?.[1]) throw new Error("Invalid CTOS response");
  return Buffer.from(match[1], "base64").toString("utf-8");
}

function buildXML(test: TestRow, confirmEntityKey?: string | null) {
  const confirm = confirmEntityKey ?? null;
  if (test.kind === "business") {
    const ownerNic = test.ownerNic ?? DEFAULT_BUSINESS_OWNER.ownerNic;
    const ownerName = test.ownerName ?? DEFAULT_BUSINESS_OWNER.ownerName;
    const bizName = escapeXml(test.name);
    const bizReg = escapeXml(test.reg);
    const oNic = escapeXml(ownerNic);
    const oName = escapeXml(ownerName);
    return `
<batch no="REQ" output="0" xmlns="http://ws.cmctos.com.my/ctosnet/request">
  <company_code>${CONFIG.companyCode}</company_code>
  <account_no>${CONFIG.accountNo}</account_no>
  <user_id>${CONFIG.userId}</user_id>
  <record_total>2</record_total>${oneRecordBlock("21", "B", "", bizReg, bizName, bizReg, confirm)}${oneRecordBlock("11", "I", "", oNic, oName, oNic, null)}
</batch>
`;
  }

  let typeCode = "";
  let typeVal = "";
  let ic = "";
  let reg = "";
  if (test.kind === "individual") {
    typeCode = "11";
    typeVal = "I";
    reg = escapeXml(test.nic);
  } else {
    typeCode = "24";
    typeVal = "C";
    ic = escapeXml(test.reg);
  }
  const name = escapeXml(test.name);
  const refNo = test.kind === "individual" ? reg : ic;
  return `
<batch no="REQ" output="0" xmlns="http://ws.cmctos.com.my/ctosnet/request">
  <company_code>${CONFIG.companyCode}</company_code>
  <account_no>${CONFIG.accountNo}</account_no>
  <user_id>${CONFIG.userId}</user_id>
  <record_total>1</record_total>${oneRecordBlock(typeCode, typeVal, ic, reg, name, refNo, confirm)}
</batch>
`;
}

type FetchOut = Awaited<ReturnType<typeof fetchReportXmlWithAutoEntityConfirm>>;

function logMultipleEntitiesFull(t: TestRow, out: FetchOut, opts?: { logFinalRawXml?: boolean }) {
  const logFinal = opts?.logFinalRawXml !== false;
  const regOrNic = t.kind === "individual" ? t.nic : t.reg;
  const m = out.multipleEntities;
  if (!m) return;
  console.log("\n========== CTOS harness: MULTIPLE ENTITIES (enq_sum status 2) ==========");
  console.log("Case:", t.kind, "|", t.name, "| regOrNic:", regOrNic);
  console.log(
    "How it works: CTOS returns status 2 + <entities> with candidate <entity key=\"...\"> rows. This harness picks the first key and calls SOAP requestConfirm with <confirm_entity> on the business/sole record (see buildXML)."
  );
  console.log("enq_sum:", m.enqSumStatusCode, "|", m.enqSumStatusMessage ?? "");
  console.log("didRequestConfirm:", m.didRequestConfirm);
  console.log("pickedEntityKey:", m.pickedEntityKey);
  console.log("entityCandidates:", JSON.stringify(m.entityCandidates, null, 2));
  console.log("--- first_pass raw_xml (before requestConfirm) ---");
  console.log(m.firstPassXml);
  if (logFinal) {
    console.log("--- final raw_xml (after requestConfirm if keys existed) ---");
    console.log(out.finalXml);
  }
}

function logMultipleEntitiesMetaOnly(t: TestRow, out: FetchOut) {
  const regOrNic = t.kind === "individual" ? t.nic : t.reg;
  const m = out.multipleEntities;
  if (!m) return;
  console.log("CTOS harness: multiple_entities (no raw XML):", {
    case: { kind: t.kind, name: t.name, regOrNic },
    enqSumStatusCode: m.enqSumStatusCode,
    enqSumStatusMessage: m.enqSumStatusMessage,
    didRequestConfirm: m.didRequestConfirm,
    pickedEntityKey: m.pickedEntityKey,
    entityCandidates: m.entityCandidates,
  });
}

async function run() {
  const mode = HARNESS_LOG.mode;
  let multipleEntitiesCount = 0;

  for (const t of TEST_CASES) {
    const out = await fetchReportXmlWithAutoEntityConfirm(t);
    if (out.multipleEntities) multipleEntitiesCount += 1;

    const regOrNic = t.kind === "individual" ? t.nic : t.reg;
    if (mode === "silent") {
      continue;
    }

    const parsed = await parseCtosReportXmlLocal(out.finalXml);

    if (mode === "raw_xml_final_only") {
      console.log("CTOS harness: case:", t.kind, "|", t.name, "| regOrNic:", regOrNic);
      console.log("CTOS harness: raw_xml (final):", out.finalXml);
      continue;
    }

    if (mode === "multiple_entities_only") {
      if (!out.multipleEntities) continue;
      logMultipleEntitiesFull(t, out);
      console.log("--- parsed JSON (raw_xml omitted) ---");
      console.log(stringifyParsedOmitRawXml(parsed));
      console.log("========== END MULTIPLE ENTITIES ==========\n");
      continue;
    }

    if (mode === "all_no_raw_xml") {
      console.log("CTOS harness: case:", t.kind, "|", t.name, "| regOrNic:", regOrNic);
      if (out.multipleEntities) logMultipleEntitiesMetaOnly(t, out);
      console.log("CTOS harness: parsed JSON (raw_xml omitted):");
      console.log(stringifyParsedOmitRawXml(parsed));
      continue;
    }

    if (mode === "all") {
      console.log("\n---------- CTOS harness: case ----------");
      console.log(t.kind, "|", t.name, "| regOrNic:", regOrNic);
      console.log("--- raw_xml (final) ---");
      console.log(out.finalXml);
      if (out.multipleEntities) {
        logMultipleEntitiesFull(t, out, { logFinalRawXml: false });
      }
      console.log("--- parsed JSON (raw_xml omitted in JSON; see raw above) ---");
      console.log(stringifyParsedOmitRawXml(parsed));
      console.log("---------- end case ----------\n");
    }
  }

  if (mode === "silent") {
    console.log("CTOS harness: finished.", TEST_CASES.length, "rows (silent mode)");
    return;
  }

  console.log(
    "CTOS harness: finished. Rows with multiple entities (status 2):",
    multipleEntitiesCount,
    "of",
    TEST_CASES.length,
    "| log mode:",
    mode
  );
}

run();
