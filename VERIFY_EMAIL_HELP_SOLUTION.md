# Solution: Self-Service Email Verification Help

## The Problem

**Edge case:** User signs up → Sees OTP screen → Closes browser → Tries to login later → Gets "User is not confirmed" error on Cognito's page → Stuck

**Why Lambda won't work:**
- Cognito blocks UNCONFIRMED users **before** any Lambda trigger runs
- Pre-Auth Lambda runs too late (after block)
- Pre-Signup Lambda only runs during signup (not login)
- Can't customize Cognito's error page

## The Solution: Self-Service Help Page

Since we can't intercept Cognito's error, we provide a **clear help link** before users try to log in.

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. User sees "Can't sign in? Verify your email" link    │
│    on login page/modal                                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Clicks link → Goes to /verify-email-help             │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Enters email address                                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 4. System calls resendSignUpCode()                       │
│    - If UNCONFIRMED → Sends verification code            │
│    - If CONFIRMED → Shows "already verified" message     │
│    - If not found → Shows error                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Redirects to /verify-email with email pre-filled     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 6. User enters code → Email verified → Can log in       │
└─────────────────────────────────────────────────────────┘
```

## What Was Implemented

### 1. New Help Page ✅
**File:** `/apps/landing/src/app/verify-email-help/page.tsx`

**Features:**
- Enter email address
- Calls Amplify's `resendSignUpCode()`
- Handles all error cases:
  - User not found → Clear error message
  - Already verified → Success message, redirect to login
  - UNCONFIRMED → Sends code, redirects to verification page
  - Rate limited → Friendly error
- Brand-consistent UI
- Self-service, no admin needed

### 2. Help Links Added ✅

**Where:**
- Login modal (role selection)
- Get Started page (signup/login page)

**Text:**
```
"Can't sign in? Verify your email"
```

**Links to:** `/verify-email-help`

### 3. Existing Verification Page ✅
**File:** `/apps/landing/src/app/verify-email/page.tsx`

- Already handles code entry
- Already has resend functionality
- Works with the help page flow

## User Experience

### Scenario 1: User Abandoned Signup

```
Day 1: Sign up → See OTP screen → Close browser

Day 2: Try to log in → See "User is not confirmed" error
       → Remember seeing "Can't sign in? Verify your email" link
       → Go back to landing page
       → Click "Verify your email" link
       → Enter email
       → Get new code
       → Verify
       → Log in successfully
```

### Scenario 2: User Already Verified

```
User clicks "Verify your email" link
→ Enters email
→ System detects already verified
→ Shows: "Your email is already verified! You can sign in normally"
→ Button: "Go to Sign In"
```

### Scenario 3: New User (No Account Yet)

```
User clicks "Verify your email" link
→ Enters email (doesn't exist)
→ Shows: "No account found with this email. Please sign up first."
→ Can try different email or go back to signup
```

## Benefits

✅ **Self-service** - No admin intervention needed  
✅ **Clear guidance** - Users know what to do  
✅ **Handles all cases** - UNCONFIRMED, CONFIRMED, not found  
✅ **Brand-consistent** - Matches your design system  
✅ **No Lambdas needed** - Uses Amplify's built-in methods  
✅ **Scalable** - Works for unlimited users  
✅ **Better UX** - Proactive help, not reactive support  

## Why This Is Better Than Pre-Signup Auto-Confirm

| Approach | Pros | Cons |
|----------|------|------|
| **Pre-Signup Auto-Confirm** | Automatic, no user action | Changes signup behavior, all users CONFIRMED immediately |
| **Help Page (This)** | Preserves existing signup flow, only helps stuck users | Requires user to click link |

Since your **signup flow already works** (Cognito OTP), this solution only adds a **safety net** for the edge case without changing the main flow.

## Files Modified/Created

```
Created:
  ✓ apps/landing/src/app/verify-email-help/page.tsx

Modified:
  ✓ apps/landing/src/components/role-selection-modal.tsx
  ✓ apps/landing/src/app/(auth)/get-started/page.tsx

Existing (reused):
  ✓ apps/landing/src/app/verify-email/page.tsx
```

## Testing

### Test 1: UNCONFIRMED User
1. Create unconfirmed user (sign up but don't verify)
2. Go to landing page → Click "Login"
3. See "Can't sign in? Verify your email" link
4. Click link → Enter email
5. Should send code and redirect to verification page
6. Enter code → Verify → Can log in

### Test 2: Already Verified User
1. Use an already verified account
2. Go to verify-email-help page
3. Enter verified email
4. Should show "Already verified" message
5. Click "Go to Sign In" → Redirects to login

### Test 3: Non-existent User
1. Go to verify-email-help page
2. Enter email that doesn't exist
3. Should show "No account found" error
4. Can go back to signup

## What About the Lambda?

**You can keep or remove the Pre-Signup Lambda:**

**Keep it:** If you want future signups to be auto-confirmed (belt-and-suspenders approach)
**Remove it:** If you want to stick with standard Cognito behavior

The help page works either way!

## Cost

**$0** - Uses only Amplify's built-in methods (resendSignUpCode), no Lambda needed.

## Support

If users still get stuck:
1. They can use the help page (self-service)
2. Support can manually confirm if needed:
   ```bash
   aws cognito-idp admin-confirm-sign-up \
     --user-pool-id ap-southeast-5_Ugz3vHRnm \
     --username email@example.com \
     --region ap-southeast-5
   ```

## Summary

**Problem:** Users abandon signup OTP, can't log in later  
**Solution:** Prominent "Verify your email" help link → Self-service code resend  
**Result:** Users can fix it themselves without admin support  

This is the **minimal, non-invasive solution** that doesn't change your existing signup flow! ✅

