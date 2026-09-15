import dotenv from 'dotenv';
import { decryptSigningCloudResponse } from './signingcloud-decrypt';
dotenv.config();

const baseUrl = process.env.SC_BASE_URL;
const apiSecret = process.env.SC_API_SECRET;
const apiKey = process.env.SC_API_KEY;

if (!baseUrl) throw new Error('SC_BASE_URL is not set');
if (!apiSecret) throw new Error('SC_API_SECRET is not set');
if (!apiKey) throw new Error('SC_API_KEY is not set');

const url = `${baseUrl}/signserver/v1/accesstoken?client_id=${encodeURIComponent(apiKey!)}`;

async function main() {
  const res = await fetch(url);

  const body = await res.json();
  if (body.result !== 0 || !body.data || !body.mac) {
    throw new Error("Invalid response" + JSON.stringify(body));
  }

  const decrypted = decryptSigningCloudResponse(body, apiSecret!);
  console.log(decrypted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
