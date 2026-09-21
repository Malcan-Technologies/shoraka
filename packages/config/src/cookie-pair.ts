/** Split a `name=value` cookie pair at the first `=` so values may contain `=`. */
export function parseCookiePair(raw: string): { name: string; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const separator = trimmed.indexOf("=");
  if (separator === -1) {
    return { name: trimmed, value: "" };
  }

  return {
    name: trimmed.slice(0, separator).trim(),
    value: trimmed.slice(separator + 1).trim(),
  };
}

/** Parse a `document.cookie` header into a name → value map. Duplicate names keep the last value. */
export function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const pair = parseCookiePair(part);
    if (!pair || !pair.name) {
      continue;
    }
    cookies[pair.name] = pair.value;
  }
  return cookies;
}

export function readCognitoAccessTokenFromCookieMap(
  cookies: Record<string, string>,
  clientId: string
): string | null {
  const userId = cookies[`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`];
  if (!userId) {
    return null;
  }

  return cookies[`CognitoIdentityServiceProvider.${clientId}.${userId}.accessToken`] ?? null;
}
