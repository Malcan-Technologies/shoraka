/**
 * Word hanging-indent + tab stop for execution Name/Designation lines.
 * Tabs alone indent the first line; wrapped overflow starts at the left margin
 * (Deed of Assignment SSP “Independent” under Signed by). Hanging indent keeps
 * wrapped values under the value column. Wrap starts at the first character of
 * the value (after `: `), not at the colon. Shared by retag scripts and wrap tests.
 */

/** Tab from the label to the colon — matches Facility Agreement Investor/Agent. */
export const EXECUTION_LABEL_VALUE_HANGING_TWIPS = 1080;

/** ": " after the hanging tab, Arial 10pt via Gotenberg (5.5pt). */
export const COLON_AND_SPACE_TWIPS = 110;

export const FA_COLON_AND_SPACE_TWIPS = COLON_AND_SPACE_TWIPS;

export function hangingWrapFromColon(
  colonPosTwips: number,
  labelLeftTwips: number
): { wrapLeft: number; hanging: number; tabPos: number } {
  const wrapLeft = colonPosTwips + COLON_AND_SPACE_TWIPS;
  return { wrapLeft, hanging: wrapLeft - labelLeftTwips, tabPos: colonPosTwips };
}

export function hangingValueIndentXml(colonPosTwips: number, labelLeftTwips: number): string {
  const metrics = hangingWrapFromColon(colonPosTwips, labelLeftTwips);
  return `<w:tabs><w:tab w:val="left" w:pos="${metrics.tabPos}"/></w:tabs><w:ind w:left="${metrics.wrapLeft}" w:hanging="${metrics.hanging}"/><w:jc w:val="left"/>`;
}

/** Minimum colon tab so this label stays on one line. Table columns use the max of their labels. */
export function colonTabTwipsForLabel(label: string): number {
  if (label.startsWith("NRIC / Passport")) return 1800;
  if (label === "Name of Witness") return 1620;
  return EXECUTION_LABEL_VALUE_HANGING_TWIPS;
}

export function sharedColonTabTwipsForLabels(labels: readonly string[]): number {
  return Math.max(EXECUTION_LABEL_VALUE_HANGING_TWIPS, ...labels.map(colonTabTwipsForLabel));
}

/** FA issuer left: Name / Designation / Date. */
export const FA_ISSUER_SIGNATORY_COLON_TWIPS = sharedColonTabTwipsForLabels([
  "Name",
  "Designation",
  "Date",
]);
/** FA issuer witness: Name of Witness / NRIC / Date. */
export const FA_ISSUER_WITNESS_COLON_TWIPS = sharedColonTabTwipsForLabels([
  "Name of Witness",
  "NRIC",
  "Date",
]);
/** DoA assignor left: Name / NRIC / Passport No / Designation. */
export const DOA_ASSIGNOR_COLON_TWIPS = sharedColonTabTwipsForLabels([
  "Name",
  "NRIC / Passport No",
  "Designation",
]);
/** DoA assignor witness: Name / Designation. */
export const DOA_ASSIGNOR_WITNESS_COLON_TWIPS = sharedColonTabTwipsForLabels(["Name", "Designation"]);

/** Six default 720-twip tabs: where SSP “Name:” currently starts. */
export const DOA_SSP_LABEL_LEFT_TWIPS = 4320;
export const DOA_SSP_COLON_TWIPS = DOA_SSP_LABEL_LEFT_TWIPS + EXECUTION_LABEL_VALUE_HANGING_TWIPS;
export const DOA_SSP_WRAP_LEFT_TWIPS = DOA_SSP_COLON_TWIPS + COLON_AND_SPACE_TWIPS;
export const DOA_SSP_VALUE_HANGING_TWIPS = DOA_SSP_WRAP_LEFT_TWIPS - DOA_SSP_LABEL_LEFT_TWIPS;

/** Clean JSG attorney column: left 3600 + firstLine 936. */
export const JSG_OPERATOR_LABEL_LEFT_TWIPS = 4536;
export const JSG_OPERATOR_COLON_TWIPS =
  JSG_OPERATOR_LABEL_LEFT_TWIPS + EXECUTION_LABEL_VALUE_HANGING_TWIPS;
export const JSG_OPERATOR_WRAP_LEFT_TWIPS = JSG_OPERATOR_COLON_TWIPS + COLON_AND_SPACE_TWIPS;
export const JSG_OPERATOR_VALUE_HANGING_TWIPS =
  JSG_OPERATOR_WRAP_LEFT_TWIPS - JSG_OPERATOR_LABEL_LEFT_TWIPS;

/** LO “Attention :” stays at the left; wrapped names start at this tab (already the value). */
export const LO_ATTENTION_WRAP_LEFT_TWIPS = 2160;
export const LO_ATTENTION_POSITION_LEFT_TWIPS = 1440;

/** Investor/Agent Name column — Agent uses the same indent as Investor. */
export const FA_EXECUTION_LABEL_LEFT_TWIPS = 5040;
export const FA_EXECUTION_COLON_TWIPS =
  FA_EXECUTION_LABEL_LEFT_TWIPS + EXECUTION_LABEL_VALUE_HANGING_TWIPS;
export const FA_EXECUTION_VALUE_LEFT_TWIPS = FA_EXECUTION_COLON_TWIPS + COLON_AND_SPACE_TWIPS;
export const FA_EXECUTION_VALUE_HANGING_TWIPS =
  FA_EXECUTION_VALUE_LEFT_TWIPS - FA_EXECUTION_LABEL_LEFT_TWIPS;

export const FA_INVESTOR_WRAP_LEFT_TWIPS = FA_EXECUTION_VALUE_LEFT_TWIPS;
export const FA_AGENT_WRAP_LEFT_TWIPS = FA_EXECUTION_VALUE_LEFT_TWIPS;

export const FA_EXECUTION_STROKE_LEFT_TWIPS = 4320;
export const FA_EXECUTION_STROKE_FIRST_LINE_TWIPS = 720;

export function paragraphPinsHangingValueWrap(
  pXml: string,
  wrapLeftTwips: number,
  hangingTwips: number = EXECUTION_LABEL_VALUE_HANGING_TWIPS,
  tabPosTwips: number = wrapLeftTwips
): boolean {
  return (
    pXml.includes(`w:left="${wrapLeftTwips}"`) &&
    pXml.includes(`w:hanging="${hangingTwips}"`) &&
    pXml.includes(`w:pos="${tabPosTwips}"`) &&
    pXml.includes('w:jc w:val="left"')
  );
}

export function paragraphPinsFaExecutionValueWrap(pXml: string): boolean {
  return paragraphPinsHangingValueWrap(
    pXml,
    FA_EXECUTION_VALUE_LEFT_TWIPS,
    FA_EXECUTION_VALUE_HANGING_TWIPS,
    FA_EXECUTION_COLON_TWIPS
  );
}

export function paragraphPinsDoaSspValueWrap(pXml: string): boolean {
  return paragraphPinsHangingValueWrap(
    pXml,
    DOA_SSP_WRAP_LEFT_TWIPS,
    DOA_SSP_VALUE_HANGING_TWIPS,
    DOA_SSP_COLON_TWIPS
  );
}

export function paragraphPinsJsgOperatorValueWrap(pXml: string): boolean {
  return paragraphPinsHangingValueWrap(
    pXml,
    JSG_OPERATOR_WRAP_LEFT_TWIPS,
    JSG_OPERATOR_VALUE_HANGING_TWIPS,
    JSG_OPERATOR_COLON_TWIPS
  );
}

export function paragraphPinsTableHangingLabelWrap(
  pXml: string,
  label: string,
  colonPosTwips: number = colonTabTwipsForLabel(label)
): boolean {
  const metrics = hangingWrapFromColon(colonPosTwips, 0);
  return paragraphPinsHangingValueWrap(pXml, metrics.wrapLeft, metrics.hanging, metrics.tabPos);
}

export function xmlHasTableHangingLabelWrap(
  xml: string,
  label: string,
  colonPosTwips?: number
): boolean {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((match) => match[0])
    .some(
      (pXml) =>
        pXml.includes(label) &&
        paragraphPinsTableHangingLabelWrap(
          pXml,
          label,
          colonPosTwips ?? colonTabTwipsForLabel(label)
        )
    );
}

export function paragraphContaining(xml: string, needle: string): string {
  const idx = xml.indexOf(needle);
  if (idx < 0) return "";
  const start = Math.max(xml.lastIndexOf("<w:p ", idx), xml.lastIndexOf("<w:p>", idx));
  const end = xml.indexOf("</w:p>", idx);
  if (start < 0 || end < 0) return "";
  return xml.slice(start, end + "</w:p>".length);
}
