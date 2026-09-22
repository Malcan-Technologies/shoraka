/**
 * Long-string wrap smoke for generated Word templates.
 * XML assertions always run. The PDF check needs GOTENBERG_URL (skips if unset
 * or if Gotenberg is down), same pattern as signing-placement tests.
 */
import PizZip from "pizzip";
import { createDeedOfAssignmentFixture } from "../applications/deed-of-assignment/doa-fixture";
import { renderDeedOfAssignmentDocx } from "../applications/deed-of-assignment/render-doa-docx";
import { createFacilityAgreementFixture } from "../applications/facility-agreement/fa-fixture";
import { renderFacilityAgreementDocx } from "../applications/facility-agreement/render-fa-docx";
import { createJsgFixture } from "../applications/joint-several-guarantee/jsg-fixture";
import { renderJsgDocx } from "../applications/joint-several-guarantee/render-jsg-docx";
import { extractPdfTextItems } from "../applications/joint-several-guarantee/jsg-signing-placement";
import { createFacilityLoFixture } from "../applications/letter-of-offer/facility-lo-fixture";
import { renderFacilityLoDocx } from "../applications/letter-of-offer/render-facility-lo-docx";
import {
  convertDocxToPdf,
  DocxToPdfError,
  resolveGotenbergUrl,
} from "../applications/letter-of-offer/convert-docx-to-pdf";
import {
  DOA_ASSIGNOR_COLON_TWIPS,
  DOA_SSP_COLON_TWIPS,
  DOA_SSP_VALUE_HANGING_TWIPS,
  DOA_SSP_WRAP_LEFT_TWIPS,
  EXECUTION_LABEL_VALUE_HANGING_TWIPS,
  FA_EXECUTION_COLON_TWIPS,
  FA_EXECUTION_VALUE_HANGING_TWIPS,
  FA_EXECUTION_VALUE_LEFT_TWIPS,
  FA_ISSUER_WITNESS_COLON_TWIPS,
  JSG_OPERATOR_COLON_TWIPS,
  JSG_OPERATOR_VALUE_HANGING_TWIPS,
  JSG_OPERATOR_WRAP_LEFT_TWIPS,
  LO_ATTENTION_POSITION_LEFT_TWIPS,
  LO_ATTENTION_WRAP_LEFT_TWIPS,
  paragraphContaining,
  paragraphPinsHangingValueWrap,
  xmlHasTableHangingLabelWrap,
} from "./hanging-execution-label";
import {
  LONG_PERSON_NAME,
  LONG_SC_DESIGNATION,
  withLongDeedOfAssignmentStrings,
  withLongFacilityAgreementStrings,
  withLongFacilityLoStrings,
  withLongJsgStrings,
} from "./long-merge-strings";

function xmlOf(docx: Buffer): string {
  return new PizZip(docx).file("word/document.xml")?.asText() ?? "";
}

function hangingValueParagraphs(
  xml: string,
  wrapLeftTwips: number,
  hangingTwips: number = EXECUTION_LABEL_VALUE_HANGING_TWIPS,
  tabPosTwips: number = wrapLeftTwips
): string[] {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((match) => match[0])
    .filter((pXml) => paragraphPinsHangingValueWrap(pXml, wrapLeftTwips, hangingTwips, tabPosTwips));
}

function assertDesignationNotAtLeftMargin(
  items: Array<{ x: number; text: string }>,
  minX: number,
  label: string
): void {
  const hits = items.filter(
    (item) => item.text.includes("Non-Independent") || item.text.trim() === "Independent"
  );
  expect(hits.length).toBeGreaterThan(0);
  for (const hit of hits) {
    if (hit.x <= minX) {
      throw new Error(
        `${label}: wrapped designation ${JSON.stringify(hit.text)} is at x=${hit.x.toFixed(1)}, expected > ${minX}`
      );
    }
  }
}

describe("generated document merge wrap", () => {
  it("keeps long hanging-column values under the value with hanging indent", () => {
    const doaXml = xmlOf(
      renderDeedOfAssignmentDocx(withLongDeedOfAssignmentStrings(createDeedOfAssignmentFixture()))
    );
    const faXml = xmlOf(
      renderFacilityAgreementDocx(withLongFacilityAgreementStrings(createFacilityAgreementFixture()))
    );
    const jsgXml = xmlOf(renderJsgDocx(withLongJsgStrings(createJsgFixture())));
    const loXml = xmlOf(renderFacilityLoDocx(withLongFacilityLoStrings(createFacilityLoFixture())));

    expect(doaXml).toContain(LONG_SC_DESIGNATION);
    expect(doaXml).toContain(LONG_PERSON_NAME);
    expect(
      hangingValueParagraphs(
        doaXml,
        DOA_SSP_WRAP_LEFT_TWIPS,
        DOA_SSP_VALUE_HANGING_TWIPS,
        DOA_SSP_COLON_TWIPS
      ).filter((pXml) => pXml.includes(LONG_SC_DESIGNATION))
    ).toHaveLength(2);
    expect(xmlHasTableHangingLabelWrap(doaXml, "NRIC / Passport No")).toBe(true);
    expect(xmlHasTableHangingLabelWrap(doaXml, "Name", DOA_ASSIGNOR_COLON_TWIPS)).toBe(true);
    expect(xmlHasTableHangingLabelWrap(doaXml, "Designation", DOA_ASSIGNOR_COLON_TWIPS)).toBe(true);

    expect(
      hangingValueParagraphs(
        faXml,
        FA_EXECUTION_VALUE_LEFT_TWIPS,
        FA_EXECUTION_VALUE_HANGING_TWIPS,
        FA_EXECUTION_COLON_TWIPS
      ).filter((pXml) => pXml.includes(LONG_SC_DESIGNATION))
    ).toHaveLength(4);
    expect(xmlHasTableHangingLabelWrap(faXml, "Name of Witness")).toBe(true);
    expect(xmlHasTableHangingLabelWrap(faXml, "NRIC", FA_ISSUER_WITNESS_COLON_TWIPS)).toBe(true);

    expect(
      hangingValueParagraphs(
        jsgXml,
        JSG_OPERATOR_WRAP_LEFT_TWIPS,
        JSG_OPERATOR_VALUE_HANGING_TWIPS,
        JSG_OPERATOR_COLON_TWIPS
      ).filter((pXml) => pXml.includes(LONG_SC_DESIGNATION))
    ).toHaveLength(2);
    expect(xmlHasTableHangingLabelWrap(jsgXml, "NRIC No.")).toBe(true);

    expect(
      paragraphPinsHangingValueWrap(
        paragraphContaining(loXml, LONG_PERSON_NAME),
        LO_ATTENTION_WRAP_LEFT_TWIPS,
        LO_ATTENTION_WRAP_LEFT_TWIPS
      )
    ).toBe(true);
    expect(paragraphContaining(loXml, LONG_SC_DESIGNATION)).toContain(
      `w:left="${LO_ATTENTION_POSITION_LEFT_TWIPS}"`
    );
    expect(paragraphContaining(loXml, LONG_SC_DESIGNATION)).not.toContain("w:firstLine=");
  });

  it("places wrapped SC designations away from the left margin in PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    try {
      const [doaPdf, faPdf, jsgPdf, loPdf] = await Promise.all([
        convertDocxToPdf(
          renderDeedOfAssignmentDocx(withLongDeedOfAssignmentStrings(createDeedOfAssignmentFixture())),
          { fileName: "doa-wrap-smoke.docx" }
        ),
        convertDocxToPdf(
          renderFacilityAgreementDocx(withLongFacilityAgreementStrings(createFacilityAgreementFixture())),
          { fileName: "fa-wrap-smoke.docx" }
        ),
        convertDocxToPdf(renderJsgDocx(withLongJsgStrings(createJsgFixture())), {
          fileName: "jsg-wrap-smoke.docx",
        }),
        convertDocxToPdf(renderFacilityLoDocx(withLongFacilityLoStrings(createFacilityLoFixture())), {
          fileName: "lo-wrap-smoke.docx",
        }),
      ]);
      const [doaItems, faItems, jsgItems, loItems] = await Promise.all([
        extractPdfTextItems(doaPdf),
        extractPdfTextItems(faPdf),
        extractPdfTextItems(jsgPdf),
        extractPdfTextItems(loPdf),
      ]);
      assertDesignationNotAtLeftMargin(doaItems, 80, "DOA");
      assertDesignationNotAtLeftMargin(faItems, 80, "FA");
      assertDesignationNotAtLeftMargin(jsgItems, 160, "JSG");
      assertDesignationNotAtLeftMargin(loItems, 90, "LO");
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
  }, 120_000);
});
