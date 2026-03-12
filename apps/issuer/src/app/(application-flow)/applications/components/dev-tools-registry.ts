// DEV TOOL REGISTRY
// Safe to delete entirely without affecting application logic.
// Imports step modules to trigger registerMockGenerator calls at load time.

import { registerMockGenerator } from "./dev-tools-panel";
import { generateMockData as contractDetailsMock } from "../steps/contract-details-step";
import { generateMockData as financialStatementsMock } from "../steps/financial-statements-step";

registerMockGenerator("contract_details", contractDetailsMock);
registerMockGenerator("financial_statements", financialStatementsMock);
