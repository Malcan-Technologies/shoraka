export function actionsRequiredLabel(count: number): string {
  return `${count} action${count === 1 ? "" : "s"} required`;
}

export function joinBannerSentences(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}
