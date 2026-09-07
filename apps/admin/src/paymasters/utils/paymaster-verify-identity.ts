import { paymasterMasterIdentityFields, type PaymasterIdentityFields } from "@cashsouk/types";

type PaymasterIdentitySource = Parameters<typeof paymasterMasterIdentityFields>[0];

/**
 * Admin confirm/edit always starts from the current official master, not application submitted values.
 */
export function paymasterIdentityToVerify(params: {
  applicationId?: string | null;
  customerDetails?: unknown;
  paymaster?: PaymasterIdentitySource | null;
}): PaymasterIdentityFields {
  const master = params.paymaster ? paymasterMasterIdentityFields(params.paymaster) : null;
  return (
    master ?? {
      name: "",
      entity_type: "",
      ssm_number: "",
      country: "",
    }
  );
}
