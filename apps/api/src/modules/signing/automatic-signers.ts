/**
 * CashSouk automatic roles: inject at plan time, freeze signatures, and freeze
 * the issuer company seal on FA/DoA when SC_ENABLE_SEAL_FIELD is enabled. Stamp
 * upload happens when the selected manual signer opens their session.
 */
import {
  automaticContractKeywordLimitIssue,
  automaticSignerKeywordCollisionIssue,
  automaticSignerKeywordPair,
  automaticSignerRef,
  automaticSlotKey,
  configuredSlotsForDocumentKeys,
  documentExecutionBindingIssues,
  documentExecutionSlotLabel,
  documentKindForExecutionRole,
  documentKindForPackageKey,
  executionRoleSigningRole,
  expandedPlacementsForRole,
  frozenAutomaticSignerLabel,
  getIssuerAuthorizedParty,
  isAutomaticSignerProviderReady,
  isOperatorDocumentWitnessRole,
  normalizeSigningEmail,
  parseFrozenAutomaticSignerSnapshot,
  signingPackageRequiresDoaStamp,
  signingPackageRequiresIssuerSeal,
  SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES,
  type AuthorizedPartiesSnapshot,
  type DocumentExecutionRepeatCounts,
  type EnvelopePlan,
  type FrozenAutomaticCompanyStamp,
  type FrozenAutomaticSignerSnapshot,
  type FrozenDocumentExecutionContext,
  type OperatorDocumentExecutionRole,
  type OperatorDocumentKind,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { confirmLegalImageBytes, readS3ObjectBytes } from "../../lib/legal-images";
import { isSigningCloudSealFieldEnabled } from "../signingcloud/signingcloud-api";
import type { SigningProvider } from "./provider/adapter";
import type { SigningEnvelopeWithGraph } from "./mapper";
import type {
  OperatorCompanyStampRecord,
  OperatorExecutionBindingRecord,
  SigningRepository,
} from "./repository";

const AUTOMATIC_ROUTING_ORDER_BASE = 1000;
const DOCUMENT_KIND_ORDER: Record<OperatorDocumentKind, number> = {
  FA: 0,
  JSG: 1,
  DOA: 2,
};

export type ConfirmedLegalImage = {
  bytes: Buffer;
  sha256: string;
  widthPx: number;
  heightPx: number;
  byteSize: number;
  contentType: "image/png" | "image/jpeg";
};

function bindingKey(roleKey: OperatorDocumentExecutionRole, slotIndex: number): string {
  return automaticSlotKey(roleKey, slotIndex);
}

export async function readConfirmedLegalImage(s3Key: string): Promise<ConfirmedLegalImage> {
  const bytes = await readS3ObjectBytes(s3Key, SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES);
  const confirmed = confirmLegalImageBytes(bytes);
  return {
    bytes,
    sha256: confirmed.sha256,
    widthPx: confirmed.widthPx,
    heightPx: confirmed.heightPx,
    byteSize: confirmed.byteSize,
    contentType: confirmed.contentType,
  };
}

async function freezeBindingPerson(
  documentKind: OperatorDocumentKind,
  binding: OperatorExecutionBindingRecord,
  placements: FrozenAutomaticSignerSnapshot["placements"],
  companyStamp?: FrozenAutomaticCompanyStamp | null
): Promise<FrozenAutomaticSignerSnapshot> {
  const label = documentExecutionSlotLabel(binding.roleKey, binding.slotIndex);
  const officerName = binding.officerName?.trim() ?? "";
  const signingEmail = normalizeSigningEmail(binding.signingEmail ?? "");
  const ready = isAutomaticSignerProviderReady({
    active: binding.active,
    roles: binding.roles,
    signingEmail,
    signatureS3Key: binding.signatureS3Key,
    signatureSha256: binding.signatureSha256,
    signatureConfirmedAt: binding.signatureConfirmedAt?.toISOString() ?? null,
    requiredRole: executionRoleSigningRole(binding.roleKey),
  });
  if (!officerName || !ready) {
    throw new AppError(
      400,
      "SIGNING_AUTOMATIC_SIGNER_NOT_READY",
      `The CashSouk ${
        isOperatorDocumentWitnessRole(binding.roleKey) ? "witness" : "signatory"
      } for ${label} is not ready for automatic signing.`
    );
  }
  const image = await readConfirmedLegalImage(binding.signatureS3Key!.trim());
  if (image.sha256 !== binding.signatureSha256!.trim().toLowerCase()) {
    throw new AppError(
      409,
      "SIGNING_AUTOMATIC_SIGNATURE_MISMATCH",
      `The CashSouk signature for ${label} no longer matches the confirmed image.`
    );
  }
  const pair = automaticSignerKeywordPair(documentKind, binding.signingPersonId, placements);
  return {
    documentKind,
    signingPersonId: binding.signingPersonId,
    officerName,
    designation: binding.designation?.trim() || null,
    identityNumber: binding.identityNumber?.trim() || null,
    signingEmail,
    signatureS3Key: binding.signatureS3Key!.trim(),
    signatureSha256: image.sha256,
    signatureWidthPx: image.widthPx,
    signatureHeightPx: image.heightPx,
    signatureByteSize: image.byteSize,
    signKeyword: pair.signKeyword,
    ...(pair.dateKeyword ? { dateKeyword: pair.dateKeyword } : {}),
    placements: placements.map((placement) => ({ ...placement, keyword: pair.signKeyword })),
    ...(companyStamp ? { companyStamp } : {}),
  };
}

async function freezeCompanyStamp(
  stamp: OperatorCompanyStampRecord | null | undefined
): Promise<FrozenAutomaticCompanyStamp | null> {
  const s3Key = stamp?.s3Key?.trim();
  if (!s3Key) return null;
  const image = await readConfirmedLegalImage(s3Key);
  return {
    s3Key,
    sha256: image.sha256,
    contentType: image.contentType,
    fileName: stamp?.fileName ?? null,
    widthPx: image.widthPx,
    heightPx: image.heightPx,
    byteSize: image.byteSize,
  };
}

export async function injectAutomaticExecutionRoles(
  plan: EnvelopePlan,
  bindings: readonly OperatorExecutionBindingRecord[],
  options?: {
    repeats?: DocumentExecutionRepeatCounts | null;
    companyStamp?: OperatorCompanyStampRecord | null;
  }
): Promise<EnvelopePlan> {
  const documentKeys = plan.documents.map((document) => document.key);
  const requiredSlots = configuredSlotsForDocumentKeys(documentKeys);
  if (requiredSlots.length === 0) return plan;

  const byKey = new Map(
    bindings.map((row) => [bindingKey(row.roleKey, row.slotIndex), row] as const)
  );
  const needsDoaStamp = signingPackageRequiresDoaStamp(documentKeys);
  const issues = documentExecutionBindingIssues({
    requiredSlots,
    companyStampReady: needsDoaStamp ? Boolean(options?.companyStamp?.s3Key?.trim()) : undefined,
    bindings: requiredSlots.map((slot) => {
      const row = byKey.get(bindingKey(slot.roleKey, slot.slotIndex));
      return {
        roleKey: slot.roleKey,
        slotIndex: slot.slotIndex,
        signingPersonId: row?.signingPersonId ?? null,
        signingEmail: row?.signingEmail ?? null,
        officerName: row?.officerName ?? null,
        designation: row?.designation ?? null,
        identityNumber: row?.identityNumber ?? null,
        providerReady: row
          ? isAutomaticSignerProviderReady({
              active: row.active,
              roles: row.roles,
              signingEmail: row.signingEmail,
              signatureS3Key: row.signatureS3Key,
              signatureSha256: row.signatureSha256,
              signatureConfirmedAt: row.signatureConfirmedAt?.toISOString() ?? null,
              requiredRole: executionRoleSigningRole(slot.roleKey),
            })
          : false,
      };
    }),
  });
  if (issues.length > 0) {
    const issue = issues[0]!;
    throw new AppError(400, issue.code, issue.message);
  }

  const companyStamp = needsDoaStamp ? await freezeCompanyStamp(options?.companyStamp) : null;
  const frozenByPerson = new Map<string, FrozenAutomaticSignerSnapshot>();
  for (const slot of requiredSlots) {
    const binding = byKey.get(bindingKey(slot.roleKey, slot.slotIndex));
    if (!binding) continue;
    const documentKind = documentKindForExecutionRole(slot.roleKey);
    const personKey = `${documentKind}:${binding.signingPersonId}`;
    const placements = (
      isOperatorDocumentWitnessRole(slot.roleKey)
        ? expandedPlacementsForRole(slot.roleKey, options?.repeats)
        : expandedPlacementsForRole(slot.roleKey).filter(
            (placement) => placement.slotIndex === slot.slotIndex
          )
    ).map((placement) => ({
      roleKey: placement.roleKey,
      slotIndex: placement.slotIndex,
      keyword: placement.keyword,
      status: "PENDING" as const,
    }));
    const existing = frozenByPerson.get(personKey);
    if (existing) {
      const seen = new Set(
        existing.placements.map((placement) => automaticSlotKey(placement.roleKey, placement.slotIndex))
      );
      for (const placement of placements) {
        if (seen.has(automaticSlotKey(placement.roleKey, placement.slotIndex))) continue;
        existing.placements.push({ ...placement, keyword: existing.signKeyword });
      }
      const pair = automaticSignerKeywordPair(
        documentKind,
        existing.signingPersonId,
        existing.placements
      );
      existing.signKeyword = pair.signKeyword;
      existing.dateKeyword = pair.dateKeyword;
      existing.placements = existing.placements.map((placement) => ({
        ...placement,
        keyword: pair.signKeyword,
      }));
      continue;
    }
    frozenByPerson.set(
      personKey,
      await freezeBindingPerson(
        documentKind,
        binding,
        placements,
        documentKind === "DOA" ? companyStamp : null
      )
    );
  }

  const people = [...frozenByPerson.values()];
  const collision = automaticSignerKeywordCollisionIssue(people);
  if (collision) {
    throw new AppError(400, "SIGNING_LAYOUT_ERROR", collision);
  }
  const byDocument = new Map<OperatorDocumentKind, FrozenAutomaticSignerSnapshot[]>();
  for (const snapshot of people) {
    const rows = byDocument.get(snapshot.documentKind) ?? [];
    rows.push(snapshot);
    byDocument.set(snapshot.documentKind, rows);
  }
  for (const snapshots of byDocument.values()) {
    const limit = automaticContractKeywordLimitIssue(snapshots);
    if (limit) throw new AppError(400, "SIGNING_LAYOUT_ERROR", limit);
  }

  const recipients = [...plan.recipients];
  const assignments = [...plan.assignments];
  for (const snapshot of [...frozenByPerson.values()].sort((left, right) => {
    const kindDelta = DOCUMENT_KIND_ORDER[left.documentKind] - DOCUMENT_KIND_ORDER[right.documentKind];
    if (kindDelta !== 0) return kindDelta;
    const leftSlot = Math.min(...left.placements.map((placement) => placement.slotIndex));
    const rightSlot = Math.min(...right.placements.map((placement) => placement.slotIndex));
    return leftSlot - rightSlot;
  })) {
    const ref = automaticSignerRef(snapshot.documentKind, snapshot.signingPersonId);
    recipients.push({
      ref,
      role_key: snapshot.documentKind,
      role_label: frozenAutomaticSignerLabel(snapshot),
      name: snapshot.officerName,
      email: snapshot.signingEmail,
      application_guarantor_id: null,
      ic_number: snapshot.identityNumber,
      routing_order:
        AUTOMATIC_ROUTING_ORDER_BASE +
        DOCUMENT_KIND_ORDER[snapshot.documentKind] * 10 +
        Math.min(...snapshot.placements.map((placement) => placement.slotIndex)),
      kyc_required: false,
      execution_mode: "AUTOMATIC",
      delivery_mode: "INTERNAL",
    });
    for (const document of plan.documents) {
      if (documentKindForPackageKey(document.key) !== snapshot.documentKind) continue;
      assignments.push({
        document_ref: document.ref,
        recipient_ref: ref,
        required: document.required,
        action: "SIGN",
        frozen_asset_snapshot: snapshot,
      });
    }
  }
  return { ...plan, recipients, assignments };
}

export function frozenExecutionContextFromPlan(plan: EnvelopePlan): FrozenDocumentExecutionContext {
  const people: FrozenAutomaticSignerSnapshot[] = [];
  const seen = new Set<string>();
  let companyStamp: FrozenAutomaticCompanyStamp | null = null;
  for (const assignment of plan.assignments) {
    const snapshot = parseFrozenAutomaticSignerSnapshot(assignment.frozen_asset_snapshot);
    if (!snapshot) continue;
    if (snapshot.companyStamp) companyStamp = snapshot.companyStamp;
    const key = `${snapshot.documentKind}:${snapshot.signingPersonId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(snapshot);
  }
  return { people, companyStamp };
}

export function frozenExecutionContextFromEnvelope(
  envelope: SigningEnvelopeWithGraph
): FrozenDocumentExecutionContext {
  const people: FrozenAutomaticSignerSnapshot[] = [];
  const seen = new Set<string>();
  let companyStamp: FrozenAutomaticCompanyStamp | null = null;
  for (const assignment of envelope.assignments) {
    const snapshot = parseFrozenAutomaticSignerSnapshot(assignment.frozen_asset_snapshot);
    if (!snapshot) continue;
    if (snapshot.companyStamp) companyStamp = snapshot.companyStamp;
    const key = `${snapshot.documentKind}:${snapshot.signingPersonId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(snapshot);
  }
  return { people, companyStamp };
}

export function assertEnvelopeHasRequiredAutomaticRoles(envelope: SigningEnvelopeWithGraph): void {
  const documentKeys = envelope.documents
    .map((document) => document.template_ref)
    .filter((key): key is string => Boolean(key));
  for (const slot of configuredSlotsForDocumentKeys(documentKeys)) {
    const present = envelope.assignments.some((assignment) => {
      const recipient = envelope.recipients.find((row) => row.id === assignment.recipient_id);
      if (recipient?.execution_mode !== "AUTOMATIC") return false;
      const snapshot = parseFrozenAutomaticSignerSnapshot(assignment.frozen_asset_snapshot);
      return snapshot?.placements.some(
        (placement) => placement.roleKey === slot.roleKey && placement.slotIndex === slot.slotIndex
      );
    });
    if (!present) {
      throw new AppError(
        400,
        "SIGNING_AUTOMATIC_ROLE_UNBOUND",
        `CashSouk has not assigned ${documentExecutionSlotLabel(slot.roleKey, slot.slotIndex)}.`
      );
    }
  }
}

export async function verifyAutomaticAssignmentSnapshots(
  envelope: SigningEnvelopeWithGraph
): Promise<void> {
  for (const assignment of envelope.assignments) {
    const recipient = envelope.recipients.find((row) => row.id === assignment.recipient_id);
    if (recipient?.execution_mode !== "AUTOMATIC") continue;
    const snapshot = parseFrozenAutomaticSignerSnapshot(assignment.frozen_asset_snapshot);
    if (!snapshot) {
      throw new AppError(
        409,
        "SIGNING_AUTOMATIC_SNAPSHOT_MISSING",
        `The frozen CashSouk signatory for ${recipient.role_label} is missing.`
      );
    }
    await readFrozenSignatureImage(snapshot);
  }
}

export async function readFrozenSignatureImage(
  snapshot: FrozenAutomaticSignerSnapshot
): Promise<ConfirmedLegalImage> {
  const image = await readConfirmedLegalImage(snapshot.signatureS3Key);
  if (image.sha256 !== snapshot.signatureSha256.trim().toLowerCase()) {
    throw new AppError(
      409,
      "SIGNING_AUTOMATIC_SIGNATURE_MISMATCH",
      `The CashSouk signature for ${frozenAutomaticSignerLabel(snapshot)} no longer matches the frozen image.`
    );
  }
  return image;
}

function sealApplierEmail(snapshot: AuthorizedPartiesSnapshot | null | undefined): string | null {
  const issuer = getIssuerAuthorizedParty(snapshot);
  const appliers = (issuer?.representatives ?? []).filter(
    (representative) => representative.applies_company_seal === true
  );
  if (appliers.length !== 1) return null;
  return normalizeSigningEmail(appliers[0]?.email ?? "");
}

export async function freezeIssuerSealForDocument(input: {
  document: SigningEnvelopeWithGraph["documents"][number];
  assignments: Array<{
    assignment: SigningEnvelopeWithGraph["assignments"][number];
    recipient: SigningEnvelopeWithGraph["recipients"][number];
  }>;
  authorizedParties: AuthorizedPartiesSnapshot | null | undefined;
  issuerOrganizationId: string;
  repo: Pick<SigningRepository, "findActiveIssuerCompanySeal" | "setAssignmentFrozenCompanySeal">;
}): Promise<void> {
  const documentKey = input.document.template_ref ?? "";
  if (!isSigningCloudSealFieldEnabled() || !signingPackageRequiresIssuerSeal([documentKey])) {
    return;
  }

  const applierEmail = sealApplierEmail(input.authorizedParties);
  const applier = input.assignments.find(
    ({ recipient }) =>
      recipient.execution_mode !== "AUTOMATIC" &&
      normalizeSigningEmail(recipient.email) === applierEmail
  );
  if (!applierEmail || !applier) {
    throw new AppError(
      400,
      "SIGNING_SEAL_APPLIER_MISSING",
      "Select exactly one issuer representative to apply the company seal."
    );
  }

  const seal = await input.repo.findActiveIssuerCompanySeal(input.issuerOrganizationId);
  if (!seal) {
    throw new AppError(
      400,
      "ISSUER_COMPANY_SEAL_REQUIRED",
      "Upload a company seal in Issuer Profile before sending this signing package."
    );
  }

  const image = await readConfirmedLegalImage(seal.s3_key);
  if (image.sha256 !== seal.sha256.trim().toLowerCase()) {
    throw new AppError(
      409,
      "SIGNING_SEAL_MISMATCH",
      "The issuer company seal no longer matches the confirmed image."
    );
  }
  await input.repo.setAssignmentFrozenCompanySeal(applier.assignment.id, seal.id);
}

/** @deprecated Use freezeIssuerSealForDocument — stamp upload is deferred to session start. */
export async function registerIssuerSealForDocument(input: {
  document: SigningEnvelopeWithGraph["documents"][number];
  assignments: Array<{
    assignment: SigningEnvelopeWithGraph["assignments"][number];
    recipient: SigningEnvelopeWithGraph["recipients"][number];
  }>;
  authorizedParties: AuthorizedPartiesSnapshot | null | undefined;
  issuerOrganizationId: string;
  provider: SigningProvider;
  repo: Pick<SigningRepository, "findActiveIssuerCompanySeal" | "setAssignmentFrozenCompanySeal">;
}): Promise<void> {
  await freezeIssuerSealForDocument(input);
}

export async function reuploadAssignmentCompanySeal(input: {
  assignment: SigningEnvelopeWithGraph["assignments"][number];
  signerEmail: string;
  provider: SigningProvider;
  repo: Pick<SigningRepository, "findIssuerCompanySealById">;
}): Promise<void> {
  const sealId = input.assignment.frozen_company_seal_id;
  if (!sealId) return;
  const seal = await input.repo.findIssuerCompanySealById(sealId);
  if (!seal) {
    throw new AppError(409, "ISSUER_COMPANY_SEAL_REQUIRED", "The frozen company seal is no longer available.");
  }
  const image = await readConfirmedLegalImage(seal.s3_key);
  if (image.sha256 !== seal.sha256.trim().toLowerCase()) {
    throw new AppError(
      409,
      "SIGNING_SEAL_MISMATCH",
      "The frozen company seal no longer matches the confirmed image."
    );
  }
  await input.provider.uploadSignerStamp({
    signerEmail: input.signerEmail,
    imageBytes: image.bytes,
    contentType: image.contentType,
  });
}

export function automaticSignsetForSnapshot(
  snapshot: FrozenAutomaticSignerSnapshot,
  automaticBySlot: Map<string, unknown[]>
): unknown[] {
  const fields: unknown[] = [];
  for (const placement of snapshot.placements) {
    const signset = automaticBySlot.get(automaticSlotKey(placement.roleKey, placement.slotIndex));
    if (signset?.length) fields.push(...signset);
  }
  return fields;
}
