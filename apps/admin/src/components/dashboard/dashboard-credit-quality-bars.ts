import { SC_PAR90_LIMIT_PERCENT } from "@cashsouk/types";

export function ladderBarWidth(percent: number): number {
  return Math.min(100, Math.max(0, percent));
}

export function par90LimitBarWidth(percent: number): number {
  return Math.min(100, (percent / SC_PAR90_LIMIT_PERCENT) * 100);
}
