/**
 * Local eKYC mock — serves WiseAI SDK assets and proxies SigningCloud getToken.
 *
 * Run from apps/api:
 *   npx tsx _sandbox/ekyc-mock-server.ts
 *
 * Flows:
 *   http://localhost:4099/     — embedded SDK (desktop camera)
 *   http://localhost:4099/qr — QR code → mobile capture (SigningCloud recommended flow)
 *
 * Requires .env: SC_BASE_URL, SC_API_SECRET, SC_API_KEY
 * Optional: SC_ACCESS_TOKEN, SC_SIGNER_EMAIL, EKYC_MOCK_PORT, EKYC_MOCK_PUBLIC_URL
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Request } from "express";
import dotenv from "dotenv";
import {
  getSigningCloudEkycSession,
  submitSigningCloudEkycResult,
} from "./ekyc-signingcloud";
import {
  decryptWiseAiEkycPayload,
  fetchWiseAiSessionCredentials,
  type WiseAiEncryption,
} from "./wiseai-decrypt";

dotenv.config();

const sandboxDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(sandboxDir, "..");
const wailibDir = path.join(apiRoot, "wailib-js-sdk");
const htmlPaths = {
  embedded: path.join(sandboxDir, "ekyc-mock.html"),
  qr: path.join(sandboxDir, "ekyc-mock-qr.html"),
  capture: path.join(sandboxDir, "ekyc-capture.html"),
};
const port = Number(process.env.EKYC_MOCK_PORT ?? 4099);

type SessionStatus = "pending" | "captured" | "submitted" | "error";

type StoredSession = {
  email: string;
  url: string;
  docType: string;
  encryption: WiseAiEncryption | null;
  status: SessionStatus;
  captureResult?: unknown;
  decrypted?: unknown;
  submitResponse?: unknown;
  error?: string;
};

const sessions = new Map<string, StoredSession>();

function readHtml(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`HTML not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

/** Public URL encoded in the QR — must be reachable from the phone. */
function publicBaseUrl(req: Request): string {
  return (
    process.env.EKYC_MOCK_PUBLIC_URL?.trim().replace(/\/$/, "") ||
    `${req.protocol}://${req.get("host")}`
  );
}

function buildCaptureUrl(req: Request, params: { token: string; url: string; docType: string }): string {
  const qs = new URLSearchParams({
    token: params.token,
    endpoint: params.url,
    docType: params.docType,
  });
  return `${publicBaseUrl(req)}/capture?${qs.toString()}`;
}

async function main() {
  if (!fs.existsSync(wailibDir)) {
    throw new Error(`WiseAI SDK folder not found: ${wailibDir}`);
  }

  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.get("/", (_req, res) => {
    res.type("html").send(readHtml(htmlPaths.embedded));
  });

  app.get("/qr", (_req, res) => {
    res.type("html").send(readHtml(htmlPaths.qr));
  });

  app.get("/capture", (_req, res) => {
    res.type("html").send(readHtml(htmlPaths.capture));
  });

  app.use("/wailib", express.static(wailibDir));

  app.get("/api/ekyc/session", async (req, res) => {
    try {
      const email =
        (typeof req.query.email === "string" && req.query.email.trim()) ||
        process.env.SC_SIGNER_EMAIL?.trim() ||
        "p2p.dev@shorakagroup.com";
      const docType =
        (typeof req.query.docType === "string" && req.query.docType.trim()) || "mykad";

      const { url, token } = await getSigningCloudEkycSession(email);

      const credentials = await fetchWiseAiSessionCredentials(url, token);
      sessions.set(token, {
        email,
        url,
        docType,
        encryption: credentials?.encryption ?? null,
        status: "pending",
      });

      const captureUrl = buildCaptureUrl(req, { token, url, docType });

      res.json({
        email,
        url,
        token,
        docType,
        captureUrl,
        publicBaseUrl: publicBaseUrl(req),
        hasEncryptionKeys: Boolean(credentials?.encryption),
        wiseAiSessionToken: credentials?.token ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/ekyc/status", (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    const stored = sessions.get(token);
    if (!stored) {
      res.status(404).json({ error: "Unknown session token" });
      return;
    }

    res.json({
      status: stored.status,
      email: stored.email,
      decrypted: stored.decrypted,
      submitResponse: stored.submitResponse,
      error: stored.error,
    });
  });

  app.post("/api/ekyc/complete", async (req, res) => {
    try {
      const body = req.body as {
        token?: string;
        result?: {
          data?: { isEncrypted?: boolean; encryptedData?: string };
          encryptedData?: string;
        };
      };

      const token = body.token?.trim();
      if (!token) {
        res.status(400).json({ error: "token is required" });
        return;
      }

      const stored = sessions.get(token);
      if (!stored) {
        res.status(404).json({ error: "Unknown session token" });
        return;
      }

      stored.captureResult = body.result;
      stored.status = "captured";

      const encryptedData =
        body.result?.data?.encryptedData ?? body.result?.encryptedData ?? null;

      if (encryptedData && stored.encryption) {
        stored.decrypted = decryptWiseAiEkycPayload(encryptedData, stored.encryption);
      }

      try {
        stored.submitResponse = await submitSigningCloudEkycResult({
          email: stored.email,
          ekycToken: token,
          result: stored.decrypted ?? body.result,
        });
        stored.status = "submitted";
      } catch (submitErr) {
        // submitResult payload may differ per tenant — still mark capture done locally
        stored.error =
          submitErr instanceof Error ? submitErr.message : String(submitErr);
        stored.status = "captured";
      }

      res.json({
        status: stored.status,
        decrypted: stored.decrypted ?? null,
        submitResponse: stored.submitResponse ?? null,
        submitError: stored.error ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/ekyc/decrypt", async (req, res) => {
    try {
      const body = req.body as {
        token?: string;
        result?: {
          data?: { isEncrypted?: boolean; encryptedData?: string };
          encryptedData?: string;
        };
      };

      const token = body.token?.trim();
      if (!token) {
        res.status(400).json({ error: "token is required" });
        return;
      }

      const stored = sessions.get(token);
      const encryptedData =
        body.result?.data?.encryptedData ?? body.result?.encryptedData ?? null;

      if (encryptedData && stored?.encryption) {
        const decrypted = decryptWiseAiEkycPayload(encryptedData, stored.encryption);
        res.json({ decrypted, raw: body.result });
        return;
      }

      res.json({
        note: stored?.encryption
          ? "No encryptedData in SDK result — returning raw payload"
          : "No WiseAI encryption keys for this session — returning raw SDK payload",
        raw: body.result,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.listen(port, () => {
    console.log(`eKYC mock running at http://localhost:${port}`);
    console.log(`  Embedded flow: http://localhost:${port}/`);
    console.log(`  QR flow:       http://localhost:${port}/qr`);
    console.log(`WiseAI assets: ${wailibDir}`);
    if (!process.env.EKYC_MOCK_PUBLIC_URL) {
      console.log("Tip: set EKYC_MOCK_PUBLIC_URL for phone-accessible QR links (LAN IP or ngrok).");
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
