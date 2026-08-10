---
title: Reset a User's Authenticator (2FA)
description: How to help a user who lost access to their authenticator app so they can sign in again.
category: Platform Operations
tags:
  - admin
  - security
  - 2fa
  - cognito
order: 31
updated: 2026-08-10
---

## Purpose

CashSouk sign-in requires two-factor authentication (2FA) with an authenticator app (for example Google Authenticator or 1Password).

If a user loses their phone, uninstalls the app, or can no longer open their authenticator codes, they cannot finish sign-in. An admin with access to the AWS Cognito console can clear that user's old authenticator so they can set up a new one on their next login.

This is done in **AWS Cognito**, not inside the CashSouk admin portal.

## Before you start

1. Confirm the request is genuine (for example match the account email through a known support channel).
2. Ask the user for the **email address** they use to sign in to CashSouk.
3. Make sure you can open the correct AWS account and Cognito user pool for CashSouk.

## Steps in AWS Cognito

1. Sign in to the **AWS Console**.
2. Open **Amazon Cognito**.
3. Open the CashSouk **user pool**.
4. Go to **Users**.
5. Search for the user by their **email address** and open their profile.
6. Find the section for **multi-factor authentication (MFA)** / authenticator app settings.
7. **Turn off** or **remove** the authenticator app / software token for that user.
8. Save the change if Cognito asks you to confirm.
9. Optional but recommended: sign the user out of all existing sessions (look for a global sign-out / revoke sessions action on the user). That forces them to sign in fresh.

## What to tell the user

Ask them to:

1. Go to CashSouk and start **sign in** again with their email and password.
2. When Cognito asks them to set up two-factor authentication, open their authenticator app.
3. Scan the QR code (or enter the setup key) and save it.
4. Enter the 6-digit code to finish setup.
5. Keep using that authenticator for future sign-ins.

They do **not** need a special link from CashSouk for this. Clearing MFA in Cognito is enough; the next login will walk them through setup again.

## If they also forgot their password

1. Clear / remove their authenticator in Cognito first (steps above).
2. Then ask them to use **Forgot password** on the sign-in page so a reset code is sent to their email.
3. After they set a new password, they will be asked to set up a **new** authenticator.

If you reset the password first but leave the old authenticator active, they may still be blocked at the 2FA step.

## Important notes

- Only do this after you have verified identity. Clearing 2FA lets anyone who knows (or can reset) the password enroll a new authenticator.
- Two-factor authentication remains required for all accounts. You are not turning 2FA off for the platform — you are only clearing this user's current authenticator so they can enroll again.
- There is currently no “Reset 2FA” button in the CashSouk admin portal. Use AWS Cognito for this recovery flow.
- After a successful recovery, remind the user to store backup access to their authenticator (for example device backup or a password manager) so this is less likely to happen again.

## Related

- For security-related account events after recovery, see **Audit > Security Logs** in the admin portal.
- Password reset emails are sent to the user's verified account email from CashSouk.
