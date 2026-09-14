"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/alert-dialog";
import { Button } from "../components/button";
import {
  incompleteCompanyOnboardingDescription,
  incompleteCompanyOnboardingTitle,
} from "./incomplete-company-onboarding-copy";

export {
  incompleteCompanyOnboardingDescription,
  incompleteCompanyOnboardingTitle,
} from "./incomplete-company-onboarding-copy";

export function IncompleteCompanyOnboardingDialog({
  open,
  companyName,
  onContinue,
  onCreateSeparate,
  onOpenChange,
  isSubmitting = false,
}: {
  open: boolean;
  companyName: string;
  onContinue: () => void;
  onCreateSeparate: () => void;
  onOpenChange: (open: boolean) => void;
  isSubmitting?: boolean;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <InformationCircleIcon className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle>{incompleteCompanyOnboardingTitle()}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 text-left">
            {incompleteCompanyOnboardingDescription(companyName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={isSubmitting}
            onClick={onCreateSeparate}
          >
            Create separate company
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={isSubmitting}
            onClick={onContinue}
          >
            Continue onboarding
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
