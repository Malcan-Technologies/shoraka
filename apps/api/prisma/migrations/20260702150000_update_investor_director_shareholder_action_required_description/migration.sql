UPDATE "notification_types"
SET "description" = 'Sent to the investor organization owner when a CTOS pull finds new directors or shareholders who need onboarding action.'
WHERE "id" = 'investor_director_shareholder_action_required';
