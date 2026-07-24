/**
 * SECTION: Plain HTML for Risk Assessment Canva-facing preview
 * WHY: Unstyled Stage 3 — audit metadata excluded from this document
 */

import type { ProspectusRiskAssessment } from "./prospectus-risk-assessment.types";
import {
  PROSPECTUS_RATING_SCALE_STATUS,
  PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES,
} from "./prospectus-risk-assessment.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusRiskAssessmentHtml(data: ProspectusRiskAssessment): string {
  const { canva } = data;
  const gradeSrc = PROSPECTUS_RISK_ASSESSMENT_FIELD_SOURCES.riskGrade;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 1 — Risk Assessment</title>
</head>
<body>
  <h1>Prospectus Page 1 — DATA STAGE 3: Risk Assessment</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: —</p>
  <p>Cashsouk grades only (A, B, C, D, E, F). Invalid grades are rejected. Page 2 scale status: ${escapeHtml(
    PROSPECTUS_RATING_SCALE_STATUS
  )} (not shown in risk box).</p>
  <p>Canonical grade source: ${escapeHtml(gradeSrc.canonicalSource)}</p>
  <section>
    <h2>Risk Rating</h2>
    <p>
      Risk Rating: ${escapeHtml(canva.riskGrade)}<br />
      Risk label: ${escapeHtml(canva.riskLabel)}<br />
      Risk explanation: ${escapeHtml(canva.riskExplanation)}<br />
      Rating scale reference: ${escapeHtml(canva.ratingScaleReference)}
    </p>
  </section>
</body>
</html>`;
}
