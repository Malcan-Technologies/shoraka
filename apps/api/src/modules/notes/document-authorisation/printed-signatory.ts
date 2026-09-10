export function printedSignatoryName(authorisation: {
  signingPersonName?: string | null;
  authorisedSignatoryName?: string | null;
} | null | undefined): string {
  return (
    authorisation?.signingPersonName?.trim() ||
    authorisation?.authorisedSignatoryName?.trim() ||
    ""
  );
}

export function printedSignatoryNameAndDate(
  authorisation: {
    signingPersonName?: string | null;
    authorisedSignatoryName?: string | null;
  } | null | undefined,
  date: string
): string {
  const name = printedSignatoryName(authorisation);
  return name ? `${name} / ${date}` : date;
}
