import dotenv from 'dotenv';
import { decryptSigningCloudResponse, encryptPayload, SigningCloudEncryptedResponse } from './signingcloud-decrypt';
dotenv.config();

const baseUrl = process.env.SC_BASE_URL;
const apiSecret = process.env.SC_API_SECRET;
const apiKey = process.env.SC_API_KEY;
const accessToken = process.env.SC_ACCESS_TOKEN;

if (!baseUrl) throw new Error('SC_BASE_URL is not set');
if (!apiSecret) throw new Error('SC_API_SECRET is not set');
if (!apiKey) throw new Error('SC_API_KEY is not set');
if (!accessToken) throw new Error('SC_ACCESS_TOKEN is not set');

const dataBody = {
    contractnum: "C583EEFD058470B6432F8CBCD7EB7221",
}

const { data, mac } = encryptPayload(JSON.stringify(dataBody), apiSecret!);
const params = new URLSearchParams({
    accesstoken: accessToken!,
    data: data,
    mac: mac,
});
const url = `${baseUrl}/signserver/v1/contract/details/data?${params.toString()}`;

async function main() {
    const res = await fetch(url, {
        method: "GET",
    });
    const body = await res.json() as SigningCloudEncryptedResponse;
    if (body.result !== 0 || !body.data || !body.mac) {
        throw new Error("Invalid response" + JSON.stringify(body));
    }
    const decrypted = decryptSigningCloudResponse(body, apiSecret!);
    console.log(JSON.stringify(decrypted, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
