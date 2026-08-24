import { getProspectusOfficialLogoDataUri } from "../../notes/prospectus/prospectus-header-logo";
import { PROSPECTUS_HEADER_TAGLINE } from "../../notes/prospectus/prospectus-static-copy";
import { escapeHtml } from "./html-escape";
import type { ApplicationSummaryPdfModel, SummaryField } from "./types";

const LOGO_WIDTH_PX = 176;
const LOGO_HEIGHT_PX = 34;

function buildBrandMarkHtml(): string {
  const dataUri = getProspectusOfficialLogoDataUri();
  if (dataUri) {
    return `<img class="brand-logo" src="${dataUri}" alt="CashSouk" width="${LOGO_WIDTH_PX}" height="${LOGO_HEIGHT_PX}" />`;
  }
  return `<div class="brand-wordmark">CashSouk</div>`;
}

function kvRows(fields: SummaryField[]): string {
  return fields
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`
    )
    .join("");
}

function section(title: string, inner: string | null): string {
  if (!inner) return "";
  return `<section class="section">
      <h2 class="section-head">${escapeHtml(title)}</h2>
      <div class="section-body">${inner}</div>
    </section>`;
}

function kvSection(title: string, fields: SummaryField[]): string {
  if (fields.length === 0) return "";
  return section(title, `<table class="kv">${kvRows(fields)}</table>`);
}

function invoiceSections(model: ApplicationSummaryPdfModel): string {
  if (model.invoices.length === 0) return "";
  const blocks = model.invoices
    .map((invoice) => {
      const details = invoice.fields.length
        ? `<table class="kv">${kvRows(invoice.fields)}</table>`
        : "";
      const offer = invoice.offerTerms.length
        ? `<h3 class="subhead">Offer terms and fees</h3><table class="kv">${kvRows(invoice.offerTerms)}</table>`
        : "";
      if (!details && !offer) return "";
      return `<div class="block">
        <h3 class="block-title">${escapeHtml(invoice.heading)}</h3>
        ${details}${offer}
      </div>`;
    })
    .filter(Boolean)
    .join("");
  return blocks ? section("Invoices", blocks) : "";
}

function remarksSection(model: ApplicationSummaryPdfModel): string {
  if (model.remarks.length === 0) return "";
  const items = model.remarks
    .map((row) => {
      const meta = [row.action, row.authorName, row.at].filter(Boolean).join(" · ");
      return `<div class="block">
        <h3 class="block-title">${escapeHtml(row.subject)}</h3>
        ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
        <p class="body">${escapeHtml(row.remark)}</p>
      </div>`;
    })
    .join("");
  return section("Review remarks and amendment requests", items);
}

function timelineSection(model: ApplicationSummaryPdfModel): string {
  if (model.timeline.length === 0) return "";
  const items = model.timeline
    .map((item) => {
      const when = item.at ? `<span class="when">${escapeHtml(item.at)}</span>` : "";
      const description = item.description
        ? `<p class="body">${escapeHtml(item.description)}</p>`
        : "";
      return `<li>
        <div class="timeline-head"><strong>${escapeHtml(item.label)}</strong>${when}</div>
        ${description}
      </li>`;
    })
    .join("");
  return section("Application history", `<ol class="timeline">${items}</ol>`);
}

function documentsSection(model: ApplicationSummaryPdfModel): string {
  if (model.documentNames.length === 0) return "";
  const items = model.documentNames
    .map((name) => `<li>${escapeHtml(name)}</li>`)
    .join("");
  return section(
    "Documents on file",
    `<p class="hint">Document names only. Source files are not attached to this summary.</p><ul class="docs">${items}</ul>`
  );
}

export function buildApplicationSummaryHtml(model: ApplicationSummaryPdfModel): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(model.title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Arial, Helvetica, sans-serif;
      color: #18181b;
      font-size: 11.5px;
      line-height: 1.45;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { max-width: 100%; }
    .accent-bar {
      height: 5px;
      background: linear-gradient(90deg, #8A0304 0%, #CE2922 55%, #BAA38B 100%);
      margin: 0 0 22px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 28px;
      margin-bottom: 16px;
    }
    .brand-logo {
      display: block;
      width: ${LOGO_WIDTH_PX}px;
      height: ${LOGO_HEIGHT_PX}px;
      object-fit: contain;
      object-position: left center;
      margin: 0 0 12px;
    }
    .brand-wordmark {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #8A0304;
      margin: 0 0 10px;
    }
    .brand-tagline {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #6F4924;
      margin: 0 0 8px;
    }
    .title-card {
      flex: 0 0 250px;
      width: 250px;
      border: 1px solid #e4e4e7;
      border-top: 3px solid #8A0304;
      background: #fafafa;
      padding: 14px 16px;
      text-align: right;
    }
    .title-card h1 {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #8A0304;
      line-height: 1.2;
    }
    .title-card .generated {
      font-size: 10.5px;
      color: #52525b;
    }
    .disclaimer {
      margin: 0 0 18px;
      padding: 10px 12px;
      border: 1px solid #e8e0d6;
      background: #f8f5f1;
      color: #3f3f46;
      font-size: 10.5px;
    }
    .section {
      margin-top: 16px;
      border: 1px solid #e4e4e7;
      border-radius: 4px;
      overflow: hidden;
    }
    .section-head {
      margin: 0;
      padding: 9px 14px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6F4924;
      background: #f8f5f1;
      border-bottom: 1px solid #e8e0d6;
    }
    .section-body { padding: 8px 14px 10px; }
    table.kv { width: 100%; border-collapse: collapse; }
    table.kv th, table.kv td {
      padding: 7px 0;
      vertical-align: top;
      text-align: left;
      border-bottom: 1px solid #f4f4f5;
    }
    table.kv tr:last-child th, table.kv tr:last-child td { border-bottom: none; }
    table.kv th {
      width: 38%;
      color: #71717a;
      font-weight: 600;
      padding-right: 16px;
    }
    table.kv td { color: #18181b; font-weight: 500; word-break: break-word; }
    .block { padding: 6px 0 10px; border-bottom: 1px solid #f4f4f5; }
    .block:last-child { border-bottom: none; padding-bottom: 2px; }
    .block-title { margin: 0 0 6px; font-size: 12px; color: #18181b; }
    .subhead {
      margin: 10px 0 4px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #6F4924;
      text-transform: uppercase;
    }
    .meta { margin: 0 0 6px; color: #71717a; font-size: 10.5px; }
    .body { margin: 0; color: #18181b; white-space: pre-wrap; }
    .hint { margin: 0 0 8px; color: #71717a; font-size: 10.5px; }
    .docs, .timeline { margin: 0; padding-left: 18px; }
    .docs li, .timeline li { margin: 0 0 6px; }
    .timeline { list-style: decimal; }
    .timeline-head { display: flex; justify-content: space-between; gap: 12px; }
    .when { color: #71717a; font-size: 10.5px; white-space: nowrap; }
    .footer {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #e4e4e7;
      font-size: 10px;
      color: #a1a1aa;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="accent-bar"></div>
    <div class="header">
      <div>
        ${buildBrandMarkHtml()}
        <div class="brand-tagline">${escapeHtml(PROSPECTUS_HEADER_TAGLINE)}</div>
      </div>
      <div class="title-card">
        <h1>${escapeHtml(model.title.toUpperCase())}</h1>
        <div class="generated">Generated ${escapeHtml(model.generatedAtLabel)}</div>
      </div>
    </div>
    <p class="disclaimer">${escapeHtml(model.disclaimer)}</p>
    ${kvSection("Application", model.identityFields)}
    ${kvSection("Facility", model.facilityFields)}
    ${kvSection("Company and customer", model.companyFields)}
    ${kvSection("Financing", model.financingFields)}
    ${invoiceSections(model)}
    ${remarksSection(model)}
    ${timelineSection(model)}
    ${documentsSection(model)}
    <div class="footer">${escapeHtml(model.disclaimer)}</div>
  </div>
</body>
</html>`;
}
