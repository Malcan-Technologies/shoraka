import {
  UTILISATION_OFFER_CONSENTS,
  UTILISATION_OFFER_CONSENTS_INTRO,
  UTILISATION_OFFER_CONSENTS_TITLE,
  UTILISATION_OFFER_TERM_CLAUSES,
  UTILISATION_OFFER_TERMS_INTRO,
  UTILISATION_OFFER_TERMS_TITLE,
  toggleUtilisationOfferConsent,
  type UtilisationOfferConsentId,
} from "@cashsouk/types";
import { Checkbox } from "@/components/ui/checkbox";

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
  return (
    <section
      aria-labelledby="utilisation-offer-terms-heading"
      className="rounded-xl border border-border"
    >
      <div className="border-b border-border px-4 py-3">
        <h3 id="utilisation-offer-terms-heading" className="text-ui font-medium text-foreground">
          {UTILISATION_OFFER_TERMS_TITLE}
        </h3>
        <p className="mt-1 text-ui text-muted-foreground">{UTILISATION_OFFER_TERMS_INTRO}</p>
      </div>
      <ol className="max-h-64 space-y-3 overflow-y-auto px-4 py-3">
        {UTILISATION_OFFER_TERM_CLAUSES.map((clause, index) => (
          <li key={clause.title} className="space-y-1">
            <p className="text-ui font-medium text-foreground">
              {index + 1}. {clause.title}
            </p>
            <p className="text-ui text-muted-foreground">{clause.body}</p>
          </li>
        ))}
      </ol>
      {showConsents ? (
        <fieldset className="space-y-3 border-t border-border px-4 py-3" disabled={consentsLocked}>
          <legend className="text-ui font-medium text-foreground">{UTILISATION_OFFER_CONSENTS_TITLE}</legend>
          <p className="text-ui text-muted-foreground">{UTILISATION_OFFER_CONSENTS_INTRO}</p>
          <div className="space-y-3">
            {UTILISATION_OFFER_CONSENTS.map((consent) => {
              const checked = consentIds.includes(consent.id);
              return (
                <label key={consent.id} className="flex cursor-pointer items-start gap-3">
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
                  <span className="text-ui text-foreground">{consent.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </section>
  );
}
