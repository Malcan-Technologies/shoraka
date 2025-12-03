#!/usr/bin/env tsx

import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { PrismaClient, UserRole } from "@prisma/client";
import { getEnv } from "../src/config/env";
import { logger } from "../src/lib/logger";
import crypto from "crypto";

const prisma = new PrismaClient();

/**
 * Generate a secure random password
 */
function generateSecurePassword(length: number = 16): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const randomBytes = crypto.randomBytes(length);
  let password = "";
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  // Ensure password has at least one of each required character type
  if (!/[A-Z]/.test(password)) {
    password = password.slice(0, -1) + "A";
  }
  if (!/[a-z]/.test(password)) {
    password = password.slice(0, -1) + "a";
  }
  if (!/[0-9]/.test(password)) {
    password = password.slice(0, -1) + "1";
  }
  if (!/[!@#$%^&*]/.test(password)) {
    password = password.slice(0, -1) + "!";
  }
  
  return password;
}

async function createAdminUser(email: string, firstName: string, lastName: string) {
  try {
    logger.info({ email, firstName, lastName }, "Starting admin user creation");

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Check if user already exists in database
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      logger.warn({ email, userId: existingUser.id }, "User already exists in database");
      
      // Check if user already has ADMIN role
      if (existingUser.roles.includes(UserRole.ADMIN)) {
        logger.info({ email }, "User already has ADMIN role");
        console.log(`\n✅ User ${email} already exists and has ADMIN role.`);
        console.log(`   User ID: ${existingUser.id}`);
        return;
      }

      // User exists but doesn't have ADMIN role - add it
      logger.info({ email }, "Adding ADMIN role to existing user");
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          roles: {
            set: [...existingUser.roles, UserRole.ADMIN],
          },
        },
      });

      console.log(`\n✅ Added ADMIN role to existing user ${email}`);
      console.log(`   User ID: ${updatedUser.id}`);
      console.log(`   Roles: ${updatedUser.roles.join(", ")}`);
      
      // Check if user exists in Cognito by trying to get user info
      const env = getEnv();
      const cognitoClient = new CognitoIdentityProviderClient({
        region: env.COGNITO_REGION,
      });

      try {
        // Try to get user from Cognito (this will throw if user doesn't exist)
        await cognitoClient.send(
          new AdminGetUserCommand({
            UserPoolId: env.COGNITO_USER_POOL_ID,
            Username: email,
          })
        );
        
        logger.info({ email }, "User already exists in Cognito");
        console.log(`\n✅ User ${email} already exists in Cognito.`);
        console.log(`\n⚠️  IMPORTANT: User must sign in via admin portal and change their password.`);
        return;
      } catch (error: any) {
        if (error.name === "UserNotFoundException") {
          logger.info({ email }, "User does not exist in Cognito, user needs to sign up");
          console.log(`\n⚠️  User ${email} exists in database but not in Cognito.`);
          console.log(`   User must sign up via the admin portal first.`);
          return;
        }
        // Other error - log and continue
        logger.warn({ email, error: error.message }, "Error checking Cognito user");
      }

      return;
    }

    // Generate secure temporary password
    const tempPassword = generateSecurePassword(16);

    // Create user in Cognito
    const env = getEnv();
    const cognitoClient = new CognitoIdentityProviderClient({
      region: env.COGNITO_REGION,
    });

    logger.info({ email }, "Creating user in Cognito");

    const cognitoCommand = new AdminCreateUserCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "given_name", Value: firstName },
        { Name: "family_name", Value: lastName },
      ],
      TemporaryPassword: tempPassword,
      MessageAction: "SUPPRESS", // Don't send welcome email
      DesiredDeliveryMediums: ["EMAIL"],
    });

    const cognitoResponse = await cognitoClient.send(cognitoCommand);
    const cognitoSub = cognitoResponse.User?.Attributes?.find((attr) => attr.Name === "sub")?.Value;

    if (!cognitoSub) {
      throw new Error("Failed to create Cognito user - no sub attribute returned");
    }

    logger.info({ email, cognitoSub }, "User created in Cognito");

    // Create user in database
    logger.info({ email }, "Creating user in database");

    const user = await prisma.user.create({
      data: {
        cognito_sub: cognitoSub,
        cognito_username: email,
        email,
        roles: [UserRole.ADMIN],
        first_name: firstName,
        last_name: lastName,
        email_verified: true,
        kyc_verified: false,
        investor_onboarding_completed: false,
        issuer_onboarding_completed: false,
      },
    });

    logger.info({ email, userId: user.id }, "User created in database");

    // Output success message
    console.log("\n✅ Admin user created successfully!");
    console.log(`\n📧 Email: ${email}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Cognito Sub: ${cognitoSub}`);
    console.log(`\n🔑 Temporary Password: ${tempPassword}`);
    console.log(`\n⚠️  IMPORTANT:`);
    console.log(`   1. Share this temporary password securely with the user`);
    console.log(`   2. User must sign in at the admin portal: ${env.ADMIN_URL || "admin.cashsouk.com"}`);
    console.log(`   3. User will be prompted to change password on first login`);
    console.log(`   4. Store this password securely - it will not be shown again\n`);
  } catch (error) {
    logger.error({ error, email }, "Failed to create admin user");
    
    if (error instanceof Error) {
      console.error(`\n❌ Error: ${error.message}\n`);
      
      if (error.message.includes("UsernameExistsException")) {
        console.error("   User already exists in Cognito. Use a different email or update existing user.\n");
      }
    } else {
      console.error(`\n❌ Unexpected error: ${error}\n`);
    }
    
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error("Usage: pnpm create-admin <email> <firstName> <lastName>");
    console.error("\nExample:");
    console.error("  pnpm create-admin admin@cashsouk.com John Doe\n");
    process.exit(1);
  }

  const [email, firstName, ...lastNameParts] = args;
  const lastName = lastNameParts.join(" ");

  if (!lastName) {
    console.error("Error: Last name is required");
    process.exit(1);
  }

  await createAdminUser(email, firstName, lastName);
}

main()
  .catch((error) => {
    logger.error({ error }, "Script execution failed");
    console.error(`\n❌ Script failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

