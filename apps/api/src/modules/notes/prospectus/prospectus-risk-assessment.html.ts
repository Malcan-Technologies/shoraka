/**
 * SECTION: Plain HTML for Risk Assessment data preview
 * WHY: Unstyled Stage 3 proof — no design
 */

import type { ProspectusRiskAssessment } from "./prospectus-risk-assessment.types";
import { PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES } from "./prospectus-risk-assessment.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusRiskAssessmentHtml(data: ProspectusRiskAssessment): string {
  const rows: Array<{ key: keyof ProspectusRiskAssessment; displayLabel: string }> = [
    { key: "riskGrade", displayLabel: "Risk grade" },
    { key: "riskLabel", displayLabel: "Risk label" },
    { key: "riskScore", displayLabel: "Risk score" },
    { key: "riskExplanation", displayLabel: "Risk explanation" },
    { key: "ratingScaleReference", displayLabel: "Rating scale reference" },
    { key: "riskAppliesTo", displayLabel: "Risk applies to" },
    { key: "assessmentSource", displayLabel: "Assessment source" },
  ];

  const body = rows
    .map(({ key, displayLabel }) => {
      const source = PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES[key];
      return `<tr>
  <td>${escapeHtml(displayLabel)}</td>
  <td>${escapeHtml(data[key])}</td>
  <td>${escapeHtml(source.canonicalSource)}</td>
  <td>${escapeHtml(source.availability)}</td>
</tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Risk Assessment</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 3: Risk Assessment</h1>
  <p>Unstyled data preview. Missing values must be exactly: Data not available</p>
  <p>
    Risk grade: ${escapeHtml(data.riskGrade)}<br />
    Risk label: ${escapeHtml(data.riskLabel)}<br />
    Risk score: ${escapeHtml(data.riskScore)}<br />
    Risk explanation: ${escapeHtml(data.riskExplanation)}<br />
    Rating scale reference: ${escapeHtml(data.ratingScaleReference)}<br />
    Risk applies to: ${escapeHtml(data.riskAppliesTo)}<br />
    Assessment source: ${escapeHtml(data.assessmentSource)}
  </p>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr>
        <th>Label</th>
        <th>Value</th>
        <th>Canonical source</th>
        <th>Availability</th>
      </tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
</body>
</html>`;
}
