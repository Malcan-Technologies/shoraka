import { NotFound } from "@cashsouk/ui";

export default function NotFoundPage() {
  return (
    <NotFound
      homeHref="/"
      homeLabel="Go to dashboard"
      description="The page you're looking for doesn't exist or you don't have permission to view it."
    />
  );
}

