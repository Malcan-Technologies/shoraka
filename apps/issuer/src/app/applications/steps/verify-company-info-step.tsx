"use client";

import * as React from "react";
import { useOrganization } from "@cashsouk/config";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import type { BankAccountDetails } from "@cashsouk/config";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

function getBankField(
  bankDetails: BankAccountDetails | null | undefined,
  fieldName: string
): string {
  if (!bankDetails?.content) return "";
  const field = bankDetails.content.find((f) => f.fieldName === fieldName);
  return field?.fieldValue || "";
}

function formatAddress(addr: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string | null;
} | null | undefined): string {
  if (!addr) return "—";
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.postalCode,
    addr.state,
    addr.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function formatOwnership(role: string | null | undefined): string {
  if (!role) return "—";
  const match = role.match(/\((\d+)%\)/);
  if (match) {
    return `${match[1]}% ownership`;
  }
  return "—";
}

function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "Director";
  const beforeParen = role.split("(")[0].trim();
  return beforeParen || "Director";
}

interface VerifyCompanyInfoStepProps {
  onDataChange?: (data: unknown) => void;
}

const inputClassName = "bg-muted rounded-xl border border-border";
const labelClassName = "text-sm md:text-base leading-6 text-muted-foreground";
const sectionHeaderClassName = "text-lg md:text-xl font-semibold";
const gridClassName = "grid grid-cols-2 gap-6 mt-4 pl-4 md:pl-6";
const sectionGridClassName = "grid grid-cols-2 gap-6 mt-6 pl-4 md:pl-6";

export function VerifyCompanyInfoStep(_props: VerifyCompanyInfoStepProps) {
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id;

  const {
    corporateInfo,
    bankAccountDetails,
    firstName,
    middleName,
    lastName,
    documentNumber,
    phoneNumber,
    isLoading: isLoadingInfo,
  } = useCorporateInfo(organizationId);
  const { data: entitiesData, isLoading: isLoadingEntities } = useCorporateEntities(organizationId);
  const isLoading = isLoadingInfo || isLoadingEntities;
  const normalizeName = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
  };

  const directorKycStatus = entitiesData?.directorKycStatus ?? null;
  const directorsFromKyc = directorKycStatus?.directors ?? [];
  const shareholdersDisplay = entitiesData?.shareholdersDisplay ?? [];
  
  const combinedList = React.useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{
      type: "director" | "shareholder";
      name: string;
      roleLabel: string;
      ownership: string;
      kycStatus: boolean;
      key: string;
    }> = [];

    directorsFromKyc.forEach((d) => {
      const normalized = normalizeName(d.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push({
          type: "director",
          name: d.name,
          roleLabel: getRoleLabel(d.role),
          ownership: formatOwnership(d.role),
          kycStatus: d.kycStatus === "APPROVED",
          key: `dir-${normalized}`,
        });
      }
    });

    shareholdersDisplay.forEach((s) => {
      const normalized = normalizeName(s.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push({
          type: "shareholder",
          name: s.name,
          roleLabel: "Shareholder",
          ownership: s.ownershipLabel,
          kycStatus: s.kycVerified,
          key: `sh-${normalized}`,
        });
      }
    });

    return result;
  }, [directorsFromKyc, shareholdersDisplay]);

  const hasDirectorsOrShareholders = combinedList.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="space-y-4">
          <div>
            <h3 className={sectionHeaderClassName}>Company info</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={gridClassName}>
            <div className={labelClassName}>Company name</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Type of entity</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>SSM no</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Industry</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Nature of business</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Number of employees</div>
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className={sectionHeaderClassName}>Address</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={sectionGridClassName}>
            <div className={labelClassName}>Business address</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Registered address</div>
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-semibold text-xl">Director & Shareholders</h3>
          </div>
          <div className={sectionGridClassName}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 rounded" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 rounded" />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className={sectionHeaderClassName}>Banking details</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={gridClassName}>
            <div className={labelClassName}>Bank name</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Bank account number</div>
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className={sectionHeaderClassName}>Contact Person</h3>
            <div className="mt-2 h-px bg-border" />
          </div>
          <div className={gridClassName}>
            <div className={labelClassName}>Applicant name</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Applicant IC no</div>
            <Skeleton className="h-10 rounded-xl" />
            <div className={labelClassName}>Applicant contact</div>
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Please select an organization to continue.
      </div>
    );
  }

  const basicInfo = corporateInfo?.basicInfo;
  const businessAddress = corporateInfo?.addresses?.business;
  const registeredAddress = corporateInfo?.addresses?.registered;
  const bankName = getBankField(bankAccountDetails, "Bank");
  const accountNumber = getBankField(bankAccountDetails, "Bank account number");
  const applicantName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim() || "—";
  const natureOfBusiness = (basicInfo as { natureOfBusiness?: string })?.natureOfBusiness || "—";

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Company info</h3>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={gridClassName}>
          <div className={labelClassName}>Company name</div>
          <Input
            value={basicInfo?.businessName || "—"}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Type of entity</div>
          <Input
            value={basicInfo?.entityType || "—"}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>SSM no</div>
          <Input
            value={basicInfo?.ssmRegisterNumber || "—"}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Industry</div>
          <Input
            value={basicInfo?.industry || "—"}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Nature of business</div>
          <Input
            value={natureOfBusiness}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Number of employees</div>
          <Input
            value={basicInfo?.numberOfEmployees?.toString() || "—"}
            disabled
            className={inputClassName}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Address</h3>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={sectionGridClassName}>
          <div className={labelClassName}>Business address</div>
          <Input
            value={formatAddress(businessAddress)}
            disabled
            className={inputClassName}
          />
          <div className={labelClassName}>Registered address</div>
          <Input
            value={formatAddress(registeredAddress)}
            disabled
            className={inputClassName}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="font-semibold text-xl">Director & Shareholders</h3>
        </div>
        <div className={sectionGridClassName}>
          {!hasDirectorsOrShareholders ? (
            <p className="text-[17px] leading-7 text-muted-foreground col-span-2">No directors or shareholders found</p>
          ) : (
            <>
              {combinedList.map((item) => (
                <React.Fragment key={item.key}>
                  <div className="text-[17px] leading-7 text-muted-foreground">{item.roleLabel}</div>
                  <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                    <div className="text-[17px] leading-7 font-medium whitespace-nowrap">{item.name}</div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-[17px] leading-7 text-muted-foreground whitespace-nowrap">{item.ownership}</div>
                    <div className="h-4 w-px bg-border" />
                    {item.kycStatus ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        <span className="text-[17px] leading-7 text-green-600">KYC</span>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                </React.Fragment>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Banking details</h3>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={gridClassName}>
          <div className={labelClassName}>Bank name</div>
          <Input value={bankName || "—"} disabled className={inputClassName} />
          <div className={labelClassName}>Bank account number</div>
          <Input value={accountNumber || "—"} disabled className={inputClassName} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Contact Person</h3>
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className={gridClassName}>
          <div className={labelClassName}>Applicant name</div>
          <Input value={applicantName} disabled className={inputClassName} />
          <div className={labelClassName}>Applicant IC no</div>
          <Input value={documentNumber || "—"} disabled className={inputClassName} />
          <div className={labelClassName}>Applicant contact</div>
          <Input value={phoneNumber || "—"} disabled className={inputClassName} />
        </div>
      </div>
    </div>
  );
}
