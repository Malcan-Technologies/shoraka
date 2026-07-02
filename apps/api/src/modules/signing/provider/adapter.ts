/**
 * Provider-agnostic signing interface. The envelope runtime talks only to this;
 * SigningCloud specifics live in signingcloud-adapter.ts so we can confirm the
 * provider's multi-document / batch behavior (Phase 0 spike) without reworking callers.
 */

export interface ProviderSigner {
  email: string;
  /** Optional per-signer signature-field placement (provider signset). */
  signset?: unknown;
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

export interface SigningProvider {
  readonly name: string;
  /** Register a single document with one or more signers; returns the provider reference. */
  createDocumentContract(input: CreateDocumentContractInput): Promise<{ providerRef: string }>;
  /** Get a hosted signing URL for one signer of a document. */
  startSignerSession(input: StartSignerSessionInput): Promise<{ signingUrl: string }>;
  /** Download the fully-signed document once complete. */
  fetchSignedDocument(input: { providerRef: string }): Promise<FetchSignedDocumentResult>;
}
