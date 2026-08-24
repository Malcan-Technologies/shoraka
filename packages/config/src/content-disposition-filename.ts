const FILENAME_STAR = /filename\*\s*=\s*(?:UTF-8''|utf-8'')([^;]+)/i;
const FILENAME_QUOTED = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i;
const FILENAME_BARE = /filename\s*=\s*([^;]+)/i;

function decodeFilenameStar(value: string): string {
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
}

/** Parses a Content-Disposition attachment filename, or null if none is present. */
export function parseContentDispositionFilename(header: string | null | undefined): string | null {
  if (!header) return null;
  const star = header.match(FILENAME_STAR);
  if (star?.[1]) {
    const decoded = decodeFilenameStar(star[1]);
    return decoded || null;
  }
  const quoted = header.match(FILENAME_QUOTED);
  if (quoted?.[1]) {
    const unescaped = quoted[1].replace(/\\(.)/g, "$1").trim();
    return unescaped || null;
  }
  const bare = header.match(FILENAME_BARE);
  if (bare?.[1]) {
    const trimmed = bare[1].trim().replace(/^["']|["']$/g, "");
    return trimmed || null;
  }
  return null;
}
