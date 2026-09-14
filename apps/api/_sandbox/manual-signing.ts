    import dotenv from "dotenv";
    import { decryptSigningCloudResponse, encryptPayload, SigningCloudEncryptedResponse } from "./signingcloud-decrypt";
    dotenv.config();

    const baseUrl = process.env.SC_BASE_URL;
    const apiSecret = process.env.SC_API_SECRET;
    const apiKey = process.env.SC_API_KEY;
    const accessToken = process.env.SC_ACCESS_TOKEN;

    if (!baseUrl) throw new Error("SC_BASE_URL is not set");
    if (!apiSecret) throw new Error("SC_API_SECRET is not set");
    if (!apiKey) throw new Error("SC_API_KEY is not set");
    if (!accessToken) throw new Error("SC_ACCESS_TOKEN is not set");

    const contractNum = "AF13212EB9C184AA69E8DE458CF5ED2E";
    const signerInfo = {
      email: "p2p.dev@shorakagroup.com"
    }
    const rawPayload = {
      contractnum: contractNum,
      signerInfo: signerInfo
    }
    console.log(signerInfo);
    const { data, mac } = encryptPayload(JSON.stringify(rawPayload), apiSecret!);
    const formData = new URLSearchParams({
      accesstoken: accessToken!,
      data: data,
      mac: mac,
    });

    console.log(formData.toString());

    const url = `${baseUrl}/signserver/v1/contract/signature/manual`;

    async function main() {
      const res = await fetch(url, {
        method: "POST",
        body: formData.toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        }
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
