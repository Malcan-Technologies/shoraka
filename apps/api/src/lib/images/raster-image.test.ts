import {
  inspectRasterImage,
  isJpeg,
  isPng,
  readJpegSize,
  readPngSize,
} from "./raster-image";

/** 1×1 opaque RGB PNG (no tRNS). */
const OPAQUE_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cf0000010101005f9b9c4e0000000049454e44ae426082",
  "hex"
);

describe("raster-image", () => {
  it("reads PNG dimensions and treats RGB as opaque", () => {
    expect(isPng(OPAQUE_PNG)).toBe(true);
    expect(readPngSize(OPAQUE_PNG)).toEqual({ width: 1, height: 1 });
    expect(inspectRasterImage(OPAQUE_PNG)).toEqual({
      kind: "png",
      contentType: "image/png",
      width: 1,
      height: 1,
      transparency: "OPAQUE",
    });
  });

  it("rejects non-images", () => {
    expect(inspectRasterImage(Buffer.from("%PDF-1.4"))).toBeNull();
    expect(isJpeg(Buffer.from([0xff, 0xd8]))).toBe(true);
    expect(readJpegSize(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });
});
