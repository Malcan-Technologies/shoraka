"use client";

import * as React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@shoraka/ui";
import {
  Bars3Icon as Menu,
  UserIcon as User,
  Cog6ToothIcon as Settings,
  ArrowRightOnRectangleIcon as LogOut,
} from "@heroicons/react/24/outline";

interface HeaderProps {
  collapsed: boolean;
  onMobileMenuClick: () => void;
  title?: string;
}

export function Header({ collapsed, onMobileMenuClick, title }: HeaderProps) {
  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16 border-b border-border bg-background transition-all duration-200 ease-out",
        collapsed ? "left-16" : "left-64",
        "max-md:left-0"
      )}
    >
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMobileMenuClick}
            className="rounded-md p-2 hover:bg-muted transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          {title && (
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt="Admin" />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    AD
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium max-sm:hidden">Admin User</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

