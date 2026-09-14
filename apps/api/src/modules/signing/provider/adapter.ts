/**
 * Provider-agnostic signing interface. The envelope runtime talks only to this;
 * SigningCloud specifics live in signingcloud-adapter.ts.
 */

export interface ProviderSigner {
  email: string;
  /** Optional per-signer signature-field placement (provider signset). */
  signset?: unknown;
  /** AUTOMATIC rows are uploaded on the same contract but never get a hosted URL. */
  executionMode?: "MANUAL" | "AUTOMATIC";
}

export interface CreateDocumentContractInput {
  pdfBuffer: Buffer;
  contractName: string;
  signers: ProviderSigner[];
}

export interface StartSignerSessionInput {
  providerRef: string;
  signerEmail: string;
  /** Where the signer is redirected after signing. */
  redirectUrl?: string | null;
  /** Server-to-server completion callback. */
  callbackUrl?: string | null;
}

export interface FetchSignedDocumentResult {
  pdfBuffer: Buffer;
  sha256: string;
}

/** Per-signer status from provider document detail (SigningCloud addressee.signstate). */
export type ProviderSignerStatus = "PENDING" | "SIGNED" | "REJECTED";

export interface ProviderSignerDetail {
  email: string;
  status: ProviderSignerStatus;
  name?: string | null;
  /** First-view timestamp from the provider when the payload includes one. */
  viewedAt?: Date | null;
}

export interface ProviderContractDetails {
  /** Provider document state when known (SigningCloud: 4 = completed). */
  documentState?: number | null;
  signers: ProviderSignerDetail[];
}

export interface UploadSignerStampInput {
  signerEmail: string;
  imageBytes: Buffer;
  contentType: "image/png" | "image/jpeg";
}

export interface AutoSignInput {
  providerRef: string;
  signerEmail: string;
  keyword: string;
  dateKeyword?: string | null;
  dateFormat?: string | null;
  signatureImageBytes: Buffer;
  widthPx: number;
  heightPx: number;
  callbackUrl?: string | null;
}

export interface AutoSignResult {
  /** Provider reported the signer had already completed. Treat as reconciliation, not a retry. */
  alreadySigned: boolean;
}

export interface SigningProvider {
  readonly name: string;
  /** Register a single document with one or more signers; returns the provider reference. */
  createDocumentContract(input: CreateDocumentContractInput): Promise<{ providerRef: string }>;
  /** Get a hosted signing URL for one signer of a document. */
  startSignerSession(input: StartSignerSessionInput): Promise<{ signingUrl: string }>;
  /** Download the fully-signed document once complete. */
  fetchSignedDocument(input: { providerRef: string }): Promise<FetchSignedDocumentResult>;
  /** Pull live per-signer status for a provider contract (Get Document Detail). */
  getContractDetails(input: { providerRef: string }): Promise<ProviderContractDetails>;
  /** Register the issuer organisation seal against a manual signer email. */
  uploadSignerStamp(input: UploadSignerStampInput): Promise<void>;
  /** Apply one automatic signer’s signature (and optional dates) in a single call. */
  autoSign(input: AutoSignInput): Promise<AutoSignResult>;
}
