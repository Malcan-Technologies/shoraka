"use client";

import Link from "next/link";
import { format } from "date-fns";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import type { PaymasterNoticeHistoryRow } from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Card, CardContent } from "@/components/ui/card";
import {
  ADMIN_ACTION_SURFACE_CLASS,
  assignmentNoticeStatusLabel,
  assignmentNoticeStatusToken,
} from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

export function PaymasterNoticesCard({ notices }: { notices: PaymasterNoticeHistoryRow[] }) {
  const needsAction = notices.some(
    (notice) => assignmentNoticeStatusToken(notice.status) === "action"
  );

  return (
    <Card className={cn("rounded-2xl", needsAction && ADMIN_ACTION_SURFACE_CLASS)}>
      <AdminDetailCardHeader
        icon={DocumentTextIcon}
        title="Assignment notices"
        description="Read-only history. Generate and send Notices from the related Note."
      />
      <CardContent>
        {notices.length === 0 ? (
          <p className="py-8 text-center text-ui text-muted-foreground">
            No assignment notices yet.
          </p>
        ) : (
          <ul className="max-h-[min(20rem,45vh)] space-y-4 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
            {notices.map((notice) => {
              const title =
                notice.noteReference ||
                notice.invoiceDisplayReference ||
                notice.contractDisplayReference ||
                "Notice";
              const href = notice.noteId ? `/notes/${encodeURIComponent(notice.noteId)}` : null;
              const noticeAt = notice.generatedAt || notice.sentAt;
              return (
                <li key={notice.id} className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {href ? (
                      <Link
                        href={href}
                        className="text-ui font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {title}
                      </Link>
                    ) : (
                      <div className="text-ui font-medium">{title}</div>
                    )}
                    <div className="text-meta text-muted-foreground">{notice.issuerName || "—"}</div>
                    {noticeAt ? (
                      <div className="text-meta text-muted-foreground">
                        {format(new Date(noticeAt), "dd MMM yyyy")}
                      </div>
                    ) : null}
                  </div>
                  <StatusBadge
                    label={assignmentNoticeStatusLabel(notice.status)}
                    status={assignmentNoticeStatusToken(notice.status)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
