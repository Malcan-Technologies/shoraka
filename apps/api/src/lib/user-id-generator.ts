import { prisma } from "./prisma";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ID_LENGTH = 5;
const MAX_RETRIES = 10;

/**
 * Generate a random 5-letter user ID (A-Z uppercase)
 */
function generateRandomUserId(): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
  }
  return id;
}

/**
 * Generate a unique user ID that doesn't exist in database
 * @throws Error if unable to generate unique ID after MAX_RETRIES
 */
export async function generateUniqueUserId(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const userId = generateRandomUserId();

    // Check if ID already exists
    const existing = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { user_id: true },
    });

    if (!existing) {
      return userId;
    }
  }

  throw new Error(`Failed to generate unique user ID after ${MAX_RETRIES} attempts`);
}

/**
 * Validate user ID format (5 uppercase letters A-Z)
 */
export function validateUserId(userId: string): boolean {
  return /^[A-Z]{5}$/.test(userId);
}
