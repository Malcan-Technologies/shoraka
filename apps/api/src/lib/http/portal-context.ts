import { AsyncLocalStorage } from 'async_hooks';
import { PortalType } from './url-utils';

/**
 * Storage for the current portal context, scoped to the lifecycle of an async operation
 * (usually an Express request).
 */
const portalStorage = new AsyncLocalStorage<PortalType>();

export const PortalContext = {
  /**
   * Run a function within the context of a specific portal.
   */
  run: <T>(portal: PortalType, fn: () => T): T => {
    return portalStorage.run(portal, fn);
  },

  /**
   * Get the current portal from the context.
   */
  get: (): PortalType | undefined => {
    return portalStorage.getStore();
  },
};
