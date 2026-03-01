import { CreateApplicationLogParams } from "./types";
import * as repository from "./repository";

export async function logApplicationActivity(params: CreateApplicationLogParams) {
  try {
    await repository.createApplicationLog(params);
  } catch (error) {
    // never throw; ensure business flow continues
    // eslint-disable-next-line no-console
    console.error("Failed to log application activity", error);
  }
}

