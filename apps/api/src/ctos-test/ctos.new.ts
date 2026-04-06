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
 * CONFIG
 */
const CONFIG = {
  clientId: "",
  username: "",
  password: "",
  tokenUrl:
    "",
  soapUrl: "",
  privateKeyPath: "",

  companyCode: "",
  accountNo: "",
  userId: ""
}

/**
 * FULL SABRINA TEST CASES
 */
const TEST_CASES = [
  { kind: "company", name: "THE FOURSQUARE GOSPEL CHURCH BHD.", reg: "198401018032" },
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

  { kind: "individual", name: "HAFIY HAMDAN", nic: "720330027845" },
  { kind: "individual", name: "CHEW MEI QI", nic: "741214265249" },
  { kind: "individual", name: "NG KEAT HAW", nic: "810324145789" },
  { kind: "individual", name: "Jonathan Chan", nic: "820106017731" },
  { kind: "individual", name: "WONG JIA XIN", nic: "661007322268" },
  { kind: "individual", name: "TAN CHONG MIN", nic: "750706081234" },
  { kind: "individual", name: "Wan Mohd Najib Azahari", nic: "771015087483" },
  { kind: "individual", name: "VIGNESH RAJ", nic: "800706217043" },
  { kind: "individual", name: "KIRAN CHANDRASEKAR", nic: "870227082659" },
  { kind: "individual", name: "Siti Hajar Binti Mohd Zain", nic: "870515051120" }
]

/**
 * HELPERS
 */
const safeGet = (obj: any, path: any[]) => {
  try {
    const val = path.reduce((o, k) => o?.[k], obj)
    return val === undefined || val === "" ? null : val
  } catch {
    return null
  }
}

const toNumber = (v: any) => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

const toBoolean = (v: any) => {
  if (v === null || v === undefined || v === "") return null
  if (v === "1" || v === 1) return true
  if (v === "0" || v === 0) return false
  return null
}

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
 * PARSER
 */
async function parseCTOS(xmlStr: string) {
  const parsed = await parseStringPromise(xmlStr, { explicitArray: true })
  const report = parsed?.report?.enq_report?.[0]?.enquiry?.[0] || {}

  const summary = report?.section_summary?.[0] || {}
  const sectionA = report?.section_a?.[0] || {}
  const sectionDNode = report?.section_d?.[0] || {}
  const sectionD2Node = report?.section_d2?.[0] || {}
  const accountsNode = report?.section_a?.[0]?.record?.[0]?.accounts?.[0] || {}
  const accountsList = Array.isArray(accountsNode?.account)
    ? accountsNode.account
    : accountsNode?.account
    ? [accountsNode.account]
    : []

  const ccris = report?.section_ccris?.[0] || {}

  const companyNode =
    sectionA?.record?.[0] || sectionA?.company?.[0] || sectionA?.person?.[0] || {}

  // ===== ADDRESS FIXED =====
  const address = {
    full:
      safeGet(companyNode, ["addr", 0, "_"]) ||
      safeGet(companyNode, ["addr", 0]),
    line1: safeGet(companyNode, ["addr_breakdown", 0, "addr1", 0]),
    line2: safeGet(companyNode, ["addr_breakdown", 0, "addr2", 0]),
    city: safeGet(companyNode, ["addr_breakdown", 0, "city", 0]),
    state: safeGet(companyNode, ["addr_breakdown", 0, "state", 0]),
    postcode: safeGet(companyNode, ["addr_breakdown", 0, "postcode", 0])
  }

  // ===== DIRECTORS =====
  const directorsRaw =
    safeGet(sectionA, ["record", 0, "directors", 0, "director"]) || []

  const directors = directorsRaw.map((d: any) => ({
    name: safeGet(d, ["name", 0]),
    alias: safeGet(d, ["alias", 0]),
    ic_lcno: safeGet(d, ["ic_lcno", 0]),
    nic_brno: safeGet(d, ["nic_brno", 0]),
    position: safeGet(d, ["position", 0]),
    addr: safeGet(d, ["addr", 0]),
    appoint: safeGet(d, ["appoint", 0]),
    resign_date: safeGet(d, ["resign_date", 0]),
    equity: toNumber(safeGet(d, ["equity", 0])),
    equity_percentage: toNumber(safeGet(d, ["equity_percentage", 0])),
    remark: safeGet(d, ["remark", 0]),
    party_type: safeGet(d, ["party_type", 0])
  }))

  // ===== SHAREHOLDERS =====
  const shareholdersRaw =
    safeGet(sectionA, ["record", 0, "shareholders", 0, "shareholder"]) || []

  const shareholders = shareholdersRaw.map((s: any) => ({
    name: safeGet(s, ["name", 0]),
    alias: safeGet(s, ["alias", 0]),
    ic_lcno: safeGet(s, ["ic_lcno", 0]),
    nic_brno: safeGet(s, ["nic_brno", 0]),
    addr: safeGet(s, ["addr", 0]),
    shares: toNumber(safeGet(s, ["shares", 0])),
    equity_percentage: toNumber(safeGet(s, ["equity_percentage", 0])),
    remark: safeGet(s, ["remark", 0]),
    party_type: safeGet(s, ["party_type", 0])
  }))

  // ===== FINANCIALS =====
const financialsArray = accountsList
  .map((accounts: any) => {
    const plyear = toNumber(accounts?.plyear?.[0])

    if (plyear === 0) return null // ✅ skip

    return {
      financial_year_end_date: safeGet(accounts, ["pldd", 0]),
      balance_sheet_date: safeGet(accounts, ["bsdd", 0]),

      balance_sheet: {
        fixed_assets: toNumber(accounts?.bsfatot?.[0]),
        other_assets: toNumber(accounts?.othass?.[0]),
        current_assets: toNumber(accounts?.bscatot?.[0]),
        non_current_assets: toNumber(accounts?.bsclbank?.[0]),
        total_assets: toNumber(accounts?.totass?.[0]),
        current_liabilities: toNumber(accounts?.curlib?.[0]),
        long_term_liabilities: toNumber(accounts?.bsslltd?.[0]),
        non_current_liabilities: toNumber(accounts?.bsclstd?.[0]),
        total_liabilities: toNumber(accounts?.totlib?.[0]),
        equity: toNumber(accounts?.bsqpuc?.[0])
      },

      profit_and_loss: {
        revenue: toNumber(accounts?.turnover?.[0]),
        profit_before_tax: toNumber(accounts?.plnpbt?.[0]),
        profit_after_tax: toNumber(accounts?.plnpat?.[0]),
        net_dividend: toNumber(accounts?.plnetdiv?.[0]),
        profit_for_year: plyear
      }
    }
  })
  .filter(Boolean) // ✅ remove skipped ones

  // ===== CCRIS =====
  const totalLimit = toNumber(
    safeGet(ccris, ["summary", 0, "liabilities", 0, "borrower", 0, "$", "total_limit"])
  )

  const totalOutstanding = toNumber(
    safeGet(ccris, ["summary", 0, "liabilities", 0, "borrower", 0, "_"])
  )

  // ===== LEGAL =====
  const sectionDRecords = [
    ...(sectionDNode?.record || []),
    ...(sectionD2Node?.record || [])
  ]

  const legalCases = sectionDRecords.map((r: any) => ({
    title: safeGet(r, ["title", 0]),
    case_type: r?.$?.rpttype || null,
    status: r?.$?.status || safeGet(r, ["status", 0]),
    amount: toNumber(safeGet(r, ["amount", 0])),
    dates: {
      action_date: safeGet(r, ["action", 0, "date", 0]),
      notice_date: safeGet(r, ["notice", 0, "date", 0]),
      petition_date: safeGet(r, ["petition", 0, "date", 0]),
      order_date: safeGet(r, ["order", 0, "date", 0])
    }
  }))

  const dcheqRaw = safeGet(summary, ["dcheqs", 0, "$", "entity"])
  const dcheqFlag = toNumber(dcheqRaw)

  // ===== FICO FIXED =====
  const ficoIndexNode =
    parsed?.report?.enq_report?.[0]?.summary?.[0]?.enq_sum?.[0]?.fico_index?.[0] || {}

  const ficoScore = toNumber(ficoIndexNode?.$?.score)

  const ficoFactors =
    (ficoIndexNode?.fico_factor || [])
      .map((f: any) => (typeof f === "string" ? f : f?._))
      .filter((f: any) => f)

  return {
    raw_xml: xmlStr,

    summary_json: {
      fico_score: ficoScore,
      fico_factors: ficoFactors,

      bankruptcy: toBoolean(
        safeGet(summary, ["ctos", 0, "bankruptcy", 0, "$", "status"])
      ),

      legal: {
        total_cases: toNumber(
          safeGet(summary, ["ctos", 0, "legal", 0, "$", "total"])
        ),
        total_amount: toNumber(
          safeGet(summary, ["ctos", 0, "legal", 0, "$", "value"])
        )
      },

      ccris: {
        applications: toNumber(
          safeGet(summary, ["ccris", 0, "application", 0, "$", "total"])
        ),
        approved: toNumber(
          safeGet(summary, ["ccris", 0, "application", 0, "$", "approved"])
        ),
        pending: toNumber(
          safeGet(summary, ["ccris", 0, "application", 0, "$", "pending"])
        ),
        arrears: toNumber(
          safeGet(summary, ["ccris", 0, "facility", 0, "$", "arrears"])
        )
      },

      dcheqs: {
        has_history: dcheqFlag !== null ? dcheqFlag > 0 : null,
        raw_flag: dcheqFlag
      }
    },

    company_json: {
      name:
        safeGet(companyNode, ["name", 0, "_"]) ||
        safeGet(companyNode, ["name", 0]),

      registration_no:
        safeGet(companyNode, ["brn_ssm", 0]) ||
        safeGet(companyNode, ["ic_lcno", 0]),

      status: safeGet(companyNode, ["status", 0]),
      business_type: safeGet(companyNode, ["type_of_business", 0]),

      company_type:
        safeGet(companyNode, ["comp_type", 0, "_"]) ||
        safeGet(companyNode, ["comp_type", 0]),

      company_category:
        safeGet(companyNode, ["comp_category", 0, "_"]) ||
        safeGet(companyNode, ["comp_category", 0]),

      address,

      directors,
      shareholders
    },

    legal_json: {
      cases: legalCases
    },

    ccris_json: {
      summary: {
        total_limit: totalLimit,
        total_outstanding: totalOutstanding
      }
    },

    financials_json: financialsArray
  }
}

/**
 * RUN
 */
async function run() {
  for (const t of TEST_CASES) {
    console.log("\n====", t.name)

    const xml = buildXML(t)
    const res = await callCTOS(wrapSoap(xml))
    const parsed = await parseCTOS(res)

    console.log(JSON.stringify(parsed, null, 2))
  }
}

run()