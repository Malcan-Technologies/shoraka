"use client";

import * as React from "react";
import { SidebarTrigger } from "../../../components/ui/sidebar";
import { Separator } from "../../../components/ui/separator";
import { SystemHealthIndicator } from "../../../components/system-health-indicator";
import { AccessLogsTable } from "../../../components/access-logs-table";
import { AccessLogsToolbar } from "../../../components/access-logs-toolbar";
import { subDays, subHours, isAfter } from "date-fns";

type EventType =
  | "LOGIN"
  | "LOGOUT"
  | "SIGNUP"
  | "ROLE_ADDED"
  | "ROLE_SWITCHED"
  | "ONBOARDING_COMPLETED";

interface AccessLog {
  id: string;
  user_id: string;
  user: {
    first_name: string;
    last_name: string;
    email: string;
    roles: string[];
  };
  event_type: EventType;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  cognito_event: Record<string, unknown> | null;
  success: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

const mockAccessLogs: AccessLog[] = [
  {
    id: "log_1",
    user_id: "user_1",
    user: {
      first_name: "Sarah",
      last_name: "Johnson",
      email: "sarah.johnson@example.com",
      roles: ["INVESTOR"],
    },
    event_type: "LOGIN",
    ip_address: "203.106.142.5",
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    device_info: "Windows Desktop",
    cognito_event: { sub: "sub_123456", event: "PreAuthentication" },
    success: true,
    metadata: { auth_method: "password", active_role: "INVESTOR" },
    created_at: subHours(new Date(), 2),
  },
  {
    id: "log_2",
    user_id: "user_2",
    user: {
      first_name: "Marcus",
      last_name: "Tan",
      email: "marcus.tan@example.com",
      roles: ["ISSUER"],
    },
    event_type: "LOGOUT",
    ip_address: "118.200.78.12",
    user_agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
    device_info: "Mac Desktop",
    cognito_event: null,
    success: true,
    metadata: { session_duration: "2h 15m", active_role: "ISSUER" },
    created_at: subHours(new Date(), 5),
  },
  {
    id: "log_3",
    user_id: "user_5",
    user: {
      first_name: "Lisa",
      last_name: "Kumar",
      email: "lisa.kumar@example.com",
      roles: ["INVESTOR"],
    },
    event_type: "SIGNUP",
    ip_address: "175.143.12.90",
    user_agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    device_info: "iPhone",
    cognito_event: { sub: "sub_567890", event: "PostConfirmation" },
    success: true,
    metadata: { signup_method: "email", referral_code: null },
    created_at: subHours(new Date(), 8),
  },
  {
    id: "log_4",
    user_id: "user_3",
    user: {
      first_name: "Admin",
      last_name: "User",
      email: "admin@cashsouk.com",
      roles: ["ADMIN"],
    },
    event_type: "LOGIN",
    ip_address: "192.168.1.100",
    user_agent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    device_info: "Linux Desktop",
    cognito_event: { sub: "sub_345678", event: "PreAuthentication" },
    success: true,
    metadata: { auth_method: "mfa", active_role: "ADMIN" },
    created_at: subHours(new Date(), 12),
  },
  {
    id: "log_5",
    user_id: "user_4",
    user: {
      first_name: "David",
      last_name: "Wong",
      email: "david.wong@example.com",
      roles: ["INVESTOR", "ISSUER"],
    },
    event_type: "ROLE_SWITCHED",
    ip_address: "101.50.123.45",
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0",
    device_info: "Windows Desktop",
    cognito_event: null,
    success: true,
    metadata: { from_role: "INVESTOR", to_role: "ISSUER" },
    created_at: subDays(new Date(), 1),
  },
  {
    id: "log_6",
    user_id: "user_1",
    user: {
      first_name: "Sarah",
      last_name: "Johnson",
      email: "sarah.johnson@example.com",
      roles: ["INVESTOR"],
    },
    event_type: "LOGIN",
    ip_address: "203.106.142.5",
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
    device_info: "Windows Desktop",
    cognito_event: { sub: "sub_123456", event: "PreAuthentication" },
    success: false,
    metadata: { auth_method: "password", error: "Invalid credentials" },
    created_at: subDays(new Date(), 1),
  },
  {
    id: "log_7",
    user_id: "user_7",
    user: {
      first_name: "Rachel",
      last_name: "Lee",
      email: "rachel.lee@example.com",
      roles: ["INVESTOR"],
    },
    event_type: "ONBOARDING_COMPLETED",
    ip_address: "220.255.1.88",
    user_agent:
      "Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
    device_info: "iPad",
    cognito_event: null,
    success: true,
    metadata: { onboarding_type: "investor", kyc_completed: true },
    created_at: subDays(new Date(), 2),
  },
  {
    id: "log_8",
    user_id: "user_8",
    user: {
      first_name: "Michael",
      last_name: "Chen",
      email: "michael.chen@example.com",
      roles: ["INVESTOR", "ADMIN"],
    },
    event_type: "ROLE_ADDED",
    ip_address: "192.168.1.105",
    user_agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
    device_info: "Mac Desktop",
    cognito_event: null,
    success: true,
    metadata: { added_role: "ADMIN", added_by: "system" },
    created_at: subDays(new Date(), 3),
  },
  {
    id: "log_9",
    user_id: "user_6",
    user: {
      first_name: "Ahmad",
      last_name: "Ibrahim",
      email: "ahmad.ibrahim@example.com",
      roles: ["ISSUER"],
    },
    event_type: "LOGIN",
    ip_address: "60.53.200.15",
    user_agent:
      "Mozilla/5.0 (Android 14; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    device_info: "Android Phone",
    cognito_event: { sub: "sub_678901", event: "PreAuthentication" },
    success: true,
    metadata: { auth_method: "password", active_role: "ISSUER" },
    created_at: subDays(new Date(), 4),
  },
  {
    id: "log_10",
    user_id: "user_2",
    user: {
      first_name: "Marcus",
      last_name: "Tan",
      email: "marcus.tan@example.com",
      roles: ["ISSUER"],
    },
    event_type: "LOGIN",
    ip_address: "118.200.78.12",
    user_agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36",
    device_info: "Mac Desktop",
    cognito_event: { sub: "sub_234567", event: "PreAuthentication" },
    success: false,
    metadata: { auth_method: "password", error: "Account locked" },
    created_at: subDays(new Date(), 5),
  },
  {
    id: "log_11",
    user_id: "user_1",
    user: {
      first_name: "Sarah",
      last_name: "Johnson",
      email: "sarah.johnson@example.com",
      roles: ["INVESTOR"],
    },
    event_type: "LOGOUT",
    ip_address: "203.106.142.5",
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
    device_info: "Windows Desktop",
    cognito_event: null,
    success: true,
    metadata: { session_duration: "45m", active_role: "INVESTOR" },
    created_at: subDays(new Date(), 7),
  },
  {
    id: "log_12",
    user_id: "user_4",
    user: {
      first_name: "David",
      last_name: "Wong",
      email: "david.wong@example.com",
      roles: ["INVESTOR", "ISSUER"],
    },
    event_type: "ONBOARDING_COMPLETED",
    ip_address: "101.50.123.45",
    user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0",
    device_info: "Windows Desktop",
    cognito_event: null,
    success: true,
    metadata: { onboarding_type: "issuer", business_verified: true },
    created_at: subDays(new Date(), 10),
  },
  {
    id: "log_13",
    user_id: "user_7",
    user: {
      first_name: "Rachel",
      last_name: "Lee",
      email: "rachel.lee@example.com",
      roles: ["INVESTOR"],
    },
    event_type: "LOGIN",
    ip_address: "220.255.1.88",
    user_agent:
      "Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) Safari/604.1",
    device_info: "iPad",
    cognito_event: { sub: "sub_789012", event: "PreAuthentication" },
    success: true,
    metadata: { auth_method: "password", active_role: "INVESTOR" },
    created_at: subDays(new Date(), 15),
  },
  {
    id: "log_14",
    user_id: "user_3",
    user: {
      first_name: "Admin",
      last_name: "User",
      email: "admin@cashsouk.com",
      roles: ["ADMIN"],
    },
    event_type: "LOGOUT",
    ip_address: "192.168.1.100",
    user_agent:
      "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36",
    device_info: "Linux Desktop",
    cognito_event: null,
    success: true,
    metadata: { session_duration: "3h 20m", active_role: "ADMIN" },
    created_at: subDays(new Date(), 20),
  },
  {
    id: "log_15",
    user_id: "user_5",
    user: {
      first_name: "Lisa",
      last_name: "Kumar",
      email: "lisa.kumar@example.com",
      roles: ["INVESTOR"],
    },
    event_type: "LOGIN",
    ip_address: "175.143.12.90",
    user_agent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) Mobile/15E148",
    device_info: "iPhone",
    cognito_event: { sub: "sub_567890", event: "PreAuthentication" },
    success: true,
    metadata: { auth_method: "password", active_role: "INVESTOR" },
    created_at: subDays(new Date(), 25),
  },
  {
    id: "log_16",
    user_id: "user_6",
    user: {
      first_name: "Ahmad",
      last_name: "Ibrahim",
      email: "ahmad.ibrahim@example.com",
      roles: ["ISSUER"],
    },
    event_type: "SIGNUP",
    ip_address: "60.53.200.15",
    user_agent:
      "Mozilla/5.0 (Android 14; Mobile) Chrome/120.0.0.0 Mobile Safari/537.36",
    device_info: "Android Phone",
    cognito_event: { sub: "sub_678901", event: "PostConfirmation" },
    success: true,
    metadata: { signup_method: "email", business_registration: true },
    created_at: subDays(new Date(), 30),
  },
  {
    id: "log_17",
    user_id: "user_8",
    user: {
      first_name: "Michael",
      last_name: "Chen",
      email: "michael.chen@example.com",
      roles: ["INVESTOR", "ADMIN"],
    },
    event_type: "ROLE_SWITCHED",
    ip_address: "192.168.1.105",
    user_agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
    device_info: "Mac Desktop",
    cognito_event: null,
    success: true,
    metadata: { from_role: "INVESTOR", to_role: "ADMIN" },
    created_at: subDays(new Date(), 35),
  },
  {
    id: "log_18",
    user_id: "user_2",
    user: {
      first_name: "Marcus",
      last_name: "Tan",
      email: "marcus.tan@example.com",
      roles: ["ISSUER"],
    },
    event_type: "SIGNUP",
    ip_address: "118.200.78.12",
    user_agent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36",
    device_info: "Mac Desktop",
    cognito_event: { sub: "sub_234567", event: "PostConfirmation" },
    success: true,
    metadata: { signup_method: "email", company_verified: true },
    created_at: subDays(new Date(), 45),
  },
];

export default function AccessLogsPage() {
  const [loading, setLoading] = React.useState(true);
  const [logs] = React.useState<AccessLog[]>(mockAccessLogs);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dateRangeFilter, setDateRangeFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const filteredLogs = React.useMemo(() => {
    let filtered = logs;

    if (searchQuery) {
      filtered = filtered.filter(
        (log) =>
          log.user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.user.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (eventTypeFilter !== "all") {
      filtered = filtered.filter((log) => log.event_type === eventTypeFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((log) =>
        statusFilter === "success" ? log.success : !log.success
      );
    }

    if (dateRangeFilter !== "all") {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateRangeFilter) {
        case "24h":
          cutoffDate = subHours(now, 24);
          break;
        case "7d":
          cutoffDate = subDays(now, 7);
          break;
        case "30d":
          cutoffDate = subDays(now, 30);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filtered = filtered.filter((log) => isAfter(log.created_at, cutoffDate));
    }

    return filtered;
  }, [logs, searchQuery, eventTypeFilter, statusFilter, dateRangeFilter]);

  const paginatedLogs = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setEventTypeFilter("all");
    setStatusFilter("all");
    setDateRangeFilter("all");
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, eventTypeFilter, statusFilter, dateRangeFilter]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Access Logs</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-7xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          <AccessLogsToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            eventTypeFilter={eventTypeFilter}
            onEventTypeFilterChange={setEventTypeFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            dateRangeFilter={dateRangeFilter}
            onDateRangeFilterChange={setDateRangeFilter}
            totalCount={logs.length}
            filteredCount={filteredLogs.length}
            onClearFilters={handleClearFilters}
          />

          <AccessLogsTable
            logs={paginatedLogs}
            loading={loading}
            currentPage={currentPage}
            pageSize={pageSize}
            totalLogs={filteredLogs.length}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </>
  );
}

