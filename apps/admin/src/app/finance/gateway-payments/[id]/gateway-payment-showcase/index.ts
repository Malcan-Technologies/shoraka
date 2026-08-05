/**
 * TEMPORARY GATEWAY PAYMENT SHOWCASE
 * Remove after UI review — see REMOVAL.md in this folder.
 */

export {
  ALL_SHOWCASE_EVENT_TYPES,
  PREVIEW_ONLY_TOAST,
  SHOWCASE_QUERY_PARAM,
  SHOWCASE_SCENARIOS,
  buildAllActivityEvents,
  getShowcaseScenario,
  isGatewayPaymentShowcaseEnabled,
} from "./scenarios";
export type {
  ShowcasePermissionMode,
  ShowcaseScenario,
  ShowcaseScenarioId,
} from "./scenarios";
export { GatewayPaymentShowcaseControls } from "./ShowcaseControls";
