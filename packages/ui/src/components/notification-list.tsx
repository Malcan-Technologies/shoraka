"use client";

import { useNotifications } from "@cashsouk/config";
import { format } from "date-fns";
import { Bell, Lock, Settings, Megaphone, Info, ChevronLeft, ChevronRight, BadgeDollarSign } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { cn } from "../lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NotificationList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const limit = 15;
  const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount, pagination } = useNotifications({
    limit,
    offset: (page - 1) * limit,
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "AUTHENTICATION":
        return <Lock className="h-5 w-5 text-blue-500" />;
      case "SYSTEM":
        return <Settings className="h-5 w-5 text-slate-500" />;
      case "MARKETING":
        return <BadgeDollarSign className="h-5 w-5 text-accent" />;
      case "ANNOUNCEMENT":
        return <Megaphone className="h-5 w-5 text-primary" />;
      default:
        return <Info className="h-5 w-5 text-slate-400" />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.read_at) {
      markAsRead(notification.id);
    }
    if (notification.link_path) {
      if (notification.link_path.startsWith("http")) {
        window.location.href = notification.link_path;
      } else {
        router.push(notification.link_path);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 w-1/4 bg-muted rounded mb-2" />
              <div className="h-3 w-3/4 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Notifications</h2>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllAsRead()}>
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-medium">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              We'll notify you when something important happens.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
            {notifications.map((notification: any) => {
              const isUnread = !notification.read_at;
              const isWarning = notification.priority === "WARNING";
              const isCritical = notification.priority === "CRITICAL";

              return (
                <Card
                  key={notification.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/80 hover:text-foreground",
                    isCritical ? "bg-red-100/100" : isWarning ? "bg-yellow-100/60" : isUnread ? "bg-muted/80" : "bg-card"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="mt-1">{getCategoryIcon(notification.notification_type.category)}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{notification.title}</p>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(notification.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((page - 1) * limit + 1, pagination.total)}-{Math.min(page * limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => {
                // Show first, last, current, and pages around current
                if (
                  p === 1 ||
                  p === pagination.pages ||
                  (p >= page - 1 && p <= page + 1)
                ) {
                  return (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setPage(p);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      {p}
                    </Button>
                  );
                }
                // Show ellipses
                if (p === 2 || p === pagination.pages - 1) {
                  return <span key={p} className="px-1 text-muted-foreground">...</span>;
                }
                return null;
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage((p) => Math.min(pagination.pages, p + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={page === pagination.pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
