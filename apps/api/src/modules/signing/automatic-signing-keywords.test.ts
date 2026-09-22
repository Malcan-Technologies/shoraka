import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  automaticSigningKeywordIssues,
  buildAutomaticSigningCloudSignsetsFromPdf,
  ensureAutomaticSigningKeywords,
  findAutomaticKeywordAnchors,
  signFieldFromAutomaticAnchor,
} from "./automatic-signing-keywords";
import type { JsgPdfTextItem } from "../applications/joint-several-guarantee/jsg-signing-placement";
import { createFacilityAgreementFixture } from "../applications/facility-agreement/fa-fixture";
import { renderFacilityAgreementDocx } from "../applications/facility-agreement/render-fa-docx";
import { createJsgFixture } from "../applications/joint-several-guarantee/jsg-fixture";
import { renderJsgDocx } from "../applications/joint-several-guarantee/render-jsg-docx";
import { withLongFacilityAgreementStrings, withLongJsgStrings } from "../generated-documents/long-merge-strings";
import {
  convertDocxToPdf,
  DocxToPdfError,
  resolveGotenbergUrl,
} from "../applications/letter-of-offer/convert-docx-to-pdf";
import { extractPdfTextItems } from "../applications/joint-several-guarantee/jsg-signing-placement";
import { LAYOUT_DETECTED_DATE_FIELD } from "./signature-field-geometry";
import { createDeedOfAssignmentFixture } from "../applications/deed-of-assignment/doa-fixture";
import { renderDeedOfAssignmentDocx } from "../applications/deed-of-assignment/render-doa-docx";
import {
  buildDoaSigningCloudSignsetsFromPdf,
  collectDoaAssignorSignatureSlots,
} from "../applications/deed-of-assignment/doa-signing-placement";
import {
  automaticSignerKeywordPair,
  defaultAutomaticKeywordOwners,
  executionRoleHasSignDate,
} from "@cashsouk/types";

function item(
  pageindex: number,
  yTop: number,
  x: number,
  text: string,
  width = 140
): JsgPdfTextItem {
  return {
    pageindex,
    yTop,
    x,
    text,
    width,
    height: 9,
    pageHeight: 842,
    pageWidth: 595,
  };
}

function keywordCount(text: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`${escaped}(?![A-Z0-9_])`, "g")) ?? []).length;
}

const FA_SLOTS = [
  { roleKey: "FA_INVESTOR" as const, slotIndex: 1 },
  { roleKey: "FA_INVESTOR" as const, slotIndex: 2 },
  { roleKey: "FA_AGENT" as const, slotIndex: 1 },
  { roleKey: "FA_AGENT" as const, slotIndex: 2 },
];

describe("automatic signing keywords", () => {
  it("anchors both signature strokes under Investor and Agent", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(8, 10, 72, "IN WITNESS WHEREOF the parties hereto have caused this Agreement"),
        item(8, 80, 268, "INVESTOR"),
        item(8, 173, 94, "______________________________"),
        item(8, 189, 94, "Name"),
        item(8, 189, 160, ":"),
        item(8, 205, 94, "Date :"),
        item(8, 173, 360, "______________________________"),
        item(8, 189, 360, "Name of Witness:"),
        item(8, 251, 94, "______________________________"),
        item(8, 266, 94, "Name :"),
        item(8, 282, 94, "Date :"),
        item(9, 80, 268, "AGENT"),
        item(9, 173, 94, "______________________________"),
        item(9, 189, 94, "Name :"),
        item(9, 205, 94, "Date :"),
        item(9, 251, 94, "______________________________"),
        item(9, 266, 94, "Name :"),
        item(9, 282, 94, "Date :"),
        item(10, 80, 268, "ISSUER"),
        item(10, 173, 94, "______________________________"),
        item(10, 189, 94, "Name : Ali Bin Abu"),
      ],
      FA_SLOTS
    );
    expect(anchors.map((anchor) => [anchor.roleKey, anchor.slotIndex, anchor.keyword, anchor.yTop])).toEqual([
      ["FA_INVESTOR", 1, "CASHSOUK_FA_INVESTOR_1", 173],
      ["FA_INVESTOR", 2, "CASHSOUK_FA_INVESTOR_2", 251],
      ["FA_AGENT", 1, "CASHSOUK_FA_AGENT_1", 173],
      ["FA_AGENT", 2, "CASHSOUK_FA_AGENT_2", 251],
    ]);
    expect(signFieldFromAutomaticAnchor(anchors[0]!)).toMatchObject({
      fieldtype: "sign",
      pageindex: 8,
      left: 94,
    });
    expect(anchors.map((anchor) => anchor.date?.yTop)).toEqual([205, 282, 205, 282]);
    const afterDateLabel =
      94 +
      Math.min(140, Math.max(24, "Date :".length * 5)) +
      LAYOUT_DETECTED_DATE_FIELD.leftGap;
    expect(anchors.map((anchor) => anchor.date?.x)).toEqual([
      afterDateLabel,
      afterDateLabel,
      afterDateLabel,
      afterDateLabel,
    ]);
    expect(anchors[0]!.date!.x).toBeGreaterThan(94);
    expect(anchors[0]!.date!.x).toBeLessThan(94 + 140);
  });

  it("anchors issuer-witness strokes when pdfjs glued Name and Name of Witness", () => {
    const glued =
      "Name : Tunku Puan Sri Datin Seri Wan Name of Witness : Tunku Puan Sri Datin Seri";
    const anchors = findAutomaticKeywordAnchors(
      [
        item(44, 10, 72, "IN WITNESS WHEREOF the parties hereto have caused this Agreement"),
        item(44, 40, 268, "AGENT"),
        item(44, 82, 72, "ISSUER"),
        item(44, 191.8, 77.5, "________________________", 105),
        item(44, 191.8, 303.1, "______________________", 97),
        item(44, 205.4, 77.5, glued, 428),
        item(44, 284.9, 77.5, "Date :", 57),
        item(44, 284.9, 303.1, "Date :", 57),
        item(44, 444.5, 77.5, "________________________", 105),
        item(44, 444.5, 303.1, "______________________", 97),
        item(44, 458.1, 77.5, glued, 428),
        item(44, 537.6, 77.5, "Date :", 57),
        item(44, 537.6, 303.1, "Date :", 57),
        item(45, 82, 263, "SCHEDULE 1"),
      ],
      [
        { roleKey: "FA_ISSUER_WITNESS", slotIndex: 1 },
        { roleKey: "FA_ISSUER_WITNESS", slotIndex: 2 },
      ]
    );
    expect(anchors.map((anchor) => [anchor.slotIndex, Number(anchor.yTop.toFixed(1)), Number(anchor.x.toFixed(1))])).toEqual([
      [1, 191.8, 303.1],
      [2, 444.5, 303.1],
    ]);
    expect(anchors.map((anchor) => Number(anchor.date?.yTop.toFixed(1)))).toEqual([284.9, 537.6]);
  });

  it("places automatic date keywords in the Name/Designation value column, not on Date", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(8, 10, 72, "IN WITNESS WHEREOF the parties hereto have caused this Agreement"),
        item(8, 80, 268, "INVESTOR"),
        item(8, 173, 288, "___________________________", 140),
        item(8, 189, 288, "Name", 28),
        item(8, 189, 360, ":", 4),
        item(8, 189, 368, "Aisha Rahman", 70),
        item(8, 197, 288, "Designation:", 58),
        item(8, 197, 368, "Chief Executive Officer", 110),
        item(8, 205, 288, "Date", 22),
        item(8, 205, 360, ":", 4),
        item(8, 251, 288, "___________________________", 140),
        item(8, 266, 288, "Name", 28),
        item(8, 266, 360, ":", 4),
        item(8, 266, 368, "Ben Tan", 40),
        item(8, 274, 288, "Designation:", 58),
        item(8, 274, 368, "Director", 40),
        item(8, 282, 288, "Date", 22),
        item(8, 282, 360, ":", 4),
        item(9, 80, 268, "AGENT"),
        item(9, 173, 94, "______________________________"),
        item(9, 189, 94, "Name :"),
        item(9, 205, 94, "Date :"),
        item(9, 251, 94, "______________________________"),
        item(9, 266, 94, "Name :"),
        item(9, 282, 94, "Date :"),
        item(10, 80, 268, "ISSUER"),
      ],
      FA_SLOTS
    );
    const valueColumn = 360 + LAYOUT_DETECTED_DATE_FIELD.leftGap;
    expect(anchors.slice(0, 2).map((anchor) => anchor.date?.x)).toEqual([valueColumn, valueColumn]);
    expect(anchors[0]!.date!.x).toBeGreaterThan(288 + 22);
    expect(anchors[0]!.date!.yTop).toBe(205);
  });

  it("reuses one hanging-tab X when a stacked Date line has no split colon", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(8, 10, 72, "IN WITNESS WHEREOF the parties hereto have caused this Agreement"),
        item(8, 80, 268, "INVESTOR"),
        item(8, 173, 288, "___________________________", 140),
        item(8, 189, 288, "Name", 28),
        item(8, 189, 360, ":", 4),
        item(8, 189, 368, "Aisha Rahman", 70),
        item(8, 197, 288, "Designation:", 58),
        item(8, 197, 368, "Chief Executive Officer", 110),
        item(8, 205, 288, "Date", 22),
        item(8, 205, 360, ":", 4),
        item(8, 251, 288, "___________________________", 140),
        item(8, 266, 288, "Name :", 140),
        item(8, 282, 288, "Date :", 200),
        item(9, 80, 268, "AGENT"),
        item(9, 173, 94, "______________________________"),
        item(9, 189, 94, "Name :"),
        item(9, 205, 94, "Date :"),
        item(9, 251, 94, "______________________________"),
        item(9, 266, 94, "Name :"),
        item(9, 282, 94, "Date :"),
        item(10, 80, 268, "ISSUER"),
      ],
      FA_SLOTS
    );
    const valueColumn = 360 + LAYOUT_DETECTED_DATE_FIELD.leftGap;
    expect(anchors[0]!.date?.x).toBe(valueColumn);
    expect(anchors[1]!.date?.x).toBe(valueColumn);
  });

  it("reads hanging Date colons from unmerged glyphs when the line gap is under 40pt", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(8, 10, 72, "IN WITNESS WHEREOF the parties hereto have caused this Agreement"),
        item(8, 80, 268, "INVESTOR"),
        item(8, 173, 324, "___________________________", 140),
        item(8, 226, 324, "Name", 27),
        item(8, 226, 378, ":", 3),
        item(8, 253, 324, "Date", 21),
        item(8, 253, 378, ":", 3),
        item(8, 320, 324, "___________________________", 140),
        item(8, 367, 324, "Name", 27),
        item(8, 367, 378, ":", 3),
        item(8, 394, 324, "Date", 21),
        item(8, 394, 378, ":", 3),
        item(9, 80, 268, "AGENT"),
        item(9, 173, 94, "______________________________"),
        item(9, 189, 94, "Name :"),
        item(9, 205, 94, "Date :"),
        item(9, 251, 94, "______________________________"),
        item(9, 266, 94, "Name :"),
        item(9, 282, 94, "Date :"),
        item(10, 80, 268, "ISSUER"),
      ],
      FA_SLOTS
    );
    const tab = 378 + LAYOUT_DETECTED_DATE_FIELD.leftGap;
    expect(anchors[0]!.date?.x).toBe(tab);
    expect(anchors[1]!.date?.x).toBe(tab);
  });

  it("anchors Investor strokes on the original hanging tabbed signature lines", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(8, 10, 72, "IN WITNESS WHEREOF the parties hereto have caused this Agreement"),
        item(8, 80, 268, "INVESTOR"),
        item(8, 120, 72, "SIGNED BY authorised representatives of"),
        item(
          8,
          173,
          72,
          "Shoraka Suyula Platform Sdn. Bhd. ___________________________",
          400
        ),
        item(8, 189, 288, "Name :"),
        item(8, 205, 288, "Date"),
        item(8, 205, 360, ":"),
        item(8, 251, 288, "___________________________", 140),
        item(8, 266, 288, "Name :"),
        item(8, 282, 288, "Date :"),
        item(9, 80, 268, "AGENT"),
        item(9, 173, 94, "______________________________"),
        item(9, 189, 94, "Name :"),
        item(9, 205, 94, "Date :"),
        item(9, 251, 94, "______________________________"),
        item(9, 266, 94, "Name :"),
        item(9, 282, 94, "Date :"),
        item(10, 80, 268, "ISSUER"),
      ],
      FA_SLOTS
    );
    expect(anchors.map((anchor) => [anchor.keyword, anchor.yTop])).toEqual([
      ["CASHSOUK_FA_INVESTOR_1", 173],
      ["CASHSOUK_FA_INVESTOR_2", 251],
      ["CASHSOUK_FA_AGENT_1", 173],
      ["CASHSOUK_FA_AGENT_2", 251],
    ]);
    expect(anchors[0]!.x).toBeGreaterThan(72);
    expect(anchors[0]!.date?.x).toBe(anchors[1]!.date?.x);
  });

  it("rejects a Facility Agreement block with only one signatory stroke", () => {
    expect(() =>
      findAutomaticKeywordAnchors(
        [
          item(8, 10, 72, "IN WITNESS WHEREOF the parties hereto have caused this Agreement"),
          item(8, 80, 268, "INVESTOR"),
          item(8, 173, 94, "______________________________"),
          item(8, 189, 94, "Name :"),
          item(9, 80, 268, "AGENT"),
          item(9, 173, 94, "______________________________"),
          item(9, 189, 94, "Name :"),
          item(9, 251, 94, "______________________________"),
          item(9, 266, 94, "Name :"),
          item(10, 80, 268, "ISSUER"),
        ],
        FA_SLOTS
      )
    ).toThrow(/missing 2 signature lines/);
  });

  it("anchors both Deed of Assignment SSP strokes under SHORAKA SUYULA PLATFORM, not assignor strokes", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(9, 81, 72, "IN WITNESS WHEREOF the Parties hereto have duly executed this Assignment", 355),
        item(9, 103, 72, "SHORAKA SUYULA PLATFORM", 151),
        item(9, 172, 72, "SHORAKA SUYULA PLATFORM", 151),
        item(9, 172, 288, "______________________________________", 211),
        item(9, 185, 288, "Name:"),
        item(9, 199, 288, "Designation:"),
        item(9, 318, 288, "______________________________________", 211),
        item(9, 332, 288, "Name:"),
        item(9, 345, 288, "Designation:"),
        item(9, 380, 285, "[SSP]"),
        item(9, 392, 285, "Company Stamp:"),
        item(10, 81, 72, "ASSIGNOR – [MINIMUM OF TWO (2) AUTHORISED SIGNATORIES’ SIGNATURES ARE REQUIRED"),
        item(10, 231, 78, "______________________________________"),
        item(10, 268, 78, "Name: Kau Khai Kit"),
      ],
      [
        { roleKey: "DOA_SSP", slotIndex: 1 },
        { roleKey: "DOA_SSP", slotIndex: 2 },
      ]
    );
    expect(anchors.map((anchor) => [anchor.keyword, anchor.yTop, anchor.x])).toEqual([
      ["CASHSOUK_DOA_SSP_1", 172, 288],
      ["CASHSOUK_DOA_SSP_2", 318, 288],
    ]);
  });

  it("still finds the first SSP stroke when it is joined to the company-name line", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(9, 103, 72, "SHORAKA SUYULA PLATFORM", 151),
        item(9, 172, 72, "SHORAKA SUYULA PLATFORM ) ______________________________________", 400),
        item(9, 185, 238, "Name:"),
        item(9, 199, 288, "Designation:"),
        item(9, 318, 288, "______________________________________", 211),
        item(9, 332, 288, "Name:"),
        item(9, 345, 288, "Designation:"),
        item(9, 380, 285, "[SSP]"),
        item(10, 81, 72, "ASSIGNOR – [MINIMUM OF TWO (2) AUTHORISED SIGNATORIES’ SIGNATURES ARE REQUIRED"),
      ],
      [
        { roleKey: "DOA_SSP", slotIndex: 1 },
        { roleKey: "DOA_SSP", slotIndex: 2 },
      ]
    );
    expect(anchors).toHaveLength(2);
    expect(anchors[0]?.yTop).toBe(172);
    expect(anchors[0]?.x).toBeGreaterThan(72);
    expect(anchors[1]?.yTop).toBe(318);
  });

  it("anchors assignor-witness keywords on the right-column stroke, not the assignor stroke", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(9, 103, 72, "SHORAKA SUYULA PLATFORM", 151),
        item(9, 172, 288, "______________________________________", 211),
        item(9, 185, 288, "Name: Aisha Rahman"),
        item(9, 318, 288, "______________________________________", 211),
        item(9, 332, 288, "Name: Ben Tan"),
        item(9, 528, 72, "ASSIGNOR – [MINIMUM OF TWO (2) AUTHORISED SIGNATORIES’ SIGNATURES ARE REQUIRED"),
        item(10, 81.4, 77.5, "______________________________________", 208),
        item(10, 81.4, 303.1, "_______________________________", 172),
        item(10, 99.8, 303.1, "[Witness]", 41),
        item(10, 118.1, 77.5, "Name: Ali Bin Abu"),
        item(10, 118.1, 303.1, "Name: Chloe Lim"),
        item(10, 287.9, 77.5, "______________________________________", 208),
        item(10, 287.9, 303.1, "_______________________________", 172),
        item(10, 306.3, 303.1, "[Witness]", 41),
        item(10, 324.6, 77.5, "Name: Siti Binti Ahmad"),
        item(10, 324.6, 303.1, "Name: Chloe Lim"),
      ],
      [
        { roleKey: "DOA_SSP", slotIndex: 1 },
        { roleKey: "DOA_SSP", slotIndex: 2 },
        { roleKey: "DOA_ASSIGNOR_WITNESS", slotIndex: 1 },
        { roleKey: "DOA_ASSIGNOR_WITNESS", slotIndex: 2 },
      ]
    );
    expect(
      anchors.map((anchor) => [anchor.keyword, Number(anchor.yTop.toFixed(1)), Math.round(anchor.x)])
    ).toEqual([
      ["CASHSOUK_DOA_SSP_1", 172, 288],
      ["CASHSOUK_DOA_SSP_2", 318, 288],
      ["CASHSOUK_DOA_ASSIGNOR_WITNESS_1", 81.4, 303],
      ["CASHSOUK_DOA_ASSIGNOR_WITNESS_2", 287.9, 303],
    ]);
    expect(anchors.slice(2).map((anchor) => anchor.date?.yTop)).toEqual([undefined, undefined]);
  });

  it("still finds both SSP strokes when the first underscore shares the company-name baseline", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(9, 103, 72, "SHORAKA SUYULA PLATFORM", 151),
        item(9, 172, 72, "SHORAKA SUYULA PLATFORM", 151),
        item(9, 172, 252, ")", 3),
        item(9, 172, 288, "______________________________________", 211),
        item(9, 185, 288, "Name:"),
        item(9, 199, 288, "Designation:"),
        item(9, 318, 288, "______________________________________", 211),
        item(9, 332, 288, "Name:"),
        item(9, 345, 288, "Designation:"),
        item(9, 380, 285, "[SSP]"),
        item(10, 81, 72, "ASSIGNOR – [MINIMUM OF TWO (2) AUTHORISED SIGNATORIES’ SIGNATURES ARE REQUIRED"),
        item(10, 231, 78, "______________________________________"),
        item(10, 268, 78, "Name: Kau Khai Kit"),
      ],
      [
        { roleKey: "DOA_SSP", slotIndex: 1 },
        { roleKey: "DOA_SSP", slotIndex: 2 },
      ]
    );
    expect(anchors.map((anchor) => [anchor.keyword, anchor.yTop, anchor.x])).toEqual([
      ["CASHSOUK_DOA_SSP_1", 172, 288],
      ["CASHSOUK_DOA_SSP_2", 318, 288],
    ]);
  });

  it("still finds both SSP strokes when a CashSouk keyword has joined an underscore line", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(9, 103, 72, "SHORAKA SUYULA PLATFORM", 151),
        item(9, 172, 288, "______________________________________CASHSOUK_DOA_SSP_1", 211),
        item(9, 185, 288, "Name:"),
        item(9, 318, 288, "______________________________________", 211),
        item(9, 332, 288, "Name:"),
        item(9, 380, 285, "[SSP]"),
        item(10, 81, 72, "ASSIGNOR – [MINIMUM OF TWO (2) AUTHORISED SIGNATORIES’ SIGNATURES ARE REQUIRED"),
        item(10, 231, 78, "______________________________________"),
        item(10, 268, 78, "Name: Kau Khai Kit"),
      ],
      [
        { roleKey: "DOA_SSP", slotIndex: 1 },
        { roleKey: "DOA_SSP", slotIndex: 2 },
      ]
    );
    expect(anchors.map((anchor) => [anchor.pageindex, anchor.yTop, anchor.x])).toEqual([
      [9, 172, 288],
      [9, 318, 288],
    ]);
  });

  it("anchors both Operator attorney strokes and the witness stroke", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(12, 40, 72, "OPERATOR"),
        item(12, 80, 72, "Signed by its Attorney for and on behalf of"),
        item(12, 173, 288, "........................................................................"),
        item(12, 189, 288, "Name: Aisha Rahman"),
        item(12, 202, 288, "NRIC No.: 850101015555"),
        item(12, 215, 288, "Designation: Chief Executive Officer"),
        item(12, 250, 72, "........................................................................"),
        item(12, 266, 72, "Signature of Witness"),
        item(12, 320, 288, "........................................................................"),
        item(12, 336, 288, "Name: Ben Tan"),
        item(12, 349, 288, "NRIC No.: 860202025555"),
        item(12, 362, 288, "Designation: Director"),
        item(13, 40, 72, "SCHEDULE 1"),
      ],
      [
        { roleKey: "JSG_OPERATOR", slotIndex: 1 },
        { roleKey: "JSG_OPERATOR", slotIndex: 2 },
        { roleKey: "JSG_OPERATOR_WITNESS", slotIndex: 1 },
      ]
    );
    expect(anchors.map((anchor) => [anchor.keyword, anchor.yTop, Math.round(anchor.x)])).toEqual([
      ["CASHSOUK_JSG_OPERATOR_1", 173, 288],
      ["CASHSOUK_JSG_OPERATOR_2", 320, 288],
      ["CASHSOUK_JSG_OPERATOR_WITNESS_1", 250, 72],
    ]);
    expect(anchors.map((anchor) => anchor.date?.yTop)).toEqual([undefined, undefined, undefined]);
  });

  it("finds the guarantor-witness Date after wrapped Full Name and NRIC", () => {
    const anchors = findAutomaticKeywordAnchors(
      [
        item(12, 80, 268, "EXECUTION PAGE"),
        item(12, 189, 325, "..............................................................", 160),
        item(12, 205, 325, "Signature of Witness"),
        item(12, 221, 325, "Full Name : Tunku Puan Sri Datin Seri Wan Nur", 200),
        item(12, 237, 325, "Aisyah binti Tengku Abdul Rahman", 160),
        item(12, 253, 325, "NRIC No. : 900101-14-5678 / Passport", 170),
        item(12, 269, 325, "No. 1234567890123456", 140),
        item(12, 300, 325, "Date: ________________", 104),
        item(13, 80, 283, "OPERATOR"),
      ],
      [{ roleKey: "JSG_GUARANTOR_WITNESS", slotIndex: 1 }]
    );
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.date?.yTop).toBe(300);
    expect(Math.round(anchors[0]?.date?.yTop ?? 0) - 189).toBeGreaterThan(105);
  });

  it("reports missing and duplicate keywords", () => {
    const investor = {
      signKeyword: "CASHSOUK_FA_PFAINVESTOR1_SIGN",
      dateKeyword: "CASHSOUK_FA_PFAINVESTOR1_DATE",
      placements: [{ roleKey: "FA_INVESTOR" as const, slotIndex: 1 }],
    };
    const items = [
      item(1, 40, 40, `${investor.signKeyword} ${investor.signKeyword} ${investor.dateKeyword}`),
    ];
    expect(automaticSigningKeywordIssues(items, [investor])).toEqual([
      `Duplicate automatic-signing keyword ${investor.signKeyword}.`,
    ]);
    expect(keywordCount(`${investor.signKeyword} ${investor.dateKeyword}`, investor.signKeyword)).toBe(1);
    expect(keywordCount(`${investor.signKeyword} ${investor.dateKeyword}`, investor.dateKeyword!)).toBe(1);
    expect(
      automaticSigningKeywordIssues(items, [
        {
          signKeyword: "CASHSOUK_DOA_PDOASSP1_SIGN",
          placements: [{ roleKey: "DOA_SSP", slotIndex: 1 }],
        },
      ])[0]
    ).toMatch(/Missing/);
  });

  it("counts sibling _SIGN and _DATE markers independently", () => {
    const pair = automaticSignerKeywordPair("FA", "sp-aisha", [{ roleKey: "FA_INVESTOR" }]);
    expect(pair.dateKeyword).toBeDefined();
    expect(pair.signKeyword.includes(pair.dateKeyword!)).toBe(false);
    expect(pair.dateKeyword!.includes(pair.signKeyword)).toBe(false);
    const line = `${pair.signKeyword} ${pair.dateKeyword}`;
    expect(keywordCount(line, pair.signKeyword)).toBe(1);
    expect(keywordCount(line, pair.dateKeyword!)).toBe(1);
    expect(keywordCount(pair.dateKeyword!, pair.signKeyword)).toBe(0);
    expect(keywordCount(pair.signKeyword, pair.dateKeyword!)).toBe(0);
  });

  it("stamps missing keywords so PDF text extraction can read them", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("EXECUTION PAGE", { x: 72, y: 800, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("______________________________", {
      x: 72,
      y: 770,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText("Signature of Witness", { x: 72, y: 755, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText("Date: ________________", { x: 72, y: 740, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText("OPERATOR", { x: 72, y: 700, size: 12, font, color: rgb(0, 0, 0) });
    page.drawText("______________________________", {
      x: 288,
      y: 650,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText("Name :", { x: 288, y: 630, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText("______________________________", {
      x: 288,
      y: 560,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText("Name :", { x: 288, y: 540, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText("______________________________", {
      x: 72,
      y: 480,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText("Signature of Witness", { x: 72, y: 465, size: 10, font, color: rgb(0, 0, 0) });
    const owners = defaultAutomaticKeywordOwners("guarantor_agreement");
    const stamped = await ensureAutomaticSigningKeywords(
      Buffer.from(await pdf.save()),
      "guarantor_agreement",
      undefined,
      owners
    );
    const texts = (await extractPdfTextItems(stamped)).map((row) => row.text).join(" ");
    for (const owner of owners) {
      expect(keywordCount(texts, owner.signKeyword)).toBe(owner.placements.length);
      if (owner.dateKeyword) {
        expect(keywordCount(texts, owner.dateKeyword)).toBe(
          owner.placements.filter((placement) => executionRoleHasSignDate(placement.roleKey)).length
        );
      }
    }
    const operatorOwners = owners.filter((owner) =>
      owner.placements.every((placement) => placement.roleKey === "JSG_OPERATOR")
    );
    expect(operatorOwners.length).toBeGreaterThan(0);
    expect(operatorOwners.every((owner) => !owner.dateKeyword)).toBe(true);
    const operatorWitness = owners.find((owner) =>
      owner.placements.some((placement) => placement.roleKey === "JSG_OPERATOR_WITNESS")
    );
    expect(operatorWitness?.dateKeyword).toBeUndefined();
  });

  it("reuses one hidden keyword pair across repeated witness lines", async () => {
    const pdf = await PDFDocument.create();
    const sspPage = pdf.addPage([595, 842]);
    const assignorPage = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    sspPage.drawText("SHORAKA SUYULA PLATFORM", { x: 72, y: 740, size: 12, font, color: rgb(0, 0, 0) });
    sspPage.drawText("______________________________________", { x: 288, y: 670, size: 12, font, color: rgb(0, 0, 0) });
    sspPage.drawText("Name:", { x: 288, y: 654, size: 10, font, color: rgb(0, 0, 0) });
    sspPage.drawText("______________________________________", { x: 288, y: 524, size: 12, font, color: rgb(0, 0, 0) });
    sspPage.drawText("Name:", { x: 288, y: 508, size: 10, font, color: rgb(0, 0, 0) });
    assignorPage.drawText(
      "ASSIGNOR – [MINIMUM OF TWO (2) AUTHORISED SIGNATORIES’ SIGNATURES ARE REQUIRED",
      { x: 72, y: 800, size: 10, font, color: rgb(0, 0, 0) }
    );
    assignorPage.drawText("________________________", { x: 78, y: 760, size: 12, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("_______________________________", { x: 303, y: 760, size: 12, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("[Witness]", { x: 303, y: 742, size: 10, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("Name: Ali Bin Abu", { x: 78, y: 724, size: 10, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("Name: Chloe Lim", { x: 303, y: 724, size: 10, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("________________________", { x: 78, y: 554, size: 12, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("_______________________________", { x: 303, y: 554, size: 12, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("[Witness]", { x: 303, y: 536, size: 10, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("Name: Siti Binti Ahmad", { x: 78, y: 518, size: 10, font, color: rgb(0, 0, 0) });
    assignorPage.drawText("Name: Chloe Lim", { x: 303, y: 518, size: 10, font, color: rgb(0, 0, 0) });
    const pair = automaticSignerKeywordPair("DOA", "sp-chloe", [
      { roleKey: "DOA_ASSIGNOR_WITNESS" },
      { roleKey: "DOA_ASSIGNOR_WITNESS" },
    ]);
    const owners = [
      ...defaultAutomaticKeywordOwners("deed_of_assignment", { assignorSignatoryCount: 2 }).filter(
        (owner) => owner.placements.every((placement) => placement.roleKey !== "DOA_ASSIGNOR_WITNESS")
      ),
      {
        ...pair,
        placements: [
          { roleKey: "DOA_ASSIGNOR_WITNESS" as const, slotIndex: 1 },
          { roleKey: "DOA_ASSIGNOR_WITNESS" as const, slotIndex: 2 },
        ],
      },
    ];
    const stamped = await ensureAutomaticSigningKeywords(
      Buffer.from(await pdf.save()),
      "deed_of_assignment",
      { assignorSignatoryCount: 2 },
      owners
    );
    const text = (await extractPdfTextItems(stamped)).map((row) => row.text).join("\n");
    expect(keywordCount(text, pair.signKeyword)).toBe(2);
    expect(pair.dateKeyword).toBeUndefined();
  });

  it("keeps a long email date keyword extractable on a right-hand Date line", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    page.drawText("IN WITNESS WHEREOF the parties hereto have caused this Agreement", {
      x: 72,
      y: 820,
      size: 10,
      font,
      color: black,
    });
    page.drawText("INVESTOR", { x: 268, y: 790, size: 12, font, color: black });
    page.drawText("___________________________", { x: 360, y: 750, size: 12, font, color: black });
    page.drawText("Name : Aisha Rahman", { x: 360, y: 734, size: 10, font, color: black });
    page.drawText("Designation: Chief Executive Officer", { x: 360, y: 718, size: 10, font, color: black });
    page.drawText("Date :", { x: 360, y: 702, size: 10, font, color: black });
    page.drawText("___________________________", { x: 360, y: 650, size: 12, font, color: black });
    page.drawText("Name : Ben Tan", { x: 360, y: 634, size: 10, font, color: black });
    page.drawText("Designation: Director", { x: 360, y: 618, size: 10, font, color: black });
    page.drawText("Date :", { x: 360, y: 602, size: 10, font, color: black });
    page.drawText("AGENT", { x: 72, y: 560, size: 12, font, color: black });
    page.drawText("___________________________", { x: 360, y: 520, size: 12, font, color: black });
    page.drawText("Name : Aisha Rahman", { x: 360, y: 504, size: 10, font, color: black });
    page.drawText("Designation: Chief Executive Officer", { x: 360, y: 488, size: 10, font, color: black });
    page.drawText("Date :", { x: 360, y: 472, size: 10, font, color: black });
    page.drawText("___________________________", { x: 360, y: 420, size: 12, font, color: black });
    page.drawText("Name : Ben Tan", { x: 360, y: 404, size: 10, font, color: black });
    page.drawText("Designation: Director", { x: 360, y: 388, size: 10, font, color: black });
    page.drawText("Date :", { x: 360, y: 372, size: 10, font, color: black });
    page.drawText("ISSUER", { x: 72, y: 320, size: 12, font, color: black });
    page.drawText("___________________________", { x: 94, y: 280, size: 12, font, color: black });
    page.drawText("Name : Ali Bin Abu", { x: 94, y: 264, size: 10, font, color: black });
    page.drawText("___________________________", { x: 360, y: 280, size: 12, font, color: black });
    page.drawText("Name of Witness", { x: 360, y: 264, size: 10, font, color: black });
    page.drawText("Date :", { x: 360, y: 248, size: 10, font, color: black });
    const emails = ["khai.kit@malcan.io", "max.chng@truestack.my", "kaukhaikit@gmail.com"];
    const slots = [
      { roleKey: "FA_INVESTOR" as const, slotIndex: 1 },
      { roleKey: "FA_INVESTOR" as const, slotIndex: 2 },
      { roleKey: "FA_AGENT" as const, slotIndex: 1 },
      { roleKey: "FA_AGENT" as const, slotIndex: 2 },
      { roleKey: "FA_ISSUER_WITNESS" as const, slotIndex: 1 },
    ];
    const groups = new Map<string, typeof slots>();
    for (const [index, slot] of slots.entries()) {
      const email = emails[index % emails.length]!;
      const list = groups.get(email) ?? [];
      list.push(slot);
      groups.set(email, list);
    }
    const owners = [...groups.entries()].map(([email, placements]) => ({
      ...automaticSignerKeywordPair("FA", email, placements),
      placements,
    }));
    const stamped = await ensureAutomaticSigningKeywords(
      Buffer.from(await pdf.save()),
      "facility_agreement",
      { issuerSignatoryCount: 1 },
      owners
    );
    const text = (await extractPdfTextItems(stamped)).map((row) => row.text).join("\n");
    expect(text).toContain("CASHSOUK_FA_KAUKHAIKITGMAILCOM_DATE");
    for (const owner of owners) {
      expect(keywordCount(text, owner.signKeyword)).toBe(owner.placements.length);
      if (!owner.dateKeyword) continue;
      expect(keywordCount(text, owner.dateKeyword)).toBe(
        owner.placements.filter((placement) => executionRoleHasSignDate(placement.roleKey)).length
      );
    }
    const dateGlyphs = (await extractPdfTextItems(stamped)).filter((row) =>
      /CASHSOUK_FA_.*_DATE/.test(row.text)
    );
    const fontAfter = await PDFDocument.create().then((doc) => doc.embedFont(StandardFonts.Helvetica));
    const stampWidth = fontAfter.widthOfTextAtSize("00/00/0000", 10);
    const impliedLeft = dateGlyphs.map(
      (row) => row.x + row.width / 2 - stampWidth / 2
    );
    expect(Math.max(...impliedLeft) - Math.min(...impliedLeft)).toBeLessThan(8);
    const restamped = await extractPdfTextItems(stamped);
    const afterStamp = findAutomaticKeywordAnchors(restamped, slots);
    expect(afterStamp.filter((anchor) => executionRoleHasSignDate(anchor.roleKey)).every((anchor) => anchor.date)).toBe(
      true
    );
  });

  it("stamps two Investor and two Agent keywords on a Facility Agreement PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    let pdf: Buffer;
    try {
      pdf = await convertDocxToPdf(renderFacilityAgreementDocx(createFacilityAgreementFixture()));
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
    const repeats = { issuerSignatoryCount: 2 };
    const owners = defaultAutomaticKeywordOwners("facility_agreement", repeats);
    const stamped = await ensureAutomaticSigningKeywords(pdf, "facility_agreement", repeats, owners);
    const text = (await extractPdfTextItems(stamped)).map((row) => row.text).join("\n");
    for (const owner of owners) {
      expect(keywordCount(text, owner.signKeyword)).toBe(owner.placements.length);
      if (owner.dateKeyword) {
        expect(keywordCount(text, owner.dateKeyword)).toBe(owner.placements.length);
      }
    }
  }, 120_000);

  it("stamps issuer-witness keywords on a wrap-test Facility Agreement PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    let pdf: Buffer;
    try {
      pdf = await convertDocxToPdf(
        renderFacilityAgreementDocx(withLongFacilityAgreementStrings(createFacilityAgreementFixture()))
      );
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
    const repeats = { issuerSignatoryCount: 2 };
    const owners = defaultAutomaticKeywordOwners("facility_agreement", repeats);
    const stamped = await ensureAutomaticSigningKeywords(pdf, "facility_agreement", repeats, owners);
    const text = (await extractPdfTextItems(stamped)).map((row) => row.text).join("\n");
    for (const owner of owners) {
      expect(keywordCount(text, owner.signKeyword)).toBe(owner.placements.length);
      if (owner.dateKeyword) {
        expect(keywordCount(text, owner.dateKeyword)).toBe(owner.placements.length);
      }
    }
    const automatic = await buildAutomaticSigningCloudSignsetsFromPdf(
      stamped,
      "facility_agreement",
      repeats
    );
    expect(automatic.get("FA_ISSUER_WITNESS:1")?.map((field) => field.fieldtype)).toEqual(["sign"]);
    expect(automatic.get("FA_ISSUER_WITNESS:2")?.map((field) => field.fieldtype)).toEqual(["sign"]);
  }, 120_000);

  it("stamps Operator and operator-witness signatures, and guarantor-witness dates, on a JSG PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    const fixture = createJsgFixture();
    const names = [
      ...fixture.guarantors_individual.map((row) => row.name),
      ...fixture.guarantors_corporate.flatMap((row) => row.signatories.map((signatory) => signatory.name)),
    ].filter(Boolean);
    let pdf: Buffer;
    try {
      pdf = await convertDocxToPdf(renderJsgDocx(fixture));
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
    const repeats = { jsgGuarantorSignatureCount: names.length };
    const owners = defaultAutomaticKeywordOwners("guarantor_agreement", repeats);
    const stamped = await ensureAutomaticSigningKeywords(pdf, "guarantor_agreement", repeats, owners);
    const text = (await extractPdfTextItems(stamped)).map((row) => row.text).join("\n");
    for (const owner of owners) {
      expect(keywordCount(text, owner.signKeyword)).toBe(owner.placements.length);
      const dateExpected = owner.placements.filter((placement) =>
        executionRoleHasSignDate(placement.roleKey)
      ).length;
      if (owner.dateKeyword) expect(keywordCount(text, owner.dateKeyword)).toBe(dateExpected);
      else expect(dateExpected).toBe(0);
    }
    const automatic = await buildAutomaticSigningCloudSignsetsFromPdf(
      stamped,
      "guarantor_agreement",
      repeats
    );
    expect(automatic.get("JSG_OPERATOR:1")?.map((field) => field.fieldtype)).toEqual(["sign"]);
    expect(automatic.get("JSG_OPERATOR:2")?.map((field) => field.fieldtype)).toEqual(["sign"]);
    expect(automatic.get("JSG_OPERATOR_WITNESS:1")?.map((field) => field.fieldtype)).toEqual(["sign"]);
    expect(automatic.get("JSG_GUARANTOR_WITNESS:1")?.map((field) => field.fieldtype)).toEqual(["sign"]);
  }, 120_000);

  it("stamps guarantor-witness dates on a wrap-test JSG PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    const fixture = withLongJsgStrings(createJsgFixture());
    const names = [
      ...fixture.guarantors_individual.map((row) => row.name),
      ...fixture.guarantors_corporate.flatMap((row) => row.signatories.map((signatory) => signatory.name)),
    ].filter(Boolean);
    let pdf: Buffer;
    try {
      pdf = await convertDocxToPdf(renderJsgDocx(fixture));
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
    const repeats = { jsgGuarantorSignatureCount: names.length };
    const owners = defaultAutomaticKeywordOwners("guarantor_agreement", repeats);
    const stamped = await ensureAutomaticSigningKeywords(pdf, "guarantor_agreement", repeats, owners);
    const text = (await extractPdfTextItems(stamped)).map((row) => row.text).join("\n");
    for (const owner of owners) {
      expect(keywordCount(text, owner.signKeyword)).toBe(owner.placements.length);
      const dateExpected = owner.placements.filter((placement) =>
        executionRoleHasSignDate(placement.roleKey)
      ).length;
      if (owner.dateKeyword) expect(keywordCount(text, owner.dateKeyword)).toBe(dateExpected);
      else expect(dateExpected).toBe(0);
    }
    const automatic = await buildAutomaticSigningCloudSignsetsFromPdf(
      stamped,
      "guarantor_agreement",
      repeats
    );
    expect(names).toHaveLength(4);
    expect(automatic.get("JSG_GUARANTOR_WITNESS:4")?.map((field) => field.fieldtype)).toEqual(["sign"]);
  }, 120_000);

  it("stamps both SSP keywords without hiding a single assignor signature line", async () => {
    if (!resolveGotenbergUrl()) return;
    const twoSigners = createDeedOfAssignmentFixture();
    const oneSigner = {
      ...twoSigners,
      assignor_signatories: [twoSigners.assignor_signatories[0]!],
    };
    let pdf: Buffer;
    try {
      pdf = await convertDocxToPdf(renderDeedOfAssignmentDocx(oneSigner), {
        fileName: "deed-of-assignment.docx",
      });
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
    const repeats = { assignorSignatoryCount: 1 };
    const owners = defaultAutomaticKeywordOwners("deed_of_assignment", repeats);
    const stamped = await ensureAutomaticSigningKeywords(pdf, "deed_of_assignment", repeats, owners);
    const items = await extractPdfTextItems(stamped);
    const text = items.map((row) => row.text).join("\n");
    for (const owner of owners) {
      expect(keywordCount(text, owner.signKeyword)).toBeGreaterThan(0);
    }
    const slots = collectDoaAssignorSignatureSlots(items, { includeTextField: true });
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu"]);
    const signsets = await buildDoaSigningCloudSignsetsFromPdf(stamped, ["Ali Bin Abu"], {
      includeTextField: true,
    });
    expect(signsets).toHaveLength(1);
  }, 120_000);

  it("stamps both assignor-witness keywords on a two-signatory Deed of Assignment PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    let pdf: Buffer;
    try {
      pdf = await convertDocxToPdf(renderDeedOfAssignmentDocx(createDeedOfAssignmentFixture()), {
        fileName: "deed-of-assignment.docx",
      });
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
    const repeats = { assignorSignatoryCount: 2 };
    const owners = defaultAutomaticKeywordOwners("deed_of_assignment", repeats);
    const stamped = await ensureAutomaticSigningKeywords(pdf, "deed_of_assignment", repeats, owners);
    const items = await extractPdfTextItems(stamped);
    const text = items.map((row) => row.text).join("\n");
    const witness = owners.find((owner) =>
      owner.placements.some((placement) => placement.roleKey === "DOA_ASSIGNOR_WITNESS")
    );
    expect(keywordCount(text, witness!.signKeyword)).toBe(2);
    expect(witness!.dateKeyword).toBeUndefined();
    const slots = collectDoaAssignorSignatureSlots(items, { includeTextField: true });
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
  }, 120_000);
});
