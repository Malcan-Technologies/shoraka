/**
 * SECTION: Shared prospectus HTML helpers
 * WHY: One escape path for Stage 8 layout modules (header / CTA / footer)
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}
