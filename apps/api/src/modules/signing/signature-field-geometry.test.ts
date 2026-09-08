import {
  assertSignatureFieldsValid,
  LAYOUT_DETECTED_SIGN_FIELD,
  matchSignersToNamedSlots,
  SIGNING_CLOUD_STACKED_SIGN_FIELD,
  signatureFieldFromLine,
  signatureFieldsOverlap,
} from "./signature-field-geometry";

describe("signatureFieldFromLine", () => {
  it("sits the box on the stroke with shared height and clamped width", () => {
    const field = signatureFieldFromLine({
      pageindex: 10,
      x: 94,
      yTop: 173,
      width: 140,
      pageWidth: 595,
      pageHeight: 842,
    });
    expect(field).toEqual({
      fieldtype: "sign",
      pageindex: 10,
      left: 94,
      width: 140,
      height: LAYOUT_DETECTED_SIGN_FIELD.height,
      top: 173 - LAYOUT_DETECTED_SIGN_FIELD.height + LAYOUT_DETECTED_SIGN_FIELD.topOffset,
    });
  });

  it("keeps the field inside the page", () => {
    const field = signatureFieldFromLine({
      pageindex: 1,
      x: -40,
      yTop: 10,
      width: 400,
      pageWidth: 595,
      pageHeight: 842,
    });
    expect(field.left).toBe(LAYOUT_DETECTED_SIGN_FIELD.minLeft);
    expect(field.top).toBe(LAYOUT_DETECTED_SIGN_FIELD.minTop);
    expect(field.width).toBe(LAYOUT_DETECTED_SIGN_FIELD.maxWidth);
    expect(field.left + field.width).toBeLessThanOrEqual(595);
    expect(field.top + field.height).toBeLessThanOrEqual(842);
  });
});

describe("signatureFieldsOverlap", () => {
  it("detects overlapping rectangles on the same page", () => {
    const a = signatureFieldFromLine({ pageindex: 1, x: 90, yTop: 200, width: 140 });
    const b = signatureFieldFromLine({ pageindex: 1, x: 100, yTop: 210, width: 140 });
    expect(signatureFieldsOverlap(a, b)).toBe(true);
  });

  it("allows stacked boxes on the same column", () => {
    const a = signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 173, width: 140 });
    const b = signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 251, width: 140 });
    expect(signatureFieldsOverlap(a, b)).toBe(false);
  });
});

describe("matchSignersToNamedSlots", () => {
  const slots = [
    { ...signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 173, width: 140 }), name: "Ali Bin Abu" },
    { ...signatureFieldFromLine({ pageindex: 1, x: 94, yTop: 251, width: 140 }), name: "Siti Binti Ahmad" },
  ];

  it("places named signers and fails when a slot is unused", () => {
    expect(() =>
      matchSignersToNamedSlots(["Ali Bin Abu"], slots, {
        documentLabel: "JSG",
        allowUnnamedFallback: false,
        requireAllSlotsUsed: true,
        createError: (message) => new Error(message),
      })
    ).toThrow(/do not match signer count/);
  });

  it("uses an unnamed fallback when allowed", () => {
    const unnamed = [
      { ...signatureFieldFromLine({ pageindex: 2, x: 72, yTop: 200, width: 140 }), name: "" },
    ];
    const signsets = matchSignersToNamedSlots(["Ali Bin Abu"], unnamed, {
      documentLabel: "Facility Agreement",
      allowUnnamedFallback: true,
      requireAllSlotsUsed: true,
      createError: (message) => new Error(message),
    });
    expect(signsets).toHaveLength(1);
    expect(signsets[0]?.[0]?.pageindex).toBe(2);
  });

  it("rejects overlapping assigned fields", () => {
    const overlapping = [
      { ...signatureFieldFromLine({ pageindex: 1, x: 90, yTop: 200, width: 140 }), name: "Ali Bin Abu" },
      { ...signatureFieldFromLine({ pageindex: 1, x: 100, yTop: 210, width: 140 }), name: "Siti Binti Ahmad" },
    ];
    expect(() =>
      matchSignersToNamedSlots(["Ali Bin Abu", "Siti Binti Ahmad"], overlapping, {
        documentLabel: "Deed of Assignment",
        allowUnnamedFallback: false,
        requireAllSlotsUsed: true,
        createError: (message) => new Error(message),
      })
    ).toThrow(/overlap/);
  });
});

describe("assertSignatureFieldsValid", () => {
  it("accepts stacked defaults on one page", () => {
    expect(() =>
      assertSignatureFieldsValid(
        [
          { ...SIGNING_CLOUD_STACKED_SIGN_FIELD, pageindex: 1 },
          {
            ...SIGNING_CLOUD_STACKED_SIGN_FIELD,
            pageindex: 1,
            top: SIGNING_CLOUD_STACKED_SIGN_FIELD.top - 50,
          },
        ],
        (message) => new Error(message)
      )
    ).not.toThrow();
  });
});
