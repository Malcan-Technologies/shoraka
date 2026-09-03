import { PDFDocument, StandardFonts } from "pdf-lib";
import { createJsgFixture } from "./jsg-fixture";
import { renderJsgDocx } from "./render-jsg-docx";
import { convertDocxToPdf, DocxToPdfError, resolveGotenbergUrl } from "../letter-of-offer/convert-docx-to-pdf";
import {
  buildJsgSigningCloudSignsetsFromPdf,
  collectJsgSignatureSlots,
  matchJsgSignersToSlots,
  type JsgPdfTextItem,
} from "./jsg-signing-placement";
import { countPdfPages } from "./jsg-signing-signsets";

function item(
  pageindex: number,
  yTop: number,
  x: number,
  text: string,
  width = 80
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

/** Geometry from a packed Gotenberg JSG: individuals + corporate on page 12. */
function packedExecutionItems(): JsgPdfTextItem[] {
  return [
    item(11, 80, 268, "EFFECTIVE DATE"),
    item(12, 80, 268, "EXECUTION PAGE"),
    item(12, 127, 94, "The Guarantor(s)"),
    item(12, 142, 94, "Ali Bin Abu"),
    item(12, 173, 99, "...........................................................................", 200),
    item(12, 173, 325, "..............................................................", 160),
    item(12, 190, 99, "Signature of Guarantor", 90),
    item(12, 190, 325, "Signature of Witness", 90),
    item(12, 206, 99, "Full Name:", 45),
    item(12, 206, 147, "Ali Bin Abu", 70),
    item(12, 206, 325, "Full Name:", 45),
    item(12, 222, 99, "NRIC No.:", 50),
    item(12, 269, 94, "The Guarantor(s)"),
    item(12, 285, 94, "Siti Binti Ahmad"),
    item(12, 316, 99, "...........................................................................", 200),
    item(12, 316, 325, "..............................................................", 160),
    item(12, 332, 99, "Signature of Guarantor", 90),
    item(12, 332, 325, "Signature of Witness", 90),
    item(12, 348, 99, "Full Name:", 45),
    item(12, 348, 147, "Siti Binti Ahmad", 80),
    item(12, 348, 325, "Full Name:", 45),
    item(12, 412, 94, "The Guarantor(s)"),
    item(12, 427, 94, "For and on behalf of HOLDCO ONE SDN. BHD."),
    item(12, 450, 99, "...........................................................................", 200),
    item(12, 450, 325, "..............................................................", 160),
    item(12, 466, 99, "Signature of Guarantor", 90),
    item(12, 466, 325, "Signature of Witness", 90),
    item(12, 482, 99, "Full Name:", 45),
    item(12, 482, 147, "Nora Abdullah", 80),
    item(12, 482, 325, "Full Name:", 45),
    item(12, 520, 99, "...........................................................................", 200),
    item(12, 520, 325, "..............................................................", 160),
    item(12, 536, 99, "Signature of Guarantor", 90),
    item(12, 536, 325, "Signature of Witness", 90),
    item(12, 552, 99, "Full Name:", 45),
    item(12, 552, 147, "Farid Hassan", 70),
    item(12, 552, 325, "Full Name:", 45),
    item(13, 80, 283, "OPERATOR"),
    item(13, 173, 94, "______________________________", 140),
    item(13, 189, 94, "Name:"),
    item(13, 251, 94, "______________________________", 140),
    item(13, 266, 94, "Signature of Witness"),
    item(14, 80, 280, "SCHEDULE 1"),
    item(14, 173, 138, "Ali Bin Abu (NRIC No. 900101145678)"),
    item(14, 406, 176, "[The remaining space of this page has been left blank intentionally]"),
  ];
}

describe("collectJsgSignatureSlots", () => {
  it("finds individual and corporate lines on the execution page, not Schedule 1 or Operator", () => {
    const slots = collectJsgSignatureSlots(packedExecutionItems());
    expect(slots.map((slot) => [slot.kind, slot.name, slot.pageindex])).toEqual([
      ["individual", "Ali Bin Abu", 12],
      ["individual", "Siti Binti Ahmad", 12],
      ["individual", "Nora Abdullah", 12],
      ["individual", "Farid Hassan", 12],
    ]);
    expect(slots.every((slot) => slot.pageindex === 12)).toBe(true);
    const ali = slots.find((slot) => slot.name === "Ali Bin Abu");
    const nora = slots.find((slot) => slot.name === "Nora Abdullah");
    const farid = slots.find((slot) => slot.name === "Farid Hassan");
    expect(ali?.height).toBe(36);
    expect((ali?.top ?? 0) + (ali?.height ?? 0)).toBeLessThan(190);
    expect((nora?.top ?? 0) + (nora?.height ?? 0)).toBeLessThan(466);
    expect(nora?.left).toBe(farid?.left);
  });

  it("places stacked corporate representatives on dotted guarantor lines, not a shared right-hand column", () => {
    const items = [
      item(1, 80, 200, "EXECUTION PAGE"),
      item(1, 200, 99, "...........................................................................", 200),
      item(1, 216, 99, "Signature of Guarantor"),
      item(1, 232, 99, "Full Name: Nora Abdullah", 140),
      item(1, 280, 99, "...........................................................................", 200),
      item(1, 296, 99, "Signature of Guarantor"),
      item(1, 312, 99, "Full Name: Farid Hassan", 140),
      item(2, 80, 200, "OPERATOR"),
    ];
    const slots = collectJsgSignatureSlots(items);
    expect(slots.map((slot) => slot.name)).toEqual(["Nora Abdullah", "Farid Hassan"]);
    expect(slots[0]?.left).toBe(slots[1]?.left);
    expect(slots[0]?.top).toBeLessThan(slots[1]?.top ?? 0);
  });
});

describe("matchJsgSignersToSlots", () => {
  it("matches by name so routing order can differ from document order", () => {
    const slots = collectJsgSignatureSlots(packedExecutionItems());
    const signsets = matchJsgSignersToSlots(
      ["Farid Hassan", "Ali Bin Abu", "Nora Abdullah", "Siti Binti Ahmad"],
      slots
    );
    expect(signsets).toHaveLength(4);
    expect(signsets.map((fields) => fields[0]?.pageindex)).toEqual([12, 12, 12, 12]);
    expect(signsets[1]?.[0]?.top).toBeLessThan(signsets[3]?.[0]?.top ?? 0);
  });

  it("places two assignments for the same person on two execution lines", () => {
    const items = [
      item(1, 80, 200, "EXECUTION PAGE"),
      item(1, 120, 99, "....................", 120),
      item(1, 136, 99, "Signature of Guarantor"),
      item(1, 152, 99, "Full Name: Kau Khai Kit", 140),
      item(1, 220, 99, "....................", 120),
      item(1, 236, 99, "Signature of Guarantor"),
      item(1, 252, 99, "Full Name: Kau Khai Kit", 140),
      item(2, 80, 200, "OPERATOR"),
    ];
    const slots = collectJsgSignatureSlots(items);
    expect(slots).toHaveLength(2);
    const signsets = matchJsgSignersToSlots(["Kau Khai Kit", "Kau Khai Kit"], slots);
    expect(signsets[0]?.[0]?.top).not.toBe(signsets[1]?.[0]?.top);
  });

  it("fails closed when a signer has no execution line", () => {
    const slots = collectJsgSignatureSlots(packedExecutionItems());
    expect(() => matchJsgSignersToSlots(["Unknown Person"], slots)).toThrow(
      /Could not place JSG signature/
    );
  });
});

describe("buildJsgSigningCloudSignsetsFromPdf", () => {
  it("reads signature lines from an extracted PDF", async () => {
    const pdf = await PDFDocument.create();
    const page1 = pdf.addPage([595, 842]);
    const page2 = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const draw = (
      page: ReturnType<PDFDocument["addPage"]>,
      text: string,
      x: number,
      yFromBottom: number
    ) => {
      page.drawText(text, { x, y: yFromBottom, size: 9, font });
    };
    draw(page1, "EXECUTION PAGE", 200, 760);
    draw(page1, "........................................", 99, 842 - 173);
    draw(page1, "Signature of Guarantor", 99, 842 - 190);
    draw(page1, "Full Name: Ali Bin Abu", 99, 842 - 206);
    draw(page2, "SCHEDULE 1", 200, 760);
    draw(page2, "Ali Bin Abu", 99, 400);

    const buffer = Buffer.from(await pdf.save());
    const signsets = await buildJsgSigningCloudSignsetsFromPdf(buffer, ["Ali Bin Abu"]);
    expect(signsets).toHaveLength(1);
    expect(signsets[0]?.[0]?.pageindex).toBe(1);
    expect(signsets[0]?.[0]?.pageindex).not.toBe(2);
  });

  it("places fields on a Gotenberg JSG PDF execution page, not Schedule 1", async () => {
    if (!resolveGotenbergUrl()) return;
    const docx = renderJsgDocx(createJsgFixture());
    let pdf: Buffer;
    try {
      pdf = await convertDocxToPdf(docx);
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }
    const names = ["Ali Bin Abu", "Siti Binti Ahmad", "Nora Abdullah", "Farid Hassan"];
    const signsets = await buildJsgSigningCloudSignsetsFromPdf(pdf, names);
    expect(signsets).toHaveLength(4);
    const pageCount = countPdfPages(pdf);
    expect(signsets.every((fields) => (fields[0]?.pageindex ?? 0) < pageCount)).toBe(true);
  }, 120_000);
});
