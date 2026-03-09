"use client";

import * as React from "react";
import { format } from "date-fns";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { reviewSectionHeaderClass } from "./review-section-styles";

const COMMENTS_PAGE_SIZE = 5;

export interface SectionCommentItem {
  id: string;
  scope?: string;
  scope_key?: string;
  action_type?: string;
  comment: string;
  created_at: string;
  author_user_id?: string;
  author?: { first_name?: string | null; last_name?: string | null } | null;
}

function getAuthorLabel(comment: SectionCommentItem): string {
  const first = comment.author?.first_name?.trim() ?? "";
  const last = comment.author?.last_name?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;
  if (comment.author_user_id && comment.author_user_id.trim()) return comment.author_user_id;
  return "System";
}

export function SectionComments({
  comments,
  onSubmitComment,
}: {
  comments: SectionCommentItem[];
  onSubmitComment?: (comment: string) => Promise<void> | void;
}) {
  const [comment, setComment] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(COMMENTS_PAGE_SIZE);

  React.useEffect(() => {
    setVisibleCount(COMMENTS_PAGE_SIZE);
  }, [comments.length]);

  const visibleComments = comments.slice(0, visibleCount);
  const hasMore = comments.length > visibleCount;

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
    <section className="space-y-3">
      <div>
        <h3 className={reviewSectionHeaderClass}>Comments</h3>
      </div>
      <div className="rounded-xl border border-border p-4">
      <div className="space-y-2">
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
            {isSubmitting ? "Posting..." : "Post Comment"}
          </Button>
        </div>
      </div>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="mt-3">
          <div className="space-y-3">
            {visibleComments.map((entry) => (
              <div key={entry.id} className="pt-3 first:pt-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {getAuthorLabel(entry)}
                  </span>
                  <span
                    className="text-xs text-muted-foreground shrink-0"
                    title={format(new Date(entry.created_at), "PPpp")}
                  >
                    {format(new Date(entry.created_at), "PPp")}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm font-normal leading-6 text-foreground">
                  {entry.comment}
                </p>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="mt-3 flex justify-center border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + COMMENTS_PAGE_SIZE, comments.length)
                  )
                }
              >
                <ChevronDownIcon className="mr-1.5 h-4 w-4" aria-hidden />
                Load more ({comments.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
