"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

interface HealthCheckResponse {
  status: "ok" | "error";
  database?: "connected" | "disconnected";
  timestamp: string;
}

export function SystemHealthIndicator() {
  const [health, setHealth] = React.useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);

  const checkHealth = React.useCallback(async () => {
    try {
      setLoading(true);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        setHealth({
          status: "error",
          database: "disconnected",
          timestamp: new Date().toISOString(),
        });
        setLastChecked(new Date());
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/healthz`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as HealthCheckResponse;
      setHealth(data);
      setLastChecked(new Date());
    } catch (error) {
      setHealth({
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      });
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [checkHealth]);

  const apiStatus = health?.status === "ok";
  const dbStatus = health?.database === "connected";

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  loading ? "bg-gray-400" : apiStatus ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs text-muted-foreground">API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  loading ? "bg-gray-400" : dbStatus ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs text-muted-foreground">DB</span>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 rounded-xl" align="end">
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">System Status</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {apiStatus ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircleIcon className="h-4 w-4 text-red-600" />
                )}
                <span>API Server: {apiStatus ? "Online" : "Offline"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {dbStatus ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircleIcon className="h-4 w-4 text-red-600" />
                )}
                <span>Database: {dbStatus ? "Connected" : "Disconnected"}</span>
              </div>
            </div>
            {lastChecked && (
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Last checked: {formatDistanceToNow(lastChecked, { addSuffix: true })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="sm"
        onClick={checkHealth}
        disabled={loading}
        className="h-8 w-8 p-0"
        title="Refresh health status"
      >
        <ArrowPathIcon
          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
        />
      </Button>
    </div>
  );
}

