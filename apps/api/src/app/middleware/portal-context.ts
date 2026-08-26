import { Request, Response, NextFunction } from 'express';
import { PortalContext } from '../../lib/http/portal-context';
import { PortalType } from '../../lib/http/url-utils';
import { parseKnownPortal } from '../../lib/role-detector';

/**
 * Middleware to detect the source portal from request headers and set the context.
 */
export function portalContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  const fromHeader = parseKnownPortal(req.headers['x-portal']);

  let portal: PortalType | undefined = fromHeader ?? undefined;

  if (!portal) {
    const urlString = (typeof origin === "string" ? origin : "") || (typeof referer === "string" ? referer : "");

    // Landing (localhost:3000 / www) is not a portal; leave context unset.
    if (urlString.includes('localhost:3002') || urlString.includes('investor.')) {
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
