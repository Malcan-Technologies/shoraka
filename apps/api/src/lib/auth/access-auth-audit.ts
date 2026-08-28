/**
 * Access LOGIN/SIGNUP classification. Portal attribution lives in OAuth state / the request;
 * this helper only decides which event to write.
 */
export function classifyAccessAuthEvent(input: {
  isNewCashSoukUser: boolean;
  hasSuccessfulSignup: boolean;
}): "SIGNUP" | "LOGIN" {
  if (input.isNewCashSoukUser && !input.hasSuccessfulSignup) {
    return "SIGNUP";
  }
  return "LOGIN";
}
