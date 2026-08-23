/**
 * /auth-error is for genuine authentication failures only.
 * Admin authorization rejections (not an active Admin) must not stay on this page.
 */
export function resolveAuthErrorPageAction(
  error: string | null
): "show-error" | "go-home" {
  if (error === "admin_access_denied") {
    return "go-home";
  }

  return "show-error";
}
