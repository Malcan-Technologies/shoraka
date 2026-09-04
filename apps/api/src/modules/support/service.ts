import crypto from "crypto";
import type { SupportChatIdentity } from "@cashsouk/types";

export function computePlainEmailHash(email: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(email).digest("hex");
}

export function buildSupportChatIdentity(
  user: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  },
  secret: string
): SupportChatIdentity {
  const email = user.email.trim().toLowerCase();
  const firstName = user.first_name?.trim() || null;
  const lastName = user.last_name?.trim() || null;
  const fullName = [firstName, lastName].filter((name): name is string => Boolean(name)).join(" ");

  return {
    email,
    emailHash: computePlainEmailHash(email, secret),
    fullName: fullName || null,
    shortName: firstName,
  };
}
