/**
 * Utility to resolve full URLs for different portals (Investor, Issuer, Admin)
 */
export type PortalType = 'investor' | 'issuer' | 'admin';

export function getPortalBaseUrl(portal: PortalType): string {
  switch (portal) {
    case 'investor':
      return process.env.INVESTOR_URL || 'http://localhost:3002';
    case 'issuer':
      return process.env.ISSUER_URL || 'http://localhost:3001';
    case 'admin':
      return process.env.ADMIN_URL || 'http://localhost:3003';
    default:
      return process.env.FRONTEND_URL || 'http://localhost:3000';
  }
}

export function getFullUrl(path: string, portal: PortalType): string {
  const baseUrl = getPortalBaseUrl(portal);
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Remove trailing slash from baseUrl if present
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return `${normalizedBase}${normalizedPath}`;
}
