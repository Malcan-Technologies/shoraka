/**
 * Identity handed to the Plain chat widget for a signed-in portal user.
 * Returned by `GET /v1/support/chat-identity`. `emailHash` is HMAC-SHA256(email, PLAIN_CHAT_SECRET)
 * so Plain can trust the email without the browser ever seeing the secret.
 */
export type SupportChatIdentity = {
  email: string;
  emailHash: string;
  fullName: string | null;
  shortName: string | null;
};
