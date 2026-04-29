"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@cashsouk/ui";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  kycAmlScreeningRiskLevelBadgeClass,
  kycAmlScreeningStatusBadgeClass,
} from "@/lib/kyc-aml-screening-badge-classes";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { OrganizationActivityTimeline } from "@/components/organization-activity-timeline";
import { OrganizationIssuerCtosReportsCard } from "@/components/organization-issuer-ctos-reports-card";
import {
  useOrganizationDetail,
  useUpdateSophisticatedStatus,
} from "@/hooks/use-organization-detail";
import type { PortalType } from "@cashsouk/types";
import { format } from "date-fns";
import {
  UserIcon,
  BuildingOffice2Icon,
  PhoneIcon,
  IdentificationIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  FaceSmileIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  filterVisiblePeopleRows,
  getDisplayStatus,
  formatSharePercentageCell,
  isNotifyEligible,
} from "@/lib/onboarding-people-display";
import {
  getEffectiveCtosPartyOnboarding,
  getEffectiveCtosPartyScreening,
  normalizeDirectorShareholderIdKey,
  regtankDisplayStatusBadgeClass,
  type AdminCtosReportListItem,
} from "@cashsouk/types";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { formatApiErrorMessage } from "@/lib/format-api-error-message";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const REGTANK_PORTAL_BASE_URL =
  typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL ?? "").trim() : "";

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

/** Issuer corporate onboarding: open director/shareholder KYC in corporate flow (COD + EOD). */
function regtankOnboardingCorporatePartyUrl(base: string, cod: string, eod: string): string | undefined {
  const b = base.replace(/\/+$/, "");
  const c = String(cod ?? "").trim();
  const e = String(eod ?? "").trim();
  if (!b || !c || !e) return undefined;
  const cu = c.toUpperCase();
  const eu = e.toUpperCase();
  if (!cu.startsWith("COD") || !eu.startsWith("EOD")) return undefined;
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

/** Same as API `normalizeCtosSubjectRefKey` (ctos subject_ref in DB). */
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

type PendingCtosSubjectFetch = {
  subjectRef: string;
  subjectKind: "INDIVIDUAL" | "CORPORATE";
  displayName: string;
  idNumber?: string;
  partyLabel: string;
};

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && (
        <div className="flex h-5 w-5 items-center justify-center text-muted-foreground shrink-0 mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

function CopyableField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [copied, setCopied] = React.useState(false);

  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && (
        <div className="flex h-5 w-5 items-center justify-center text-muted-foreground shrink-0 mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-background hover:bg-muted px-2 py-1 rounded border transition-colors cursor-pointer group mt-0.5"
          title="Click to copy"
        >
          <span className="break-words text-left">{value}</span>
          {copied ? (
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <ClipboardIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
}

function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || "";
    if (lastPart.length > 30) {
      return `${parsed.hostname}/.../${lastPart.substring(0, 25)}...`;
    }
    if (pathParts.length > 2) {
      return `${parsed.hostname}/.../${lastPart}`;
    }
    return `${parsed.hostname}${parsed.pathname.substring(0, 40)}${parsed.pathname.length > 40 ? "..." : ""}`;
  } catch {
    return url.substring(0, 40) + (url.length > 40 ? "..." : "");
  }
}

interface FormField {
  fieldName: string;
  fieldType: string;
  fieldValue: string | boolean | string[] | null;
  alias?: string;
  cn?: boolean;
}

interface FormData {
  content?: FormField[];
  displayArea?: string;
}

function isFormData(data: unknown): data is FormData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.content) &&
    obj.content.length > 0 &&
    obj.content.every(
      (item: unknown) => typeof item === "object" && item !== null && "fieldName" in item
    )
  );
}

const COPYABLE_FIELD_PATTERNS = [
  /bank.*account.*number/i,
  /account.*number/i,
  /phone/i,
  /mobile/i,
  /email/i,
];

function isCopyableField(fieldName: string): boolean {
  return COPYABLE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

function CopyableFormValue({ value, fieldName }: { value: string; fieldName: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${fieldName} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Failed to copy`);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 font-medium bg-background hover:bg-muted px-2 py-1 rounded border transition-colors cursor-pointer group"
      title="Click to copy"
    >
      <span>{value}</span>
      {copied ? (
        <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      ) : (
        <ClipboardIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      )}
    </button>
  );
}

function FormFieldValue({ field }: { field: FormField }): React.ReactNode {
  const { fieldValue, fieldType, fieldName } = field;

  if (fieldValue === null || fieldValue === undefined || fieldValue === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  if (fieldType === "checkbox" && typeof fieldValue === "boolean") {
    return fieldValue ? (
      <span className="text-green-600 font-medium">✓ Yes</span>
    ) : (
      <span className="text-muted-foreground">No</span>
    );
  }

  if (fieldType === "multi-checkbox" && Array.isArray(fieldValue)) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {fieldValue.map((item, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs">
            {item}
          </Badge>
        ))}
      </div>
    );
  }

  if (fieldType === "picklist" && typeof fieldValue === "string") {
    const lowerValue = fieldValue.toLowerCase();
    if (lowerValue === "yes") return <span className="text-green-600 font-medium">✓ Yes</span>;
    if (lowerValue === "no") return <span className="text-muted-foreground">No</span>;
    return (
      <Badge variant="secondary" className="text-xs font-medium">
        {fieldValue}
      </Badge>
    );
  }

  if (typeof fieldValue === "string" && isUrl(fieldValue)) {
    return (
      <a
        href={fieldValue}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <LinkIcon className="h-3 w-3" />
        <span className="truncate max-w-[200px]">{shortenUrl(fieldValue)}</span>
        <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
      </a>
    );
  }

  if (typeof fieldValue === "string" && isCopyableField(fieldName)) {
    return <CopyableFormValue value={fieldValue} fieldName={field.alias || fieldName} />;
  }

  return <span className="font-medium">{String(fieldValue)}</span>;
}

function isSophisticatedInvestorCriteriaField(fieldName: string, alias?: string): boolean {
  const name = (fieldName || "").toLowerCase();
  const aliasLower = (alias || "").toLowerCase();
  return (
    name.includes("net assets") ||
    aliasLower.includes("net assets") ||
    name.includes("annual income") ||
    aliasLower.includes("annual income") ||
    name.includes("net personal investment portfolio") ||
    name.includes("net joint investment portfolio") ||
    name.includes("rm1,000,000") ||
    name.includes("professional qualification") ||
    aliasLower.includes("professional qualification") ||
    name.includes("experience categories") ||
    aliasLower.includes("experience categories")
  );
}

function FormDataDisplay({ data, label }: { data: FormData; label: React.ReactNode }) {
  const fields = data.content || [];
  const displayArea = data.displayArea || "";
  const isComplianceDeclaration = displayArea.toLowerCase().includes("compliance");

  const visibleFields = fields.filter((field) => {
    if (field.fieldType === "header") return field.fieldName.trim().length > 0;
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {isComplianceDeclaration && (
          <p className="text-xs text-muted-foreground mt-1">
            Fields marked with a star (★) are used to determine sophisticated investor status.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {visibleFields.map((field, idx) => {
          if (field.fieldType === "header") {
            const isSection =
              field.fieldName.endsWith(":") ||
              field.fieldName.includes("Declaration") ||
              field.fieldName.includes("Categories") ||
              field.fieldName.includes("Status");
            return (
              <div
                key={idx}
                className={
                  isSection
                    ? "text-xs font-semibold text-foreground pt-3 pb-1 border-t first:border-0 first:pt-0"
                    : "text-xs text-muted-foreground pl-2"
                }
              >
                {field.fieldName}
              </div>
            );
          }

          const displayName = field.alias || field.fieldName;
          const isCriteriaField =
            isComplianceDeclaration &&
            isSophisticatedInvestorCriteriaField(field.fieldName, field.alias);

          return (
            <div
              key={idx}
              className={`flex flex-col py-1.5 border-b last:border-0 ${isCriteriaField ? "bg-violet-50 dark:bg-violet-950/20 -mx-4 px-4 rounded" : ""}`}
            >
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {isCriteriaField && <span className="text-violet-500">★</span>}
                {displayName}
              </div>
              <div className="text-sm">
                <FormFieldValue field={field} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function KycResponseDisplay({
  data,
}: {
  data: {
    tags?: string[];
    status?: string;
    assignee?: string;
    systemId?: string;
    requestId?: string;
    riskLevel?: string;
    riskScore?: string;
    timestamp?: string;
    referenceId?: string;
    onboardingId?: string;
    messageStatus?: string;
    possibleMatchCount?: number;
    blacklistedMatchCount?: number;
  } | null;
}) {
  if (!data) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldExclamationIcon className="h-4 w-4" />
          KYC/AML Screening Result
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {data.status && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Badge className={kycAmlScreeningStatusBadgeClass(data.status)}>{data.status}</Badge>
            </div>
          )}
          {data.riskLevel && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Risk Level:</span>
              <Badge className={kycAmlScreeningRiskLevelBadgeClass(data.riskLevel)}>{data.riskLevel}</Badge>
            </div>
          )}
          {data.riskScore && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Risk Score:</span>
              <Badge variant="outline">{data.riskScore}</Badge>
            </div>
          )}
        </div>

        {(data.possibleMatchCount !== undefined || data.blacklistedMatchCount !== undefined) && (
          <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-muted/50">
            {data.possibleMatchCount !== undefined && (
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon
                  className={`h-4 w-4 ${data.possibleMatchCount > 0 ? "text-amber-500" : "text-muted-foreground"}`}
                />
                <span className="text-sm">
                  <span className="font-medium">{data.possibleMatchCount}</span>{" "}
                  <span className="text-muted-foreground">
                    possible {data.possibleMatchCount === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            )}
            {data.blacklistedMatchCount !== undefined && (
              <div className="flex items-center gap-2">
                <ShieldExclamationIcon
                  className={`h-4 w-4 ${data.blacklistedMatchCount > 0 ? "text-red-500" : "text-muted-foreground"}`}
                />
                <span className="text-sm">
                  <span className="font-medium">{data.blacklistedMatchCount}</span>{" "}
                  <span className="text-muted-foreground">
                    blacklisted {data.blacklistedMatchCount === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {data.systemId && (
            <div>
              <div className="text-xs text-muted-foreground">System ID</div>
              <div className="font-mono">{data.systemId}</div>
            </div>
          )}
          {data.requestId && (
            <div>
              <div className="text-xs text-muted-foreground">Request ID</div>
              <div className="font-mono">{data.requestId}</div>
            </div>
          )}
          {data.onboardingId && (
            <div>
              <div className="text-xs text-muted-foreground">Onboarding ID</div>
              <div className="font-mono">{data.onboardingId}</div>
            </div>
          )}
          {data.messageStatus && (
            <div>
              <div className="text-xs text-muted-foreground">Message Status</div>
              <div>{data.messageStatus}</div>
            </div>
          )}
          {data.timestamp && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">Screening Date</div>
              <div>{format(new Date(data.timestamp), "PPpp")}</div>
            </div>
          )}
        </div>

        {data.tags && data.tags.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JsonDisplay({
  data,
  label,
}: {
  data: Record<string, unknown> | null;
  label: React.ReactNode;
}) {
  if (!data || Object.keys(data).length === 0) return null;

  if (isFormData(data)) {
    return <FormDataDisplay data={data} label={label} />;
  }

  const renderValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined)
      return <span className="text-muted-foreground">-</span>;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string" && isUrl(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <LinkIcon className="h-3 w-3" />
          <span className="truncate max-w-[200px]">{shortenUrl(value)}</span>
          <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
        </a>
      );
    }
    if (typeof value === "object") {
      return (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return String(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="border-b last:border-0 pb-2 last:pb-0">
            <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</div>
            <div className="text-sm">{renderValue(value)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatAddressDisplay(address?: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string | null;
}): string {
  if (!address) return "—";
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.postalCode,
    address.state,
    address.country,
  ].filter((part) => part && part.trim() !== "");
  return parts.length > 0 ? parts.join(", ") : "—";
}

function getNestedValue(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function getFirstString(obj: unknown, paths: string[][]): string | null {
  for (const p of paths) {
    const v = getNestedValue(obj, p);
    const s = typeof v === "string" ? v.trim() : "";
    if (s) return s;
  }
  return null;
}

function formatRoleTitleCaseWithoutShare(roles: string[]): string {
  const cleaned = roles
    .map((r) => String(r || "").trim().toUpperCase())
    .filter(Boolean)
    .map((r) => r.replace(/^SHAREHOLDER$/, "Shareholder").replace(/^DIRECTOR$/, "Director"))
    .map((r) => (r === "Shareholder" || r === "Director" ? r : r.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())));
  const uniq = [...new Set(cleaned)];
  return uniq.length > 0 ? uniq.join(", ") : "—";
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

type AmlInfo = { status: string; riskLevel: string; riskScore: string };
type KycInfo = {
  status: string;
  governmentIdNumber: string;
  eodRequestId: string;
  shareholderEodRequestId: string;
  kycId: string;
};
type CorporateEntityInfo = {
  kycType: string;
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
    const riskScore =
      scoreRaw === null || scoreRaw === undefined
        ? ""
        : String(typeof scoreRaw === "number" ? scoreRaw : scoreRaw).trim();
    if (!status && !riskLevel && !riskScore) continue;
    const info: AmlInfo = {
      status: status || "",
      riskLevel,
      riskScore,
    };
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
    const status = String(r.kycStatus ?? r.status ?? "").trim();
    const info: KycInfo = {
      status,
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
      kycType: String(r.kycType ?? "").trim(),
      eodRequestId: String(r.eodRequestId ?? "").trim(),
      requestId: String(r.requestId ?? "").trim(),
      frontDocumentUrl: String(documents?.frontDocumentUrl ?? "").trim(),
      backDocumentUrl: String(documents?.backDocumentUrl ?? "").trim(),
    });
  }
  return byGov;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const portal = params.portal as PortalType;
  const organizationId = params.id as string;

  const { data: org, isLoading, error } = useOrganizationDetail(portal, organizationId);
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();

  const ctosReportsQuery = useQuery<AdminCtosReportListItem[]>({
    queryKey: ["admin", "organization-ctos-reports-inline", portal, organizationId],
    queryFn: async () => {
      const res = await apiClient.listAdminOrganizationCtosSubjectReports(
        portal as "issuer" | "investor",
        organizationId
      );
      if (!res.success) throw new Error(formatApiErrorMessage(res.error));
      return res.data;
    },
    enabled: Boolean(organizationId && (portal === "issuer" || portal === "investor")),
  });

  const [ctosFetchSubjectKey, setCtosFetchSubjectKey] = React.useState<string | null>(null);
  const [pendingCtosSubjectFetch, setPendingCtosSubjectFetch] = React.useState<PendingCtosSubjectFetch | null>(null);

  const fetchSubjectCtosMutation = useMutation({
    mutationFn: async (input: {
      subjectRef: string;
      subjectKind: "INDIVIDUAL" | "CORPORATE";
      displayName?: string;
      idNumber?: string;
    }) => {
      const idNumber = String(input.idNumber ?? "").trim();
      const displayName = String(input.displayName ?? "").trim();
      const res = await apiClient.createAdminOrganizationCtosSubjectReport(
        portal as "issuer" | "investor",
        organizationId,
        {
          subjectRef: input.subjectRef,
          subjectKind: input.subjectKind,
          enquiryOverride: idNumber && displayName ? { displayName, idNumber } : undefined,
        }
      );
      if (!res.success) throw new Error(formatApiErrorMessage(res.error));
      return res.data;
    },
    onMutate: (input) => {
      setCtosFetchSubjectKey(normalizeDirectorShareholderIdKey(input.subjectRef));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "organization-ctos-reports-inline", portal, organizationId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "organization-ctos-reports", portal, organizationId] });
      toast.success("CTOS subject report saved.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "CTOS subject request failed");
    },
    onSettled: () => {
      setCtosFetchSubjectKey(null);
    },
  });
  const notifyActionRequiredMutation = useMutation({
    mutationFn: async (input: { partyKey: string }) => {
      const res = await apiClient.notifyIssuerDirectorShareholderActionRequired(
        organizationId,
        input
      );
      if (!res.success) throw new Error(formatApiErrorMessage(res.error));
      return res.data;
    },
    onSuccess: () => {
      toast.success("Notify sent to issuer.");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Notify failed");
    },
  });
  const updateSophisticatedMutation = useUpdateSophisticatedStatus();
  const [showSophisticatedDialog, setShowSophisticatedDialog] = React.useState(false);
  const [pendingSophisticatedStatus, setPendingSophisticatedStatus] = React.useState<boolean | null>(null);
  const [sophisticatedReason, setSophisticatedReason] = React.useState("");

  const handleSophisticatedToggle = (checked: boolean) => {
    if (!organizationId) return;
    setPendingSophisticatedStatus(checked);
    setSophisticatedReason("");
    setShowSophisticatedDialog(true);
  };

  const handleConfirmSophisticatedChange = () => {
    if (!organizationId || pendingSophisticatedStatus === null || !sophisticatedReason.trim()) return;
    updateSophisticatedMutation.mutate(
      {
        organizationId,
        isSophisticatedInvestor: pendingSophisticatedStatus,
        reason: sophisticatedReason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(
            pendingSophisticatedStatus
              ? "Marked as sophisticated investor"
              : "Removed sophisticated investor status"
          );
          setShowSophisticatedDialog(false);
          setPendingSophisticatedStatus(null);
          setSophisticatedReason("");
        },
        onError: (err) => {
          toast.error(`Failed to update status: ${err.message}`);
        },
      }
    );
  };

  const handleCancelSophisticatedChange = () => {
    setShowSophisticatedDialog(false);
    setPendingSophisticatedStatus(null);
    setSophisticatedReason("");
  };

  const displayName = React.useMemo(() => {
    if (!org) return "";
    if (org.type === "COMPANY") return org.name || "Unnamed Company";
    return org.firstName && org.lastName
      ? `${org.firstName} ${org.lastName}`
      : `${org.owner.firstName} ${org.owner.lastName}`;
  }, [org]);

  const openSubjectReportHtml = React.useCallback(
    async (reportId: string) => {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = `${API_URL}/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-reports/${reportId}/html`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        toast.error("Could not load report");
        return;
      }
      const html = await res.text();
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    },
    [getAccessToken, organizationId, portal]
  );

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/organizations")}
          className="gap-1.5 -ml-1"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Organizations
        </Button>
        <Separator orientation="vertical" className="mx-2 h-4" />
        <h1 className="text-lg font-semibold truncate">
          {isLoading ? "Loading..." : displayName}
        </h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content (~67%) */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-8 space-y-6">
            {isLoading && <PageSkeleton />}

            {error && (
              <div className="py-8 text-center text-destructive">
                Error loading organization:{" "}
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            )}

            {org && (
              <>
                {/* Header Card — includes status, dates, sophisticated toggle */}
                <Card className="rounded-2xl">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                          {org.type === "COMPANY" ? (
                            <BuildingOffice2Icon className="h-6 w-6 text-primary" />
                          ) : (
                            <UserIcon className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{displayName}</h2>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={
                                portal === "investor"
                                  ? "border-primary/30 text-primary text-xs"
                                  : "border-accent/30 text-accent text-xs"
                              }
                            >
                              {org.portal.charAt(0).toUpperCase() + org.portal.slice(1)}
                            </Badge>
                            {org.type === "COMPANY" ? (
                              <Badge variant="outline" className="border-blue-500/30 text-foreground bg-blue-500/10 text-xs">
                                <BuildingOffice2Icon className="h-3 w-3 mr-1 text-blue-600" />
                                Company
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-slate-500/30 text-foreground bg-slate-500/10 text-xs">
                                <UserIcon className="h-3 w-3 mr-1 text-slate-600" />
                                Personal
                              </Badge>
                            )}
                            {org.onboardingStatus === "COMPLETED" ? (
                              <Badge className="bg-emerald-500 text-white text-xs">
                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                Onboarded
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <ClockIcon className="h-3 w-3 mr-1" />
                                {org.onboardingStatus}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {portal === "investor" && (
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground whitespace-nowrap">Sophisticated Investor</div>
                            <Switch
                              checked={org.isSophisticatedInvestor}
                              onCheckedChange={handleSophisticatedToggle}
                              disabled={updateSophisticatedMutation.isPending}
                            />
                            {org.isSophisticatedInvestor ? (
                              <Badge className="bg-violet-500 text-white text-xs">
                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                Yes
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-xs">
                                No
                              </Badge>
                            )}
                          </div>
                        )}
                        {org.regtankPortalUrl && (
                          <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <a href={org.regtankPortalUrl} target="_blank" rel="noopener noreferrer">
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              Open in RegTank
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Dates row */}
                    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                      <DetailRow
                        label="Onboarded At"
                        value={org.onboardedAt ? format(new Date(org.onboardedAt), "PPpp") : null}
                        icon={CheckCircleIcon}
                      />
                      <DetailRow label="Created" value={format(new Date(org.createdAt), "PPpp")} icon={ClockIcon} />
                      <DetailRow label="Updated" value={format(new Date(org.updatedAt), "PPpp")} icon={ClockIcon} />
                    </div>

                    {portal === "investor" && org.sophisticatedInvestorReason && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Sophisticated Reason:</span> {org.sophisticatedInvestorReason}
                      </p>
                    )}

                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-mono">
                        ID: {org.id}
                      </p>
                      {org.type === "COMPANY" && org.codRequestId && (
                        <p className="text-xs text-muted-foreground font-mono">
                          COD: {org.codRequestId}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Applications (issuer only) */}
                {org.applications && org.applications.length > 0 && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4" />
                        Applications ({org.applications.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="divide-y">
                        {org.applications.map((app) => (
                          <div
                            key={app.id}
                            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge
                                variant="outline"
                                className={
                                  app.status === "APPROVED"
                                    ? "border-emerald-500/30 text-foreground bg-emerald-500/10 text-xs"
                                    : app.status === "SUBMITTED"
                                      ? "border-blue-500/30 text-foreground bg-blue-500/10 text-xs"
                                      : app.status === "REJECTED"
                                        ? "border-red-500/30 text-foreground bg-red-500/10 text-xs"
                                        : app.status === "ARCHIVED"
                                          ? "border-slate-500/30 text-foreground bg-slate-500/10 text-xs"
                                          : "border-amber-500/30 text-foreground bg-amber-500/10 text-xs"
                                }
                              >
                                {app.status === "DRAFT" && <ClockIcon className="h-3 w-3 mr-1 text-amber-600" />}
                                {app.status === "SUBMITTED" && <DocumentTextIcon className="h-3 w-3 mr-1 text-blue-600" />}
                                {app.status === "APPROVED" && <CheckCircleIcon className="h-3 w-3 mr-1 text-emerald-600" />}
                                {app.status === "REJECTED" && <ExclamationTriangleIcon className="h-3 w-3 mr-1 text-red-600" />}
                                {app.status === "ARCHIVED" && <DocumentTextIcon className="h-3 w-3 mr-1 text-slate-600" />}
                                {app.status.charAt(0) + app.status.slice(1).toLowerCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono truncate">
                                {app.id}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                              {app.submittedAt && (
                                <span title={format(new Date(app.submittedAt), "PPpp")}>
                                  Submitted {format(new Date(app.submittedAt), "MMM d, yyyy")}
                                </span>
                              )}
                              {!app.submittedAt && (
                                <span title={format(new Date(app.createdAt), "PPpp")}>
                                  Created {format(new Date(app.createdAt), "MMM d, yyyy")}
                                </span>
                              )}
                              {app.contractId && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                  Has Contract
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Members + Company Info (or just Members for personal) */}
                <div className={org.type === "COMPANY" ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}>
                  {/* Members */}
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <UsersIcon className="h-4 w-4" />
                        Members ({org.members.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {org.members.length > 0 ? (
                        <div className="space-y-3">
                          {org.members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                  <UserIcon className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium">
                                    {member.firstName} {member.lastName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{member.email}</div>
                                </div>
                              </div>
                              <Badge variant="outline" className="capitalize">
                                {member.role.toLowerCase()}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No members found</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Company Info (for COMPANY type) */}
                  {org.type === "COMPANY" && (
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <BuildingOffice2Icon className="h-4 w-4" />
                          Company Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <DetailRow label="Company Name" value={org.name} />
                          <DetailRow
                            label="Registration Number (SSM)"
                            value={org.registrationNumber || org.corporateOnboardingData?.basicInfo?.ssmRegisterNumber}
                          />
                          {org.corporateOnboardingData?.basicInfo?.tinNumber && (
                            <DetailRow label="TIN Number" value={org.corporateOnboardingData.basicInfo.tinNumber} />
                          )}
                          {org.corporateOnboardingData?.basicInfo?.industry && (
                            <DetailRow label="Industry" value={org.corporateOnboardingData.basicInfo.industry} />
                          )}
                          {org.corporateOnboardingData?.basicInfo?.entityType && (
                            <DetailRow label="Entity Type" value={org.corporateOnboardingData.basicInfo.entityType} />
                          )}
                          {org.corporateOnboardingData?.basicInfo?.businessName && (
                            <DetailRow
                              label="Business Name"
                              value={org.corporateOnboardingData.basicInfo.businessName}
                            />
                          )}
                          {org.corporateOnboardingData?.basicInfo?.numberOfEmployees !== undefined && (
                            <DetailRow
                              label="Number of Employees"
                              value={org.corporateOnboardingData.basicInfo.numberOfEmployees?.toString()}
                            />
                          )}
                          {org.corporateOnboardingData?.basicInfo?.annualRevenue && (
                            <DetailRow
                              label="Annual Revenue (RM)"
                              value={org.corporateOnboardingData.basicInfo.annualRevenue}
                            />
                          )}
                          {org.corporateOnboardingData?.basicInfo?.website && (
                            <DetailRow
                              label="Website"
                              value={
                                isUrl(org.corporateOnboardingData.basicInfo.website)
                                  ? (
                                    <a
                                      href={org.corporateOnboardingData.basicInfo.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-primary hover:underline"
                                    >
                                      <LinkIcon className="h-3.5 w-3.5" />
                                      <span>{shortenUrl(org.corporateOnboardingData.basicInfo.website)}</span>
                                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                    </a>
                                  )
                                  : org.corporateOnboardingData.basicInfo.website
                              }
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Addresses (for COMPANY type) */}
                {org.type === "COMPANY" &&
                  (org.corporateOnboardingData?.addresses?.business ||
                    org.corporateOnboardingData?.addresses?.registered) && (
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <BuildingOffice2Icon className="h-4 w-4" />
                          Addresses
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {org.corporateOnboardingData?.addresses?.business && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Business Address</Label>
                              <p className="text-sm">
                                {formatAddressDisplay(org.corporateOnboardingData.addresses.business)}
                              </p>
                            </div>
                          )}
                          {org.corporateOnboardingData?.addresses?.registered && (
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Registered Address</Label>
                              <p className="text-sm">
                                {formatAddressDisplay(org.corporateOnboardingData.addresses.registered)}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Person in Charge (for COMPANY type) */}
                {org.type === "COMPANY" && org.corporateOnboardingData?.personInCharge && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        Person in Charge
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <DetailRow label="Name" value={org.corporateOnboardingData.personInCharge.name} />
                        <DetailRow label="Position" value={org.corporateOnboardingData.personInCharge.position} />
                        <CopyableField label="Email" value={org.corporateOnboardingData.personInCharge.email || null} />
                        <CopyableField
                          label="Contact Number"
                          value={org.corporateOnboardingData.personInCharge.contactNumber || null}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Personal Details + Contact — 2-col only when both exist */}
                {(() => {
                  const hasPersonal = !!(org.firstName || org.lastName || org.nationality || org.dateOfBirth);
                  const hasContact = !!(org.phoneNumber || org.address || org.owner.email);
                  const useGrid = hasPersonal && hasContact;

                  return (
                    <div className={useGrid ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-6"}>
                      {hasPersonal && (
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <IdentificationIcon className="h-4 w-4" />
                              Personal Details (KYC)
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              <DetailRow label="First Name" value={org.firstName} />
                              <DetailRow label="Last Name" value={org.lastName} />
                              <DetailRow label="Middle Name" value={org.middleName} />
                              <DetailRow label="Gender" value={org.gender} />
                              <DetailRow
                                label="Date of Birth"
                                value={org.dateOfBirth ? format(new Date(org.dateOfBirth), "PP") : null}
                              />
                              <DetailRow label="Nationality" value={org.nationality} />
                              <DetailRow label="Country" value={org.country} />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {hasContact && (
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <PhoneIcon className="h-4 w-4" />
                              Contact Details
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              {org.phoneNumber && (
                                <CopyableField label="Phone Number" value={org.phoneNumber} />
                              )}
                              {org.owner.email && (
                                <CopyableField label="Email" value={org.owner.email} />
                              )}
                              {org.address && (
                                <div className="col-span-2">
                                  <CopyableField label="Address" value={org.address} />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  );
                })()}

                {/* Document Info — standalone, no grid wrapper when company info isn't beside it */}
                {(org.documentType || org.documentNumber || org.idIssuingCountry || org.kycId) && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4" />
                        Document Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <DetailRow label="Document Type" value={org.documentType} />
                        <CopyableField
                          label="Document Number"
                          value={org.documentNumber}
                        />
                        <DetailRow label="ID Issuing Country" value={org.idIssuingCountry} />
                        <CopyableField label="KYC ID" value={org.kycId} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {org.type === "COMPANY" && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <UsersIcon className="h-4 w-4" />
                          Directors and Shareholders
                        </CardTitle>
                        {null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const rows = filterVisiblePeopleRows(org.people ?? []);
                        const supplementsByKey = new Map<string, Record<string, unknown>>();
                        for (const row of org.ctosPartySupplements ?? []) {
                          const key = normalizeDirectorShareholderIdKey(row.partyKey);
                          if (!key) continue;
                          const json =
                            row.onboardingJson &&
                            typeof row.onboardingJson === "object" &&
                            !Array.isArray(row.onboardingJson)
                              ? (row.onboardingJson as Record<string, unknown>)
                              : {};
                          supplementsByKey.set(key, json);
                        }
                        const amlLookup = buildAmlLookup(org.directorAmlStatus);
                        const kycLookup = buildKycLookup(org.directorKycStatus);
                        const entitiesByGov = buildCorporateEntityByGovernmentId(org.corporateEntities);

                        if (rows.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              No director or shareholder data.
                            </p>
                          );
                        }
                        return (
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
                                  const onboarding = getEffectiveCtosPartyOnboarding(supplement);
                                  const screening = getEffectiveCtosPartyScreening(supplement);
                                  const entity = key ? entitiesByGov.get(key) : undefined;

                                  const rowRefKey = ctosSubjectRefKey(p.matchKey);
                                  const kycInfo =
                                    (key ? kycLookup.byGov.get(key) : undefined) ||
                                    kycLookup.byEod.get(rowRefKey) ||
                                    kycLookup.byKycId.get(rowRefKey);
                                  const amlInfo =
                                    (key ? amlLookup.byGov.get(key) : undefined) ||
                                    (kycInfo?.kycId ? amlLookup.byKycId.get(kycInfo.kycId) : undefined) ||
                                    (kycInfo?.eodRequestId ? amlLookup.byEod.get(kycInfo.eodRequestId) : undefined) ||
                                    (kycInfo?.shareholderEodRequestId
                                      ? amlLookup.byEod.get(kycInfo.shareholderEodRequestId)
                                      : undefined);
                                  const amlFallback = String(amlInfo?.status ?? "").trim();
                                  const kycFallback = kycInfo?.status || "";
                                  const onboardingStatus =
                                    String(onboarding.status ?? onboarding.regtankStatus ?? "").trim();
                                  const fallbackRequestId =
                                    String(
                                      onboarding.requestId ??
                                        onboarding.eodRequestId ??
                                        kycInfo?.eodRequestId ??
                                        entity?.eodRequestId ??
                                        entity?.requestId ??
                                        screening.requestId ??
                                        ""
                                    ).trim() ||
                                    "—";
                                  const eodForRegtankLink = firstEodId(
                                    kycInfo?.eodRequestId,
                                    kycInfo?.shareholderEodRequestId,
                                    String(onboarding.eodRequestId ?? "").trim() || undefined,
                                    fallbackRequestId !== "—" ? fallbackRequestId : undefined
                                  );
                                  const codForRegtankLink = String(org.codRequestId ?? "").trim();
                                  const requestId =
                                    eodForRegtankLink ||
                                    String(kycInfo?.kycId ?? "").trim() ||
                                    fallbackRequestId;
                                  const icFront = entity?.frontDocumentUrl || getFirstString(supplement, [
                                    ["identityDocument", "frontUrl"],
                                    ["identityDocument", "frontImageUrl"],
                                    ["documents", "idFrontUrl"],
                                    ["documents", "identityFrontUrl"],
                                    ["icFrontUrl"],
                                    ["frontIcUrl"],
                                    ["idFrontUrl"],
                                    ["frontImageUrl"],
                                  ]) || "—";
                                  const icBack = entity?.backDocumentUrl || getFirstString(supplement, [
                                    ["identityDocument", "backUrl"],
                                    ["identityDocument", "backImageUrl"],
                                    ["documents", "idBackUrl"],
                                    ["documents", "identityBackUrl"],
                                    ["icBackUrl"],
                                    ["backIcUrl"],
                                    ["idBackUrl"],
                                    ["backImageUrl"],
                                  ]) || "—";
                                  const subjectIdNumber =
                                    (p.entityType !== "CORPORATE" && kycInfo?.governmentIdNumber
                                      ? kycInfo.governmentIdNumber
                                      : "") ||
                                    (!looksLikeRequestId(p.matchKey) ? String(p.matchKey ?? "").trim() : "") ||
                                    "";

                                  const displayStatus = getDisplayStatus({
                                    screening: p.screening,
                                    directorAmlStatus: amlFallback || null,
                                    directorKycStatus: kycFallback || null,
                                    onboarding: { status: onboardingStatus || null },
                                  });
                                  console.log("DS person", {
                                    matchKey: p.matchKey,
                                    screening: p.screening?.status,
                                    aml: p.directorAmlStatus,
                                    kyc: p.directorKycStatus,
                                    onboarding: p.onboarding?.status,
                                  });
                                  const regtankBase =
                                    resolveRegtankPortalBase(org.regtankPortalUrl) ||
                                    resolveRegtankPortalBase(REGTANK_PORTAL_BASE_URL);
                                  const requestUrl =
                                    regtankOnboardingCorporatePartyUrl(
                                      regtankBase,
                                      codForRegtankLink,
                                      eodForRegtankLink
                                    ) ??
                                    regtankResultUrl(
                                      regtankBase,
                                      eodForRegtankLink ||
                                        String(kycInfo?.kycId ?? "").trim() ||
                                        (fallbackRequestId !== "—" ? fallbackRequestId : ""),
                                      p.entityType === "CORPORATE" || requestId.toUpperCase().startsWith("COD")
                                        ? "company"
                                        : "individual"
                                    );
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
                                  const latestSubjectReport = (ctosReportsQuery.data ?? [])
                                    .filter((r) => !!r.subject_ref)
                                    .filter((r) =>
                                      subjectRefCandidates.some((c) => ctosSubjectRefsMatch(c, r.subject_ref))
                                    )
                                    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0];
                                  console.log("Admin org people row CTOS match:", {
                                    matchKey: p.matchKey,
                                    subject_ref_in_db: latestSubjectReport?.subject_ref,
                                    report_id: latestSubjectReport?.id,
                                    has_html: latestSubjectReport?.has_report_html,
                                  });
                                  const timestamp = latestSubjectReport?.fetched_at
                                    ? format(new Date(latestSubjectReport.fetched_at), "PPpp")
                                    : "—";
                                  const riskLevel =
                                    String(amlInfo?.riskLevel ?? "").trim() ||
                                    String(amlInfo?.riskScore ?? "").trim() ||
                                    String(screening.riskLevel ?? "").trim() ||
                                    "—";
                                  console.log("Admin org people row AML risk:", {
                                    matchKey: p.matchKey,
                                    kycId: kycInfo?.kycId,
                                    amlRiskLevel: amlInfo?.riskLevel,
                                    amlRiskScore: amlInfo?.riskScore,
                                  });

                                  return (
                                    <TableRow key={p.matchKey}>
                                      <TableCell className="font-medium">
                                        <div>{p.name ?? "—"}</div>
                                        <div className="font-mono text-xs text-muted-foreground mt-0.5">{p.matchKey}</div>
                                      </TableCell>
                                      <TableCell>{formatRoleTitleCaseWithoutShare(p.roles ?? [])}</TableCell>
                                      <TableCell>{formatSharePercentageCell(p)}</TableCell>
                                      <TableCell>
                                        {displayStatus ? (
                                          <Badge
                                            variant="outline"
                                            className={`border-transparent text-[11px] font-normal ${regtankDisplayStatusBadgeClass(String(displayStatus))}`}
                                          >
                                            {displayStatus}
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
                                          <a
                                            href={icFront}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                          >
                                            View
                                          </a>
                                        ) : (
                                          "—"
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {icBack !== "—" && isUrl(icBack) ? (
                                          <a
                                            href={icBack}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                          >
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
                                            disabled={
                                              fetchSubjectCtosMutation.isPending &&
                                              ctosFetchSubjectKey === normalizeDirectorShareholderIdKey(p.matchKey)
                                            }
                                          >
                                            {fetchSubjectCtosMutation.isPending &&
                                            ctosFetchSubjectKey === normalizeDirectorShareholderIdKey(p.matchKey)
                                              ? "Fetching..."
                                              : "Fetch"}
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8"
                                            onClick={() => latestSubjectReport?.id && void openSubjectReportHtml(latestSubjectReport.id)}
                                            disabled={!latestSubjectReport?.id}
                                          >
                                            View Last
                                          </Button>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {isNotifyEligible(p) ? (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8"
                                            disabled={
                                              portal !== "issuer" ||
                                              notifyActionRequiredMutation.isPending
                                            }
                                            onClick={() => {
                                              notifyActionRequiredMutation.mutate({
                                                partyKey: p.matchKey,
                                              });
                                            }}
                                          >
                                            Notify
                                          </Button>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* Corporate Required Documents (COMPANY only) */}
                {org.type === "COMPANY" &&
                  org.corporateRequiredDocuments &&
                  Array.isArray(org.corporateRequiredDocuments) &&
                  org.corporateRequiredDocuments.length > 0 && (
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <DocumentTextIcon className="h-4 w-4" />
                          Corporate Required Documents
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {(org.corporateRequiredDocuments as Record<string, unknown>[]).map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{String(doc.fieldName || doc.fileName || `Document ${idx + 1}`)}</p>
                                {typeof doc.fileType === "string" && (
                                  <p className="text-xs text-muted-foreground">{doc.fileType}</p>
                                )}
                              </div>
                              {typeof doc.url === "string" && (
                                <Button variant="outline" size="sm" asChild className="gap-1.5 shrink-0">
                                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                    View
                                  </a>
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Extended data cards — no heading, just flowing cards */}
                {(() => {
                  // Compliance Declaration always full width (lots of text)
                  const fullWidthCards = [
                    { data: org.complianceDeclaration, icon: ShieldCheckIcon, label: "Compliance Declaration" },
                  ].filter((c) => c.data && Object.keys(c.data as Record<string, unknown>).length > 0);

                  const pairableCards = [
                    { data: org.bankAccountDetails, icon: BanknotesIcon, label: "Bank Account Details" },
                    { data: org.wealthDeclaration, icon: DocumentTextIcon, label: "Wealth Declaration" },
                    { data: org.documentInfo, icon: DocumentTextIcon, label: "Document Info" },
                    { data: org.livenessCheckInfo, icon: FaceSmileIcon, label: "Liveness Check Info" },
                  ].filter((c) => c.data && Object.keys(c.data as Record<string, unknown>).length > 0);

                  if (fullWidthCards.length === 0 && pairableCards.length === 0) return null;

                  // Pair cards into rows of 2, last odd one gets full width
                  const rows: typeof pairableCards[] = [];
                  for (let i = 0; i < pairableCards.length; i += 2) {
                    rows.push(pairableCards.slice(i, i + 2));
                  }

                  return (
                    <>
                      {rows.map((row, rowIdx) => (
                        <div
                          key={rowIdx}
                          className={row.length === 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}
                        >
                          {row.map((card) => (
                            <JsonDisplay
                              key={card.label}
                              data={card.data as Record<string, unknown>}
                              label={
                                <span className="flex items-center gap-2">
                                  <card.icon className="h-4 w-4" />
                                  {card.label}
                                </span>
                              }
                            />
                          ))}
                        </div>
                      ))}
                      {fullWidthCards.map((card) => (
                        <JsonDisplay
                          key={card.label}
                          data={card.data as Record<string, unknown>}
                          label={
                            <span className="flex items-center gap-2">
                              <card.icon className="h-4 w-4" />
                              {card.label}
                            </span>
                          }
                        />
                      ))}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* Right Sidebar — KYC/AML, CTOS history (issuer / investor), Activity Timeline (~33%) */}
        <div className="w-[380px] xl:w-[420px] shrink-0 hidden lg:flex flex-col overflow-hidden py-8 pr-4 gap-4">
          {org?.kycResponse && <KycResponseDisplay data={org.kycResponse} />}
          {(portal === "issuer" || portal === "investor") && organizationId ? (
            <OrganizationIssuerCtosReportsCard organizationId={organizationId} portal={portal} />
          ) : null}
          <div className="flex-1 min-h-0">
            <OrganizationActivityTimeline organizationId={organizationId} />
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingCtosSubjectFetch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCtosSubjectFetch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fetch CTOS subject report?</AlertDialogTitle>
            <AlertDialogDescription>
              This requests a new CTOS report for{" "}
              <span className="font-medium text-foreground">
                {pendingCtosSubjectFetch?.partyLabel ?? "this party"}
              </span>
              . Charges or provider limits may apply. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                const payload = pendingCtosSubjectFetch;
                if (!payload) return;
                setPendingCtosSubjectFetch(null);
                console.log("Confirm CTOS subject fetch:", {
                  subjectRef: payload.subjectRef,
                  displayName: payload.displayName,
                  idNumber: payload.idNumber ?? "(server resolve)",
                });
                fetchSubjectCtosMutation.mutate({
                  subjectRef: payload.subjectRef,
                  subjectKind: payload.subjectKind,
                  displayName: payload.displayName,
                  idNumber: payload.idNumber,
                });
              }}
              disabled={fetchSubjectCtosMutation.isPending}
            >
              {fetchSubjectCtosMutation.isPending ? "Fetching..." : "Fetch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog for sophisticated investor status change */}
      <AlertDialog open={showSophisticatedDialog} onOpenChange={setShowSophisticatedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSophisticatedStatus
                ? "Mark as Sophisticated Investor"
                : "Remove Sophisticated Investor Status"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSophisticatedStatus
                ? "Please provide a reason for granting sophisticated investor status to this organization."
                : "Please provide a reason for removing sophisticated investor status from this organization."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="sophisticated-reason" className="text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="sophisticated-reason"
              placeholder={
                pendingSophisticatedStatus
                  ? "e.g., Manual verification of net assets exceeding RM3,000,000"
                  : "e.g., Re-evaluation of investor classification"
              }
              value={sophisticatedReason}
              onChange={(e) => setSophisticatedReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
            {sophisticatedReason.trim() === "" && (
              <p className="text-xs text-muted-foreground mt-1">Reason is required to proceed.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSophisticatedChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSophisticatedChange}
              disabled={!sophisticatedReason.trim() || updateSophisticatedMutation.isPending}
            >
              {updateSophisticatedMutation.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
