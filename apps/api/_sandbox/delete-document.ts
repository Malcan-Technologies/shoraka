import dotenv from "dotenv";
import { decryptSigningCloudResponse, encryptPayload } from "./signingcloud-decrypt";
dotenv.config();

const baseUrl = process.env.SC_BASE_URL;
const apiSecret = process.env.SC_API_SECRET;
const apiKey = process.env.SC_API_KEY;
const accessToken = process.env.SC_ACCESS_TOKEN;

if (!baseUrl) throw new Error("SC_BASE_URL is not set");
if (!apiSecret) throw new Error("SC_API_SECRET is not set");
if (!apiKey) throw new Error("SC_API_KEY is not set");
if (!accessToken) throw new Error("SC_ACCESS_TOKEN is not set");

const rawPayload = {
  contractnum: "5D61E01CD1C25B64F88B0E2D4949D8D5",
}
const { data, mac } = encryptPayload(JSON.stringify(rawPayload), apiSecret!);
const formData = new URLSearchParams({
  accesstoken: accessToken!,
  data: data,
  mac: mac,
});

console.log(formData.toString());

const url = `${baseUrl}/signserver/v1/contract/list?${formData.toString()}`;

async function main() {
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    }
  });
  const body = await res.json();
  if (body.result !== 0 || !body.data || !body.mac) {
    console.log("Response (not encrypted or error):", body);
    throw new Error("Invalid response");
  }
  const decrypted = decryptSigningCloudResponse(body, apiSecret!);
  console.log(JSON.stringify(decrypted, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
