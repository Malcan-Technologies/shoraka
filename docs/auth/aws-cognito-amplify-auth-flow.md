# AWS Cognito & Amplify Authentication Flow

## Overview

This document describes the complete authentication system using AWS Cognito and AWS Amplify. The system uses OAuth 2.0 authorization code flow with Cognito Hosted UI for login/signup, and stores all tokens in cookies for Amplify to manage automatically.

## Architecture

### Components

1. **AWS Cognito User Pool**: Manages user accounts, passwords, and authentication
2. **Cognito Hosted UI**: Provides login/signup forms via OAuth 2.0
3. **Backend API** (`apps/api`): Handles OAuth callback, token exchange, and user management
4. **Frontend Portals** (`apps/investor`, `apps/issuer`, `apps/admin`, `apps/landing`): Next.js applications using AWS Amplify
5. **AWS Amplify**: Frontend SDK that manages Cognito sessions and token refresh

### Token Types

- **Access Token**: Short-lived JWT (1 hour) used for API authentication
- **ID Token**: Short-lived JWT (1 hour) containing user profile information
- **Refresh Token**: Long-lived token (30 days) used to obtain new access/ID tokens

## Authentication Flow

### 1. Initial Login/Signup

```
User → Portal → Cognito Hosted UI → Backend Callback → Landing Callback → Portal
```

**Step-by-Step:**

1. **User clicks "Login" or "Sign Up"** on any portal (investor, issuer, admin, landing)
2. **Redirect to Cognito Hosted UI**:
   - URL: `https://auth.cashsouk.com/oauth2/authorize?client_id=...&redirect_uri=...&response_type=code&scope=email+openid+profile&state=...`
   - User enters credentials or creates account
3. **Cognito redirects to backend callback** (`/v1/auth/cognito/callback`):
   - Backend exchanges authorization code for tokens
   - Creates/updates user in database
   - Sets Amplify-compatible cookies:
     - `CognitoIdentityServiceProvider.{clientId}.LastAuthUser` (cognito user ID)
     - `CognitoIdentityServiceProvider.{clientId}.{userId}.accessToken`
     - `CognitoIdentityServiceProvider.{clientId}.{userId}.idToken`
     - `CognitoIdentityServiceProvider.{clientId}.{userId}.refreshToken`
     - `CognitoIdentityServiceProvider.{clientId}.{userId}.clockDrift`
4. **Backend redirects to landing callback** (`/callback?portal={portal}&onboarding={status}`)
5. **Landing callback reads cookies** and redirects to appropriate portal
6. **Portal's `useAuth()` hook** verifies authentication and fetches user data

### 2. Token Storage

All tokens are stored in **cookies** (not HTTP-only, so Amplify can read them):

- **Domain**: `.cashsouk.com` (production) or `localhost` (development)
- **Secure**: `true` in production (HTTPS only)
- **SameSite**: `lax` (allows cross-site redirects)
- **Expiry**:
  - Access/ID tokens: 1 hour
  - Refresh token: 30 days
  - LastAuthUser: 30 days

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

**Step-by-Step:**

1. **Frontend calls `logout()`** function:
   - Calls Amplify's `signOut()`
   - Clears all Cognito cookies
   - Calls backend `/v1/auth/cognito/logout?portal={portal}`
2. **Backend logout endpoint**:
   - Clears server-side session
   - Redirects to Cognito logout URL: `https://auth.cashsouk.com/logout?client_id=...&logout_uri=...`
3. **Cognito clears hosted UI session**
4. **User redirected to landing page**

## Password Change Flow

### Endpoint

`POST /v1/auth/change-password`

### Request Body

```json
{
  "currentPassword": "CurrentPassword123!",
  "newPassword": "NewPassword123!"
}
```

### Requirements

- User must be authenticated (Bearer token required)
- Current password must be correct
- New password must:
  - Be at least 8 characters
  - Contain at least one uppercase letter
  - Contain at least one lowercase letter
  - Contain at least one number

### Flow

1. **User submits form** with current and new password
2. **Backend verifies current password**:
   - Authenticates user with Cognito using `USER_PASSWORD_AUTH` flow
   - Gets Cognito access token
3. **Backend changes password**:
   - Uses Cognito `ChangePasswordCommand` with access token
   - Updates `password_changed_at` in database
   - Logs password change event
4. **Response**: `{ success: true }`

### Testing Password Change

1. **Login to any portal** (investor, issuer, or admin)
2. **Navigate to Profile page**
3. **Click "Change Password"**
4. **Fill in form**:
   - Current password: Your current password
   - New password: Must meet requirements (8+ chars, uppercase, lowercase, number)
   - Confirm password: Must match new password
5. **Submit form**
6. **Expected**: Success toast, form closes
7. **Verify**: Logout and login with new password

### Error Cases

- **Invalid current password**: `400 Bad Request` - "Invalid current password"
- **Weak new password**: `400 Bad Request` - Validation error message
- **Not authenticated**: `401 Unauthorized`

## Email Change Flow

Email change is a **two-step process** for security:

### Step 1: Initiate Email Change

**Endpoint**: `POST /v1/auth/initiate-email-change`

**Request Body**:
```json
{
  "newEmail": "newemail@example.com",
  "password": "CurrentPassword123!"
}
```

**Flow**:
1. User enters new email and current password
2. Backend verifies password by authenticating with Cognito
3. Backend checks if new email is already in use
4. Backend updates email in Cognito (triggers verification email)
5. Backend updates email in database (sets `email_verified: false`)
6. Cognito sends verification code to new email
7. Response: `{ success: true, message: "Verification code sent to your new email address" }`

### Step 2: Verify Email Change

**Endpoint**: `POST /v1/auth/verify-email-change`

**Request Body**:
```json
{
  "code": "123456",
  "newEmail": "newemail@example.com",
  "password": "CurrentPassword123!"
}
```

**Flow**:
1. User enters verification code from email
2. Backend verifies password again (security check)
3. Backend verifies code with Cognito using `VerifyUserAttributeCommand`
4. Backend updates `email_verified: true` in database
5. Response: `{ success: true, newEmail: "newemail@example.com" }`

### Testing Email Change

1. **Login to any portal**
2. **Navigate to Profile page**
3. **Click "Change Email"**
4. **Step 1 - Initiate**:
   - Enter new email address
   - Enter current password
   - Click "Send Verification Code"
   - **Expected**: Success toast, form switches to verification step
5. **Check email inbox** for verification code (from AWS Cognito)
6. **Step 2 - Verify**:
   - Enter 6-digit verification code from email
   - Password field is pre-filled (same as step 1)
   - Click "Verify Email"
   - **Expected**: Success toast, email updated in profile
7. **Verify**: Logout and login with new email

### Error Cases

- **Invalid password**: `400 Bad Request` - "Invalid password"
- **Email already in use**: `400 Bad Request` - "This email address is already in use"
- **Invalid verification code**: `400 Bad Request` - "Invalid verification code"
- **Expired verification code**: `400 Bad Request` - "Verification code has expired"

## Testing Guide

### Prerequisites

1. **Environment Variables** (all portals):
   - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
   - `NEXT_PUBLIC_COGNITO_CLIENT_ID`
   - `NEXT_PUBLIC_COGNITO_DOMAIN` (e.g., `auth.cashsouk.com`)
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_COOKIE_DOMAIN` (e.g., `.cashsouk.com` or `localhost`)

2. **Backend Environment Variables**:
   - `COGNITO_USER_POOL_ID`
   - `COGNITO_CLIENT_ID`
   - `COGNITO_CLIENT_SECRET`
   - `COGNITO_DOMAIN` (e.g., `https://auth.cashsouk.com`)
   - `COGNITO_REGION` (e.g., `ap-southeast-5`)

3. **Start all services**:
   ```bash
   pnpm dev
   ```

### Test 1: New User Signup

1. Navigate to `http://localhost:3000` (landing page)
2. Click "Get Started" or "Sign Up"
3. Fill in signup form on Cognito Hosted UI:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Confirm password: `TestPassword123!`
4. Click "Sign Up"
5. Check email for verification code
6. Enter verification code on Cognito UI
7. **Expected**: Redirected to investor portal onboarding (default role)

### Test 2: Existing User Login

1. Navigate to any portal (e.g., `http://localhost:3002` for investor)
2. Click "Login"
3. Enter credentials on Cognito Hosted UI
4. **Expected**: Redirected to portal dashboard

### Test 3: Token Refresh

1. Login to any portal
2. Open browser DevTools → Application → Cookies
3. Note the access token cookie expiry (1 hour)
4. Wait for token to expire OR manually expire it:
   - Edit cookie expiry to past date
   - Refresh page
5. **Expected**: Amplify automatically refreshes token, user stays logged in

### Test 4: Logout

1. Login to any portal
2. Click user menu → "Logout"
3. **Expected**:
   - Redirected to Cognito logout page
   - Then redirected to landing page
   - All cookies cleared
   - Cannot access protected routes

### Test 5: Password Change

1. Login to any portal
2. Navigate to Profile page
3. Click "Change Password"
4. Fill form:
   - Current: Your current password
   - New: `NewPassword123!`
   - Confirm: `NewPassword123!`
5. Submit
6. **Expected**: Success toast
7. Logout and login with new password
8. **Expected**: Login successful

### Test 6: Email Change

1. Login to any portal
2. Navigate to Profile page
3. Click "Change Email"
4. **Step 1**:
   - New email: `newemail@example.com`
   - Password: Your current password
   - Submit
5. **Expected**: Verification code sent toast, form switches to step 2
6. Check email inbox for verification code
7. **Step 2**:
   - Enter 6-digit code
   - Password: Your current password (pre-filled)
   - Submit
8. **Expected**: Success toast, email updated
9. Logout and login with new email
10. **Expected**: Login successful

### Test 7: Cross-Portal Navigation

1. Login as investor (`http://localhost:3002`)
2. Note your session cookies
3. Navigate to issuer portal (`http://localhost:3001`)
4. **Expected**: Automatically logged in (cookies shared via domain)

### Test 8: Role-Based Access

1. Login as investor
2. Try to access admin portal (`http://localhost:3003`)
3. **Expected**: Redirected to landing page (no ADMIN role)

### Test 9: Onboarding Flow

1. Sign up as new user
2. **Expected**: Redirected to `/onboarding-start`
3. Complete onboarding form
4. **Expected**: Redirected to dashboard, onboarding status updated

### Test 10: Session Persistence

1. Login to any portal
2. Close browser tab
3. Reopen portal URL
4. **Expected**: Still logged in (cookies persist)

## Troubleshooting

### Issue: "No access token found"

**Cause**: Cookies not set or expired

**Solution**:
1. Check browser cookies (DevTools → Application → Cookies)
2. Verify `COOKIE_DOMAIN` environment variable matches your domain
3. Ensure cookies are not blocked by browser settings
4. Try logging in again

### Issue: "Token verification failed"

**Cause**: Invalid or expired token

**Solution**:
1. Logout and login again
2. Check backend logs for JWT verification errors
3. Verify `COGNITO_USER_POOL_ID` matches in backend and frontend

### Issue: "Redirect loop"

**Cause**: Authentication state mismatch

**Solution**:
1. Clear all cookies for the domain
2. Clear browser cache
3. Logout from Cognito Hosted UI directly: `https://auth.cashsouk.com/logout`
4. Try login again

### Issue: "Email change verification code not received"

**Cause**: Email delivery delay or spam filter

**Solution**:
1. Check spam/junk folder
2. Wait 1-2 minutes (AWS SES can have delays)
3. Verify email address is correct
4. Check AWS Cognito console for email delivery status

### Issue: "Password change fails"

**Cause**: Password doesn't meet Cognito requirements

**Solution**:
1. Ensure password meets all requirements:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - May require special characters (check Cognito password policy)
2. Verify current password is correct

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
  3. Two-step process prevents unauthorized changes

### Session Security

- Access tokens expire after 1 hour
- Automatic refresh via refresh token
- Logout clears all tokens and Cognito session
- Cross-site request protection via `sameSite: lax`

## API Endpoints Reference

### Authentication

- `GET /v1/auth/cognito/login` - Initiate OAuth login
- `GET /v1/auth/cognito/callback` - OAuth callback (handles token exchange)
- `GET /v1/auth/cognito/logout?portal={portal}` - Logout
- `GET /v1/auth/me` - Get current user info

### Password Management

- `POST /v1/auth/change-password` - Change password
  - Body: `{ currentPassword: string, newPassword: string }`

### Email Management

- `POST /v1/auth/initiate-email-change` - Start email change
  - Body: `{ newEmail: string, password: string }`
- `POST /v1/auth/verify-email-change` - Complete email change
  - Body: `{ code: string, newEmail: string, password: string }`
- `POST /v1/auth/resend-email-verification` - Resend verification code
  - Body: `{ password: string }`

## Environment Variables

### Frontend (All Portals)

```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-southeast-5_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=auth.cashsouk.com
NEXT_PUBLIC_COGNITO_REGION=ap-southeast-5
NEXT_PUBLIC_API_URL=https://api.cashsouk.com
NEXT_PUBLIC_COOKIE_DOMAIN=.cashsouk.com
```

### Backend

```env
COGNITO_USER_POOL_ID=ap-southeast-5_xxxxx
COGNITO_CLIENT_ID=xxxxx
COGNITO_CLIENT_SECRET=xxxxx
COGNITO_DOMAIN=https://auth.cashsouk.com
COGNITO_REGION=ap-southeast-5
COOKIE_DOMAIN=.cashsouk.com
```

## Additional Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [AWS Amplify Auth Documentation](https://docs.amplify.aws/react/build-a-backend/auth/)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)

