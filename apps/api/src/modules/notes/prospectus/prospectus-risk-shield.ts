/**
 * SECTION: Embed Risk Rating shield SVG for Prospectus Page 1
 * WHY: Official shield artwork with dynamic A–F grade colour + letter overlay
 */

import { readFileSync } from "node:fs";
import { CASHSCOUK_RISK_GRADE_LETTER_COLOR } from "@cashsouk/types";
import { resolveProspectusAssetAbsolutePath } from "./prospectus-asset-paths";
import { escapeHtml, escapeHtmlAttribute } from "./prospectus-html";

/** Source fill in prospectus-risk-shield.svg — replaced per selected grade. */
export const PROSPECTUS_RISK_SHIELD_SOURCE_FILL = "#21b524";

export const PROSPECTUS_RISK_SHIELD_DISPLAY_WIDTH_PX = 72;
export const PROSPECTUS_RISK_SHIELD_DISPLAY_HEIGHT_PX = 72;
/** Overlay grade letter — Canva reference `.shield` uses 30px. */
export const PROSPECTUS_RISK_SHIELD_GRADE_FONT_SIZE_PX = 30;

let cachedSvgXml: string | null | undefined;

export function resolveProspectusRiskShieldAbsolutePath(): string | null {
  return resolveProspectusAssetAbsolutePath("prospectus-risk-shield.svg");
}

function prepareProspectusRiskShieldSvg(svgXml: string, fillColor: string): string {
  let out = svgXml;
  out = out.replace(/\s(width|height)="[^"]*"/g, "");
  if (!/preserveAspectRatio=/.test(out)) {
    out = out.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid meet"');
  }
  const fill = fillColor.trim() || PROSPECTUS_RISK_SHIELD_SOURCE_FILL;
  out = out.replace(
    new RegExp(PROSPECTUS_RISK_SHIELD_SOURCE_FILL, "gi"),
    fill
  );
  return out;
}

function getProspectusRiskShieldSvgXml(): string | null {
  if (cachedSvgXml !== undefined) return cachedSvgXml;
  const absolute = resolveProspectusRiskShieldAbsolutePath();
  if (!absolute) {
    cachedSvgXml = null;
    return null;
  }
  cachedSvgXml = readFileSync(absolute, "utf8");
  return cachedSvgXml;
}

export type ProspectusRiskShieldHtmlInput = {
  grade: string;
  color: string;
  textColor: string;
};

/** Grade letter on the Page 1 shield is always white (Canva presentation). */
export const PROSPECTUS_RISK_SHIELD_GRADE_TEXT_COLOR = CASHSCOUK_RISK_GRADE_LETTER_COLOR;

/**
 * Page 1 risk shield: coloured SVG + centred grade letter.
 * Falls back to a coloured square when the asset is missing.
 * Shield fill stays dynamic A–F; grade letter is always white for contrast.
 */
export function buildProspectusRiskShieldHtml(
  input: ProspectusRiskShieldHtmlInput
): string {
  const grade = input.grade.trim() || "—";
  const color = input.color.trim() || PROSPECTUS_RISK_SHIELD_SOURCE_FILL;
  const gradeTextColor = PROSPECTUS_RISK_SHIELD_GRADE_TEXT_COLOR;
  const w = PROSPECTUS_RISK_SHIELD_DISPLAY_WIDTH_PX;
  const h = PROSPECTUS_RISK_SHIELD_DISPLAY_HEIGHT_PX;
  const source = getProspectusRiskShieldSvgXml();

  if (source) {
    const coloured = prepareProspectusRiskShieldSvg(source, color);
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(coloured, "utf8").toString("base64")}`;
    return `<div class="risk-shield" data-grade="${escapeHtmlAttribute(
      grade
    )}" style="background:${escapeHtmlAttribute(color)};color:${escapeHtmlAttribute(gradeTextColor)}">
  <img class="risk-shield-asset" src="${dataUri}" alt="" width="${w}" height="${h}" />
  <span class="risk-shield-grade">${escapeHtml(grade)}</span>
</div>`;
  }

  return `<div class="risk-shield risk-shield-fallback" data-grade="${escapeHtmlAttribute(
    grade
  )}" style="background:${escapeHtmlAttribute(color)};color:${escapeHtmlAttribute(
    gradeTextColor
  )}">
  <span class="risk-shield-grade">${escapeHtml(grade)}</span>
</div>`;
}
