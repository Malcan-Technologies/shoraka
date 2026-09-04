/**
 * Content-Security-Policy origins required by the Plain chat widget
 * (https://plain.support.site/article/live-chat-overview#content-security-policy-csp).
 * Shared by every portal that mounts `PlainChatWidget` so the allow-list lives in one place.
 * `img-src` and `font-src` are not listed because portal CSPs already allow `https:` for both.
 */
exports.PLAIN_CSP = {
  scripts: "https://chat.cdn-plain.com",
  connect:
    "https://chat.uk.plain.com https://prod-uk-services-attachm-attachmentsuploadbucket2-1l2e4906o2asm.s3.eu-west-2.amazonaws.com",
  styles: "https://fonts.googleapis.com",
};
