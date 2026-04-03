/**
 * Empty check for declaration HTML/plain text (product validation).
 * No browser APIs or heavy deps — safe anywhere.
 */
export function isDeclarationHtmlEmpty(html: string): boolean {
  if (typeof html !== "string") return true;
  const plain = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length === 0;
}
