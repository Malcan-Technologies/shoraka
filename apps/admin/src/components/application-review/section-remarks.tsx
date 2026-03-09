"use client";

import * as React from "react";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatRemarkAsBullets } from "@/lib/utils";

export interface SectionRemarkItem {
  id: string;
  scope?: string;
  scope_key?: string;
  action_type?: string;
  remark: string;
  created_at: string;
  author_user_id?: string;
  author?: { first_name?: string | null; last_name?: string | null } | null;
}

function getAuthorLabel(remark: SectionRemarkItem): string {
  const first = remark.author?.first_name?.trim() ?? "";
  const last = remark.author?.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;
  if (remark.author_user_id && remark.author_user_id.trim()) return remark.author_user_id;
  return "System";
}

export function SectionRemarks({
  remarks,
  onSubmitComment,
}: {
  remarks: SectionRemarkItem[];
  onSubmitComment?: (comment: string) => Promise<void> | void;
}) {
  const [comment, setComment] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    if (!onSubmitComment || isSubmitting) return;
    const value = comment.trim();
    if (!value) return;
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await onSubmitComment(value);
      setComment("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground">Add Remarks</Label>
      <div className="mt-1 space-y-2">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a comment for this section..."
          className="min-h-[90px]"
          disabled={isSubmitting}
        />
        <div className="flex items-center justify-end gap-2">
          {submitError && <p className="mr-auto text-xs text-destructive">{submitError}</p>}
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || comment.trim().length === 0}
          >
            {isSubmitting ? "Posting..." : "Post comment"}
          </Button>
        </div>
      </div>
      <Label className="mt-4 inline-block text-xs text-muted-foreground">Comments</Label>
      {remarks.length === 0 ? (
        <div className="mt-1 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          No comments yet.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {remarks.map((entry) => {
            const lines = formatRemarkAsBullets(entry.remark);
            return (
              <div key={entry.id} className="rounded-xl border bg-muted/20 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">{getAuthorLabel(entry)}</span>
                  <span title={format(new Date(entry.created_at), "PPpp")}>
                    {format(new Date(entry.created_at), "PPp")}
                  </span>
                </div>
                {lines.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
                    {lines.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-foreground">{entry.remark}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
