import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { decryptSigningCloudResponse, encryptPayload, SigningCloudEncryptedResponse } from "./signingcloud-decrypt";

dotenv.config();

/** Binary size cap per SigningCloud MyKAD OCR field (idFront, idFrontFlash, idBack). */
export const MYKAD_OCR_IMAGE_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

function sandboxDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

/**
 * Read an image file and return raw Base64 (no `data:image/...;base64,` prefix).
 * Throws if the file is missing, not a regular file, or larger than `maxBytes`.
 */
export function imageFileToMykadOcrBase64(
  filePath: string,
  maxBytes: number = MYKAD_OCR_IMAGE_MAX_BYTES
): string {
  const resolved = path.resolve(filePath);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch (e) {
    throw new Error(`MyKAD OCR image not found: ${resolved}`, { cause: e });
  }
  if (!stat.isFile()) {
    throw new Error(`MyKAD OCR path is not a file: ${resolved}`);
  }
  if (stat.size > maxBytes) {
    throw new Error(
      `MyKAD OCR image exceeds ${maxBytes} bytes (${(maxBytes / 1024 / 1024).toFixed(2)} MiB): ${resolved} is ${stat.size} bytes`
    );
  }
  return fs.readFileSync(resolved).toString("base64");
}

/** Resolve `filename` next to this script and return Base64 for the OCR API. */
export function mykadOcrImageFromSandbox(filename: string): string {
  return imageFileToMykadOcrBase64(path.join(sandboxDir(), filename));
}

const baseUrl = process.env.SC_BASE_URL;
const apiSecret = process.env.SC_API_SECRET;
const apiKey = process.env.SC_API_KEY;
const accessToken = process.env.SC_ACCESS_TOKEN;

if (!baseUrl) throw new Error("SC_BASE_URL is not set");
if (!apiSecret) throw new Error("SC_API_SECRET is not set");
if (!apiKey) throw new Error("SC_API_KEY is not set");
if (!accessToken) throw new Error("SC_ACCESS_TOKEN is not set");

/** Drop your files in `_sandbox/` with these names, or change the constants. */
const MYKAD_FRONT_FILE = "mykad-front.jpg";
const MYKAD_FRONT_FLASH_FILE = "mykad-front-flash.jpg";
const MYKAD_BACK_FILE = "mykad-back.jpg";

/** Must match the name on the MyKAD; override with MYKAD_SIGNER_NAME / MYKAD_SIGNER_EMAIL in `.env` if you prefer. */
const signerName = "KAU KHAI KIT";
const signerEmail = "khai.kit@malcan.io";

const rawPayload = {
  doctype: "mykad" as const,
  idFront: mykadOcrImageFromSandbox(MYKAD_FRONT_FILE),
  idFrontFlash: mykadOcrImageFromSandbox(MYKAD_FRONT_FLASH_FILE),
  idBack: mykadOcrImageFromSandbox(MYKAD_BACK_FILE),
  signerinfo: JSON.stringify({ name: signerName, email: signerEmail }),
};

const { data, mac } = encryptPayload(JSON.stringify(rawPayload), apiSecret!);
const formData = new URLSearchParams({
  accesstoken: accessToken!,
  data: data,
  mac: mac,
});

const url = `${baseUrl}/signserver/v1/user/ekycimages/ocr`;

async function main() {
  const res = await fetch(url, {
    method: "POST",
    body: formData.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const body = (await res.json()) as SigningCloudEncryptedResponse;
  if (body.result !== 0 || !body.data || !body.mac) {
    console.log(JSON.stringify(body, null, 2));
    throw new Error("Invalid response" + JSON.stringify(body));
  }
  const decrypted = decryptSigningCloudResponse(body, apiSecret!);
  console.log(JSON.stringify(decrypted, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
