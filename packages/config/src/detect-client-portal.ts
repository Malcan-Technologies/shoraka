export type ClientPortal = "investor" | "issuer" | "admin";

/** Browser portal for `x-portal`. Landing (`localhost:3000` / www) returns null. */
export function detectClientPortalFromLocation(location: {
  hostname: string;
  port: string;
}): ClientPortal | null {
  const hostname = location.hostname.toLowerCase();
  const port = location.port;
  if (hostname.includes("admin") || port === "3003") return "admin";
  if (hostname.includes("issuer") || port === "3001") return "issuer";
  if (hostname.includes("investor") || port === "3002") return "investor";
  return null;
}

export function detectClientPortal(): ClientPortal | null {
  if (typeof window === "undefined") return null;
  return detectClientPortalFromLocation({
    hostname: window.location.hostname,
    port: window.location.port,
  });
}
