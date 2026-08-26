/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@cashsouk/types$": "<rootDir>/../../packages/types/src/index.ts",
    "^@cashsouk/config/src/bank-account-details$":
      "<rootDir>/../../packages/config/src/bank-account-details.ts",
  },
};
