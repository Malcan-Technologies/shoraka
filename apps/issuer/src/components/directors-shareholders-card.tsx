"use client";

import * as React from "react";
import {
  UserGroupIcon,
  UserIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

interface CorporateEntities {
  directors?: Array<Record<string, unknown>>;
  shareholders?: Array<Record<string, unknown>>;
  corporateShareholders?: Array<Record<string, unknown>>;
}

interface DirectorsShareholdersCardProps {
  corporateEntities: CorporateEntities;
}

export function DirectorsShareholdersCard({
  corporateEntities,
}: DirectorsShareholdersCardProps) {
  const directors = corporateEntities.directors || [];
  const shareholders = corporateEntities.shareholders || [];
  const corporateShareholders = corporateEntities.corporateShareholders || [];

  // Helper to extract name from director/shareholder
  const getName = (entity: Record<string, unknown>): string => {
    const personalInfo = entity.personalInfo as Record<string, unknown> | undefined;
    if (personalInfo?.fullName) return String(personalInfo.fullName);
    if (personalInfo?.firstName || personalInfo?.lastName) {
      return [
        personalInfo.firstName,
        personalInfo.middleName,
        personalInfo.lastName,
      ]
        .filter(Boolean)
        .join(" ");
    }
    return "—";
  };

  // Helper to extract email from director/shareholder
  const getEmail = (entity: Record<string, unknown>): string => {
    const personalInfo = entity.personalInfo as Record<string, unknown> | undefined;
    return personalInfo?.email ? String(personalInfo.email) : "—";
  };

  // Helper to extract designation/role from director
  const getDesignation = (entity: Record<string, unknown>): string => {
    const personalInfo = entity.personalInfo as Record<string, unknown> | undefined;
    const formContent = personalInfo?.formContent as
      | { content?: Array<{ fieldName?: string; fieldValue?: unknown }> }
      | undefined;
    if (formContent?.content) {
      const designationField = formContent.content.find(
        (f) => f.fieldName === "Designation"
      );
      if (designationField?.fieldValue) {
        return String(designationField.fieldValue);
      }
    }
    return "Director";
  };

  // Helper to extract share percentage from shareholder
  const getSharePercentage = (entity: Record<string, unknown>): string => {
    const personalInfo = entity.personalInfo as Record<string, unknown> | undefined;
    const formContent = personalInfo?.formContent as
      | { content?: Array<{ fieldName?: string; fieldValue?: unknown }> }
      | undefined;
    if (formContent?.content) {
      const shareField = formContent.content.find(
        (f) => f.fieldName === "% of Shares"
      );
      if (shareField?.fieldValue) {
        return String(shareField.fieldValue);
      }
    }
    return "";
  };

  // Helper to get corporate shareholder name
  const getCorporateShareholderName = (entity: Record<string, unknown>): string => {
    return (
      String(entity.companyName || entity.businessName || "—") ||
      "—"
    );
  };

  // Helper to get corporate shareholder share percentage
  const getCorporateSharePercentage = (entity: Record<string, unknown>): string => {
    const formContent = entity.formContent as
      | { displayAreas?: Array<{ content?: Array<{ fieldName?: string; fieldValue?: unknown }> }> }
      | undefined;
    if (formContent?.displayAreas) {
      for (const area of formContent.displayAreas) {
        if (area.content) {
          const shareField = area.content.find(
            (f) => f.fieldName === "% of Shares"
          );
          if (shareField?.fieldValue) {
            return String(shareField.fieldValue);
          }
        }
      }
    }
    return "";
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-lg font-semibold">Directors and Shareholders</h2>
          <p className="text-sm text-muted-foreground">
			Directors and shareholders details
          </p>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {/* Directors / Controllers / Authorised Personnel */}
        {directors.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">
                Directors / Controllers / Authorised Personnel
              </h3>
            </div>
            <div className="space-y-3">
              {directors.map((director, index) => {
                const name = getName(director);
                const email = getEmail(director);
                const designation = getDesignation(director);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{email}</p>
                      <p className="text-xs text-muted-foreground mt-1">{designation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Individual Shareholders / Ultimate Beneficiaries */}
        {shareholders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">
                Individual Shareholders / Ultimate Beneficiaries
              </h3>
            </div>
            <div className="space-y-3">
              {shareholders.map((shareholder, index) => {
                const name = getName(shareholder);
                const email = getEmail(shareholder);
                const sharePercent = getSharePercentage(shareholder);
                const role = sharePercent
                  ? `Shareholder (${sharePercent}%)`
                  : "Shareholder";
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{email}</p>
                      <p className="text-xs text-muted-foreground mt-1">{role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Business Shareholders / Beneficiaries */}
        {corporateShareholders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">
                Business Shareholders / Beneficiaries
              </h3>
            </div>
            <div className="space-y-3">
              {corporateShareholders.map((corpShareholder, index) => {
                const name = getCorporateShareholderName(corpShareholder);
                const sharePercent = getCorporateSharePercentage(corpShareholder);
                const role = sharePercent
                  ? `Shareholder (${sharePercent}%)`
                  : "Shareholder";
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Corporate shareholders/beneficiaries associated with your organization.
            </p>
          </div>
        )}

        {/* Empty state */}
        {directors.length === 0 &&
          shareholders.length === 0 &&
          corporateShareholders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No directors or shareholders information available.</p>
            </div>
          )}
      </div>
    </div>
  );
}
