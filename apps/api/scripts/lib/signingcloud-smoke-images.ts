import { crc32, deflateSync } from "node:zlib";

/** SigningCloud `/signature/auto` image limits: 300×300 px and 500 KB. */
export const SMOKE_SIGNATURE_WIDTH_PX = 120;
export const SMOKE_SIGNATURE_HEIGHT_PX = 28;

function pngChunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData) >>> 0);
  return Buffer.concat([length, typeAndData, checksum]);
}

function pngBuffer(width: number, height: number, colorType: 2 | 6, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Opaque RGB PNG for the company-seal field (SigningCloud `/user/stampimg` `img` hex). */
export function opaqueRgbPng(
  width: number,
  height: number,
  rgb: readonly [number, number, number]
): Buffer {
  const [red, green, blue] = rgb;
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = red;
      raw[i + 1] = green;
      raw[i + 2] = blue;
    }
  }
  return pngBuffer(width, height, 2, raw);
}

const SCRIPT_GLYPHS: Record<string, readonly string[]> = {
  C: [" ###", "#   ", "#   ", "#   ", " ###"],
  S: [" ###", "#   ", " ## ", "   #", "### "],
  T: ["####", "  # ", "  # ", "  # ", "  # "],
  e: ["    ", " ## ", "#  #", "### ", " ## "],
  s: ["    ", " ###", "##  ", "  ##", "### "],
  t: [" #  ", "### ", " #  ", " #  ", "  ##"],
  " ": ["    ", "    ", "    ", "    ", "    "],
};

/**
 * Transparent RGBA PNG with slanted smoke-test lettering. Isolated from production
 * auto-sign, which uses the operator's uploaded signature image.
 */
export function transparentSignaturePng(
  width = SMOKE_SIGNATURE_WIDTH_PX,
  height = SMOKE_SIGNATURE_HEIGHT_PX,
  text = "CS Test"
): Buffer {
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  const ink: readonly [number, number, number, number] = [36, 28, 24, 255];
  const scale = 2;
  const glyphHeight = 5 * scale;
  const baseline = Math.max(2, Math.floor((height - glyphHeight) / 2) - 1);
  let cursor = 6;

  const plot = (px: number, py: number, alpha = ink[3]) => {
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const i = py * stride + 1 + px * 4;
    raw[i] = ink[0];
    raw[i + 1] = ink[1];
    raw[i + 2] = ink[2];
    raw[i + 3] = alpha;
  };

  const brush = (px: number, py: number) => {
    plot(px, py);
    plot(px + 1, py);
    plot(px, py + 1, 180);
  };

  for (const char of text) {
    const glyph = SCRIPT_GLYPHS[char] ?? SCRIPT_GLYPHS.T;
    for (let gy = 0; gy < glyph.length; gy += 1) {
      const row = glyph[gy] ?? "";
      for (let gx = 0; gx < row.length; gx += 1) {
        if (row[gx] !== "#") continue;
        for (let sy = 0; sy < scale; sy += 1) {
          for (let sx = 0; sx < scale; sx += 1) {
            const y = baseline + gy * scale + sy;
            const shear = Math.floor((height - 1 - y) * 0.28);
            brush(cursor + gx * scale + sx + shear, y);
          }
        }
      }
    }
    cursor += (glyph[0]?.length ?? 4) * scale + 3;
  }

  const flourishY = baseline + glyphHeight + 3;
  for (let x = 8; x < width - 8; x += 1) {
    const wave = Math.round(Math.sin((x - 8) / 9) * 2);
    brush(x, flourishY + wave);
  }

  return pngBuffer(width, height, 6, raw);
}
