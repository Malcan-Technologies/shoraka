"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useOrganization } from "@cashsouk/config";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "../components/card";
import { ScrollArea } from "../components/scroll-area";
import { Checkbox } from "../components/checkbox";
import { Label } from "../components/label";
import { Button } from "../components/button";
import { toast } from "sonner";

interface TermsAcceptanceCardProps {
  organizationId: string;
  termsMarkdown: string;
  lastUpdated: Date;
  onAccepted?: () => void;
}

export function TermsAcceptanceCard({
  organizationId,
  termsMarkdown,
  lastUpdated,
  onAccepted,
}: TermsAcceptanceCardProps) {
  const { acceptTnc, refreshOrganizations, activeOrganization } = useOrganization();
  const [isAccepted, setIsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOwner =
    activeOrganization?.id === organizationId ? Boolean(activeOrganization.isOwner) : false;

  const handleAccept = async () => {
    if (!isAccepted) {
      toast.error("Please accept the Terms and Conditions to continue");
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptTnc(organizationId);
      await refreshOrganizations();
      toast.success("Terms and Conditions accepted successfully");
      onAccepted?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept Terms and Conditions"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = lastUpdated.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="w-full rounded-2xl border bg-card shadow-sm md:shadow">
      <CardHeader className="space-y-1.5 border-b px-6 py-6 md:px-8">
        <CardTitle className="text-xl font-semibold tracking-tight md:text-2xl">
          Terms and Conditions
        </CardTitle>
        <CardDescription className="text-[17px] leading-7 text-muted-foreground">
          {isOwner
            ? "Please read and accept our Terms and Conditions to continue."
            : "The organisation owner must accept the updated legal document before new transactions can continue."}
          <br />
          <span className="text-[13px] leading-5 text-muted-foreground">
            Last updated: {formattedDate}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-6 md:px-8">
        <ScrollArea className="h-[400px] rounded-xl border bg-background p-4 md:h-[500px] lg:h-[600px]">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-h1:mb-6 prose-h1:mt-0 prose-h1:text-xl prose-h2:mb-3 prose-h2:mt-8 prose-h2:text-base prose-p:my-2 prose-p:text-sm prose-p:leading-relaxed prose-li:my-1 prose-li:text-sm prose-ul:my-3 prose-ul:list-disc prose-ul:pl-6 prose-ol:my-3 prose-ol:list-decimal prose-ol:pl-6 prose-strong:text-foreground prose-hr:my-6">
            <ReactMarkdown>{termsMarkdown}</ReactMarkdown>
          </div>
        </ScrollArea>
      </CardContent>
      {isOwner ? (
        <CardFooter className="flex flex-col gap-4 border-t px-6 py-4 md:px-8">
          <div className="flex w-full items-start gap-3">
            <Checkbox
              id="accept-tnc"
              checked={isAccepted}
              onCheckedChange={(checked) => setIsAccepted(checked === true)}
              disabled={isSubmitting}
            />
            <Label htmlFor="accept-tnc" className="cursor-pointer text-sm leading-relaxed">
              I have read and agree to the Terms and Conditions
            </Label>
          </div>
          <Button
            onClick={handleAccept}
            disabled={!isAccepted || isSubmitting}
            className="h-11 w-full rounded-xl"
          >
            {isSubmitting ? "Submitting…" : "Accept and Continue"}
          </Button>
        </CardFooter>
      ) : (
        <CardFooter className="border-t px-6 py-4 md:px-8">
          <p className="text-[17px] leading-7 text-muted-foreground">
            Only the organisation owner can accept these terms. You can still read the document
            above.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}
