/**
 * SigningCloud Upload Document (New) — offer letter with coordinate-based signature fields.
 *
 * Based on: https://docs.signingcloud.com/s/api-integration/doc/upload-document-new-UyjWn4QZL8
 *
 * Run from apps/api:
 *   npx tsx _sandbox/upload-offer-letter-coordinate.ts
 *
 * PDF coordinates: A4 default 595.27 × 841.89 pt, origin bottom-left (PDF user space).
 * The signature box is placed in the lower-left area where "Please sign below:" appears
 * in {@link ../src/modules/applications/offer-letter-pdf.ts}.
 */

import * as crypto from "crypto";
import { Readable } from "stream";
import dotenv from "dotenv";
dotenv.config();

import { generateContractOfferLetterStream } from "../src/modules/applications/offer-letter-pdf";
import { decryptSigningCloudResponse, encryptPayload, SigningCloudEncryptedResponse } from "./signingcloud-decrypt";

const baseUrl = process.env.SC_BASE_URL;
const apiSecret = process.env.SC_API_SECRET;
const accessToken = process.env.SC_ACCESS_TOKEN;
const SIGNER_EMAIL = process.env.SC_SIGNER_EMAIL ?? "p2p.dev@shorakagroup.com";

if (!baseUrl) throw new Error("SC_BASE_URL is not set");
if (!apiSecret) throw new Error("SC_API_SECRET is not set");
if (!accessToken) throw new Error("SC_ACCESS_TOKEN is not set");

/** A4 height in points (PDFKit default). */
const PDF_PAGE_HEIGHT_PT = 841.89;

/**
 * Signature rectangle in PDF coordinates (bottom-left origin).
 * Tuned for contract offer letter: band under "Please sign below:" before the date line.
 * Adjust if you change fonts/layout in offer-letter-pdf.ts.
 */
const SIGNATURE_FIELD = {
  fieldtype: "sign",
  /** Lower y (closer to bottom of page). */
  top: 270,
  /** Left edge — matches ~50pt page margin. */
  left: 50,
  /** Upper y of the box. */
  height: 30,
  /** Right edge — signature width ~230pt. */
  width: 100,
  /** 1-based signer index (matches single signer in contractInfo). */
  pageindex: 1,
} as const;

/**
 * Coordinate signing mode per Upload Document (New). Use the value from docs if different.
 * Often: 0 = tag/text anchor, 1 or 2 = coordinate rectangle.
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function fileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildSignsetJsonString(): string {
  return JSON.stringify([SIGNATURE_FIELD]);
}

export async function main() {
  const offer = {
    requested_facility: 100_000,
    offered_facility: 80_000,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const stream = generateContractOfferLetterStream("sandbox-contract-id", offer);
  const pdfBuffer = await streamToBuffer(stream);

  const uploadFileHash = fileHash(pdfBuffer);

  const rawPayload = {
    contractInfo: {
      contractnum: "",
      contractname: "Sandbox Offer Letter (coordinate sign)",
      signernum: 1,
      signerinfo: [
        {
          email: SIGNER_EMAIL,
          authtype: "0",
          caprovide: "2",
          signset: buildSignsetJsonString(),
        },
      ],
    },
    uploadFileHash,
    type: "pdf",
  };

  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), apiSecret!);

  const formData = new FormData();
  formData.append("accesstoken", accessToken!);
  formData.append("data", data);
  formData.append("mac", mac);
  formData.append("uploadFile", new Blob([pdfBuffer], { type: "application/pdf" }), "offer-letter.pdf");

  const res = await fetch(`${baseUrl}/signserver/v1/contract/file2`, {
    method: "POST",
    body: formData,
  });
  const body = (await res.json()) as SigningCloudEncryptedResponse & Record<string, unknown>;
  if (body.result !== 0 || !body.data || !body.mac) {
    throw new Error("Invalid response: " + JSON.stringify(body));
  }
  const decrypted = decryptSigningCloudResponse(body, apiSecret!);
  console.log(JSON.stringify(decrypted, null, 2));
  console.log(
    "\nSignature box (PDF pt, bottom-left origin):",
    SIGNATURE_FIELD,
    `(page height ref ${PDF_PAGE_HEIGHT_PT} pt)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
