/**
 * =========================================================
 * CTOS DATA PARSER — DESIGN RULES & SCORING NOTES
 * =========================================================
 *
 * 🧠 CORE PRINCIPLE
 * This file ONLY parses and stores RAW CTOS data.
 * It MUST NOT contain business logic, scoring rules, or assumptions.
 *
 * Database = Source of truth (what CTOS actually returns)
 * Service layer = where all calculations and SoukScore logic happen
 *
 * ---------------------------------------------------------
 * ⚠️ IMPORTANT EDGE CASES (FOR SCORING LAYER, NOT HERE)
 * ---------------------------------------------------------
 *
 * 1. DISHONOURED CHEQUES (DCHEQ)
 * ---------------------------------------------------------
 * SoukScore requires:
 *   "Dishonored cheques (last 3 months)"
 *
 * CTOS provides:
 *   <dcheqs entity="X"/>  → total historical flag only (0/1)
 *
 * Limitation:
 *   - No timestamp
 *   - Cannot determine "last 3 months"
 *
 * Rule:
 *   - Store raw flag only
 *   - DO NOT infer recency
 *
 * Future scoring layer should:
 *   - Treat as "has cheque history"
 *   - Or enhance with external/bank data if available
 *
 * ---------------------------------------------------------
 * 2. MATERIAL LITIGATION (>10% OF NET ASSETS)
 * ---------------------------------------------------------
 * SoukScore requires:
 *   "Active material litigation (>10% of net assets)"
 *
 * Parser stores:
 *   - total legal amount
 *   - total assets
 *   - total liabilities
 *
 * Derived in scoring layer:
 *
 *   net_assets = total_assets - total_liabilities
 *   is_material =
 *     total_legal_amount / net_assets > 0.1
 *
 * DO NOT compute this inside parser.
 *
 * ---------------------------------------------------------
 * 3. CCRIS UTILISATION
 * ---------------------------------------------------------
 * SoukScore uses:
 *   utilisation = outstanding / approved_limit
 *
 * Parser stores:
 *   - total_outstanding
 *   - total_limit
 *
 * Scoring rule:
 *   if total_limit === 0 → utilisation = 0 (low risk)
 *
 * ---------------------------------------------------------
 * 4. FICO SCORE DEFAULT
 * ---------------------------------------------------------
 * SoukScore rule:
 *   "No Score = 60"
 *
 * Parser:
 *   - stores fico_score as null if missing
 *
 * Scoring layer:
 *   - substitute null → 60
 *
 * ---------------------------------------------------------
 * 5. FINANCIAL DATA AVAILABILITY
 * ---------------------------------------------------------
 * If <accounts> section is missing:
 *
 * Parser:
 *   - returns empty financials_json
 *
 * Scoring layer:
 *   - must treat as higher risk / incomplete data
 *
 * ---------------------------------------------------------
 * 6. METRICS & RATIOS (MOVED TO SERVICE LAYER)
 * ---------------------------------------------------------
 * The following MUST be calculated in service layer (NOT here):
 *
 *   - net_worth (total_assets - total_liabilities)
 *   - turnover_growth (requires cross-year comparison)
 *   - debt_ratio
 *   - gearing
 *   - asset_turnover
 *   - DSCR (not available from CTOS)
 *   - interest coverage (not available from CTOS)
 *   - any scoring / thresholds / grading
 *
 * ---------------------------------------------------------
 * 🚫 DO NOT ADD INTO THIS FILE
 * ---------------------------------------------------------
 * - Paymaster logic
 * - Invoice risk logic
 * - Behaviour scoring
 * - DSCR / interest coverage
 * - Any threshold-based classification
 * - Any cross-year calculations
 *
 * ---------------------------------------------------------
 * ✅ RESPONSIBILITY SPLIT
 * ---------------------------------------------------------
 *
 * Parser (this file):
 *   - Extract CTOS XML → JSON
 *   - Ensure null safety
 *   - Preserve raw data exactly
 *
 * Service Layer:
 *   - Compute ALL metrics (including net_worth)
 *   - Apply SoukScore rules
 *   - Perform cross-year calculations
 *
 * Frontend:
 *   - Display values
 *   - Show warnings / labels
 *
 * =========================================================
 */

import fs from "fs"
import axios from "axios"
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"
import { parseStringPromise } from "xml2js"

/**
 * SECTION: CTOS XML → JSON (duplicate of apps/api/src/modules/ctos/parser.ts)
 * WHY: Standalone test harness — no imports from ../modules or workspace packages.
 * INPUT: raw XML string from CTOS
 * OUTPUT: same shape as production parseCtosReportXml
 * WHERE USED: run() below only
 */
function safeGet(obj: unknown, path: (string | number)[]): unknown {

  try {

    const val = path.reduce(
      (o, k) => (o as Record<string, unknown>)?.[k as string],
      obj
    )
    return val === undefined || val === "" ? null : val

  } catch {

    return null

  }

}

function toNumber(v: unknown): number | null {

  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n

}

function toBoolean(v: unknown): boolean | null {

  if (v === null || v === undefined || v === "") return null
  if (v === "1" || v === 1) return true
  if (v === "0" || v === 0) return false
  return null

}

function parseReportingYearFromCtosDates(
  financialYearEnd: string | null,
  balanceSheetDate: string | null
): number | null {

  for (const raw of [financialYearEnd, balanceSheetDate]) {

    if (!raw || typeof raw !== "string") continue
    const s = raw.trim()
    const iso = s.match(/^(\d{4})-\d{2}-\d{2}$/)
    if (iso) {

      const y = Number(iso[1])
      if (y >= 1900 && y <= 2100) return y

    }
    const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (dmy) {

      const y = Number(dmy[3])
      if (y >= 1900 && y <= 2100) return y

    }

  }
  return null

}

async function parseCtosReportXmlLocal(xmlStr: string) {

  const parsed = await parseStringPromise(xmlStr, { explicitArray: true })
  const report = (parsed as { report?: { enq_report?: unknown[] } })?.report
    ?.enq_report?.[0] as
    | { enquiry?: unknown[]; summary?: unknown[] }
    | undefined
  const enquiry = (report?.enquiry?.[0] ?? {}) as Record<string, unknown>

  const sumTop = report?.summary?.[0] as { enq_sum?: unknown[] } | undefined
  const enqSum0 = sumTop?.enq_sum?.[0] as
    | { $?: { ptype?: string }; fico_index?: unknown[] }
    | undefined
  const isIndividual = enqSum0?.$?.ptype === "I"

  const summary = (enquiry?.section_summary as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined
  const sectionA = (enquiry?.section_a as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined
  const sectionDNode = (enquiry?.section_d as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined
  const sectionD2Node = (enquiry?.section_d2 as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined
  const accountsNode = safeGet(sectionA, ["record", 0, "accounts", 0]) as
    | Record<string, unknown>
    | undefined
  const accountsList = Array.isArray(accountsNode?.account)
    ? (accountsNode.account as unknown[])
    : accountsNode?.account
      ? [accountsNode.account]
      : []

  const ccris = (enquiry?.section_ccris as unknown[] | undefined)?.[0] as
    | Record<string, unknown>
    | undefined

  const companyNode = (safeGet(sectionA, ["record", 0]) ??
    safeGet(sectionA, ["company", 0]) ??
    safeGet(sectionA, ["person", 0])) as Record<string, unknown> | undefined

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
  }

  const directorsRaw = safeGet(companyNode, ["directors", 0, "director"]) || []
  const directorsArr = Array.isArray(directorsRaw)
    ? directorsRaw
    : directorsRaw
      ? [directorsRaw]
      : []

  const directors = directorsArr.map((d: unknown) => {

    const x = d as Record<string, unknown>
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
    }

  })

  const seenYears = new Set<number>()
  const accountsForFinancials: unknown[] = []
  for (const acc of accountsList) {

    const a = acc as Record<string, unknown>
    const plddRaw = safeGet(a, ["pldd", 0])
    const bsddRaw = safeGet(a, ["bsdd", 0])
    const plddStr = plddRaw != null ? String(plddRaw) : null
    const bsddStr = bsddRaw != null ? String(bsddRaw) : null
    const year = parseReportingYearFromCtosDates(plddStr, bsddStr)
    if (year === null) continue
    if (seenYears.has(year)) continue
    seenYears.add(year)
    accountsForFinancials.push(acc)

  }

  const financialsArray = isIndividual
    ? []
    : accountsForFinancials
      .map((accounts: unknown) => {

        const acc = accounts as Record<string, unknown>
        const plddRaw = safeGet(acc, ["pldd", 0])
        const bsddRaw = safeGet(acc, ["bsdd", 0])
        const pldd = plddRaw != null ? String(plddRaw) : null
        const bsdd = bsddRaw != null ? String(bsddRaw) : null
        const reportingYear = parseReportingYearFromCtosDates(pldd, bsdd)

        const plyearAmt = toNumber(safeGet(acc, ["plyear", 0]))

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
        }

      })
      .filter((row) => row.reporting_year !== null)

  const totalLimit = toNumber(
    safeGet(ccris, ["summary", 0, "liabilities", 0, "borrower", 0, "$", "total_limit"])
  )
  const totalOutstanding = toNumber(
    safeGet(ccris, ["summary", 0, "liabilities", 0, "borrower", 0, "_"])
  )

  const recordsD = sectionDNode?.record
  const recordsD2 = sectionD2Node?.record
  const flatD = recordsD == null ? [] : Array.isArray(recordsD) ? recordsD : [recordsD]
  const flatD2 = recordsD2 == null ? [] : Array.isArray(recordsD2) ? recordsD2 : [recordsD2]
  const sectionDRecords = [...flatD, ...flatD2]
  const legalCases = sectionDRecords.map((r: unknown) => {

    const x = r as Record<string, unknown>
    return {
      title: safeGet(x, ["title", 0]),
      case_type:
        x?.$ && typeof x.$ === "object"
          ? (x.$ as { rpttype?: string }).rpttype ?? null
          : null,
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
    }

  })

  const dcheqRaw = safeGet(summary, ["dcheqs", 0, "$", "entity"])
  const dcheqFlag = toNumber(dcheqRaw)

  const ficoIndexNode = enqSum0?.fico_index?.[0] ?? {}
  const ficoObj = ficoIndexNode as { $?: { score?: string }; fico_factor?: unknown[] }
  const ficoScore = toNumber(ficoObj?.$?.score)
  const ficoFactors = (Array.isArray(ficoObj?.fico_factor) ? ficoObj.fico_factor : [])
    .map((f: unknown) => (typeof f === "string" ? f : (f as { _?: string })?._))
    .filter((f): f is string => Boolean(f))

  console.log("Parsed CTOS XML, financial year rows:", financialsArray.length)

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

          const v = safeGet(companyNode, ["name", 0, "_"]) ?? safeGet(companyNode, ["name", 0])
          return v == null ? null : String(v)

        })(),
        ic_no: (() => {

          const v =
            safeGet(companyNode, ["nic_brno", 0]) ?? safeGet(companyNode, ["ic_lcno", 0])
          return v == null ? null : String(v)

        })(),
        nationality: (() => {

          const v = safeGet(companyNode, ["nationality", 0])
          return v == null ? null : String(v)

        })(),
        birth_date: (() => {

          const v = safeGet(companyNode, ["birth_date", 0])
          return v == null ? null : String(v)

        })(),
        address: (() => {

          const v =
            (safeGet(companyNode, ["addr", 0, "_"]) ?? safeGet(companyNode, ["addr", 0])) ||
            (safeGet(companyNode, ["addr1", 0, "_"]) ?? safeGet(companyNode, ["addr1", 0])) ||
            null
          return v == null ? null : String(v)

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
        company_type:
          safeGet(companyNode, ["comp_type", 0, "_"]) ?? safeGet(companyNode, ["comp_type", 0]),
        company_category:
          safeGet(companyNode, ["comp_category", 0, "_"]) ??
          safeGet(companyNode, ["comp_category", 0]),
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
  }

}

/**
 * CONFIG
 */
const CONFIG = {
  clientId: "Shor_jwt",
  username: "shor_uat",
  password: "sMV524D_~49237(Sh",
  tokenUrl:
    "https://uat-sso.ctos.com.my/auth/realms/CTOSNET/protocol/openid-connect/token",
  soapUrl: "https://uat-integration.ctos.com.my/ctos_secure/Proxy",
  privateKeyPath: "./apps/api/src/ctos-test/rsa-private.cer",

  companyCode: "SHORUAT",
  accountNo: "SHORUAT",
  userId: "shor_uat"
}


/**
 * FULL SABRINA TEST CASES
 */
const TEST_CASES = [
  // { kind: "company", name: "REDIAL ONE SDN BHD", reg: "200501525124" },
  // { kind: "company", name: "GINSENGA CHICKEN RESTAURANTSA SDN BHD", reg: "200001020876" },
  // { kind: "company", name: "SHINING SDN BHD", reg: "198501006938" },
  // { kind: "company", name: "Harry SDN BHD", reg: "198601005678" },

  { kind: "company", name: "BrightNova Solutions Sdn. Bhd.", reg: "202501234567" },
  { kind: "company", name: "Vertex Quantum Technologies Sdn. Bhd.", reg: "202501998877" },
  { kind: "company", name: "Orion Crest Holdings Sdn. Bhd.", reg: "202001556432" },
  { kind: "company", name: "QuantumEdge Solutions Sdn. Bhd.", reg: "202501447890" },
  { kind: "company", name: "ApexStar Holdings Sdn. Bhd.", reg: "202001223344" },
  { kind: "company", name: "AeroNova Solutions Sdn. Bhd.", reg: "202501889900" },
  // { kind: "company", name: "THE FOURSQUARE GOSPEL CHURCH BHD.", reg: "198401018032" },
  // { kind: "company", name: "SIEW HUI CONSTRUCTION BERHAD", reg: "198401005456" },
  // { kind: "company", name: "LUFFY'S CONSTRUCTION BERHAD", reg: "198401005123" },
  // { kind: "company", name: "ZORO'S CONSTRUCTION BERHAD", reg: "198401005124" },
  // { kind: "company", name: "ELEGANT RAY RAY (M) SDN. BHD.", reg: "199001010123" },

  // { kind: "business", name: "BLANC ENTERPRISE", reg: "190003594012" },
  // { kind: "business", name: "DAHLIA RIZAL ENTERPRISE", reg: "190203155179" },
  // { kind: "business", name: "ALPHA MAJU ENTERPRISE", reg: "190403983543" },
  // { kind: "business", name: "JAMES BOND ENTERPRISE", reg: "192403950452" },
  // { kind: "business", name: "CASHMIRA ENTERPRISE", reg: "192803228303" },
  // { kind: "business", name: "BATISTE ENTERPRISE", reg: "193003261657" },

  // { kind: "individual", name: "HAFIY HAMDAN", nic: "720330027845" },
  // { kind: "individual", name: "CHEW MEI QI", nic: "741214265249" },
  // { kind: "individual", name: "NG KEAT HAW", nic: "810324145789" },
  // { kind: "individual", name: "Jonathan Chan", nic: "820106017731" },
  // { kind: "individual", name: "WONG JIA XIN", nic: "661007322268" },
  // { kind: "individual", name: "TAN CHONG MIN", nic: "750706081234" },
  // { kind: "individual", name: "Wan Mohd Najib Azahari", nic: "771015087483" },
  // { kind: "individual", name: "VIGNESH RAJ", nic: "800706217043" },
  // { kind: "individual", name: "KIRAN CHANDRASEKAR", nic: "870227082659" },
  // { kind: "individual", name: "Siti Hajar Binti Mohd Zain", nic: "870515051120" }
]

/**
 * AUTH
 */
function generateJWT() {
  const key = fs.readFileSync(CONFIG.privateKeyPath)

  return jwt.sign(
    {
      jti: uuidv4(),
      sub: CONFIG.clientId,
      iss: CONFIG.clientId,
      aud: CONFIG.tokenUrl,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300
    },
    key,
    { algorithm: "RS256" }
  )
}

async function getToken() {
  const res = await axios.post(
    CONFIG.tokenUrl,
    new URLSearchParams({
      grant_type: "password",
      client_id: CONFIG.clientId,
      username: CONFIG.username,
      password: CONFIG.password,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: generateJWT()
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  )

  return res.data.access_token
}

/**
 * SOAP
 */
const wrapSoap = (inner: string) => `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.proxy.xml.ctos.com.my/">
  <soapenv:Body>
    <ws:request>
      <input>${inner.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</input>
    </ws:request>
  </soapenv:Body>
</soapenv:Envelope>
`

async function callCTOS(xml: string) {
  const token = await getToken()

  const res = await axios.post(CONFIG.soapUrl, xml, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/xml"
    }
  })

  const match = res.data.match(/<return>([\s\S]*?)<\/return>/)
  if (!match?.[1]) throw new Error("Invalid CTOS response")

  return Buffer.from(match[1], "base64").toString("utf-8")
}

/**
 * REQUEST
 */
function buildXML(test: any) {
  let typeCode = ""
  let typeVal = ""
  let ic = ""
  let reg = ""

  if (test.kind === "individual") {
    typeCode = "11"
    typeVal = "I"
    reg = test.nic
  } else if (test.kind === "business") {
    typeCode = "21"
    typeVal = "B"
    reg = test.reg
  } else {
    typeCode = "24"
    typeVal = "C"
    ic = test.reg
  }

  return `
<batch no="REQ" output="0" xmlns="http://ws.cmctos.com.my/ctosnet/request">
  <company_code>${CONFIG.companyCode}</company_code>
  <account_no>${CONFIG.accountNo}</account_no>
  <user_id>${CONFIG.userId}</user_id>

  <record_total>1</record_total>
  <records>
    <type code="${typeCode}">${typeVal}</type>
    <ic_lc>${ic}</ic_lc>
    <nic_br>${reg}</nic_br>
    <name>${test.name}</name>
    <ref_no>${reg || ic}</ref_no>

    <include_ctos>1</include_ctos>
    <include_ccris>1</include_ccris>
    <include_fico>1</include_fico>
  </records>
</batch>
`
}

/**
 * RUN — XML → JSON via local duplicate of modules/ctos/parser.ts (same shape as API/DB).
 */
async function run() {
  for (const t of TEST_CASES) {
    console.log("\n====", t.name)

    const xml = buildXML(t)
    const res = await callCTOS(wrapSoap(xml))
    console.log("Parsing CTOS XML with local parser (ctos.new.ts copy of parser.ts)")
    const parsed = await parseCtosReportXmlLocal(res)

    console.log(JSON.stringify(parsed, null, 2))
  }
}

run()