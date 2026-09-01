"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { Button, cn } from "@cashsouk/ui";
import { toast } from "sonner";
import { openPublicMarketplaceProspectus } from "@/lib/open-public-prospectus";

export function ViewProspectusButton({
  noteId,
  className,
  variant = "ghost",
}: {
  noteId: string;
  className?: string;
  variant?: "ghost" | "link";
}) {
  const [isOpening, setIsOpening] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleClick() {
    if (isOpening) return;
    setIsOpening(true);
    try {
      await openPublicMarketplaceProspectus(noteId);
    } catch (error) {
      if (!mountedRef.current) return;
      toast.error(error instanceof Error ? error.message : "Prospectus unavailable");
    } finally {
      if (mountedRef.current) setIsOpening(false);
    }
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isOpening}
        className={cn(
          "flex w-full items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-50",
          className
        )}
      >
        <DocumentTextIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {isOpening ? "Opening prospectus…" : "View prospectus"}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-10 w-full rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        className
      )}
      disabled={isOpening}
      onClick={() => void handleClick()}
    >
      <DocumentTextIcon className="h-4 w-4" />
      {isOpening ? "Opening prospectus…" : "View prospectus"}
    </Button>
  );
}
