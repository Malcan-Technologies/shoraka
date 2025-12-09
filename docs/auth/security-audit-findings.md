# Authentication Security Audit - Findings & Recommendations

**Date:** December 9, 2025  
**System:** AWS Cognito + Amplify Authentication  
**Scope:** Full authentication flow including OAuth, token management, and session handling

---

## Executive Summary

A comprehensive security audit was performed on the CashSouk authentication system. The analysis covered:

- Backend OAuth implementation (Express + Cognito)
- Frontend authentication (Next.js + Amplify)
- Token management and refresh flows
- Session handling and cookie management
- Role-based access control (RBAC)

**Total Issues Found:** 14

- **Critical:** 4 issues requiring immediate attention
- **High Priority:** 3 issues affecting security/functionality (1 resolved ✅)
- **Medium Priority:** 3 issues affecting reliability/performance
- **Low Priority/Improvements:** 4 enhancement opportunities

**Resolved Issues:** 1

---

## 🚨 CRITICAL ISSUES (Fix Immediately)

### 1. Admin Logout Creates Infinite Redirect Loop

**Severity:** Critical  
**Location:** `apps/api/src/modules/auth/cognito.routes.ts:490`  
**Impact:** User account lockout, poor UX

#### Problem

When a non-admin user attempts to access the admin portal, they are immediately logged out:

```typescript
// Line 448-490
if (requestedRole === UserRole.ADMIN && !user.roles.includes(UserRole.ADMIN)) {
  // ... log failed attempt ...
  const logoutUrl = new URL(`${apiBaseUrl}/v1/auth/cognito/logout`);
  return res.redirect(logoutUrl.toString());
}
```

**Bug:** After logout, Cognito redirects to landing page. If cookies aren't fully cleared or if the user has a valid Cognito session, they may be auto-authenticated again, creating an infinite loop.

#### Impact

- Users get stuck in redirect loop
- Poor user experience
- Potential account lockout scenarios

#### Recommended Fix

**Option A:** Redirect to dedicated error page instead of logout:

```typescript
if (requestedRole === UserRole.ADMIN && !user.roles.includes(UserRole.ADMIN)) {
  // ... log failed attempt ...
  const errorUrl = new URL(`${env.FRONTEND_URL}/auth-error`);
  errorUrl.searchParams.set("error", "access_denied");
  errorUrl.searchParams.set("message", "You do not have permission to access the admin portal.");
  return res.redirect(errorUrl.toString());
}
```

**Option B:** Force global sign out before redirect:

```typescript
if (requestedRole === UserRole.ADMIN && !user.roles.includes(UserRole.ADMIN)) {
  // ... log failed attempt ...

  // Sign out from Cognito globally
  await cognitoClient.send(
    new AdminUserGlobalSignOutCommand({
      UserPoolId: config.userPoolId,
      Username: cognitoSub,
    })
  );

  // Redirect to landing with error message
  const errorUrl = new URL(env.FRONTEND_URL);
  errorUrl.searchParams.set("error", "access_denied");
  return res.redirect(errorUrl.toString());
}
```

---

### 2. Weak OAuth State Encryption Key

**Severity:** Critical  
**Location:** `apps/api/src/lib/auth/oauth-state.ts:45`  
**Impact:** OAuth state tampering, CSRF attacks possible

#### Problem

The encryption key for OAuth state is derived by padding `SESSION_SECRET`:

```typescript
const key = Buffer.from(env.SESSION_SECRET.padEnd(32, "0").substring(0, 32));
```

**Bug:** If `SESSION_SECRET` is shorter than 32 characters, it's padded with predictable `"0"` characters:

- Secret: `"mysecret"` (8 chars)
- Becomes: `"mysecret000000000000000000000000"` (32 chars)

This significantly weakens the encryption, making OAuth state tampering possible.

#### Impact

- Weak encryption enables state parameter tampering
- CSRF attack protection can be bypassed
- Replay attacks become easier
- Security of entire OAuth flow is compromised

#### Recommended Fix

**Option A:** Enforce minimum length in env validation:

```typescript
// apps/api/src/config/env.ts
const envSchema = z.object({
  // ...
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  // ...
});
```

**Option B:** Use proper key derivation (recommended):

```typescript
import { pbkdf2Sync } from "crypto";

function deriveEncryptionKey(secret: string): Buffer {
  // Use PBKDF2 to derive a proper 32-byte key
  return pbkdf2Sync(
    secret,
    "oauth-state-encryption", // salt
    100000, // iterations
    32, // key length
    "sha256"
  );
}

export function encryptOAuthState(data: OAuthState): string {
  const env = getEnv();
  const key = deriveEncryptionKey(env.SESSION_SECRET);
  // ... rest of encryption ...
}
```

---

### 3. In-Memory Replay Protection Won't Scale

**Severity:** Critical  
**Location:** `apps/api/src/lib/auth/oauth-state.ts:22`  
**Impact:** Replay attacks possible in production

#### Problem

The replay attack prevention uses in-memory storage:

```typescript
const usedStateIds = new Set<string>();

// Clean up expired state IDs every 5 minutes
setInterval(
  () => {
    usedStateIds.clear();
  },
  5 * 60 * 1000
);
```

**Bug:** In multi-container deployment (ECS Fargate with >1 task):

1. User authenticates → callback hits Container A → stateId stored in Container A's memory
2. Attacker replays the callback → hits Container B → stateId not found in Container B's memory → **replay succeeds**

#### Impact

- Replay attacks possible in production
- OAuth security model breaks down at scale
- Session hijacking becomes easier

#### Recommended Fix

Use distributed storage (Redis recommended):

```typescript
import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.connect();

export async function decryptOAuthState(encryptedState: string): Promise<OAuthState> {
  // ... decryption code ...

  const data = JSON.parse(decrypted) as OAuthState;

  // Check if state is expired
  const now = Date.now();
  if (now - data.timestamp > STATE_TTL_MS) {
    throw new Error("OAuth state expired");
  }

  // Check if state was already used (distributed check)
  const stateKey = `oauth:state:${data.stateId}`;
  const wasUsed = await redisClient.get(stateKey);

  if (wasUsed) {
    throw new Error("OAuth state already used (possible replay attack)");
  }

  // Mark state as used with TTL
  await redisClient.setEx(stateKey, STATE_TTL_MS / 1000, "used");

  return data;
}
```

**Alternative:** Use DynamoDB with TTL if Redis isn't available.

---

### 4. Email Change Account Lockout Risk

**Severity:** Critical  
**Location:** `apps/api/src/modules/auth/service.ts:808-819`  
**Impact:** User account lockout

#### Problem

The email change flow updates the database **before** verification:

```typescript
// Step 2: Update email attribute in Cognito (triggers verification email)
const updateCommand = new UpdateUserAttributesCommand({
  AccessToken: cognitoAccessToken,
  UserAttributes: [{ Name: "email", Value: data.newEmail.toLowerCase() }],
});
await cognitoClient.send(updateCommand);

// Update database email IMMEDIATELY (before verification!)
await prisma.user.update({
  where: { id: userId },
  data: {
    email: data.newEmail.toLowerCase(),
    email_verified: false,
  },
});
```

**Bug:** If user abandons the flow (never enters verification code):

- Old email: No longer in database
- New email: In database but unverified
- Result: **User cannot log in with either email**

#### Impact

- Permanent account lockout
- Loss of customer access
- Poor user experience
- Support burden

#### Recommended Fix

**Option A:** Use pending email field:

```typescript
// Step 1: Store pending email without changing active email
await prisma.user.update({
  where: { id: userId },
  data: {
    pending_email: data.newEmail.toLowerCase(),
    email_change_requested_at: new Date(),
  },
});

// Step 2: Only update email after verification
async verifyEmailChange(req, userId, data) {
  // ... verify code ...

  await prisma.user.update({
    where: { id: userId },
    data: {
      email: data.newEmail.toLowerCase(),
      email_verified: true,
      pending_email: null,
      email_change_requested_at: null,
    },
  });
}
```

**Option B:** Store both old and new email temporarily:

```typescript
// Step 1: Keep old email, store new one as pending
await prisma.user.update({
  where: { id: userId },
  data: {
    old_email: user.email, // Backup
    pending_email: data.newEmail.toLowerCase(),
  },
});

// Step 2: On verification, swap emails
// Step 3: On timeout/cancellation, restore old email
```

Add schema migration:

```sql
ALTER TABLE "User" ADD COLUMN "pending_email" TEXT;
ALTER TABLE "User" ADD COLUMN "email_change_requested_at" TIMESTAMP;
```

---

## ⚠️ HIGH PRIORITY ISSUES

### 5. Admin Logout Missing Access Token

**Severity:** High  
**Location:** `apps/admin/src/lib/auth.ts:91-127`  
**Impact:** Incomplete access logging, unreliable portal detection

#### Problem

Admin logout doesn't pass the access token to backend:

```typescript
// Admin logout (line 123)
await fetch(`${API_URL}/v1/auth/cognito/logout?portal=admin`, {
  method: "GET",
  credentials: "include",
});
```

Compare to investor/issuer logout (lines 44-74):

```typescript
// Get access token BEFORE logout
let accessToken: string | null = null;
try {
  accessToken = await getAccessToken();
} catch (error) {
  console.error("[Logout] Failed to get access token:", error);
}

// Include token in request
const headers: HeadersInit = { "Content-Type": "application/json" };
if (accessToken) {
  headers["Authorization"] = `Bearer ${accessToken}`;
}

await fetch(`${API_URL}/v1/auth/cognito/logout?portal=issuer`, {
  method: "GET",
  credentials: "include",
  headers,
});
```

#### Impact

- Access logs may not be created for admin logouts
- Portal detection relies on unreliable referer header
- Inconsistent logout behavior across portals

#### Recommended Fix

```typescript
// apps/admin/src/lib/auth.ts
export async function logout(
  signOut: () => Promise<void>,
  getAccessToken: () => Promise<string | null>
) {
  if (typeof window === "undefined") return;

  // 1. Get access token before logout (for backend access log)
  let accessToken: string | null = null;
  try {
    accessToken = await getAccessToken();
    console.log("[Logout] Got access token:", accessToken ? "present" : "missing");
  } catch (error) {
    console.error("[Logout] Failed to get access token:", error);
  }

  // 2. Sign out from Amplify
  try {
    await signOut();
    console.log("[Logout] Amplify signOut successful");
  } catch (error) {
    console.error("[Logout] Amplify signOut failed:", error);
  }

  // 3. Clear Cognito cookies
  const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (clientId) {
    const cookies = document.cookie.split(";");
    cookies.forEach((cookie) => {
      const cookieName = cookie.split("=")[0].trim();
      if (cookieName.startsWith("CognitoIdentityServiceProvider")) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  }

  // 4. Call backend logout WITH access token
  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    await fetch(`${API_URL}/v1/auth/cognito/logout?portal=admin`, {
      method: "GET",
      credentials: "include",
      headers,
    });
    console.log("[Logout] Backend logout successful");
  } catch (error) {
    console.error("[Logout] Backend logout failed:", error);
  }

  // 5. Redirect through Cognito logout
  let cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  if (cognitoDomain && cognitoClientId) {
    if (!cognitoDomain.startsWith("http://") && !cognitoDomain.startsWith("https://")) {
      cognitoDomain = `https://${cognitoDomain}`;
    }

    const cognitoLogoutUrl = `${cognitoDomain}/logout?client_id=${cognitoClientId}&logout_uri=${encodeURIComponent(LANDING_URL)}`;
    window.location.href = cognitoLogoutUrl;
  } else {
    redirectToLanding();
  }
}
```

---

### 6. Token Fetch Race Condition

**Severity:** High  
**Location:** `apps/investor/src/lib/auth.ts:143-151`, `apps/issuer/src/lib/auth.ts:143-151`  
**Impact:** Multiple token refresh attempts, unpredictable auth state

#### Problem

The retry logic for token fetching can cause race conditions:

```typescript
let token: string | null = null;
let retries = 0;
const maxRetries = 3;

while (!token && retries < maxRetries) {
  token = await getAccessToken();
  if (!token) {
    console.log(`[useAuth] No token on attempt ${retries + 1}/${maxRetries}, waiting...`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    retries++;
  }
}
```

**Bug:** If multiple components/hooks call `useAuth()` simultaneously:

1. All start retrying in parallel
2. Multiple `getAccessToken()` calls → multiple `fetchAuthSession()` calls
3. Amplify may trigger multiple token refreshes
4. Race conditions in token state

#### Impact

- Token refresh failures
- Inconsistent auth state
- Poor performance (unnecessary API calls)
- Potential 401 errors during navigation

#### Recommended Fix

Create a singleton token manager:

```typescript
// packages/config/src/token-manager.ts
class TokenManager {
  private pendingRefresh: Promise<string | null> | null = null;
  private getAccessToken: (() => Promise<string | null>) | null = null;

  setTokenGetter(getter: () => Promise<string | null>) {
    this.getAccessToken = getter;
  }

  async getToken(): Promise<string | null> {
    if (!this.getAccessToken) {
      throw new Error("Token getter not initialized");
    }

    // If refresh is already in progress, wait for it
    if (this.pendingRefresh) {
      return this.pendingRefresh;
    }

    // Start new refresh
    this.pendingRefresh = this.fetchWithRetry();

    try {
      const token = await this.pendingRefresh;
      return token;
    } finally {
      this.pendingRefresh = null;
    }
  }

  private async fetchWithRetry(): Promise<string | null> {
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      const token = await this.getAccessToken!();
      if (token) {
        return token;
      }

      if (retries < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      retries++;
    }

    return null;
  }
}

export const tokenManager = new TokenManager();
```

Use it in `useAuth`:

```typescript
export function useAuth() {
  const { getAccessToken, signOut } = useAuthToken();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    tokenManager.setTokenGetter(getAccessToken);

    const checkAuth = async () => {
      const token = await tokenManager.getToken(); // Uses singleton

      if (!token) {
        setIsAuthenticated(false);
        redirectToLanding();
        return;
      }

      // ... rest of auth check ...
    };

    checkAuth();
  }, [getAccessToken, signOut]);

  return { isAuthenticated, token: null };
}
```

---

### 7. Password Change Doesn't Invalidate Sessions ✅ RESOLVED

**Severity:** High  
**Status:** ✅ **RESOLVED** (December 9, 2025)  
**Location:** `apps/api/src/modules/auth/service.ts:666`  
**Impact:** Compromised sessions remain active

#### Problem

After successful password change, existing access tokens remain valid:

```typescript
const changePasswordCommand = new ChangePasswordCommand({
  AccessToken: cognitoAccessToken,
  PreviousPassword: data.currentPassword,
  ProposedPassword: data.newPassword,
});

await cognitoClient.send(changePasswordCommand);

// Update password changed timestamp
await this.repository.updatePasswordChangedAt(userId);

// Create access log
await this.repository.createAccessLog({
  /* ... */
});

// NO SESSION INVALIDATION!
return { success: true };
```

**Bug:** All existing access tokens remain valid until natural expiry (1 hour). If attacker has stolen token, password change doesn't revoke it.

#### Impact

- Stolen sessions remain active for up to 1 hour
- Compromised accounts stay accessible
- False sense of security after password change

#### Recommended Fix

```typescript
async changePassword(req, userId, data) {
  // ... existing password change code ...

  await cognitoClient.send(changePasswordCommand);

  // Update password changed timestamp
  await this.repository.updatePasswordChangedAt(userId);

  // CRITICAL: Revoke all existing sessions
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    try {
      await cognitoClient.send(new AdminUserGlobalSignOutCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: user.cognito_sub,
      }));

      logger.info(
        { userId, cognitoSub: user.cognito_sub },
        "All user sessions revoked after password change"
      );
    } catch (error) {
      logger.error(
        { userId, error },
        "Failed to revoke sessions after password change"
      );
      // Don't fail the password change, but log the error
    }
  }

  // Log successful password change
  await this.repository.createAccessLog({ /* ... */ });

  return {
    success: true,
    sessionRevoked: true, // Inform frontend to re-authenticate
  };
}
```

Frontend should handle re-authentication:

```typescript
const result = await apiClient.changePassword(data);

if (result.success && result.data?.sessionRevoked) {
  // User will be signed out globally, redirect to login
  toast.success("Password changed successfully. Please sign in again.");
  await signOut();
  redirectToLogin();
}
```

#### Resolution (December 9, 2025)

**Implementation completed across all portals:**

1. **Backend Changes** (`apps/api/src/modules/auth/service.ts`):
   - Added `AdminUserGlobalSignOutCommand` import
   - Implemented global session revocation after successful password change
   - Updated return type to include `sessionRevoked` flag
   - Added comprehensive error handling and logging
   - Updated access logs to track session revocation status

2. **API Client** (`packages/config/src/api-client.ts`):
   - Updated `changePassword` return type to include optional `sessionRevoked` flag

3. **Frontend Components** (all portals):
   - Updated `change-password-dialog.tsx` in admin, investor, and issuer portals
   - Added session revocation detection logic
   - Implemented automatic logout flow when sessions are revoked
   - Added user-friendly toast notification explaining the security logout
   - 2-second delay before logout to allow user to read the message

**Security Impact:**

- All existing sessions are now immediately invalidated upon password change
- Users are automatically logged out from all devices after changing password
- Compromised tokens cannot be reused after password change
- Consistent with AWS Cognito security best practices

**Testing Verified:**

- Password change triggers `AdminUserGlobalSignOutCommand`
- Access logs record `sessionRevoked: true` in metadata
- Users are redirected through complete logout flow to landing page
- All Cognito cookies and tokens are properly cleared

---

## ⚙️ MEDIUM PRIORITY ISSUES

### 8. Hardcoded Cookie Domains

**Severity:** Medium  
**Location:** Multiple files  
**Impact:** Deployment flexibility, environment configuration

#### Problem

Cookie domains are hardcoded instead of using environment variables:

```typescript
// apps/api/src/modules/auth/cognito.routes.ts:549
const cookieDomain = process.env.NODE_ENV === "production" ? ".cashsouk.com" : "localhost";

// apps/investor/src/lib/amplify-config.ts:43
domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost",
```

**Bug:** The `COOKIE_DOMAIN` env var exists in `apps/api/src/config/env.ts` but isn't consistently used.

#### Impact

- Hard to deploy to different domains
- Staging environments require code changes
- Environment-specific configurations not flexible

#### Recommended Fix

```typescript
// apps/api/src/modules/auth/cognito.routes.ts
const env = getEnv();
const cookieDomain =
  env.COOKIE_DOMAIN || (process.env.NODE_ENV === "production" ? ".cashsouk.com" : "localhost");
```

Ensure all amplify configs use it:

```typescript
// apps/*/src/lib/amplify-config.ts
storage: new CookieStorage({
  domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost",
  // ...
}),
```

---

### 9. AuthProvider Infinite Re-render Risk

**Severity:** Medium  
**Location:** `packages/config/src/auth-context.tsx:55-57`  
**Impact:** Performance, unnecessary API calls

#### Problem

The `useEffect` calls `getAccessToken` on mount, but `getAccessToken` is a `useCallback` without stable dependencies:

```typescript
const getAccessToken = useCallback(async (): Promise<string | null> => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString() || null;

    if (token) {
      setAccessTokenState(token);
      setIsAuthenticated(true);
      return token;
    } else {
      setAccessTokenState(null);
      setIsAuthenticated(false);
      return null;
    }
  } catch (error) {
    console.error("[AuthProvider] Failed to fetch auth session:", error);
    setAccessTokenState(null);
    setIsAuthenticated(false);
    return null;
  }
}, []); // Empty deps, but uses setAccessTokenState and setIsAuthenticated

useEffect(() => {
  getAccessToken();
}, [getAccessToken]); // Re-runs if getAccessToken changes
```

**Bug:** While the empty deps array prevents most re-renders, this pattern is fragile.

#### Impact

- Potential unnecessary re-renders
- Extra API calls if parent re-renders
- ESLint warnings about missing dependencies

#### Recommended Fix

```typescript
export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const initRef = useRef(false);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString() || null;

      if (token) {
        setAccessTokenState(token);
        setIsAuthenticated(true);
        return token;
      } else {
        setAccessTokenState(null);
        setIsAuthenticated(false);
        return null;
      }
    } catch (error) {
      console.error("[AuthProvider] Failed to fetch auth session:", error);
      setAccessTokenState(null);
      setIsAuthenticated(false);
      return null;
    }
  }, []); // Kept empty intentionally

  // Initialize once on mount
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      getAccessToken();
    }
  }, []); // Only run once

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    setIsAuthenticated(!!token);
  }, []);

  const clearAccessToken = useCallback(() => {
    setAccessTokenState(null);
    setIsAuthenticated(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await amplifySignOut({ global: true });
      clearAccessToken();
    } catch (error) {
      console.error("[AuthProvider] Failed to sign out:", error);
      clearAccessToken();
    }
  }, [clearAccessToken]);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        setAccessToken,
        clearAccessToken,
        getAccessToken,
        isAuthenticated,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

---

### 10. Redundant API Calls in AuthGuard

**Severity:** Medium  
**Location:** `apps/investor/src/components/auth-guard.tsx:36`  
**Impact:** Performance, unnecessary backend load

#### Problem

The `useAuth()` hook calls `/v1/auth/me`, then `AuthGuard` calls it **again**:

```typescript
// In useAuth() - apps/investor/src/lib/auth.ts:164
const isValid = await verifyToken(getAccessToken);

// verifyToken calls:
const result = await apiClient.get("/v1/auth/me");

// Then in AuthGuard - apps/investor/src/components/auth-guard.tsx:36
const result = await apiClient.get<{
  user: { roles: string[]; investor_onboarding_completed: boolean };
}>("/v1/auth/me");
```

**Bug:** Every protected page load makes **two identical API calls** to `/v1/auth/me`.

#### Impact

- 2x backend load
- Slower page loads
- Wasted bandwidth

#### Recommended Fix

Have `useAuth` return user data:

```typescript
// apps/investor/src/lib/auth.ts
export function useAuth() {
  const { getAccessToken, signOut } = useAuthToken();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<{
    roles: string[];
    investor_onboarding_completed: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/callback") {
      return;
    }

    const checkAuth = async () => {
      try {
        let token: string | null = null;
        let retries = 0;
        const maxRetries = 3;

        while (!token && retries < maxRetries) {
          token = await getAccessToken();
          if (!token) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            retries++;
          }
        }

        if (!token) {
          setIsAuthenticated(false);
          redirectToLanding();
          return;
        }

        // Fetch user info (single call)
        const { createApiClient } = await import("@cashsouk/config");
        const apiClient = createApiClient(API_URL, getAccessToken);
        const result = await apiClient.get<{
          user: {
            roles: string[];
            investor_onboarding_completed: boolean;
          };
        }>("/v1/auth/me");

        if (result.success && result.data?.user) {
          setIsAuthenticated(true);
          setUser(result.data.user);
        } else {
          setIsAuthenticated(false);
          await signOut();
          redirectToLanding();
        }
      } catch (error) {
        console.error("[useAuth] Auth check failed:", error);
        setIsAuthenticated(false);
        redirectToLanding();
      }
    };

    checkAuth();
  }, [getAccessToken, signOut]);

  return { isAuthenticated, user, token: null };
}
```

Update AuthGuard to use cached user data:

```typescript
// apps/investor/src/components/auth-guard.tsx
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth(); // Get user from useAuth
  const [checking, setChecking] = useState(true);

  const shouldSkipAuthGuard = pathname === "/callback" || pathname === "/onboarding-start";

  useEffect(() => {
    if (shouldSkipAuthGuard) {
      setChecking(false);
      return;
    }

    // Check role once user data is available
    if (isAuthenticated && user) {
      const hasRole = user.roles.includes("INVESTOR");

      if (!hasRole) {
        router.push("/onboarding-start");
      } else {
        setChecking(false);
      }
    }
  }, [isAuthenticated, user, router, shouldSkipAuthGuard]);

  // ... rest of component ...
}
```

---

## 🔧 LOW PRIORITY / IMPROVEMENTS

### 11. Missing CSRF Token Validation

**Severity:** Low  
**Impact:** Defense-in-depth enhancement

#### Recommendation

While OAuth `state` parameter provides CSRF protection, consider adding an additional CSRF token validated against request headers for extra security:

```typescript
// Generate CSRF token and store in cookie
res.cookie("csrf-token", csrfToken, { httpOnly: true, sameSite: "strict" });

// Validate on callback
const csrfFromCookie = req.cookies["csrf-token"];
const csrfFromHeader = req.headers["x-csrf-token"];
if (csrfFromCookie !== csrfFromHeader) {
  throw new Error("CSRF token mismatch");
}
```

---

### 12. No Rate Limiting on Sensitive Endpoints

**Severity:** Low  
**Impact:** Brute force attacks possible

#### Problem

Password change and email change endpoints lack rate limiting:

- `/v1/auth/change-password`
- `/v1/auth/initiate-email-change`
- `/v1/auth/verify-email-change`

Attackers could:

- Brute force current passwords
- Spam verification codes
- Denial of service via email flooding

#### Recommended Fix

Add rate limiting middleware:

```typescript
import rateLimit from "express-rate-limit";

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: "Too many attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to sensitive routes
router.post("/change-password", requireAuth, authRateLimiter, controller.changePassword);
router.post("/initiate-email-change", requireAuth, authRateLimiter, controller.initiateEmailChange);
router.post("/verify-email-change", requireAuth, authRateLimiter, controller.verifyEmailChange);
```

---

### 13. Cookie Clearing Doesn't Use Correct Domain

**Severity:** Low  
**Location:** All portal logout functions  
**Impact:** Cookies may not clear properly in production

#### Problem

Logout clears cookies but doesn't use the correct domain:

```typescript
// Clears for localhost only
document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost;`;

// Clears without domain (may not work for subdomains)
document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
```

In production (`.cashsouk.com`), cookies may not be cleared properly.

#### Recommended Fix

```typescript
// Read cookie domain from env
const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost";

// Clear with correct domain
cookies.forEach((cookie) => {
  const cookieName = cookie.split("=")[0].trim();
  if (cookieName.startsWith("CognitoIdentityServiceProvider")) {
    // Clear for specific domain
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${cookieDomain};`;
    // Clear without domain (fallback)
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
});
```

---

### 14. Landing Callback Redirect Race Condition

**Severity:** Low  
**Location:** `apps/landing/src/app/callback/page.tsx:34`  
**Impact:** Multiple redirects in dev mode

#### Problem

Error handling uses `setTimeout` which can execute multiple times in React Strict Mode:

```typescript
if (!clientId) {
  console.error("[Landing Callback] COGNITO_CLIENT_ID not configured");
  setError("Configuration error. Please contact support.");
  setTimeout(() => router.push("/"), 2000); // May execute multiple times
  return;
}
```

#### Recommended Fix

```typescript
const redirectedRef = useRef(false);

if (!clientId) {
  console.error("[Landing Callback] COGNITO_CLIENT_ID not configured");
  setError("Configuration error. Please contact support.");

  if (!redirectedRef.current) {
    redirectedRef.current = true;
    setTimeout(() => router.push("/"), 2000);
  }
  return;
}
```

---

## 📊 Priority Matrix

| Priority     | Issues | Fix Complexity | Risk if Ignored                                         |
| ------------ | ------ | -------------- | ------------------------------------------------------- |
| **Critical** | 4      | Medium-High    | Account lockout, security breaches, production failures |
| **High**     | 3      | Medium         | Security gaps, poor UX, auth failures                   |
| **Medium**   | 3      | Low-Medium     | Performance issues, maintainability                     |
| **Low**      | 4      | Low            | Minor improvements, edge cases                          |

---

## 🎯 Recommended Action Plan

### Phase 1: Critical Fixes (Week 1)

1. ✅ Fix OAuth state encryption key (#2)
2. ✅ Implement Redis replay protection (#3)
3. ✅ Fix email change lockout bug (#4)
4. ✅ Fix admin redirect loop (#1)

### Phase 2: High Priority (Week 2)

5. ✅ Add token to admin logout (#5)
6. ✅ Implement token manager singleton (#6)
7. ✅ Add session revocation to password change (#7)

### Phase 3: Medium Priority (Week 3-4)

8. ✅ Standardize cookie domain usage (#8)
9. ✅ Fix AuthProvider re-render (#9)
10. ✅ Eliminate redundant API calls (#10)

### Phase 4: Improvements (Ongoing)

11-14. Implement rate limiting, CSRF enhancement, cookie cleanup, etc.

---

## 📝 Testing Recommendations

After fixes, test the following scenarios:

1. **Multi-container OAuth**: Deploy with 2+ ECS tasks, verify replay protection works
2. **Email change abandonment**: Start email change, don't verify, ensure user can still login
3. **Admin access denial**: Non-admin attempts admin access, verify no redirect loop
4. **Password change security**: Change password, verify old tokens are invalidated
5. **Concurrent auth checks**: Multiple tabs/components, verify no race conditions
6. **Cross-portal navigation**: Login on investor, navigate to issuer, verify shared auth works
7. **Session expiry**: Wait for token expiry, verify auto-refresh works
8. **Logout completeness**: Logout, verify all cookies cleared, can't access protected routes

---

## 🔐 Security Best Practices Moving Forward

1. **Always validate env vars** on app startup
2. **Use distributed storage** for any auth state in production
3. **Never update critical data** (email, phone) before verification
4. **Always invalidate sessions** after password/email changes
5. **Implement rate limiting** on all auth endpoints
6. **Log all security events** (failed logins, password changes, etc.)
7. **Use singleton patterns** for token management to prevent race conditions
8. **Test with multiple containers** to catch distributed system bugs
9. **Monitor for auth failures** in production with alerts
10. **Regular security audits** on authentication flows

---

## 📚 References

- [AWS Cognito Security Best Practices](https://docs.aws.amazon.com/cognito/latest/developerguide/security-best-practices.html)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Next Review:** January 9, 2026
