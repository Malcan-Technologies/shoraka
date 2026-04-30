"use client";

import * as React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DirectorShareholderNotifyButton } from "@/components/director-shareholder-notify-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
  formatSharePercentageCell,
  getDisplayStatus,
} from "@/lib/onboarding-people-display";
import {
  getEffectiveCtosPartyOnboarding,
  getEffectiveCtosPartyScreening,
  normalizeDirectorShareholderIdKey,
  regtankDisplayStatusBadgeClass,
  toTitleCase,
  type ApplicationPersonRow,
} from "@cashsouk/types";

type AmlInfo = { status: string; riskLevel: string; riskScore: string };
type KycInfo = {
  status: string;
  governmentIdNumber: string;
  eodRequestId: string;
  shareholderEodRequestId: string;
  kycId: string;
};
type CorporateEntityInfo = {
  eodRequestId: string;
  requestId: string;
  frontDocumentUrl: string;
  backDocumentUrl: string;
};
type AmlLookup = {
  byGov: Map<string, AmlInfo>;
  byKycId: Map<string, AmlInfo>;
  byEod: Map<string, AmlInfo>;
};
type CtosReportRow = {
  id: string;
  subject_ref?: string | null;
  fetched_at: string;
  has_report_html?: boolean;
};
type PendingCtosSubjectFetch = {
  subjectRef: string;
  subjectKind: "INDIVIDUAL" | "CORPORATE";
  displayName: string;
  idNumber?: string;
  partyLabel: string;
};

/**
 * SECTION: Director/shareholder shared table
 * WHY: Keep Admin Financial and Organization Detail UI identical.
 * INPUT: people + supplements + status JSON + CTOS actions.
 * OUTPUT: Unified table and CTOS confirmation modal.
 * WHERE USED: Admin Financial tab and Organization Detail page.
 */
export function DirectorShareholderTable({
  people,
  supplements,
  directorAmlStatus,
  directorKycStatus,
  corporateEntities,
  codRequestId,
  regtankPortalUrl,
  ctosReports,
  ctosFetchPendingKey,
  ctosFetchPending,
  notifyPending,
  canNotify,
  onFetchSubjectCtos,
  onViewLastReport,
  onNotify,
}: {
  people: ApplicationPersonRow[];
  supplements: Array<{ partyKey: string; onboardingJson?: unknown }> | null | undefined;
  directorAmlStatus: unknown;
  directorKycStatus: unknown;
  corporateEntities: unknown;
  codRequestId?: string | null;
  regtankPortalUrl?: string | null;
  ctosReports: CtosReportRow[] | null | undefined;
  ctosFetchPendingKey?: string | null;
  ctosFetchPending?: boolean;
  notifyPending?: boolean;
  canNotify?: boolean;
  onFetchSubjectCtos: (input: {
    subjectRef: string;
    subjectKind: "INDIVIDUAL" | "CORPORATE";
    displayName?: string;
    idNumber?: string;
  }) => void;
  onViewLastReport?: (reportId: string) => void;
  onNotify?: (partyKey: string) => void;
}) {
  const [pendingCtosSubjectFetch, setPendingCtosSubjectFetch] = React.useState<PendingCtosSubjectFetch | null>(null);
  const rows = React.useMemo(() => mergePeopleRowsByMatchKey(filterVisiblePeopleRows(people ?? [])), [people]);
  const supplementsByKey = React.useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    for (const row of supplements ?? []) {
      const key = normalizeDirectorShareholderIdKey(row.partyKey);
      if (!key) continue;
      const json =
        row.onboardingJson &&
        typeof row.onboardingJson === "object" &&
        !Array.isArray(row.onboardingJson)
          ? (row.onboardingJson as Record<string, unknown>)
          : {};
      m.set(key, json);
    }
    return m;
  }, [supplements]);
  const amlLookup = React.useMemo(() => buildAmlLookup(directorAmlStatus), [directorAmlStatus]);
  const kycLookup = React.useMemo(() => buildKycLookup(directorKycStatus), [directorKycStatus]);
  const entitiesByGov = React.useMemo(() => buildCorporateEntityByGovernmentId(corporateEntities), [corporateEntities]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No director or shareholder data.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Share %</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>Request ID</TableHead>
              <TableHead>IC Front</TableHead>
              <TableHead>IC Back</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>CTOS</TableHead>
              <TableHead>Notify</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const key = normalizeDirectorShareholderIdKey(p.matchKey);
              const supplement = key ? supplementsByKey.get(key) ?? {} : {};
              const displayRow = buildDirectorShareholderDisplayRowForEmailEligibility(p, supplement);
              const onboarding = getEffectiveCtosPartyOnboarding(supplement);
              const screening = getEffectiveCtosPartyScreening(supplement);
              const entity = key ? entitiesByGov.get(key) : undefined;
              const rowRefKey = ctosSubjectRefKey(p.matchKey);
              const kycInfo =
                (key ? kycLookup.byGov.get(key) : undefined) || kycLookup.byEod.get(rowRefKey) || kycLookup.byKycId.get(rowRefKey);
              const amlInfo =
                (key ? amlLookup.byGov.get(key) : undefined) ||
                (kycInfo?.kycId ? amlLookup.byKycId.get(kycInfo.kycId) : undefined) ||
                (kycInfo?.eodRequestId ? amlLookup.byEod.get(kycInfo.eodRequestId) : undefined) ||
                (kycInfo?.shareholderEodRequestId ? amlLookup.byEod.get(kycInfo.shareholderEodRequestId) : undefined);
              const amlFallback = String(amlInfo?.status ?? "").trim();
              const kycFallback = kycInfo?.status || "";
              const onboardingStatus = String(onboarding.status ?? onboarding.regtankStatus ?? "").trim();
              const fallbackRequestId =
                String(
                  onboarding.requestId ??
                    onboarding.eodRequestId ??
                    kycInfo?.eodRequestId ??
                    entity?.eodRequestId ??
                    entity?.requestId ??
                    screening.requestId ??
                    ""
                ).trim() || "—";
              const eodForRegtankLink = firstEodId(
                kycInfo?.eodRequestId,
                kycInfo?.shareholderEodRequestId,
                String(onboarding.eodRequestId ?? "").trim() || undefined,
                fallbackRequestId !== "—" ? fallbackRequestId : undefined
              );
              const requestId = eodForRegtankLink || String(kycInfo?.kycId ?? "").trim() || fallbackRequestId;
              const icFront =
                entity?.frontDocumentUrl ||
                getFirstString(supplement, [
                  ["identityDocument", "frontUrl"],
                  ["identityDocument", "frontImageUrl"],
                  ["documents", "idFrontUrl"],
                  ["documents", "identityFrontUrl"],
                  ["icFrontUrl"],
                  ["frontIcUrl"],
                  ["idFrontUrl"],
                  ["frontImageUrl"],
                ]) ||
                "—";
              const icBack =
                entity?.backDocumentUrl ||
                getFirstString(supplement, [
                  ["identityDocument", "backUrl"],
                  ["identityDocument", "backImageUrl"],
                  ["documents", "idBackUrl"],
                  ["documents", "identityBackUrl"],
                  ["icBackUrl"],
                  ["backIcUrl"],
                  ["idBackUrl"],
                  ["backImageUrl"],
                ]) ||
                "—";
              const subjectIdNumber =
                (p.entityType !== "CORPORATE" && kycInfo?.governmentIdNumber ? kycInfo.governmentIdNumber : "") ||
                (!looksLikeRequestId(p.matchKey) ? String(p.matchKey ?? "").trim() : "") ||
                "";
              const displayStatus = getDisplayStatus({
                screening: p.screening,
                directorAmlStatus: amlFallback || null,
                directorKycStatus: kycFallback || null,
                onboarding: { status: onboardingStatus || null },
              });
              const regtankBase = resolveRegtankPortalBase(regtankPortalUrl);
              const regtankPathRequestId =
                eodForRegtankLink || String(kycInfo?.kycId ?? "").trim() || (fallbackRequestId !== "—" ? fallbackRequestId : "");
              const requestUrl =
                regtankOnboardingCorporatePartyUrl(regtankBase, String(codRequestId ?? "").trim(), eodForRegtankLink) ??
                (p.entityType === "CORPORATE" || requestId.toUpperCase().startsWith("COD")
                  ? regtankResultUrl(regtankBase, regtankPathRequestId, "company")
                  : regtankIndividualLivenessAdminUrl(regtankBase, regtankPathRequestId));
              const subjectRefCandidates = [
                p.matchKey,
                requestId,
                eodForRegtankLink,
                fallbackRequestId,
                kycInfo?.eodRequestId ?? "",
                kycInfo?.shareholderEodRequestId ?? "",
                entity?.eodRequestId ?? "",
                entity?.requestId ?? "",
              ].filter((v) => String(v ?? "").trim().length > 0);
              const latestSubjectReport = (ctosReports ?? [])
                .filter((r) => !!r.subject_ref)
                .filter((r) => subjectRefCandidates.some((c) => ctosSubjectRefsMatch(c, r.subject_ref)))
                .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0];
              const timestamp = latestSubjectReport?.fetched_at ? format(new Date(latestSubjectReport.fetched_at), "PPpp") : "—";
              const riskLevel =
                String(amlInfo?.riskLevel ?? "").trim() ||
                String(amlInfo?.riskScore ?? "").trim() ||
                String(screening.riskLevel ?? "").trim() ||
                "—";
              const canNotifyByHelper = displayRow.canSendOnboarding === true;
              const notifyEnabled = (canNotify ?? true) && canNotifyByHelper;
              const shareDisplay = (() => {
                const rolesU = (p.roles ?? []).map((r) => String(r).toUpperCase());
                const hasDirector = rolesU.includes("DIRECTOR");
                const hasShareholder = rolesU.includes("SHAREHOLDER");
                if (hasDirector && !hasShareholder) return "—";
                return formatSharePercentageCell(p) || "—";
              })();
              return (
                <TableRow key={p.matchKey}>
                  <TableCell className="font-medium">
                    <div>{p.name ?? "—"}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5">{p.matchKey}</div>
                  </TableCell>
                  <TableCell>{formatRoleTitleCaseWithoutShare(p.roles ?? [])}</TableCell>
                  <TableCell>{shareDisplay}</TableCell>
                  <TableCell>
                    {displayStatus ? (
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[11px] font-normal ${regtankDisplayStatusBadgeClass(String(displayStatus))}`}
                      >
                        {toTitleCase(displayStatus)}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{riskLevel}</TableCell>
                  <TableCell>
                    {requestUrl ? (
                      <Button type="button" variant="outline" size="sm" asChild className="h-8 gap-1.5">
                        <a href={requestUrl} target="_blank" rel="noopener noreferrer">
                          {requestId}
                        </a>
                      </Button>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{requestId}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {icFront !== "—" && isUrl(icFront) ? (
                      <a href={icFront} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {icBack !== "—" && isUrl(icBack) ? (
                      <a href={icBack} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{timestamp}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          const subjectDisplayName = String(p.name ?? "").trim() || p.matchKey;
                          console.log("Open CTOS fetch confirm:", {
                            subjectRef: p.matchKey,
                            displayName: subjectDisplayName,
                            idNumber: subjectIdNumber || "(server resolve)",
                          });
                          setPendingCtosSubjectFetch({
                            subjectRef: p.matchKey,
                            subjectKind: p.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
                            displayName: subjectDisplayName,
                            idNumber: subjectIdNumber || undefined,
                            partyLabel: p.name?.trim() ? `${p.name} (${p.matchKey})` : p.matchKey,
                          });
                        }}
                        disabled={ctosFetchPending === true && ctosFetchPendingKey === normalizeDirectorShareholderIdKey(p.matchKey)}
                      >
                        {ctosFetchPending === true && ctosFetchPendingKey === normalizeDirectorShareholderIdKey(p.matchKey)
                          ? "Fetching..."
                          : "Fetch"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => latestSubjectReport?.id && onViewLastReport?.(latestSubjectReport.id)}
                        disabled={!latestSubjectReport?.id || !onViewLastReport}
                      >
                        View Last
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {notifyEnabled && onNotify ? (
                        <DirectorShareholderNotifyButton
                          rowActionable={true}
                          disabled={notifyPending === true}
                          onNotify={() => onNotify(p.matchKey)}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={pendingCtosSubjectFetch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCtosSubjectFetch(null);
        }}
      >
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Fetch latest CTOS report for this party?</AlertDialogTitle>
            <AlertDialogDescription>
              We will request a fresh CTOS report for {pendingCtosSubjectFetch?.partyLabel ?? "this party"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={ctosFetchPending === true}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg"
              disabled={ctosFetchPending === true}
              onClick={() => {
                const payload = pendingCtosSubjectFetch;
                if (!payload) return;
                setPendingCtosSubjectFetch(null);
                console.log("Confirm CTOS subject fetch:", payload.subjectRef, payload.subjectKind);
                onFetchSubjectCtos({
                  subjectRef: payload.subjectRef,
                  subjectKind: payload.subjectKind,
                  displayName: payload.displayName,
                  idNumber: payload.idNumber,
                });
              }}
            >
              {ctosFetchPending === true ? "Fetching..." : "Fetch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function mergePeopleRowsByMatchKey(rows: ApplicationPersonRow[]): ApplicationPersonRow[] {
  const map = new Map<string, ApplicationPersonRow>();
  for (const row of rows) {
    const key = normalizeDirectorShareholderIdKey(row.matchKey);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row, matchKey: key });
      continue;
    }
    const roleSet = new Set<string>([...(prev.roles ?? []), ...(row.roles ?? [])].map((r) => String(r).toUpperCase()));
    const prevShare = typeof prev.sharePercentage === "number" ? prev.sharePercentage : null;
    const rowShare = typeof row.sharePercentage === "number" ? row.sharePercentage : null;
    map.set(key, {
      ...prev,
      matchKey: key,
      roles: Array.from(roleSet),
      sharePercentage: prevShare != null && rowShare != null ? Math.max(prevShare, rowShare) : prevShare ?? rowShare,
      name: prev.name ?? row.name ?? null,
    });
  }
  return Array.from(map.values());
}

function formatRoleTitleCaseWithoutShare(roles: string[]): string {
  const cleaned = roles
    .map((r) => String(r ?? "").trim().toUpperCase())
    .filter((r) => r === "DIRECTOR" || r === "SHAREHOLDER");
  const uniq = [...new Set(cleaned)];
  if (uniq.length === 0) return "—";
  return uniq.map((r) => (r === "DIRECTOR" ? "Director" : "Shareholder")).join(", ");
}

function resolveRegtankPortalBase(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return s.replace(/\/+$/, "");
  }
}

function regtankResultUrl(base: string, requestId: string, kind: "individual" | "company"): string | undefined {
  const b = base.replace(/\/+$/, "");
  const rid = String(requestId ?? "").trim();
  if (!b || !rid || rid === "—") return undefined;
  const enc = encodeURIComponent(rid);
  return kind === "company" ? `${b}/app/screen-kyb/result/${enc}` : `${b}/app/screen-kyc/result/${enc}`;
}

function regtankIndividualLivenessAdminUrl(base: string, requestId: string): string | undefined {
  const b = base.replace(/\/+$/, "");
  const rid = String(requestId ?? "").trim();
  if (!b || !rid) return undefined;
  return `${b}/app/liveness/${encodeURIComponent(rid)}?archived=false`;
}

function regtankOnboardingCorporatePartyUrl(base: string, cod: string, eod: string): string | undefined {
  const b = base.replace(/\/+$/, "");
  const c = String(cod ?? "").trim();
  const e = String(eod ?? "").trim();
  if (!b || !c || !e) return undefined;
  if (!c.toUpperCase().startsWith("COD") || !e.toUpperCase().startsWith("EOD")) return undefined;
  return `${b}/app/onboardingCorporate/${encodeURIComponent(c)}/${encodeURIComponent(e)}`;
}

function firstEodId(...candidates: Array<string | null | undefined>): string {
  for (const raw of candidates) {
    const v = String(raw ?? "").trim();
    if (v.toUpperCase().startsWith("EOD")) return v;
  }
  return "";
}

function comparableSubjectRef(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function ctosSubjectRefKey(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function ctosSubjectRefsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = ctosSubjectRefKey(a);
  const kb = ctosSubjectRefKey(b);
  if (ka.length > 0 && kb.length > 0 && ka === kb) return true;
  return comparableSubjectRef(a) === comparableSubjectRef(b);
}

function looksLikeRequestId(raw: string | null | undefined): boolean {
  const v = String(raw ?? "").trim().toUpperCase();
  return v.startsWith("EOD") || v.startsWith("COD");
}

function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getFirstString(root: Record<string, unknown>, paths: string[][]): string {
  for (const path of paths) {
    let cur: unknown = root;
    for (const segment of path) {
      if (!cur || typeof cur !== "object" || Array.isArray(cur)) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[segment];
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
  }
  return "";
}

function extractFormFieldValue(formContent: unknown, fieldName: string): string {
  if (!formContent || typeof formContent !== "object" || Array.isArray(formContent)) return "";
  const root = formContent as Record<string, unknown>;
  const areas = Array.isArray(root.displayAreas)
    ? (root.displayAreas as Array<{ content?: unknown[] }>)
    : [{ content: Array.isArray(root.content) ? root.content : [] }];
  for (const area of areas) {
    const rows = Array.isArray(area?.content) ? area.content : [];
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      if (String(r.fieldName ?? "").trim().toLowerCase() !== fieldName.trim().toLowerCase()) continue;
      const val = String(r.fieldValue ?? "").trim();
      if (val) return val;
    }
  }
  return "";
}

function buildAmlLookup(source: unknown): AmlLookup {
  const byGov = new Map<string, AmlInfo>();
  const byKycId = new Map<string, AmlInfo>();
  const byEod = new Map<string, AmlInfo>();
  if (!source || typeof source !== "object" || Array.isArray(source)) return { byGov, byKycId, byEod };
  const root = source as { directors?: unknown[]; individualShareholders?: unknown[] };
  const rows = [...(root.directors ?? []), ...(root.individualShareholders ?? [])];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const status = String(r.amlStatus ?? r.status ?? "").trim();
    const riskLevel = String(r.amlRiskLevel ?? "").trim();
    const scoreRaw = r.amlRiskScore;
    const riskScore = scoreRaw === null || scoreRaw === undefined ? "" : String(scoreRaw).trim();
    if (!status && !riskLevel && !riskScore) continue;
    const info: AmlInfo = { status: status || "", riskLevel, riskScore };
    const gov = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? "")) ?? "";
    if (gov) byGov.set(gov, info);
    const kycId = String(r.kycId ?? "").trim();
    if (kycId) byKycId.set(kycId, info);
    const eod = String(r.eodRequestId ?? "").trim();
    if (eod) byEod.set(eod, info);
  }
  return { byGov, byKycId, byEod };
}

function buildKycLookup(source: unknown): {
  byGov: Map<string, KycInfo>;
  byEod: Map<string, KycInfo>;
  byKycId: Map<string, KycInfo>;
} {
  const byGov = new Map<string, KycInfo>();
  const byEod = new Map<string, KycInfo>();
  const byKycId = new Map<string, KycInfo>();
  if (!source || typeof source !== "object" || Array.isArray(source)) return { byGov, byEod, byKycId };
  const root = source as { directors?: unknown[]; individualShareholders?: unknown[] };
  const rows = [...(root.directors ?? []), ...(root.individualShareholders ?? [])];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const gov = normalizeDirectorShareholderIdKey(String(r.governmentIdNumber ?? "")) ?? "";
    const info: KycInfo = {
      status: String(r.kycStatus ?? r.status ?? "").trim(),
      governmentIdNumber: gov,
      eodRequestId: String(r.eodRequestId ?? "").trim(),
      shareholderEodRequestId: String(r.shareholderEodRequestId ?? "").trim(),
      kycId: String(r.kycId ?? "").trim(),
    };
    if (gov) byGov.set(gov, info);
    if (info.eodRequestId) byEod.set(ctosSubjectRefKey(info.eodRequestId), info);
    if (info.shareholderEodRequestId) byEod.set(ctosSubjectRefKey(info.shareholderEodRequestId), info);
    if (info.kycId) byKycId.set(ctosSubjectRefKey(info.kycId), info);
  }
  return { byGov, byEod, byKycId };
}

function buildCorporateEntityByGovernmentId(source: unknown): Map<string, CorporateEntityInfo> {
  const byGov = new Map<string, CorporateEntityInfo>();
  if (!source || typeof source !== "object" || Array.isArray(source)) return byGov;
  const root = source as { directors?: unknown[]; shareholders?: unknown[] };
  const rows = [...(root.directors ?? []), ...(root.shareholders ?? [])];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const personalInfo = r.personalInfo as Record<string, unknown> | undefined;
    const documents = r.documents as Record<string, unknown> | undefined;
    const govRaw =
      String(personalInfo?.governmentIdNumber ?? "").trim() ||
      extractFormFieldValue(personalInfo?.formContent, "Government ID Number");
    const gov = normalizeDirectorShareholderIdKey(govRaw);
    if (!gov) continue;
    byGov.set(gov, {
      eodRequestId: String(r.eodRequestId ?? "").trim(),
      requestId: String(r.requestId ?? "").trim(),
      frontDocumentUrl: String(documents?.frontDocumentUrl ?? "").trim(),
      backDocumentUrl: String(documents?.backDocumentUrl ?? "").trim(),
    });
  }
  return byGov;
}
