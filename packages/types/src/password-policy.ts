export const PASSWORD_MIN_LENGTH = 8;

/**
 * Cognito user-pool RequireSymbols set:
 * ^ $ * . [ ] { } ( ) ? " ! @ # % & / \ , > < ' : ; | _ ~ ` = + -
 */
export const COGNITO_PASSWORD_SYMBOLS = "^$*.[]{}()?\"!@#%&/\\,><':;|_~`=+-";

function cognitoSymbolCharacterClass(symbols: string): string {
  return `[${symbols.replace(/[\\^\-\]]/g, "\\$&")}]`;
}

/** Uppercase, lowercase, digit, and a Cognito-recognized symbol. */
export const PASSWORD_COMPLEXITY_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*${cognitoSymbolCharacterClass(COGNITO_PASSWORD_SYMBOLS)}).{${PASSWORD_MIN_LENGTH},}$`
);

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol. Common passwords are not allowed.";

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password1!",
  "password123",
  "password123!",
  "qwerty",
  "qwerty1",
  "qwerty123",
  "qwerty123!",
  "12345678",
  "123456789",
  "abc123",
  "abc123!",
  "letmein",
  "welcome",
  "welcome1",
  "welcome1!",
  "admin123",
  "admin123!",
  "iloveyou1",
  "passw0rd",
  "passw0rd!",
  "p@ssw0rd",
  "changeme",
  "changeme1",
  "changeme1!",
  "cashsouk1",
  "cashsouk1!",
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

export function meetsPasswordPolicy(password: string): boolean {
  return PASSWORD_COMPLEXITY_REGEX.test(password) && !isCommonPassword(password);
}

export function passwordPolicyIssue(password: string): string | null {
  return meetsPasswordPolicy(password) ? null : PASSWORD_POLICY_MESSAGE;
}
