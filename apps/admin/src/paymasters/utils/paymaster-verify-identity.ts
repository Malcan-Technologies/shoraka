import {
  paymasterMasterIdentityFields,
  paymasterSubmittedIdentitiesConflict,
  submittedPaymasterIdentityFields,
  type PaymasterIdentityFields,
  type PaymasterSubmittedApplicationIdentity,
} from "@cashsouk/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

type PaymasterIdentitySource = Parameters<typeof paymasterMasterIdentityFields>[0];

/**
 * Application Review verifies the identity submitted on THAT application.
 * Paymaster Detail verifies the current master only when identities do not conflict.
 */
export function paymasterIdentityToVerify(params: {
  applicationId?: string | null;
  customerDetails?: unknown;
  paymaster?: PaymasterIdentitySource | null;
}): PaymasterIdentityFields {
  const master = params.paymaster ? paymasterMasterIdentityFields(params.paymaster) : null;
  if (!params.applicationId) {
    return (
      master ?? {
        name: "",
        entity_type: "",
        ssm_number: "",
        country: "",
      }
    );
  }
  const submitted = submittedPaymasterIdentityFields(asRecord(params.customerDetails));
  return {
    name: submitted.name || master?.name || "",
    entity_type: submitted.entity_type || master?.entity_type || "",
    ssm_number: submitted.ssm_number || master?.ssm_number || "",
    country: submitted.country || master?.country || "",
  };
}

export function paymasterDetailVerificationBlocked(
  identities: PaymasterSubmittedApplicationIdentity[] | undefined
): boolean {
  return paymasterSubmittedIdentitiesConflict(identities ?? []);
}
