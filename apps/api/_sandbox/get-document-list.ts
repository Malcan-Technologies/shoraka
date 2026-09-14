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
  startIndex: 0,
  pageSize: 0,
  rDetail: 2,
  contractState: -1,
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
    method: "GET",
  });
  const body = await res.json();
  const decrypted = decryptSigningCloudResponse(body, apiSecret!);
  console.log(JSON.stringify(decrypted, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
