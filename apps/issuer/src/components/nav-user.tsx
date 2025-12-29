"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, ChevronsUpDown, LogOut, ArrowLeftRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { logout } from "../lib/auth";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const INVESTOR_URL = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3002";

interface ApiUserData {
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export function NavUser() {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { activeOrganization } = useOrganization();
  const { getAccessToken, signOut } = useAuthToken();

  // Check if organization has a status that allows Profile access
  const allowsProfileAccess = useMemo(() => {
    const status = activeOrganization?.onboardingStatus;
    return (
      status === "PENDING_AML" ||
      status === "PENDING_FINAL_APPROVAL" ||
      status === "COMPLETED"
    );
  }, [activeOrganization]);

  // Profile should be disabled only if on onboarding page AND status doesn't allow access
  const isProfileDisabled = pathname === "/onboarding-start" && !allowsProfileAccess;

  const { data: userData, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const apiClient = createApiClient(API_URL, getAccessToken);
      const result = await apiClient.get<{ user: ApiUserData }>("/v1/auth/me");
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data.user;
    },
  });

  const user = {
    name: userData
      ? [userData.first_name, userData.last_name].filter(Boolean).join(" ") || "User"
      : "User",
    email: userData?.email || "",
    avatar: "",
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout(signOut, getAccessToken);
  };

  const handleSwitchPortal = () => {
    // Simply redirect to target portal - it will auto-refresh to get access token
    window.location.href = INVESTOR_URL;
  };

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="cursor-default">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="grid flex-1 gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-colors"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {isProfileDisabled ? (
                <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
                  <BadgeCheck />
                  Profile
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/profile">
                    <BadgeCheck />
                    Profile
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="cursor-pointer" onClick={handleSwitchPortal}>
                <ArrowLeftRight />
                Switch to Investor Portal
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="cursor-pointer"
            >
              <LogOut />
              {isLoggingOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
