import {
  isAuthorisedSignatoryRole,
  isOperatorSigningRole,
  SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE,
  SHORAKA_SIGNING_PERSON_REQUIRED_MESSAGE,
  shorakaSigningPersonSelectorLabel,
  type DocumentSigningOptions,
  type OperatorSigningRole,
} from "@cashsouk/types";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../lib/http/error-handler";
import {
  freezeStamp,
  loadDocumentAuthorisationConfig,
  type FrozenCompanyStamp,
} from "./config";

export type FrozenShorakaSigningAuthorisation = {
  signingPersonId: string;
  signingPersonName: string;
  signingRoles: OperatorSigningRole[];
  authorisedSignatoryName: string;
  signature: FrozenCompanyStamp;
  companyStamp: FrozenCompanyStamp | null;
  stampSource: "SHARED_CERTIFICATE_STAMP";
};

export function toCertificateAuthorisationSnapshot(
  frozen: FrozenShorakaSigningAuthorisation
): {
  authorisedSignatoryName: string;
  companyStamp: FrozenCompanyStamp | null;
  signingPersonId: string;
  signingPersonName: string;
  signingRoles: OperatorSigningRole[];
  signature: FrozenCompanyStamp;
} {
  return {
    authorisedSignatoryName: frozen.authorisedSignatoryName,
    companyStamp: frozen.companyStamp,
    signingPersonId: frozen.signingPersonId,
    signingPersonName: frozen.signingPersonName,
    signingRoles: frozen.signingRoles,
    signature: frozen.signature,
  };
}

export function toReceiptAuthorisationSnapshot(
  frozen: FrozenShorakaSigningAuthorisation
): {
  stampSource: "SHARED_CERTIFICATE_STAMP";
  companyStamp: FrozenCompanyStamp | null;
  signingPersonId: string;
  signingPersonName: string;
  signingRoles: OperatorSigningRole[];
  signature: FrozenCompanyStamp;
  authorisedSignatoryName: string;
} {
  return {
    stampSource: frozen.stampSource,
    companyStamp: frozen.companyStamp,
    signingPersonId: frozen.signingPersonId,
    signingPersonName: frozen.signingPersonName,
    signingRoles: frozen.signingRoles,
    signature: frozen.signature,
    authorisedSignatoryName: frozen.authorisedSignatoryName,
  };
}

function asSigningRoles(value: unknown): OperatorSigningRole[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isOperatorSigningRole);
}

export async function listShorakaDocumentSigningOptions(): Promise<DocumentSigningOptions> {
  const [people, config] = await Promise.all([
    prisma.operatorSigningPerson.findMany({
      where: { active: true },
      include: { officer: true },
      orderBy: { created_at: "asc" },
    }),
    loadDocumentAuthorisationConfig(),
  ]);
  const eligible = people.filter((row) => isAuthorisedSignatoryRole(asSigningRoles(row.roles)));
  return {
    people: eligible.map((row) => {
      const roles = asSigningRoles(row.roles);
      const personName = row.officer.name?.trim() || "Unnamed";
      return {
        id: row.id,
        personName,
        roles,
        label: shorakaSigningPersonSelectorLabel({ personName, roles }),
        hasSignature: Boolean(row.signature_s3_key?.trim()),
        signatureS3Key: row.signature_s3_key,
      };
    }),
    companyStampS3Key: config.certificateCompanyStamp?.s3Key?.trim() || null,
  };
}

export async function freezeShorakaSigningAuthorisation(
  signingPersonId: string
): Promise<FrozenShorakaSigningAuthorisation> {
  const id = signingPersonId.trim();
  if (!id) {
    throw new AppError(400, "SIGNING_PERSON_REQUIRED", SHORAKA_SIGNING_PERSON_REQUIRED_MESSAGE);
  }
  const person = await prisma.operatorSigningPerson.findUnique({
    where: { id },
    include: { officer: true },
  });
  if (!person || !person.active) {
    throw new AppError(400, "SIGNING_PERSON_REQUIRED", "Select an active Shoraka signing person.");
  }
  const roles = asSigningRoles(person.roles);
  if (!isAuthorisedSignatoryRole(roles)) {
    throw new AppError(
      400,
      "SIGNING_PERSON_ROLE_REQUIRED",
      "Select a signing person configured as Authorised Signatory."
    );
  }
  const personName = person.officer.name?.trim() ?? "";
  if (!personName) {
    throw new AppError(
      409,
      "SIGNING_PERSON_NAME_REQUIRED",
      "This signing person has no name on the Shoraka Profile."
    );
  }
  const signatureKey = person.signature_s3_key?.trim() ?? "";
  if (!signatureKey) {
    throw new AppError(
      409,
      "SIGNING_PERSON_SIGNATURE_REQUIRED",
      SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE
    );
  }
  const config = await loadDocumentAuthorisationConfig();
  const [signature, companyStamp] = await Promise.all([
    freezeStamp({
      s3Key: signatureKey,
      fileName: person.signature_file_name,
      contentType: person.signature_content_type,
    }),
    freezeStamp({
      s3Key: config.certificateCompanyStamp?.s3Key ?? null,
      fileName: config.certificateCompanyStamp?.fileName ?? null,
      contentType: config.certificateCompanyStamp?.contentType ?? null,
    }),
  ]);
  if (!signature) {
    throw new AppError(
      409,
      "SIGNING_PERSON_SIGNATURE_REQUIRED",
      SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE
    );
  }
  return {
    signingPersonId: person.id,
    signingPersonName: personName,
    signingRoles: roles,
    authorisedSignatoryName: personName,
    signature,
    companyStamp,
    stampSource: "SHARED_CERTIFICATE_STAMP",
  };
}
