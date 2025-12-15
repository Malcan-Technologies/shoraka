# Authentication System Documentation

## Overview

The CashSouk platform uses AWS Cognito and AWS Amplify for authentication. The system implements OAuth 2.0 authorization code flow with Cognito Hosted UI for login and signup, storing all tokens in cookies for Amplify to manage automatically.

## Architecture

### System Components

1. **AWS Cognito User Pool**: Manages user accounts, passwords, and authentication
2. **Cognito Hosted UI**: Provides login/signup forms via OAuth 2.0
3. **Backend API** (`apps/api`): Handles OAuth callback, token exchange, and user management
4. **Frontend Portals**: Next.js applications (investor, issuer, admin, landing) using AWS Amplify
5. **AWS Amplify**: Frontend SDK that manages Cognito sessions and token refresh

### Token Types

| Token Type | Purpose | Lifetime |
|------------|---------|----------|
| **Access Token** | Short-lived JWT used for API authentication | 1 hour |
| **ID Token** | Short-lived JWT containing user profile information | 1 hour |
| **Refresh Token** | Long-lived token used to obtain new access/ID tokens | 30 days |

## Authentication Flow

### 1. Initial Login/Signup

```
User → Portal → Cognito Hosted UI → Backend Callback → Landing Callback → Portal
```

**Step-by-Step Process:**

1. **User clicks "Login" or "Sign Up"** on any portal (investor, issuer, admin, landing)
2. **Redirect to Cognito Hosted UI**:
   - User enters credentials or creates account
   - OAuth 2.0 authorization code flow initiated
3. **Cognito redirects to backend callback** (`/v1/auth/cognito/callback`):
   - Backend exchanges authorization code for tokens
   - Creates/updates user in database
   - Sets Amplify-compatible cookies
4. **Backend redirects to landing callback** (`/callback?portal={portal}&onboarding={status}`)
5. **Landing callback reads cookies** and redirects to appropriate portal
6. **Portal's `useAuth()` hook** verifies authentication and fetches user data

### 2. Token Storage

All tokens are stored in **cookies** (not HTTP-only, so Amplify can read them):

| Cookie Name | Purpose | Expiry |
|-------------|---------|--------|
| `CognitoIdentityServiceProvider.{clientId}.LastAuthUser` | Stores Cognito user ID | 30 days |
| `CognitoIdentityServiceProvider.{clientId}.{userId}.accessToken` | Access token for API calls | 1 hour |
| `CognitoIdentityServiceProvider.{clientId}.{userId}.idToken` | ID token with user profile | 1 hour |
| `CognitoIdentityServiceProvider.{clientId}.{userId}.refreshToken` | Refresh token for obtaining new tokens | 30 days |
| `CognitoIdentityServiceProvider.{clientId}.{userId}.clockDrift` | Clock drift adjustment for Amplify | 30 days |

**Cookie Configuration:**
- **Domain**: `.cashsouk.com` (production) or `localhost` (development)
- **Secure**: `true` in production (HTTPS only)
- **SameSite**: `lax` (allows cross-site redirects)

### 3. Automatic Token Refresh

Amplify automatically refreshes access tokens when they expire:

1. Amplify detects expired access token
2. Uses refresh token from cookie
3. Calls Cognito to get new access/ID tokens
4. Updates cookies with new tokens
5. API requests continue seamlessly

### 4. Logout Flow

```
User clicks Logout → Frontend logout() → Backend /logout → Cognito logout → Landing page
```

**Step-by-Step Process:**

1. **Frontend calls `logout()` function**:
   - Calls Amplify's `signOut()`
   - Clears all Cognito cookies
   - Calls backend `/v1/auth/cognito/logout?portal={portal}`
2. **Backend logout endpoint**:
   - Creates logout access log
   - Signs out from Cognito using `AdminUserGlobalSignOut`
   - Destroys Express session
3. **Cognito clears hosted UI session**
4. **User redirected to landing page**

## Password Management

### Change Password Flow

**Endpoint:** `POST /v1/auth/change-password`

**Request Body:**
```json
{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Requirements:**
- User must be authenticated (Bearer token required)
- Current password must be correct
- New password must:
  - Be at least 8 characters
  - Contain at least one uppercase letter
  - Contain at least one lowercase letter
  - Contain at least one number

**Flow:**
1. User submits form with current and new password
2. Backend verifies current password by authenticating with Cognito
3. Backend changes password using Cognito `ChangePasswordCommand`
4. Backend updates `password_changed_at` in database
5. Backend logs password change event
6. Response: `{ success: true }`

## Email Management

### Email Change Flow (Two-Step Process)

> **Security Note:** Email change is a two-step process for security. Both steps require password verification.

#### Step 1: Initiate Email Change

**Endpoint:** `POST /v1/auth/initiate-email-change`

**Request Body:**
```json
{
  "newEmail": "newemail@example.com",
  "password": "CurrentPassword123!"
}
```

**Flow:**
1. User enters new email and current password
2. Backend verifies password by authenticating with Cognito
3. Backend checks if new email is already in use
4. Backend updates email in Cognito (triggers verification email)
5. Backend updates email in database (sets `email_verified: false`)
6. Cognito sends verification code to new email
7. Response: `{ success: true, message: "Verification code sent to your new email address" }`

#### Step 2: Verify Email Change

**Endpoint:** `POST /v1/auth/verify-email-change`

**Request Body:**
```json
{
  "code": "123456",
  "newEmail": "newemail@example.com",
  "password": "CurrentPassword123!"
}
```

**Flow:**
1. User enters verification code from email
2. Backend verifies password again (security check)
3. Backend verifies code with Cognito using `VerifyUserAttributeCommand`
4. Backend updates `email_verified: true` in database
5. Response: `{ success: true, newEmail: "newemail@example.com" }`

## Role-Based Access Control (RBAC)

### User Roles

The system supports three main user roles:

- **INVESTOR**: Users who invest in loans
- **ISSUER**: Users who create and manage loan requests
- **ADMIN**: Administrative users with access to admin portal

### Role Assignment

- Roles are stored in the database as an array (users can have multiple roles)
- During signup, users start with no roles (empty array)
- Roles are assigned after completing onboarding for each role type
- Admin role is assigned only through invitation system (see Settings/Roles documentation)

### Role Detection

The system detects the requested role from:
1. Query parameter: `?role=INVESTOR`
2. Referer/Origin header: Detects portal from URL (e.g., `investor.cashsouk.com`)
3. Default: Falls back to `INVESTOR` if no role detected

> **Admin Portal Security:** Admin portal is sign-in only. Users must have the ADMIN role AND an active admin status to access. Sign-up is blocked for admin role.

## API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/auth/cognito/login` | Initiate OAuth login (redirects to Cognito Hosted UI) |
| GET | `/v1/auth/cognito/callback` | OAuth callback (handles token exchange) |
| GET | `/v1/auth/cognito/logout` | Logout (requires `?portal={portal}` query param) |
| GET | `/v1/auth/me` | Get current user info (requires authentication) |

### Password Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/change-password` | Change password (requires authentication) |

### Email Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/auth/initiate-email-change` | Start email change process (requires authentication) |
| POST | `/v1/auth/verify-email-change` | Complete email change with verification code (requires authentication) |
| POST | `/v1/auth/resend-email-verification` | Resend email verification code (requires authentication) |

## Security Considerations

### Token Storage

- **Cookies vs Memory**: All tokens stored in cookies (not HTTP-only) so Amplify can manage them
- **Security**: Cookies use `secure: true` (HTTPS only) and `sameSite: lax` in production
- **Refresh Token**: Long-lived (30 days) but only used for token refresh, never sent to API

### Password Security

- Passwords never stored in plain text (handled by Cognito)
- Password changes require current password verification
- Password complexity enforced by Cognito password policy

### Email Security

- Email changes require:
  1. Current password verification
  2. Email verification code
- Two-step process prevents unauthorized changes

### Session Security

- Access tokens expire after 1 hour
- Automatic refresh via refresh token
- Logout clears all tokens and Cognito session
- Cross-site request protection via `sameSite: lax`

## Troubleshooting

### Issue: "No access token found"

**Cause:** Cookies not set or expired

**Solution:**
1. Check browser cookies (DevTools → Application → Cookies)
2. Verify cookie domain matches your domain
3. Ensure cookies are not blocked by browser settings
4. Try logging in again

### Issue: "Token verification failed"

**Cause:** Invalid or expired token

**Solution:**
1. Logout and login again
2. Check backend logs for JWT verification errors
3. Verify Cognito User Pool ID matches in backend and frontend

### Issue: "Redirect loop"

**Cause:** Authentication state mismatch

**Solution:**
1. Clear all cookies for the domain
2. Clear browser cache
3. Logout from Cognito Hosted UI directly
4. Try login again

### Issue: "Email change verification code not received"

**Cause:** Email delivery delay or spam filter

**Solution:**
1. Check spam/junk folder
2. Wait 1-2 minutes (AWS SES can have delays)
3. Verify email address is correct
4. Check AWS Cognito console for email delivery status

### Issue: "Password change fails"

**Cause:** Password doesn't meet Cognito requirements

**Solution:**
1. Ensure password meets all requirements:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - May require special characters (check Cognito password policy)
2. Verify current password is correct

## Additional Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [AWS Amplify Auth Documentation](https://docs.amplify.aws/react/build-a-backend/auth/)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)

