import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("4000"),
  DATABASE_URL: z.string().url(),
  
  // Cognito
  COGNITO_USER_POOL_ID: z.string(),
  COGNITO_CLIENT_ID: z.string(),
  COGNITO_CLIENT_SECRET: z.string(),
  COGNITO_DOMAIN: z.string().url(),
  COGNITO_REGION: z.string(),
  REDIRECT_URI: z.string().url(),
  
  // Frontend URLs
  FRONTEND_URL: z.string().url(),
  INVESTOR_URL: z.string().url().optional(),
  ISSUER_URL: z.string().url().optional(),
  ADMIN_URL: z.string().url().optional(),
  
  // Session
  SESSION_SECRET: z.string().min(32),
  
  // Cookies
  COOKIE_DOMAIN: z.string().optional(), // e.g., ".cashsouk.com" for subdomain sharing
  
  // CORS
  ALLOWED_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (env) {
    return env;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables: ${result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
    );
  }

  env = result.data;
  return env;
}

