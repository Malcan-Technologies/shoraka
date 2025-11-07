"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  cn,
  Logo,
} from "@shoraka/ui";
import {
  HomeIcon as Home,
  DocumentTextIcon as FileText,
  UsersIcon as Users,
  ArrowTrendingUpIcon as TrendingUp,
  Cog6ToothIcon as Settings,
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Loans", href: "/loans", icon: FileText },
  { name: "Users", href: "/users", icon: Users },
  { name: "Investments", href: "/investments", icon: TrendingUp },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

