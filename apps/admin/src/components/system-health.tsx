"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cashsouk/ui/card";
import { Badge, Skeleton } from "@cashsouk/ui";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ServerIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";

interface HealthCheckResponse {
  status: "ok" | "error";
  database?: "connected" | "disconnected";
  timestamp: string;
  error?: string;
}

export function SystemHealth() {
  const [health, setHealth] = React.useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);

  const checkHealth = React.useCallback(async () => {
    try {
      setLoading(true);

      // Use environment variable or default to localhost for development
      const apiUrl =
        typeof window !== "undefined" && window.location.hostname === "localhost"
          ? "http://localhost:4000" // Local development
          : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Debug logging
      console.log("🔍 Health check debug:", {
        hostname: typeof window !== "undefined" ? window.location.hostname : "SSR",
        apiUrl,
        envVar: process.env.NEXT_PUBLIC_API_URL,
      });

      const response = await fetch(`${apiUrl}/healthz`, {
        cache: "no-store",
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as HealthCheckResponse;
      setHealth(data);
      setLastChecked(new Date());
    } catch (error) {
      setHealth({
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Failed to connect to API",
      });
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    checkHealth();

    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const getStatusBadge = (status?: string) => {
    if (loading) {
      return <Skeleton className="h-6 w-20" />;
    }

    if (status === "ok" || status === "connected") {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          <CheckCircleIcon className="mr-1 h-3.5 w-3.5" />
          Healthy
        </Badge>
      );
    }

    return (
      <Badge variant="destructive">
        <XCircleIcon className="mr-1 h-3.5 w-3.5" />
        Error
      </Badge>
    );
  };

  const formatTimestamp = (date: Date | null) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-MY", {
      timeStyle: "medium",
      dateStyle: "short",
      timeZone: "Asia/Kuala_Lumpur",
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5" />
              System Health
            </CardTitle>
            <CardDescription>Real-time system status monitoring</CardDescription>
          </div>
          {getStatusBadge(health?.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Status */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2 ${
                health?.status === "ok"
                  ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
              }`}
            >
              <ServerIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">API Server</p>
              <p className="text-sm text-muted-foreground">
                {loading ? "Checking..." : health?.error || "Operational"}
              </p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-16" />
          ) : (
            <span
              className={`text-sm font-medium ${
                health?.status === "ok"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {health?.status === "ok" ? "Online" : "Offline"}
            </span>
          )}
        </div>

        {/* Database Status */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2 ${
                health?.database === "connected"
                  ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
              }`}
            >
              <CircleStackIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Database</p>
              <p className="text-sm text-muted-foreground">
                {loading ? "Checking..." : "PostgreSQL via RDS Proxy"}
              </p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <span
              className={`text-sm font-medium ${
                health?.database === "connected"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {health?.database === "connected" ? "Connected" : "Disconnected"}
            </span>
          )}
        </div>

        {/* Last Checked */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4" />
            <span>Last checked</span>
          </div>
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span>{formatTimestamp(lastChecked)}</span>
          )}
        </div>

        {/* Error Message */}
        {health?.error && !loading && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <p className="font-medium">Error Details:</p>
            <p className="mt-1">{health.error}</p>
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={checkHealth}
          disabled={loading}
          className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? "Checking..." : "Refresh Status"}
        </button>
      </CardContent>
    </Card>
  );
}
