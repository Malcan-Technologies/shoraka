import {
  buildFaSigningCloudSignsetsFromPdf,
  collectFaIssuerSignatureSlots,
  FaSigningLayoutError,
  matchFaSignersToSlots,
  type FaSignatureSlot,
} from "./fa-signing-placement";
import { previewFieldsFromSignsets } from "../../signing/preview-signature-stamp";
import type { JsgPdfTextItem } from "../joint-several-guarantee/jsg-signing-placement";
import { createFacilityAgreementFixture } from "./fa-fixture";
import { renderFacilityAgreementDocx } from "./render-fa-docx";
import {
  convertDocxToPdf,
  DocxToPdfError,
  resolveGotenbergUrl,
} from "../letter-of-offer/convert-docx-to-pdf";

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

function issuerExecutionItems(signerCount: 1 | 2): JsgPdfTextItem[] {
  const items: JsgPdfTextItem[] = [
    item(8, 80, 268, "INVESTOR"),
    item(8, 173, 94, "______________________________", 140),
    item(8, 189, 94, "Name : Platform Investor"),
    item(9, 80, 268, "AGENT"),
    item(9, 173, 94, "______________________________", 140),
    item(9, 189, 94, "Name : CashSouk Agent"),
    item(10, 80, 268, "ISSUER"),
    item(10, 173, 94, "______________________________", 140),
    item(10, 189, 94, "Name : Ali Bin Abu"),
    item(10, 205, 94, "Designation : Director"),
  ];
  if (signerCount === 2) {
    items.push(
      item(10, 251, 94, "______________________________", 140),
      item(10, 266, 94, "Name : Siti Binti Ahmad"),
      item(10, 282, 94, "Designation : Authorised Signatory")
    );
  }
  items.push(
    item(10, 330, 94, "______________________________", 140),
    item(10, 346, 94, "Name of Witness"),
    item(11, 80, 268, "SCHEDULE 1"),
    item(11, 173, 94, "______________________________", 140),
    item(11, 189, 94, "Name : Schedule Party"),
    item(14, 80, 268, "SCHEDULE 4"),
    item(14, 173, 94, "______________________________", 140),
    item(14, 189, 94, "Name : Utilisation Signatory")
  );
  return items;
}

describe("collectFaIssuerSignatureSlots", () => {
  it("finds one issuer line and skips Investor, Agent, witness, and schedules", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(1));
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu"]);
    expect(slots[0]?.pageindex).toBe(10);
  });

  it("finds two issuer lines in document order", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(2));
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
    expect(slots[0]?.top).toBeLessThan(slots[1]?.top ?? 0);
  });

  it("keeps issuer lines when SCHEDULE 1 starts on the same page", () => {
    const items = issuerExecutionItems(2).map((entry) =>
      entry.text === "SCHEDULE 1" ? { ...entry, pageindex: 10, yTop: 500 } : entry
    );
    const slots = collectFaIssuerSignatureSlots(items);
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
  });

  it("places the left signatory line and skips the witness column", () => {
    const items: JsgPdfTextItem[] = [
      item(9, 80, 268, "AGENT"),
      item(10, 80, 268, "ISSUER"),
      item(10, 173, 94, "______________________________", 140),
      item(10, 189, 94, "Name : Ali Bin Abu"),
      item(10, 173, 360, "______________________________", 140),
      item(10, 189, 360, "Name of Witness:"),
      item(10, 205, 360, "NRIC:"),
      item(10, 251, 94, "______________________________", 140),
      item(10, 266, 94, "Name : Siti Binti Ahmad"),
      item(10, 251, 360, "______________________________", 140),
      item(10, 266, 360, "Name of Witness:"),
      item(11, 80, 268, "SCHEDULE 1"),
    ];
    const slots = collectFaIssuerSignatureSlots(items);
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
    expect(slots[0]?.left).toBe(94);
    expect(slots[1]?.left).toBe(94);
    expect(slots[0]?.top).toBeLessThan(slots[1]?.top ?? 0);
  });
});

describe("matchFaSignersToSlots", () => {
  it("places one signer on the matching issuer rectangle", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(1));
    const signsets = matchFaSignersToSlots(["Ali Bin Abu"], slots);
    expect(signsets).toHaveLength(1);
    expect(signsets[0]?.[0]).toMatchObject({
      fieldtype: "sign",
      pageindex: slots[0]?.pageindex,
      top: slots[0]?.top,
      left: slots[0]?.left,
    });
  });

  it("places two signers and keeps preview coordinates identical to send signsets", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(2));
    const names = ["Ali Bin Abu", "Siti Binti Ahmad"];
    const signsets = matchFaSignersToSlots(names, slots);
    expect(signsets).toHaveLength(2);
    const preview = previewFieldsFromSignsets(names, signsets);
    expect(preview.map((field) => [field.pageindex, field.top, field.left, field.width, field.height])).toEqual(
      signsets.map((fields) => {
        const field = fields[0];
        return [field?.pageindex, field?.top, field?.left, field?.width, field?.height];
      })
    );
  });

  it("fails when signer count does not match issuer lines", () => {
    const slots = collectFaIssuerSignatureSlots(issuerExecutionItems(2));
    expect(() => matchFaSignersToSlots(["Ali Bin Abu"], slots)).toThrow(FaSigningLayoutError);
  });

  it("fails when geometry has no issuer lines", () => {
    const empty: FaSignatureSlot[] = [];
    expect(() => matchFaSignersToSlots(["Ali Bin Abu"], empty)).toThrow(/missing issuer signature lines/);
  });
});

describe("buildFaSigningCloudSignsetsFromPdf", () => {
  it("places issuer CA fields on a Gotenberg Facility Agreement PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    const twoSigners = createFacilityAgreementFixture();
    const oneSigner = {
      ...twoSigners,
      issuer_signatories: [twoSigners.issuer_signatories[0]!],
    };

    let twoSignerPdf: Buffer;
    let oneSignerPdf: Buffer;
    try {
      twoSignerPdf = await convertDocxToPdf(renderFacilityAgreementDocx(twoSigners));
      oneSignerPdf = await convertDocxToPdf(renderFacilityAgreementDocx(oneSigner));
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }

    const twoNames = ["Ali Bin Abu", "Siti Binti Ahmad"];
    const twoSignsets = await buildFaSigningCloudSignsetsFromPdf(twoSignerPdf, twoNames);
    expect(twoSignsets).toHaveLength(2);
    const twoPreview = previewFieldsFromSignsets(twoNames, twoSignsets);
    expect(
      twoPreview.map((field) => [field.pageindex, field.top, field.left, field.width, field.height])
    ).toEqual(
      twoSignsets.map((fields) => {
        const field = fields[0];
        return [field?.pageindex, field?.top, field?.left, field?.width, field?.height];
      })
    );

    const oneNames = ["Ali Bin Abu"];
    const oneSignsets = await buildFaSigningCloudSignsetsFromPdf(oneSignerPdf, oneNames);
    expect(oneSignsets).toHaveLength(1);
    expect(oneSignsets[0]?.[0]?.pageindex).toBeGreaterThan(0);
  }, 120_000);
});
