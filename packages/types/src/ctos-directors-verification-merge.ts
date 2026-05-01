/**
 * SECTION: Dedupe CTOS `company_json.directors` for onboarding verification
 * WHY: Parser can emit duplicate rows (same nic); admin CTOS compare must match people[] merge rules
 * INPUT: Parsed director rows (same shape as admin extract, post-parse only)
 * OUTPUT: One row per normalized person; merged roles, max equity, first non-empty metadata
 * WHERE USED: apps/admin onboarding-ctos-compare (SSM / CTOS verification panel)
 */

import { normalizeDirectorShareholderIdKey } from "./director-shareholder-display";

export type CtosDirectorRowForVerificationMerge = {
  ic_lcno: string | null;
  nic_brno: string | null;
  brn_ssm?: string | null;
  name: string | null;
  position: string | null;
  equity_percentage: number | null;
  equity: number | null;
  party_type: string | null;
  addr?: string | null;
  appoint?: string | null;
  resign_date?: string | null;
  remark?: string | null;
};

function preferNonEmpty(a: string | null | undefined, b: string | null | undefined): string | null {
  const p = a != null ? String(a).trim() : "";
  if (p) return p;
  const s = b != null ? String(b).trim() : "";
  return s || null;
}

function individualIdNicFirstIcSecond(r: CtosDirectorRowForVerificationMerge): string {
  const nic = (r.nic_brno ?? "").trim();
  const ic = (r.ic_lcno ?? "").trim();
  return nic || ic;
}

function mergeKeyForCtosDirectorRow(r: CtosDirectorRowForVerificationMerge): string | null {
  const pt = (r.party_type ?? "").trim().toUpperCase();
  if (pt === "C") {
    const nic = (r.nic_brno ?? "").trim();
    const ic = (r.ic_lcno ?? "").trim();
    const corpId = nic || ic || null;
    return normalizeDirectorShareholderIdKey(corpId);
  }
  const fromInd = normalizeDirectorShareholderIdKey(individualIdNicFirstIcSecond(r) || null);
  if (fromInd) return fromInd;
  return normalizeDirectorShareholderIdKey((r.name ?? "").trim() || null);
}

function positionCodeUpper(position: string | null | undefined): string {
  return String(position ?? "").trim().toUpperCase();
}

/** Same director/shareholder code sets as admin onboarding CTOS compare (no `SC` as shareholder). */
const CTOS_VERIFY_DIR_CODES = new Set(["DO", "AD", "DS", "AS"]);
const CTOS_VERIFY_SH_CODES = new Set(["SO", "DS", "AS"]);

function isVerifyDirectorCode(code: string): boolean {
  return CTOS_VERIFY_DIR_CODES.has(code);
}

function isVerifyShareholderCode(code: string): boolean {
  return CTOS_VERIFY_SH_CODES.has(code);
}

function resolvedEquityPercent(r: CtosDirectorRowForVerificationMerge): number | null {
  const raw = r.equity_percentage;
  if (raw == null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw > 0 && raw <= 1) return raw * 100;
  return raw;
}

function syntheticPosition(hasDir: boolean, hasSh: boolean, firstDirPos: string | null, firstShPos: string | null): string {
  if (hasDir && hasSh) return "DS";
  if (hasDir) {
    const c = firstDirPos != null ? positionCodeUpper(firstDirPos) : "";
    if (c && isVerifyDirectorCode(c)) return firstDirPos!.trim();
    return "DO";
  }
  if (hasSh) {
    const c = firstShPos != null ? positionCodeUpper(firstShPos) : "";
    if (c && isVerifyShareholderCode(c)) return firstShPos!.trim();
    return "SO";
  }
  return "";
}

/**
 * Dedupe and merge CTOS director rows before admin onboarding / CTOS verification compare.
 * Individuals: nic → ic → normalized name. Corporate (`party_type` C): nic → ic (same as display `corporateCtosRegDisplayRaw`).
 */
export function mergeCtosDirectorsForVerification<T extends CtosDirectorRowForVerificationMerge>(rows: T[]): T[] {
  const keyOrder: string[] = [];
  const groups = new Map<string, T[]>();
  let anonSeq = 0;

  for (const r of rows) {
    const rawKey = mergeKeyForCtosDirectorRow(r);
    const mapKey = rawKey ?? `__anon_${anonSeq++}`;
    if (!groups.has(mapKey)) keyOrder.push(mapKey);
    const list = groups.get(mapKey);
    if (list) list.push(r);
    else groups.set(mapKey, [r]);
  }

  const out: T[] = [];
  for (const mapKey of keyOrder) {
    const list = groups.get(mapKey);
    if (!list?.length) continue;

    let hasDir = false;
    let hasSh = false;
    let firstDirPos: string | null = null;
    let firstShPos: string | null = null;
    let eqMax: number | null = null;
    let equityMax: number | null = null;

    for (const r of list) {
      const code = positionCodeUpper(r.position);
      if (code && isVerifyDirectorCode(code)) {
        hasDir = true;
        if (!firstDirPos && r.position != null && String(r.position).trim()) firstDirPos = String(r.position).trim();
      }
      if (code && isVerifyShareholderCode(code)) {
        hasSh = true;
        if (!firstShPos && r.position != null && String(r.position).trim()) firstShPos = String(r.position).trim();
      }
      const rp = resolvedEquityPercent(r);
      if (rp != null) eqMax = eqMax == null ? rp : Math.max(eqMax, rp);
      if (r.equity != null && Number.isFinite(Number(r.equity))) {
        const e = Number(r.equity);
        equityMax = equityMax == null ? e : Math.max(equityMax, e);
      }
    }

    let name: string | null = null;
    let ic_lcno: string | null = null;
    let nic_brno: string | null = null;
    let brn_ssm: string | null = null;
    let party_type: string | null = null;
    let addr: string | null = null;
    let appoint: string | null = null;
    let resign_date: string | null = null;
    let remark: string | null = null;

    for (const r of list) {
      name = preferNonEmpty(name, r.name);
      nic_brno = preferNonEmpty(nic_brno, r.nic_brno != null ? String(r.nic_brno) : null);
      ic_lcno = preferNonEmpty(ic_lcno, r.ic_lcno != null ? String(r.ic_lcno) : null);
      if (r.brn_ssm != null) brn_ssm = preferNonEmpty(brn_ssm, String(r.brn_ssm));
      party_type = preferNonEmpty(party_type, r.party_type);
      addr = preferNonEmpty(addr, r.addr);
      appoint = preferNonEmpty(appoint, r.appoint);
      resign_date = preferNonEmpty(resign_date, r.resign_date);
      remark = preferNonEmpty(remark, r.remark);
    }

    const pos = syntheticPosition(hasDir, hasSh, firstDirPos, firstShPos);

    const merged = {
      ...list[0],
      name,
      ic_lcno,
      nic_brno,
      brn_ssm: brn_ssm ?? list[0].brn_ssm ?? null,
      party_type,
      position: pos || list[0].position,
      equity_percentage: eqMax,
      equity: equityMax,
      addr: addr ?? undefined,
      appoint: appoint ?? undefined,
      resign_date: resign_date ?? undefined,
      remark: remark ?? undefined,
    } as T;

    out.push(merged);
  }

  return out;
}
