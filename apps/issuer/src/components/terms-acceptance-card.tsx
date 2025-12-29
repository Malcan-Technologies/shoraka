"use client";

import * as React from "react";
import { useState } from "react";
import { useOrganization } from "@cashsouk/config";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, ScrollArea, Checkbox } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TERMS_AND_CONDITIONS } from "../content/terms-and-conditions";
import { TNC_LAST_UPDATED } from "../content/tnc-metadata";
import { toast } from "sonner";

interface TermsAcceptanceCardProps {
  organizationId: string;
  onAccepted?: () => void;
}

export function TermsAcceptanceCard({ organizationId, onAccepted }: TermsAcceptanceCardProps) {
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

  // Format the last updated date
  const formattedDate = TNC_LAST_UPDATED.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>User Agreement</CardTitle>
        <CardDescription>
          Please read and accept our Terms and Conditions to continue.
          <br />
          <span className="text-xs text-muted-foreground">Last updated: {formattedDate}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] md:h-[400px] rounded-md border p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {/* Render T&C as markdown-like content */}
            {TERMS_AND_CONDITIONS.split("\n").map((line, index) => {
              if (line.startsWith("# ")) {
                return (
                  <h1 key={index} className="text-xl font-bold mt-4 mb-2">
                    {line.replace("# ", "")}
                  </h1>
                );
              } else if (line.startsWith("## ")) {
                return (
                  <h2 key={index} className="text-lg font-semibold mt-4 mb-2">
                    {line.replace("## ", "")}
                  </h2>
                );
              } else if (line.startsWith("---")) {
                return <hr key={index} className="my-4" />;
              } else if (line.match(/^\d+\.\s/)) {
                return (
                  <p key={index} className="ml-4 mb-1">
                    {line}
                  </p>
                );
              } else if (line.startsWith("- ")) {
                return (
                  <p key={index} className="ml-6 mb-1">
                    • {line.replace("- ", "")}
                  </p>
                );
              } else if (line.trim() === "") {
                return <br key={index} />;
              } else {
                return (
                  <p key={index} className="mb-2">
                    {line}
                  </p>
                );
              }
            })}
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
          <Label
            htmlFor="accept-tnc"
            className="text-sm leading-relaxed cursor-pointer"
          >
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

