import { encode as encodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import {
  MAX_STAMP_HEIGHT_EMU,
  MAX_STAMP_WIDTH_EMU,
  fitStampImageForDocx,
  maxStampPixelBox,
  pngWithPhysForExtent,
  readPngSize,
  stampExtentEmuFromPixels,
} from "./stamp-image-contain";

function rgbaPng(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(180);
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  return PNG.sync.write(png);
}

describe("fitStampImageForDocx", () => {
  it("contains a large square bitmap inside the 96 DPI cell box", () => {
    const fitted = fitStampImageForDocx(rgbaPng(800, 800), "image/png");
    const size = readPngSize(fitted.bytes);
    const box = maxStampPixelBox();
    expect(size).toEqual({ width: box.height, height: box.height });
    expect(fitted.extent.cy).toBe(MAX_STAMP_HEIGHT_EMU);
    expect(fitted.extent.cx).toBe(MAX_STAMP_HEIGHT_EMU);
    expect(fitted.contentType).toBe("image/png");
    expect(fitted.bytes.includes(Buffer.from("pHYs"))).toBe(true);
  });

  it("contains a wide screenshot without growing past the cell width", () => {
    const fitted = fitStampImageForDocx(rgbaPng(1600, 400), "image/png");
    const size = readPngSize(fitted.bytes);
    const box = maxStampPixelBox();
    expect(size).not.toBeNull();
    expect(size!.width).toBeLessThanOrEqual(box.width);
    expect(size!.height).toBeLessThanOrEqual(box.height);
    expect(fitted.extent.cx).toBe(MAX_STAMP_WIDTH_EMU);
    expect(fitted.extent.cy).toBeLessThan(MAX_STAMP_HEIGHT_EMU);
    expect(fitted.extent.cx / fitted.extent.cy).toBeCloseTo(1600 / 400, 5);
  });

  it("does not enlarge a tiny PNG's pixels", () => {
    const tiny = rgbaPng(2, 1);
    const fitted = fitStampImageForDocx(tiny, "image/png");
    expect(readPngSize(fitted.bytes)).toEqual({ width: 2, height: 1 });
    expect(fitted.extent).toEqual(stampExtentEmuFromPixels(2, 1));
  });

  it("re-encodes a large JPEG as a contained PNG", () => {
    const pixels = Buffer.alloc(400 * 200 * 4, 160);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    const jpeg = encodeJpeg({ data: pixels, width: 400, height: 200 }, 80).data;
    const fitted = fitStampImageForDocx(Buffer.from(jpeg), "image/jpeg");
    const size = readPngSize(fitted.bytes);
    const box = maxStampPixelBox();
    expect(fitted.contentType).toBe("image/png");
    expect(size).not.toBeNull();
    expect(size!.width).toBeLessThanOrEqual(box.width);
    expect(size!.height).toBeLessThanOrEqual(box.height);
    expect(fitted.extent.cx).toBe(MAX_STAMP_WIDTH_EMU);
  });
});

describe("pngWithPhysForExtent", () => {
  it("replaces an existing pHYs chunk", () => {
    const png = rgbaPng(10, 10);
    const first = pngWithPhysForExtent(png, 10, 10, { cx: 914_400, cy: 914_400 });
    const second = pngWithPhysForExtent(first!, 10, 10, { cx: 457_200, cy: 457_200 });
    expect(second).toBeTruthy();
    const physCount = second!.toString("binary").split("pHYs").length - 1;
    expect(physCount).toBe(1);
  });
});
