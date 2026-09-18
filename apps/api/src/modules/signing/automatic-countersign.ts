/**
 * Delayed CashSouk auto-sign: after every manual required assignment on a document
 * is provider-confirmed SIGNED, apply one `/signature/auto` call per automatic
 * signer. That call covers every placement owned by the signer. The assignment
 * is marked signed only when every placement is confirmed.
 */
import {
  frozenAutomaticPlacementsComplete,
  frozenAutomaticSignerName,
  isAutomaticSigningRecipient,
  parseFrozenAutomaticSignerSnapshot,
  pendingAutomaticPlacements,
  SIGNINGCLOUD_AUTO_DATE_FORMAT,
  type FrozenAutomaticSignerSnapshot,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { internalAuditContext } from "../../lib/audit";
import type { SigningProvider } from "./provider/adapter";
import type { SigningEnvelopeWithGraph } from "./mapper";
import type { SigningRepository } from "./repository";
import { readFrozenSignatureImage } from "./automatic-signers";
import { markAssignmentSignedAndLog } from "./document-signed-activity";

export const AUTO_SIGN_BACKOFF_MS = 2 * 60 * 1000;
export const AUTO_SIGN_MAX_ATTEMPTS = 8;

export function normalizeAutoSignErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[0-9a-f]{32,}/gi, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 280);
}

export function shouldSkipAutomaticCountersign(input: {
  lastAutoSignAt: Date | null | undefined;
  attemptCount: number;
  now: Date;
  ignoreBackoff: boolean;
}): boolean {
  if (input.ignoreBackoff) return false;
  if (input.attemptCount > AUTO_SIGN_MAX_ATTEMPTS) return true;
  if (!input.lastAutoSignAt) return false;
  return input.now.getTime() - input.lastAutoSignAt.getTime() < AUTO_SIGN_BACKOFF_MS;
}

type CountersignRepo = Pick<
  SigningRepository,
  "markAssignmentSigned" | "recordAutoSignAttempt" | "setAssignmentFrozenSnapshot"
>;

export type AutomaticCountersignResult = {
  markedSigned: number;
  attempted: number;
};

function documentAutomaticPending(
  envelope: SigningEnvelopeWithGraph,
  documentId: string
): SigningEnvelopeWithGraph["assignments"] {
  return envelope.assignments
    .filter((assignment) => {
      if (assignment.document_id !== documentId || assignment.action !== "SIGN") return false;
      if (assignment.status === "SIGNED" || assignment.status === "DECLINED") return false;
      const recipient = envelope.recipients.find((row) => row.id === assignment.recipient_id);
      return Boolean(recipient && isAutomaticSigningRecipient(recipient));
    })
    .sort((left, right) => {
      const leftOrder =
        envelope.recipients.find((row) => row.id === left.recipient_id)?.routing_order ?? 0;
      const rightOrder =
        envelope.recipients.find((row) => row.id === right.recipient_id)?.routing_order ?? 0;
      return leftOrder - rightOrder;
    });
}

function manualsAllSigned(envelope: SigningEnvelopeWithGraph, documentId: string): boolean {
  const manuals = envelope.assignments.filter((assignment) => {
    if (assignment.document_id !== documentId || !assignment.required || assignment.action !== "SIGN") {
      return false;
    }
    const recipient = envelope.recipients.find((row) => row.id === assignment.recipient_id);
    return recipient != null && !isAutomaticSigningRecipient(recipient);
  });
  return manuals.every((assignment) => assignment.status === "SIGNED");
}

async function persistAutoSignFailure(
  repo: CountersignRepo,
  assignmentId: string,
  error: unknown
): Promise<string> {
  const message = normalizeAutoSignErrorMessage(error) || "Automatic signing failed";
  await repo.recordAutoSignAttempt(assignmentId, { error: message, increment: true });
  return message;
}

async function autoSignSigner(input: {
  envelope: SigningEnvelopeWithGraph;
  document: SigningEnvelopeWithGraph["documents"][number];
  assignment: SigningEnvelopeWithGraph["assignments"][number];
  snapshot: FrozenAutomaticSignerSnapshot;
  signerEmail: string;
  image: Awaited<ReturnType<typeof readFrozenSignatureImage>>;
  provider: SigningProvider;
  callbackUrl: string | null;
}): Promise<FrozenAutomaticSignerSnapshot> {
  const pending = pendingAutomaticPlacements(input.snapshot);
  if (pending.length === 0) return input.snapshot;
  const result = await input.provider.autoSign({
    providerRef: input.document.provider_contract_ref!,
    signerEmail: input.signerEmail,
    keyword: input.snapshot.signKeyword,
    dateKeyword: input.snapshot.dateKeyword,
    dateFormat: input.snapshot.dateKeyword ? SIGNINGCLOUD_AUTO_DATE_FORMAT : undefined,
    signatureImageBytes: input.image.bytes,
    widthPx: input.snapshot.signatureWidthPx,
    heightPx: input.snapshot.signatureHeightPx,
    callbackUrl: input.callbackUrl,
  });
  if (result.alreadySigned) {
    logger.info(
      {
        envelopeId: input.envelope.id,
        documentId: input.document.id,
        assignmentId: input.assignment.id,
        keyword: input.snapshot.signKeyword,
        dateKeyword: input.snapshot.dateKeyword ?? null,
      },
      "Automatic signer already present on provider"
    );
  }
  const signed = new Set(pending.map((placement) => `${placement.roleKey}:${placement.slotIndex}`));
  return {
    ...input.snapshot,
    placements: input.snapshot.placements.map((placement) =>
      signed.has(`${placement.roleKey}:${placement.slotIndex}`)
        ? { ...placement, status: "SIGNED" }
        : placement
    ),
  };
}

export async function runAutomaticCountersign(input: {
  envelope: SigningEnvelopeWithGraph;
  provider: SigningProvider;
  repo: CountersignRepo;
  callbackUrl: string | null;
  assignmentId?: string;
  ignoreBackoff?: boolean;
  throwOnFailure?: boolean;
  now?: Date;
}): Promise<AutomaticCountersignResult> {
  const now = input.now ?? new Date();
  const ignoreBackoff = input.ignoreBackoff === true;
  const throwOnFailure = input.throwOnFailure === true;
  let markedSigned = 0;
  let attempted = 0;

  for (const document of envelopeDocumentsWithProvider(input.envelope)) {
    if (!manualsAllSigned(input.envelope, document.id)) continue;
    const pending = documentAutomaticPending(input.envelope, document.id).filter((assignment) =>
      input.assignmentId ? assignment.id === input.assignmentId : true
    );
    if (pending.length === 0) continue;

    for (const assignment of pending) {
      const recipient = input.envelope.recipients.find((row) => row.id === assignment.recipient_id);
      if (!recipient) continue;
      if (
        shouldSkipAutomaticCountersign({
          lastAutoSignAt: assignment.last_auto_sign_at,
          attemptCount: assignment.auto_sign_attempt_count ?? 0,
          now,
          ignoreBackoff,
        })
      ) {
        continue;
      }

      const snapshot = parseFrozenAutomaticSignerSnapshot(assignment.frozen_asset_snapshot);
      if (!snapshot) {
        const message = await persistAutoSignFailure(
          input.repo,
          assignment.id,
          new Error(`The frozen CashSouk signatory for ${recipient.role_label} is missing.`)
        );
        if (throwOnFailure) {
          throw new AppError(409, "SIGNING_AUTOMATIC_SNAPSHOT_MISSING", message);
        }
        break;
      }

      attempted += 1;
      logger.info(
        {
          envelopeId: input.envelope.id,
          documentId: document.id,
          assignmentId: assignment.id,
          documentKind: snapshot.documentKind,
          signerIndex: snapshot.signerIndex,
          attemptCount: assignment.auto_sign_attempt_count,
        },
        "Attempting automatic countersign"
      );

      let image;
      try {
        image = await readFrozenSignatureImage(snapshot);
      } catch (error) {
        const message = await persistAutoSignFailure(input.repo, assignment.id, error);
        logger.warn(
          {
            envelopeId: input.envelope.id,
            documentId: document.id,
            assignmentId: assignment.id,
            documentKind: snapshot.documentKind,
            error: message,
          },
          "Automatic countersign failed"
        );
        if (throwOnFailure) {
          throw error instanceof AppError
            ? error
            : new AppError(502, "SIGNING_AUTOMATIC_SIGN_FAILED", message);
        }
        break;
      }

      const signerEmail = recipient.email ?? snapshot.signingEmail;
      let nextSnapshot = snapshot;
      try {
        if (!nextSnapshot.signKeyword?.trim()) {
          throw new Error(
            `The frozen CashSouk signatory for ${frozenAutomaticSignerName(nextSnapshot)} is missing a signature keyword.`
          );
        }
        nextSnapshot = await autoSignSigner({
          envelope: input.envelope,
          document,
          assignment,
          snapshot: nextSnapshot,
          signerEmail,
          image,
          provider: input.provider,
          callbackUrl: input.callbackUrl,
        });
        await input.repo.setAssignmentFrozenSnapshot(assignment.id, nextSnapshot);
        await input.repo.recordAutoSignAttempt(assignment.id, { error: null, increment: true });
        if (!frozenAutomaticPlacementsComplete(nextSnapshot)) {
          throw new Error(
            `Not every automatic placement for ${frozenAutomaticSignerName(nextSnapshot)} is complete.`
          );
        }
        const newlySigned = await markAssignmentSignedAndLog({
          repo: input.repo,
          parties: {
            envelope: input.envelope,
            assignment,
            recipient,
            document,
          },
          context: internalAuditContext(),
        });
        assignment.status = "SIGNED";
        assignment.frozen_asset_snapshot = nextSnapshot;
        if (newlySigned !== false) markedSigned += 1;
        logger.info(
          {
            envelopeId: input.envelope.id,
            documentId: document.id,
            assignmentId: assignment.id,
            documentKind: snapshot.documentKind,
            signerIndex: snapshot.signerIndex,
          },
          "Automatic countersign succeeded"
        );
      } catch (error) {
        assignment.frozen_asset_snapshot = nextSnapshot;
        const message = await persistAutoSignFailure(input.repo, assignment.id, error);
        logger.warn(
          {
            envelopeId: input.envelope.id,
            documentId: document.id,
            assignmentId: assignment.id,
            documentKind: snapshot.documentKind,
            attemptCount: assignment.auto_sign_attempt_count + 1,
            error: message,
          },
          "Automatic countersign failed"
        );
        if (throwOnFailure) {
          throw new AppError(502, "SIGNING_AUTOMATIC_SIGN_FAILED", message);
        }
        break;
      }
    }
  }

  return { markedSigned, attempted };
}

function envelopeDocumentsWithProvider(envelope: SigningEnvelopeWithGraph) {
  return envelope.documents.filter(
    (document) => Boolean(document.provider_contract_ref) && document.status !== "VOIDED"
  );
}
