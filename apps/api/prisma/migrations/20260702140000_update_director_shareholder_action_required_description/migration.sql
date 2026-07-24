UPDATE "notification_types"
SET "description" = 'Sent to the issuer organization owner when a CTOS pull finds new directors or shareholders who need onboarding action.'
WHERE "id" = 'director_shareholder_action_required';
