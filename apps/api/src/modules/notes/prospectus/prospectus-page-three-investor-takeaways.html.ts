/**
 * SECTION: Plain HTML for Page 3 Stage 6 investor takeaways preview
 * WHY: Heading + six labels/values only — no claims, colours, or audit
 */

import type { ProspectusPageThreeInvestorTakeaways } from "./prospectus-page-three-investor-takeaways.types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProspectusPageThreeInvestorTakeawaysHtml(
  data: ProspectusPageThreeInvestorTakeaways
): string {
  const omitted = new Set(data.omittedKeys ?? []);
  const bodyRows = data.items
    .filter((item) => !omitted.has(item.key))
    .map(
      (item) =>
        `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${escapeHtml(
          item.takeaway
        )}</td></tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prospectus Page 3 — Investor Takeaways</title>
</head>
<body>
  <h1>Prospectus Page 3 — DATA STAGE 6: Investor Takeaways</h1>
  <p>Unstyled Canva-facing preview. Missing values must be exactly: Data not available</p>
  <section>
    <h2>${escapeHtml(data.sectionHeading)}</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Topic</th>
          <th>Takeaway</th>
        </tr>
      </thead>
      <tbody>
${bodyRows}
      </tbody>
    </table>
  </section>
</body>
</html>`;
}
