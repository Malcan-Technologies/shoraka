import { Button } from "./button";
import { cn } from "../lib/utils";

interface NotFoundProps {
  title?: string;
  description?: string;
  showHomeButton?: boolean;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
}

export function NotFound({
  title = "404 — Page not found",
  description = "The page you're looking for doesn't exist or has been moved.",
  showHomeButton = true,
  homeHref = "/",
  homeLabel = "Go home",
  className,
}: NotFoundProps) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold tracking-tight text-primary/20">404</h1>
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h2>
        </div>

        <p className="text-[17px] leading-7 text-muted-foreground">{description}</p>

        {showHomeButton && (
          <div className="pt-4">
            <Button asChild size="lg" className="shadow-brand">
              <a href={homeHref}>{homeLabel}</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
