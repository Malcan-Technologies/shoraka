/**
 * SigningCloud implementation of the SigningProvider interface. One SigningCloud
 * "contract" per document; multi-signer via the signerinfo array.
 */
import * as crypto from "crypto";
import {
  readSigningCloudConfigFromEnv,
  getSigningCloudAccessToken,
  uploadPdfToSigningCloudMultiSigner,
  startManualSigning,
  extractSigningUrlFromManualSigningResponse,
  getContractFileData,
  type SigningCloudEnvConfig,
} from "../../signingcloud/signingcloud-api";
import type {
  SigningProvider,
  CreateDocumentContractInput,
  StartSignerSessionInput,
  FetchSignedDocumentResult,
} from "./adapter";

function requireConfig(): SigningCloudEnvConfig {
  const cfg = readSigningCloudConfigFromEnv();
  if (!cfg) {
    throw new Error("SigningCloud is not configured (SC_BASE_URL, SC_API_KEY, SC_API_SECRET)");
  }
  return cfg;
}

/** SigningCloud returns signed PDF bytes as a hex string under `pdfdata`. */
function bufferFromHexPdfData(raw: Record<string, unknown>): Buffer {
  const hex =
    typeof raw.pdfdata === "string"
      ? raw.pdfdata
      : typeof (raw.data as { pdfdata?: string })?.pdfdata === "string"
        ? (raw.data as { pdfdata: string }).pdfdata
        : "";
  if (!hex) {
    throw new Error("SigningCloud file response missing pdfdata");
  }
  return Buffer.from(hex, "hex");
}

export class SigningCloudProvider implements SigningProvider {
  readonly name = "signingcloud";

  async createDocumentContract(
    input: CreateDocumentContractInput
  ): Promise<{ providerRef: string }> {
    const cfg = requireConfig();
    const accessToken = await getSigningCloudAccessToken(cfg);
    const { contractnum } = await uploadPdfToSigningCloudMultiSigner({
      cfg,
      accessToken,
      pdfBuffer: input.pdfBuffer,
      contractName: input.contractName,
      signers: input.signers.map((s) => ({
        email: s.email,
        signsetJson:
          s.signset != null
            ? typeof s.signset === "string"
              ? s.signset
              : JSON.stringify(s.signset)
            : undefined,
      })),
    });
    return { providerRef: contractnum };
  }

  async startSignerSession(input: StartSignerSessionInput): Promise<{ signingUrl: string }> {
    const cfg = requireConfig();
    const accessToken = await getSigningCloudAccessToken(cfg);
    const decrypted = await startManualSigning({
      cfg,
      accessToken,
      contractnum: input.providerRef,
      signerEmail: input.signerEmail,
      redirectUrl: input.redirectUrl ?? null,
      callbackUrl: input.callbackUrl ?? null,
    });
    const signingUrl = extractSigningUrlFromManualSigningResponse(decrypted);
    if (!signingUrl) {
      throw new Error("SigningCloud did not return a signing URL");
    }
    return { signingUrl };
  }

  async fetchSignedDocument(input: { providerRef: string }): Promise<FetchSignedDocumentResult> {
    const cfg = requireConfig();
    const accessToken = await getSigningCloudAccessToken(cfg);
    const raw = await getContractFileData({ cfg, accessToken, contractnum: input.providerRef });
    const pdfBuffer = bufferFromHexPdfData(raw);
    const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    return { pdfBuffer, sha256 };
  }
}
