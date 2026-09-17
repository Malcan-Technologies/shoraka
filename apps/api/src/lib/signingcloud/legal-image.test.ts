import { confirmSigningCloudLegalImageBytes } from "./legal-image";
import { AppError } from "../http/error-handler";
import { PNG } from "pngjs";
import {
  SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE,
  SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES,
  SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE,
} from "@cashsouk/types";

const OPAQUE_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cf0000010101005f9b9c4e0000000049454e44ae426082",
  "hex"
);

function opaquePngBuffer(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i += 1) {
    const base = i * 4;
    // Opaque black pixels.
    png.data[base] = 0;
    png.data[base + 1] = 0;
    png.data[base + 2] = 0;
    png.data[base + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe("confirmSigningCloudLegalImageBytes", () => {
  it("hashes a valid PNG without logging bytes", () => {
    const confirmed = confirmSigningCloudLegalImageBytes(OPAQUE_PNG);
    expect(confirmed.widthPx).toBe(1);
    expect(confirmed.heightPx).toBe(1);
    expect(confirmed.contentType).toBe("image/png");
    expect(confirmed.transparencyMode).toBe("OPAQUE");
    expect(confirmed.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects non-images", () => {
    try {
      confirmSigningCloudLegalImageBytes(Buffer.from("%PDF-1.4"));
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects signatures with width > 300px (301×300)", () => {
    const bytes = opaquePngBuffer(301, 300);
    expect(bytes.length).toBeLessThanOrEqual(SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES);
    expect(() => confirmSigningCloudLegalImageBytes(bytes)).toThrow(
      SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE
    );
  });

  it("rejects signatures with height > 300px (300×301)", () => {
    const bytes = opaquePngBuffer(300, 301);
    expect(bytes.length).toBeLessThanOrEqual(SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES);
    expect(() => confirmSigningCloudLegalImageBytes(bytes)).toThrow(
      SIGNINGCLOUD_LEGAL_IMAGE_DIMENSION_MESSAGE
    );
  });

  it("rejects signatures larger than 500 KB (>500KB)", () => {
    const base = opaquePngBuffer(300, 300);
    expect(base.length).toBeLessThanOrEqual(SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES);
    const oversized = Buffer.concat([
      base,
      Buffer.alloc(SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES + 1),
    ]);
    expect(oversized.length).toBeGreaterThan(SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES);
    expect(() => confirmSigningCloudLegalImageBytes(oversized)).toThrow(
      SIGNINGCLOUD_LEGAL_IMAGE_TOO_LARGE_MESSAGE
    );
  });

  it("accepts 300×300 images at or under 500 KB", () => {
    const bytes = opaquePngBuffer(300, 300);
    expect(bytes.length).toBeLessThanOrEqual(SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES);
    const confirmed = confirmSigningCloudLegalImageBytes(bytes);
    expect(confirmed.widthPx).toBe(300);
    expect(confirmed.heightPx).toBe(300);
  });
});
