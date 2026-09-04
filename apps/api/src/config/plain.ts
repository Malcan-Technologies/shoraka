import { z } from "zod";

const plainEnvSchema = z.object({
  PLAIN_API_KEY: z.string().trim().optional(),
  PLAIN_CHAT_APP_ID: z.string().trim().optional(),
  PLAIN_CHAT_SECRET: z.string().trim().optional(),
});

export type PlainConfig = {
  apiKey: string | null;
  chatAppId: string | null;
  chatSecret: string | null;
};

let cachedConfig: PlainConfig | null = null;

export function resetPlainConfigCache(): void {
  cachedConfig = null;
}

export function getPlainConfig(): PlainConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = plainEnvSchema.parse(process.env);
  cachedConfig = {
    apiKey: env.PLAIN_API_KEY || null,
    chatAppId: env.PLAIN_CHAT_APP_ID || null,
    chatSecret: env.PLAIN_CHAT_SECRET || null,
  };
  return cachedConfig;
}

export function isPlainChatConfigured(): boolean {
  return Boolean(getPlainConfig().chatSecret);
}
