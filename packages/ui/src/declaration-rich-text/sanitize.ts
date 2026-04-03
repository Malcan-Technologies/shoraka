import DOMPurify from "dompurify";
import type { Config } from "dompurify";

const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li"],
  ALLOWED_ATTR: [],
};

/** Allowlisted HTML for declaration copy (bold, italic, lists only — no images/links). */
export function sanitizeDeclarationHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
