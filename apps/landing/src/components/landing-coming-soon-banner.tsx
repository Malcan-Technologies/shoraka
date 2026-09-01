import { InformationCircleIcon } from "@heroicons/react/24/outline";

export function LandingComingSoonBanner() {
  return (
    <div
      role="status"
      className="border-b border-status-action-text/20 bg-status-action-bg"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-2.5 px-4 py-3 sm:items-center sm:px-6">
        <InformationCircleIcon
          className="mt-0.5 size-5 shrink-0 text-status-action-text sm:mt-0"
          aria-hidden
        />
        <p className="text-ui leading-6 text-status-action-text">
          <span className="font-semibold">In development — coming soon.</span>{" "}
          No applications will be considered at this stage.
        </p>
      </div>
    </div>
  );
}
