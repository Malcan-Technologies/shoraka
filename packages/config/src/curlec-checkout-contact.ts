export type CheckoutContactInput = {
  explicitEmail?: string | null;
  memberEmail?: string | null;
  userEmail?: string | null;
  organisationEmail?: string | null;

  explicitPhone?: string | null;
  memberPhone?: string | null;
  userPhone?: string | null;
  organisationPhone?: string | null;
};

export type CheckoutContact = {
  email?: string;
  contact?: string;
};

/** Known fake / sentinel values that must never be sent to Curlec Checkout. */
const PLACEHOLDER_PHONES = new Set([
  "+60000000000",
  "60000000000",
  "00000000000",
  "+00000000000",
]);

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeCandidate(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isValidCheckoutEmail(value: string | null | undefined): value is string {
  const email = normalizeCandidate(value);
  if (!email) return false;
  if (!BASIC_EMAIL_RE.test(email)) return false;
  // Invitation placeholder addresses used elsewhere in the platform.
  if (email.startsWith("invitation-") && email.endsWith("@cashsouk.com")) return false;
  return true;
}

export function normalizeCheckoutPhone(value: string | null | undefined): string | undefined {
  const phone = normalizeCandidate(value);
  if (!phone) return undefined;

  // Collapse accidental internal whitespace without inventing a new number.
  const compacted = phone.replace(/\s+/g, "");
  if (!compacted) return undefined;
  if (PLACEHOLDER_PHONES.has(compacted)) return undefined;

  return compacted;
}

function firstValidEmail(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    if (isValidCheckoutEmail(candidate)) {
      return candidate.trim();
    }
  }
  return undefined;
}

function firstValidPhone(
  ...candidates: Array<string | null | undefined>
): string | undefined {
  for (const candidate of candidates) {
    const phone = normalizeCheckoutPhone(candidate);
    if (phone) return phone;
  }
  return undefined;
}

/**
 * Pick the first real email/phone for Curlec Checkout prefill.
 * Returns only keys that should be sent (never undefined placeholders).
 */
export function resolveCurlecCheckoutContact(input: CheckoutContactInput): CheckoutContact {
  const email = firstValidEmail(
    input.explicitEmail,
    input.memberEmail,
    input.userEmail,
    input.organisationEmail
  );
  const contact = firstValidPhone(
    input.explicitPhone,
    input.memberPhone,
    input.userPhone,
    input.organisationPhone
  );

  const result: CheckoutContact = {};
  if (email) result.email = email;
  if (contact) result.contact = contact;
  return result;
}

type OrgMemberLike = {
  role?: string | null;
  email?: string | null;
};

type OrganizationContactLike = {
  members?: OrgMemberLike[] | null;
  phoneNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

type AuthUserContactLike = {
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/** Prefer ORGANIZATION_ADMIN member email, else first member with a valid email. */
export function selectOrganizationMemberEmail(
  members?: OrgMemberLike[] | null
): string | undefined {
  if (!members?.length) return undefined;

  const admin =
    members.find((entry) => entry.role === "ORGANIZATION_ADMIN" && isValidCheckoutEmail(entry.email)) ??
    members.find((entry) => isValidCheckoutEmail(entry.email));

  return admin?.email ? admin.email.trim() : undefined;
}

export function resolveCheckoutDisplayName(input: {
  organization?: OrganizationContactLike | null;
  user?: AuthUserContactLike | null;
}): string | undefined {
  const org = input.organization;
  if (org?.firstName?.trim() && org?.lastName?.trim()) {
    return `${org.firstName.trim()} ${org.lastName.trim()}`;
  }
  if (org?.name?.trim()) {
    return org.name.trim();
  }

  const user = input.user;
  const first = user?.first_name?.trim() || user?.firstName?.trim();
  const last = user?.last_name?.trim() || user?.lastName?.trim();
  const full = [first, last].filter(Boolean).join(" ");
  return full || undefined;
}

/**
 * Map org + authenticated user fields onto the shared resolution order.
 * Organisation email is unsupported in the current schema (no org email column).
 */
export function buildCurlecCheckoutContactFromParties(input: {
  organization?: OrganizationContactLike | null;
  user?: AuthUserContactLike | null;
  explicitEmail?: string | null;
  explicitPhone?: string | null;
}): CheckoutContact {
  return resolveCurlecCheckoutContact({
    explicitEmail: input.explicitEmail,
    memberEmail: selectOrganizationMemberEmail(input.organization?.members),
    userEmail: input.user?.email,
    organisationEmail: undefined,
    explicitPhone: input.explicitPhone,
    memberPhone: undefined,
    userPhone: input.user?.phone,
    organisationPhone: input.organization?.phoneNumber,
  });
}
