import {
  buildDoaSigningCloudSignsetsFromPdf,
  collectDoaAssignorSignatureSlots,
  DoaSigningLayoutError,
  matchDoaSignersToSlots,
  type DoaSignatureSlot,
} from "./doa-signing-placement";
import { previewFieldsFromSignsets } from "../../signing/preview-signature-stamp";
import type { JsgPdfTextItem } from "../joint-several-guarantee/jsg-signing-placement";
import { createDeedOfAssignmentFixture } from "./doa-fixture";
import { renderDeedOfAssignmentDocx } from "./render-doa-docx";
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

function assignorExecutionItems(signerCount: 1 | 2): JsgPdfTextItem[] {
  const items: JsgPdfTextItem[] = [
    item(6, 80, 72, "Signed by )"),
    item(6, 96, 72, "SHORAKA SUYULA PLATFORM SDN. BHD."),
    item(7, 80, 72, "ASSIGNOR – [MINIMUM OF TWO (2) AUTHORISED SIGNATORIES’ SIGNATURES]"),
    item(7, 120, 72, "Signed by )"),
    item(7, 136, 72, "For and on behalf of )"),
    item(7, 152, 72, "DEMO ISSUER SDN. BHD. )"),
    item(7, 200, 72, "........................................................", 140),
    item(7, 216, 72, "Name: Ali Bin Abu"),
    item(7, 200, 360, "........................................................", 140),
    item(7, 216, 360, "[Witness]"),
    item(7, 232, 360, "Name:"),
  ];
  if (signerCount === 2) {
    items.push(
      item(7, 280, 72, "........................................................", 140),
      item(7, 296, 72, "Name: Siti Binti Ahmad"),
      item(7, 280, 360, "........................................................", 140),
      item(7, 296, 360, "[Witness]"),
      item(7, 312, 360, "Name:")
    );
  }
  items.push(
    item(7, 360, 400, "[Assignor]"),
    item(7, 376, 400, "Company Stamp:"),
    item(8, 80, 72, "SCHEDULE 1"),
    item(8, 120, 72, "........................................................", 140),
    item(8, 136, 72, "Name: Schedule Party")
  );
  return items;
}

describe("collectDoaAssignorSignatureSlots", () => {
  it("finds one assignor line and skips SSP, witness, stamp, and schedules", () => {
    const slots = collectDoaAssignorSignatureSlots(assignorExecutionItems(1));
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu"]);
    expect(slots[0]?.pageindex).toBe(7);
    expect(slots[0]?.left).toBe(72);
  });

  it("finds two assignor lines in document order", () => {
    const slots = collectDoaAssignorSignatureSlots(assignorExecutionItems(2));
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
    expect(slots[0]?.top).toBeLessThan(slots[1]?.top ?? 0);
  });

  it("keeps assignor lines when SCHEDULE 1 starts on the same page", () => {
    const items = assignorExecutionItems(2).map((entry) =>
      entry.text === "SCHEDULE 1" ? { ...entry, pageindex: 7, yTop: 500 } : entry
    );
    const slots = collectDoaAssignorSignatureSlots(items);
    expect(slots.map((slot) => slot.name)).toEqual(["Ali Bin Abu", "Siti Binti Ahmad"]);
  });
});

describe("matchDoaSignersToSlots", () => {
  it("places one signer on the matching assignor rectangle", () => {
    const slots = collectDoaAssignorSignatureSlots(assignorExecutionItems(1));
    const signsets = matchDoaSignersToSlots(["Ali Bin Abu"], slots);
    expect(signsets).toHaveLength(1);
    expect(signsets[0]?.[0]).toMatchObject({
      fieldtype: "sign",
      pageindex: slots[0]?.pageindex,
      top: slots[0]?.top,
      left: slots[0]?.left,
    });
  });

  it("places two signers and keeps preview coordinates identical to send signsets", () => {
    const slots = collectDoaAssignorSignatureSlots(assignorExecutionItems(2));
    const names = ["Ali Bin Abu", "Siti Binti Ahmad"];
    const signsets = matchDoaSignersToSlots(names, slots);
    expect(signsets).toHaveLength(2);
    const preview = previewFieldsFromSignsets(names, signsets);
    expect(preview.map((field) => [field.pageindex, field.top, field.left, field.width, field.height])).toEqual(
      signsets.map((fields) => {
        const field = fields[0];
        return [field?.pageindex, field?.top, field?.left, field?.width, field?.height];
      })
    );
  });

  it("fails when signer count does not match assignor lines", () => {
    const slots = collectDoaAssignorSignatureSlots(assignorExecutionItems(2));
    expect(() => matchDoaSignersToSlots(["Ali Bin Abu"], slots)).toThrow(DoaSigningLayoutError);
  });

  it("fails when geometry has no assignor lines", () => {
    const empty: DoaSignatureSlot[] = [];
    expect(() => matchDoaSignersToSlots(["Ali Bin Abu"], empty)).toThrow(/missing assignor signature lines/);
  });
});

describe("buildDoaSigningCloudSignsetsFromPdf", () => {
  it("places assignor CA fields on a Gotenberg Deed of Assignment PDF", async () => {
    if (!resolveGotenbergUrl()) return;
    const twoSigners = createDeedOfAssignmentFixture();
    const oneSigner = {
      ...twoSigners,
      assignor_signatories: [twoSigners.assignor_signatories[0]!],
    };

    let twoSignerPdf: Buffer;
    let oneSignerPdf: Buffer;
    try {
      twoSignerPdf = await convertDocxToPdf(renderDeedOfAssignmentDocx(twoSigners));
      oneSignerPdf = await convertDocxToPdf(renderDeedOfAssignmentDocx(oneSigner));
    } catch (err) {
      if (err instanceof DocxToPdfError && err.code === "GOTENBERG_UNAVAILABLE") return;
      throw err;
    }

    const twoNames = ["Ali Bin Abu", "Siti Binti Ahmad"];
    const twoSignsets = await buildDoaSigningCloudSignsetsFromPdf(twoSignerPdf, twoNames);
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
    const oneSignsets = await buildDoaSigningCloudSignsetsFromPdf(oneSignerPdf, oneNames);
    expect(oneSignsets).toHaveLength(1);
    expect(oneSignsets[0]?.[0]?.pageindex).toBeGreaterThan(0);
    expect(oneSignsets[0]?.[0]?.left).toBeLessThan(200);
  }, 120_000);
});
