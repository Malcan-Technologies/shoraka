import { getProspectusOfficialLogoDataUri } from "../prospectus/prospectus-header-logo";
import { escapeHtml } from "../prospectus/prospectus-html";
import type { CertificateAudience, InvestmentNoteCertificateSnapshot } from "./types";

const CERTIFICATION_COPY =
  "Certification. Shoraka Suyula Platform Sdn Bhd certifies that the campaign identified above achieved its applicable successful-funding threshold and that the Islamic Investment Note identified above has been recorded as issued to the participating Investors/Noteholders listed in the linked Investor Schedule. The linked Investor Schedule and the bullet Payment Schedule shown in this certificate form part of and must be read together with the Note terms, platform terms and applicable transaction documents.";

const RISK_NOTICE_COPY =
  "Risk notice. This certificate records the issuance and allocation of the Islamic Investment Note; it is not a deposit certificate or a guarantee of payment by CashSouk, Shoraka Suyula Platform Sdn Bhd, the trustee, the Securities Commission Malaysia or the Government. Payment remains subject to the issuer’s and paymaster’s performance and the governing documents. In the event of conflict, the executed transaction documents prevail.";

const SCHEDULE_RULES_COPY =
  "Record control. This Investor Schedule forms part of and must be read together with the Islamic Investment Note shown above. Investor allocations must reconcile to the funded principal, participation must total 100.00%, and profit and total payable must reconcile to the Payment Schedule. Investor names may be replaced with platform Investor IDs on an issuer-facing copy where confidentiality controls require it. Amendments must be issued as a new version and must not overwrite an approved schedule.";

const FOOTER_COMPANY =
  "SHORAKA SUYULA PLATFORM SDN BHD (1433328-H) 202101033028";
const FOOTER_ADDRESS =
  "LEVEL 19, WISMA MONT’ KIARA, NO. 1, JALAN KIARA, MONT KIARA, 50480 KUALA LUMPUR, MALAYSIA";
const FOOTER_CONTACT = "T: +603-2708 8100 E: enquiry@cashsouk.com W: www.cashsouk.com";

export type CertificateHtmlAudienceInput = {
  audience: CertificateAudience;
  investorOrganizationId?: string | null;
};

function formatRm(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShare(percent: number): string {
  return `${percent.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatProfitRate(percent: number): string {
  return `${percent.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}% p.a.`;
}

function kvRow(label: string, value: string): string {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function visibleInvestors(
  snapshot: InvestmentNoteCertificateSnapshot,
  input: CertificateHtmlAudienceInput
) {
  if (input.audience === "INVESTOR") {
    const selfId = input.investorOrganizationId;
    return snapshot.investors.filter((row) => row.investorOrganizationId === selfId);
  }
  return snapshot.investors;
}

function issuerLegalName(snapshot: InvestmentNoteCertificateSnapshot, audience: CertificateAudience) {
  return audience === "INVESTOR" ? "—" : snapshot.note.issuerLegalName;
}

function companyRegistration(
  snapshot: InvestmentNoteCertificateSnapshot,
  audience: CertificateAudience
) {
  return audience === "INVESTOR" ? "—" : snapshot.note.companyRegistrationNumber;
}

function investorNameCell(
  name: string,
  audience: CertificateAudience
): string {
  if (audience === "ISSUER") return "—";
  return escapeHtml(name);
}

export function buildInvestmentNoteCertificateHtml(
  snapshot: InvestmentNoteCertificateSnapshot,
  input: CertificateHtmlAudienceInput
): string {
  const investors = visibleInvestors(snapshot, input);
  const n = snapshot.note;
  const cert = snapshot.certificate;
  const schedule = snapshot.investorSchedule;
  const logo = getProspectusOfficialLogoDataUri();
  const logoHtml = logo
    ? `<img class="logo" src="${logo}" alt="CashSouk" />`
    : `<div class="logo-fallback">CashSouk</div>`;

  const sumPrincipal = investors.reduce((sum, row) => sum + row.principal, 0);
  const sumShare = investors.reduce((sum, row) => sum + row.sharePercent, 0);
  const sumProfit = investors.reduce((sum, row) => sum + row.expectedGrossProfit, 0);
  const sumPayable = investors.reduce((sum, row) => sum + row.totalPayable, 0);
  const totalShareDisplay =
    input.audience === "INVESTOR" ? formatShare(sumShare) : "100.00%";

  const allocationRows = investors
    .map(
      (row, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.investorReference)}</td>
        <td>${investorNameCell(row.investorName, input.audience)}</td>
        <td class="num">${formatAmount(row.principal)}</td>
        <td class="num">${formatShare(row.sharePercent)}</td>
        <td class="num">${formatAmount(row.expectedGrossProfit)}</td>
        <td class="num">${formatAmount(row.totalPayable)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(cert.certificateNumber)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #1a1a1a;
      font-family: "Liberation Serif", "Times New Roman", Times, serif;
      font-size: 11pt;
      line-height: 1.35;
    }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .logo { height: 42px; width: auto; }
    .logo-fallback { font-weight: 700; font-size: 16pt; color: #8B1E1E; }
    h1 { font-size: 16pt; letter-spacing: 0.04em; margin: 0 0 4px; text-align: center; }
    .banner {
      text-align: center;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #8B1E1E;
      margin: 0 0 16px;
    }
    h2 {
      font-size: 10pt;
      letter-spacing: 0.06em;
      margin: 16px 0 6px;
      border-bottom: 1px solid #8B1E1E;
      padding-bottom: 3px;
      color: #8B1E1E;
    }
    table.kv { width: 100%; border-collapse: collapse; }
    table.kv th, table.kv td { padding: 3px 8px 3px 0; vertical-align: top; font-size: 10pt; }
    table.kv th { width: 38%; font-weight: 600; text-align: left; color: #444; }
    table.grid { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9pt; }
    table.grid th, table.grid td { border: 1px solid #ccc; padding: 5px 6px; }
    table.grid th { background: #f4f0ea; font-weight: 600; text-align: left; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .legal { font-size: 9.5pt; margin: 8px 0; text-align: justify; }
    .sign { display: flex; justify-content: space-between; gap: 24px; margin: 22px 0 8px; }
    .sign div { width: 46%; font-size: 9pt; }
    .line { border-top: 1px solid #222; margin-top: 28px; padding-top: 4px; }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      font-size: 8pt;
      color: #555;
      text-align: center;
    }
  </style>
</head>
<body>
  <section class="page">
    <div class="header">${logoHtml}</div>
    <h1>ISLAMIC INVESTMENT NOTE CERTIFICATE</h1>
    <p class="banner">CAMPAIGN SUCCESSFULLY FUNDED — NOTE ISSUED</p>

    <h2>CERTIFICATE AND NOTE IDENTIFIERS</h2>
    <table class="kv">
      ${kvRow("Certificate no.", cert.certificateNumber)}
      ${kvRow("Certificate date", cert.certificateDateDisplay)}
      ${kvRow("Financing Note ID", n.noteReference)}
      ${kvRow("Campaign ID", n.campaignReference)}
      ${kvRow("Issuer ID", n.issuerReference)}
      ${kvRow("Business sector", n.businessSector)}
      ${kvRow("Issuer", issuerLegalName(snapshot, input.audience))}
      ${kvRow("Company no.", companyRegistration(snapshot, input.audience))}
    </table>

    <h2>CAMPAIGN AND NOTE PARTICULARS</h2>
    <table class="kv">
      ${kvRow("Campaign status", n.campaignStatus)}
      ${kvRow("Funding close date", n.fundingCloseDateDisplay)}
      ${kvRow("Target amount", formatRm(n.targetAmount))}
      ${kvRow("Amount successfully raised", formatRm(n.fundedAmount))}
      ${kvRow("Principal amount", formatRm(n.principalAmount))}
      ${kvRow("Currency", n.currency)}
      ${kvRow("Profit rate", formatProfitRate(n.profitRatePercent))}
      ${kvRow("Contracted profit", formatRm(n.contractedProfit))}
      ${kvRow("Total amount payable", formatRm(n.totalAmountPayable))}
      ${kvRow("Repayment profile", n.repaymentProfile)}
      ${kvRow("Issue date", n.issueDateDisplay)}
      ${kvRow("Disbursement value date", n.disbursementValueDateDisplay)}
      ${kvRow("Tenure", `${n.tenureDays} days`)}
      ${kvRow("Maturity date", n.maturityDateDisplay)}
      ${kvRow("Shariah structure", n.shariahStructure)}
      ${kvRow("Risk rating", n.riskRating)}
      ${kvRow("Underlying invoice", n.underlyingInvoice)}
      ${kvRow("Paymaster", n.paymaster)}
      ${kvRow("Financing purpose", n.financingPurpose)}
      ${kvRow("Security / support", n.securitySupport)}
    </table>

    <h2>LINKED INVESTOR SCHEDULE</h2>
    <table class="kv">
      ${kvRow("Investor Schedule ref.", schedule.scheduleReference)}
      ${kvRow("Schedule status", schedule.status)}
    </table>

    <h2>PAYMENT SCHEDULE</h2>
    <table class="grid">
      <thead>
        <tr>
          <th>Maturity Date</th>
          <th class="num">Principal Amount (RM)</th>
          <th class="num">Expected Profit (RM)</th>
          <th class="num">Total Amount Payable (RM)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(n.maturityDateDisplay)}</td>
          <td class="num">${formatAmount(n.principalAmount)}</td>
          <td class="num">${formatAmount(n.contractedProfit)}</td>
          <td class="num">${formatAmount(n.totalAmountPayable)}</td>
        </tr>
      </tbody>
    </table>

    <h2>CERTIFICATION</h2>
    <p class="legal">${escapeHtml(CERTIFICATION_COPY)}</p>

    <h2>IMPORTANT NOTICE</h2>
    <p class="legal">${escapeHtml(RISK_NOTICE_COPY)}</p>

    <div class="sign">
      <div><div class="line">As agent of the Issuer<br/>Name / Date: __________________</div></div>
      <div><div class="line">Company Stamp</div></div>
    </div>
  </section>

  <section class="page">
    <h1>INVESTOR SCHEDULE</h1>
    <p class="banner">TIED TO THE ISLAMIC INVESTMENT NOTE</p>

    <h2>SCHEDULE CONTROL</h2>
    <table class="kv">
      ${kvRow("Financing Note ID", n.noteReference)}
      ${kvRow("Investor Schedule ref.", schedule.scheduleReference)}
      ${kvRow("Version", schedule.version)}
      ${kvRow("Status", schedule.status)}
      ${kvRow("Issue date", schedule.issueDateDisplay)}
      ${kvRow("Effective date", schedule.effectiveDateDisplay)}
      ${kvRow("Issuer ID", n.issuerReference)}
      ${kvRow("Funded principal", formatRm(schedule.fundedPrincipal))}
    </table>

    <h2>INVESTOR ALLOCATION</h2>
    <table class="grid">
      <thead>
        <tr>
          <th>No.</th>
          <th>Investor ID</th>
          <th>Investor / Noteholder</th>
          <th class="num">Principal (RM)</th>
          <th class="num">Share %</th>
          <th class="num">Expected Profit (RM)</th>
          <th class="num">Total payable (RM)</th>
        </tr>
      </thead>
      <tbody>
        ${allocationRows}
        <tr>
          <th colspan="3">TOTAL</th>
          <th class="num">${formatAmount(input.audience === "INVESTOR" ? sumPrincipal : n.fundedAmount)}</th>
          <th class="num">${totalShareDisplay}</th>
          <th class="num">${formatAmount(input.audience === "INVESTOR" ? sumProfit : n.contractedProfit)}</th>
          <th class="num">${formatAmount(input.audience === "INVESTOR" ? sumPayable : n.totalAmountPayable)}</th>
        </tr>
      </tbody>
    </table>

    <h2>SCHEDULE RULES</h2>
    <p class="legal">${escapeHtml(SCHEDULE_RULES_COPY)}</p>

    <div class="footer">
      <div>${escapeHtml(FOOTER_COMPANY)}</div>
      <div>${escapeHtml(FOOTER_ADDRESS)}</div>
      <div>${escapeHtml(FOOTER_CONTACT)}</div>
    </div>
  </section>
</body>
</html>`;
}
