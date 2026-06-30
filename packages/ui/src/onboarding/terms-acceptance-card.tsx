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
  const { acceptTnc, refreshOrganizations } = useOrganization();
  const [isAccepted, setIsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <Card className="w-full rounded-2xl shadow-lg">
      <CardHeader>
        <CardTitle>User Agreement</CardTitle>
        <CardDescription>
          Please read and accept our Terms and Conditions to continue.
          <br />
          <span className="text-xs text-muted-foreground">Last updated: {formattedDate}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] md:h-[500px] lg:h-[600px] rounded-md border p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-xl prose-h1:mt-0 prose-h1:mb-6 prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-p:text-sm prose-p:leading-relaxed prose-p:my-2 prose-li:text-sm prose-li:my-1 prose-ul:my-3 prose-ul:pl-6 prose-ul:list-disc prose-ol:my-3 prose-ol:pl-6 prose-ol:list-decimal prose-strong:text-foreground prose-hr:my-6">
            <ReactMarkdown>{termsMarkdown}</ReactMarkdown>
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <div className="flex items-start gap-3 w-full">
          <Checkbox
            id="accept-tnc"
            checked={isAccepted}
            onCheckedChange={(checked) => setIsAccepted(checked === true)}
            disabled={isSubmitting}
          />
          <Label htmlFor="accept-tnc" className="text-sm leading-relaxed cursor-pointer">
            I have read and agree to the Terms and Conditions
          </Label>
        </div>
        <Button
          onClick={handleAccept}
          disabled={!isAccepted || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Submitting..." : "Accept and Continue"}
        </Button>
      </CardFooter>
    </Card>
  );
}
