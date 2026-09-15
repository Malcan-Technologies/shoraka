import { encode as encodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import {
  MAX_STAMP_HEIGHT_EMU,
  MAX_STAMP_WIDTH_EMU,
  fitStampImageForDocx,
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
  it("keeps a large square bitmap and caps the drawing with wp:extent", () => {
    const fitted = fitStampImageForDocx(rgbaPng(800, 800), "image/png");
    const size = readPngSize(fitted.bytes);
    expect(size).toEqual({ width: 800, height: 800 });
    expect(fitted.extent.cy).toBe(MAX_STAMP_HEIGHT_EMU);
    expect(fitted.extent.cx).toBe(MAX_STAMP_HEIGHT_EMU);
    expect(fitted.contentType).toBe("image/png");
    expect(fitted.bytes.includes(Buffer.from("pHYs"))).toBe(true);
  });

  it("keeps a wide screenshot and contains it with wp:extent", () => {
    const fitted = fitStampImageForDocx(rgbaPng(1600, 400), "image/png");
    const size = readPngSize(fitted.bytes);
    expect(size).toEqual({ width: 1600, height: 400 });
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

  it("keeps a large JPEG and contains it with wp:extent", () => {
    const pixels = Buffer.alloc(400 * 200 * 4, 160);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
    const jpeg = encodeJpeg({ data: pixels, width: 400, height: 200 }, 80).data;
    const fitted = fitStampImageForDocx(Buffer.from(jpeg), "image/jpeg");
    expect(fitted.contentType).toBe("image/jpeg");
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
