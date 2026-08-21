/**
 * Closed type scale. Prefer these over arbitrary `text-[Npx]`.
 *
 * | Token | Size | Use |
 * | body  | 16px | page copy, empty states, default |
 * | ui    | 14px | labels, buttons, tables, descriptions, inputs, status badges |
 * | meta  | 12px | captions, compact chips, timestamps, hints |
 *
 * Title roles: `text-page-title`, `text-section-title`, `text-card-title`, `text-dialog-title`.
 * `text-base` / `text-sm` / `text-xs` alias the same CSS variables.
 */
export const typeScale = {
  pageTitle: "text-page-title",
  sectionTitle: "text-section-title",
  cardTitle: "text-card-title",
  dialogTitle: "text-dialog-title",
  body: "text-body",
  ui: "text-ui",
  meta: "text-meta",
} as const;
