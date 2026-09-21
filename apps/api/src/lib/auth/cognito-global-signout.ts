import {
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoConfig } from "../../config/aws";
import { logger } from "../logger";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || "ap-southeast-5",
});

/**
 * Best-effort Cognito global sign-out. Local token revocation must already
 * have succeeded; a Cognito failure must not undo that work.
 */
export async function signOutCognitoUserGlobally(cognitoSub: string): Promise<void> {
  try {
    const config = getCognitoConfig();
    await cognitoClient.send(
      new AdminUserGlobalSignOutCommand({
        UserPoolId: config.userPoolId,
        Username: cognitoSub,
      })
    );
  } catch (error) {
    logger.warn(
      {
        cognitoSub,
        error: error instanceof Error ? error.message : String(error),
      },
      "Cognito global sign-out failed after local token revocation"
    );
  }
}
