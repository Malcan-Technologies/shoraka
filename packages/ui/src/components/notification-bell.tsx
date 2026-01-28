"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@cashsouk/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Button } from "./button";
import { Badge } from "./badge";
import { ScrollArea } from "./scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({
    limit: 15,
    read: false,
  });

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden rounded-xl border border-slate-200 shadow-xl bg-white">
        <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-slate-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
              >
                Mark all as read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="flex h-[300px] flex-col items-center justify-center p-6 text-center bg-white">
              <Bell className="mb-2 h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">No new notifications yet</p>
            </div>
          ) : (
            <div className="flex flex-col bg-white">
              {notifications.map((notification: any) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex flex-col items-start gap-0.5 p-3 cursor-pointer border-b border-slate-50 last:border-0 focus:bg-slate-100 focus:text-slate-900 outline-none transition-colors",
                    notification.priority === "CRITICAL" ? "bg-red-100/100" : notification.priority === "WARNING" ? "bg-yellow-100/60" : !notification.read_at ? "bg-slate-50/30" : "bg-white"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex w-full items-start justify-between gap-1">
                    <div className="flex-1 pr-1">
                      <div className="flex items-center justify-between w-full mb-0.5">
                        <span className="text-sm font-bold text-slate-900 leading-tight">
                          {notification.title}
                        </span>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap ml-2">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500 leading-snug line-clamp-2">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <div className="pt-1 shrink-0">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 block shadow-[0_0_0_2px_rgba(16,185,129,0.1)]" />
                      </div>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-1.5 border-t border-slate-100 bg-white">
          <Button
            variant="ghost"
            className="w-full h-8 text-sm font-medium text-slate-900 hover:bg-slate-50 hover:text-slate-900 rounded-md transition-colors"
            onClick={() => router.push("/notifications")}
          >
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
