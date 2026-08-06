import { createApiClient } from "./api-client";
import {
  buildCurlecCheckoutContactFromParties,
  resolveCheckoutDisplayName,
  type CheckoutContact,
} from "./curlec-checkout-contact";

type OrganizationPayerLike = {
  members?: Array<{ role?: string | null; email?: string | null }> | null;
  phoneNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

type AuthMeUser = {
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type PortalCheckoutPayer = CheckoutContact & {
  name?: string;
};

/**
 * Resolve Checkout prefill from the active organisation plus `/v1/auth/me`.
 * Always loads the authenticated user so deposit/fee flows share the same email/phone fallbacks.
 */
export async function resolvePortalCheckoutPayer(input: {
  apiUrl: string;
  getAccessToken: () => Promise<string | null>;
  organization?: OrganizationPayerLike | null;
}): Promise<PortalCheckoutPayer> {
  let user: AuthMeUser | null = null;

  try {
    const apiClient = createApiClient(input.apiUrl, input.getAccessToken);
    const me = await apiClient.get<{ user: AuthMeUser }>("/v1/auth/me");
    if (me.success && me.data.user) {
      user = me.data.user;
    }
  } catch {
    user = null;
  }

  const contact = buildCurlecCheckoutContactFromParties({
    organization: input.organization,
    user,
  });

  const name = resolveCheckoutDisplayName({
    organization: input.organization,
    user,
  });

  return {
    ...contact,
    ...(name ? { name } : {}),
  };
}
