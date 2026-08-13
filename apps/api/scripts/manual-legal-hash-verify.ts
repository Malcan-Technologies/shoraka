import "dotenv/config";
import { createHash } from "crypto";
import { putS3ObjectBuffer, deleteS3Object } from "../src/lib/s3/client";
import {
  assertStoredLegalPdf,
  calculateS3ObjectSha256,
} from "../src/lib/s3/legal-document-object";

async function main() {
  const pdf = Buffer.from("%PDF-1.4\nmanual-verify-bytes-" + Date.now() + "\n%%EOF\n");
  const expected = createHash("sha256").update(pdf).digest("hex");
  const key = `legal-documents/verify-hash/${Date.now()}.pdf`;
  try {
    await putS3ObjectBuffer({ key, body: pdf, contentType: "application/pdf" });
    const hashed = await calculateS3ObjectSha256(key);
    const asserted = await assertStoredLegalPdf({ s3Key: key, claimedFileSize: pdf.length });
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        match: hashed.sha256 === expected && asserted.fileHash === expected,
        expectedPrefix: expected.slice(0, 12),
        hashedPrefix: hashed.sha256.slice(0, 12),
        byteLength: hashed.byteLength,
      })
    );
  } finally {
    try {
      await deleteS3Object(key);
    } catch {
      // ignore cleanup errors in manual verify
    }
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("MANUAL_HASH_FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
