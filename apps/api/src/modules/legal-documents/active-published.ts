/**
 * Active published legal-document resolver.
 *
 * ARCHIVED MEANS INACTIVE. Only an explicitly PUBLISHED version counts.
 * There is no automatic fallback to an older, archived, or newest historical version.
 * If none is published, these helpers return null / empty.
 */
import type { LegalDocumentAudienceValue, LegalDocumentTypeValue } from "./schemas";
import { legalDocumentRepository, type VersionWithDocument } from "./repository";

export async function resolveActivePublishedByDocumentId(
  legalDocumentId: string
): Promise<VersionWithDocument | null> {
  return legalDocumentRepository.findPublishedByDocumentId(legalDocumentId);
}

export async function resolveActivePublishedByTypeAndAudiences(
  type: LegalDocumentTypeValue,
  audiences: LegalDocumentAudienceValue[]
): Promise<VersionWithDocument | null> {
  return legalDocumentRepository.findPublishedByTypeAndAudiences(type, audiences);
}

export async function resolveActivePublishedReacceptanceByTypeAndAudiences(
  type: LegalDocumentTypeValue,
  audiences: LegalDocumentAudienceValue[]
): Promise<VersionWithDocument | null> {
  return legalDocumentRepository.findPublishedReacceptanceByTypeAndAudiences(
    type,
    audiences
  );
}

export async function resolveActivePublicPublishedVersions(): Promise<
  VersionWithDocument[]
> {
  return legalDocumentRepository.findPublicPublishedVersions();
}

export async function resolveActivePublicPublishedByType(
  type: LegalDocumentTypeValue
): Promise<VersionWithDocument | null> {
  return legalDocumentRepository.findPublicPublishedByType(type);
}
