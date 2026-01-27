import { Request, Response, NextFunction } from 'express';
import { PortalContext } from '../../lib/http/portal-context';
import { PortalType } from '../../lib/http/url-utils';

/**
 * Middleware to detect the source portal from request headers and set the context.
 */
export function portalContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Custom header can be used for non-browser requests or explicit overrides
  const explicitPortal = req.headers['x-portal'] as string;

  let portal: PortalType | undefined;

  if (explicitPortal === 'investor' || explicitPortal === 'issuer' || explicitPortal === 'admin') {
    portal = explicitPortal as PortalType;
  } else {
    // Detect from origin/referer URLs
    const urlString = origin || referer || '';

    if (urlString.includes('localhost:3002') || urlString.includes('localhost:3000') || urlString.includes('investor.')) {
      portal = 'investor';
    } else if (urlString.includes('localhost:3001') || urlString.includes('issuer.')) {
      portal = 'issuer';
    } else if (urlString.includes('localhost:3003') || urlString.includes('admin.')) {
      portal = 'admin';
    }
  }

  // If detected, run the rest of the request within the portal context
  if (portal) {
    PortalContext.run(portal, () => next());
  } else {
    next();
  }
}
