import { AppError } from "../../lib/http/error-handler";
import {
  normalizeEkycLegalName,
  normalizeMalaysianIcNumber,
} from "./resolve-issuer-ekyc-identity";

export interface EkycConfirmedIdentityInput {
  confirmedName?: string;
  confirmedIcNumber?: string;
}

export interface ParsedEkycConfirmedIdentity {
  name: string;
  icNumber: string;
}

/** Normalize user-confirmed MyKad details for SigningCloud submitResult (not persisted on org). */
export function parseConfirmedEkycIdentity(
  input: EkycConfirmedIdentityInput
): ParsedEkycConfirmedIdentity | null {
  const rawName = input.confirmedName?.trim() ?? "";
  const rawIc = input.confirmedIcNumber?.trim() ?? "";

  if (!rawName && !rawIc) {
    return null;
  }

  if (!rawName || !rawIc) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Both full name and IC number are required when confirming identity"
    );
  }

  const name = normalizeEkycLegalName(rawName);
  const icNumber = normalizeMalaysianIcNumber(rawIc);

  if (!name) {
    throw new AppError(400, "VALIDATION_ERROR", "Full name is required");
  }

  if (!icNumber) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "IC number must be a valid 12-digit Malaysian MyKad number"
    );
  }

  return { name, icNumber };
}

export function maskMalaysianIcNumber(icNumber: string): string {
  if (icNumber.length !== 12) {
    return icNumber;
  }

  return `${icNumber.slice(0, 6)}•••${icNumber.slice(-3)}`;
}
