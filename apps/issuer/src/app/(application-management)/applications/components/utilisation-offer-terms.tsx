"use client";

import * as React from "react";
import {
  UTILISATION_FULL_AUTHORISATION_CLAUSES,
  UTILISATION_FULL_AUTHORISATION_CLOSE,
  UTILISATION_FULL_AUTHORISATION_CONFIRM,
  UTILISATION_FULL_AUTHORISATION_INTRO,
  UTILISATION_FULL_AUTHORISATION_CONFIRMED_LABEL,
  UTILISATION_FULL_AUTHORISATION_READ_AGAIN,
  UTILISATION_FULL_AUTHORISATION_READ_LINK,
  UTILISATION_FULL_AUTHORISATION_REQUIRED_HINT,
  UTILISATION_FULL_AUTHORISATION_TITLE,
  UTILISATION_OFFER_BINDING_FOOTER,
  UTILISATION_OFFER_CONSENTS,
  UTILISATION_OFFER_CONSENTS_INTRO,
  UTILISATION_OFFER_CONSENTS_TITLE,
  UTILISATION_OFFER_TERM_CLAUSES,
  UTILISATION_OFFER_TERMS_INTRO,
  UTILISATION_OFFER_TERMS_READ_LINK,
  UTILISATION_OFFER_TERMS_TITLE,
  confirmUtilisationFullAuthorisation,
  toggleUtilisationOfferConsent,
  type UtilisationOfferConsentId,
} from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UtilisationOfferTermsProps = {
  consentIds?: readonly string[];
  onConsentIdsChange?: (ids: UtilisationOfferConsentId[]) => void;
  showConsents?: boolean;
  consentsLocked?: boolean;
};

export function UtilisationOfferTerms({
  consentIds = [],
  onConsentIdsChange,
  showConsents = false,
  consentsLocked = false,
}: UtilisationOfferTermsProps) {
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [fullAuthorisationOpen, setFullAuthorisationOpen] = React.useState(false);
  const fullAuthorisationConfirmed = consentIds.includes("full_authorisation");

  return (
    <section className="space-y-4" aria-label={UTILISATION_OFFER_CONSENTS_TITLE}>
      <p>
        <button
          type="button"
          className="text-ui text-primary underline-offset-2 hover:underline"
          onClick={() => setTermsOpen(true)}
        >
          {UTILISATION_OFFER_TERMS_READ_LINK}
        </button>
      </p>
      {showConsents ? (
        <fieldset
          className="space-y-3 rounded-xl border border-border px-4 py-3"
          disabled={consentsLocked}
        >
          <legend className="text-ui font-medium text-foreground">{UTILISATION_OFFER_CONSENTS_TITLE}</legend>
          <p className="text-ui text-muted-foreground">{UTILISATION_OFFER_CONSENTS_INTRO}</p>
          <div className="space-y-4">
            {UTILISATION_OFFER_CONSENTS.map((consent) => {
              const checked = consentIds.includes(consent.id);
              return (
                <div key={consent.id} className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={checked}
                      disabled={consentsLocked}
                      onCheckedChange={(next) => {
                        if (consentsLocked) return;
                        onConsentIdsChange?.(
                          toggleUtilisationOfferConsent(consentIds, consent.id, next === true)
                        );
                      }}
                      className="mt-0.5 rounded-[4px]"
                    />
                    <span className="space-y-1">
                      <span className="block text-ui font-medium text-foreground">{consent.title}</span>
                      <span className="block text-ui text-muted-foreground">{consent.detail}</span>
                    </span>
                  </label>
                  {consent.hasFullAuthorisationLink ? (
                    <div
                      className={cn(
                        "ml-7 space-y-2 rounded-xl border px-3 py-3",
                        fullAuthorisationConfirmed
                          ? "border-border bg-muted/30"
                          : "border-status-action-text/30 bg-status-action-bg"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={fullAuthorisationConfirmed ? "Confirmed" : "Required"}
                          status={fullAuthorisationConfirmed ? "success" : "action"}
                          showDot={false}
                        />
                        <p
                          className={cn(
                            "text-ui",
                            fullAuthorisationConfirmed
                              ? "text-foreground"
                              : "font-medium text-status-action-text"
                          )}
                        >
                          {fullAuthorisationConfirmed
                            ? UTILISATION_FULL_AUTHORISATION_CONFIRMED_LABEL
                            : UTILISATION_FULL_AUTHORISATION_REQUIRED_HINT}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={fullAuthorisationConfirmed ? "outline" : "default"}
                        className="rounded-xl"
                        disabled={consentsLocked}
                        onClick={() => setFullAuthorisationOpen(true)}
                      >
                        {fullAuthorisationConfirmed
                          ? UTILISATION_FULL_AUTHORISATION_READ_AGAIN
                          : UTILISATION_FULL_AUTHORISATION_READ_LINK}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="text-ui text-muted-foreground">{UTILISATION_OFFER_BINDING_FOOTER}</p>
        </fieldset>
      ) : null}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{UTILISATION_OFFER_TERMS_TITLE}</DialogTitle>
            <DialogDescription className="text-ui text-muted-foreground">
              {UTILISATION_OFFER_TERMS_INTRO}
            </DialogDescription>
          </DialogHeader>
          <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {UTILISATION_OFFER_TERM_CLAUSES.map((clause, index) => (
              <li key={clause.title} className="space-y-1">
                <p className="text-ui font-medium text-foreground">
                  {index + 1}. {clause.title}
                </p>
                <p className="text-ui text-muted-foreground">{clause.body}</p>
              </li>
            ))}
          </ol>
          <DialogFooter>
            <Button type="button" className="rounded-xl" onClick={() => setTermsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={fullAuthorisationOpen} onOpenChange={setFullAuthorisationOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{UTILISATION_FULL_AUTHORISATION_TITLE}</DialogTitle>
            <DialogDescription className="text-ui text-muted-foreground">
              {UTILISATION_FULL_AUTHORISATION_INTRO}
            </DialogDescription>
          </DialogHeader>
          <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {UTILISATION_FULL_AUTHORISATION_CLAUSES.map((clause, index) => (
              <li key={clause.title} className="space-y-2">
                <p className="text-ui font-medium text-foreground">
                  {index + 1}. {clause.title}
                </p>
                {clause.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-ui text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </li>
            ))}
          </ol>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setFullAuthorisationOpen(false)}
            >
              {UTILISATION_FULL_AUTHORISATION_CLOSE}
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => {
                onConsentIdsChange?.(confirmUtilisationFullAuthorisation(consentIds));
                setFullAuthorisationOpen(false);
              }}
            >
              {UTILISATION_FULL_AUTHORISATION_CONFIRM}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
