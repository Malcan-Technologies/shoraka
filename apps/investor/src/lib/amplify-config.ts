"use client";

import { Amplify } from "aws-amplify";
import { CookieStorage } from "aws-amplify/utils";

const cognitoUserPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const cognitoClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
const investorUrl = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3002";
const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";

// Only configure Amplify if we're in the browser and have all required variables
// During build/SSR, skip configuration to avoid errors
if (typeof window !== "undefined") {
  if (!cognitoUserPoolId || !cognitoClientId || !cognitoDomain) {
    throw new Error(
      "Missing required Cognito environment variables: NEXT_PUBLIC_COGNITO_USER_POOL_ID, NEXT_PUBLIC_COGNITO_CLIENT_ID, NEXT_PUBLIC_COGNITO_DOMAIN"
    );
  }

  Amplify.configure(
  {
    Auth: {
      Cognito: {
        userPoolId: cognitoUserPoolId,
        userPoolClientId: cognitoClientId,
        loginWith: {
          oauth: {
            domain: cognitoDomain,
            scopes: ["email", "openid", "profile"],
            redirectSignIn: [`${investorUrl}/callback`, `${landingUrl}/callback`],
            redirectSignOut: [landingUrl],
            responseType: "code",
          },
        },
      },
    },
  },
  {
    ssr: true,
    // storage is a valid option but not in TypeScript definitions - using type assertion
    storage: new CookieStorage({
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || "localhost",
      path: "/",
      expires: 365,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    }),
  } as { ssr: boolean; storage: InstanceType<typeof CookieStorage> }
  );
}

export default Amplify;

