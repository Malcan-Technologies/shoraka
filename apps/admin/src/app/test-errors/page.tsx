"use client";

import { useState, useCallback } from "react";
import { useAuthToken } from "@cashsouk/config";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

// API_URL is now handled by the proxy route

interface ErrorStats {
  get: { count: number; lastStatus: number | null };
  patch: { count: number; lastStatus: number | null };
  put: { count: number; lastStatus: number | null };
  delete: { count: number; lastStatus: number | null };
  all: { count: number; lastStatus: number | null };
  badRequest: { count: number; lastStatus: number | null };
}

export default function TestErrorsPage() {
  const { getAccessToken } = useAuthToken();

  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<ErrorStats>({
    get: { count: 0, lastStatus: null },
    patch: { count: 0, lastStatus: null },
    put: { count: 0, lastStatus: null },
    delete: { count: 0, lastStatus: null },
    all: { count: 0, lastStatus: null },
    badRequest: { count: 0, lastStatus: null },
  });

  // Make a request that will return 4xx error
  // Uses Next.js API route as proxy to bypass CORS
  const makeErrorRequest = useCallback(
    async (method: "GET" | "PATCH" | "PUT" | "DELETE"): Promise<number> => {
      const invalidEndpoint = `/v1/invalid-endpoint-${Date.now()}-${Math.random()}`;
      // Use Next.js API route as proxy to avoid CORS issues
      const proxyUrl = `/api/test-errors?endpoint=${encodeURIComponent(invalidEndpoint)}`;

      // Get auth token for the request
      const authToken = await getAccessToken();

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const options: RequestInit = {
        method,
        headers,
        credentials: "include",
      };

      if (method !== "GET" && method !== "DELETE") {
        options.body = JSON.stringify({ invalid: "data" });
      }

      try {
        const response = await fetch(proxyUrl, options);
        const data = await response.json();
        // The proxy now returns the actual status code
        // Use response.status (actual HTTP status) or fallback to data.status
        return response.status || data.status || 0;
      } catch (error) {
        // Network errors
        return 0;
      }
    },
    [getAccessToken]
  );

  // Spam GET requests
  const spamGet = useCallback(async () => {
    setIsRunning(true);
    const batchSize = 10;
    const batches = 5; // 50 requests total

    for (let batch = 0; batch < batches; batch++) {
      const promises = Array(batchSize)
        .fill(0)
        .map(() => makeErrorRequest("GET"));

      const statusCodes = await Promise.all(promises);
      const lastStatus = statusCodes[statusCodes.length - 1] || null;

      setStats((prev) => ({
        ...prev,
        get: {
          count: prev.get.count + batchSize,
          lastStatus,
        },
      }));

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  }, [makeErrorRequest]);

  // Spam PATCH requests
  const spamPatch = useCallback(async () => {
    setIsRunning(true);
    const batchSize = 10;
    const batches = 5; // 50 requests total

    for (let batch = 0; batch < batches; batch++) {
      const promises = Array(batchSize)
        .fill(0)
        .map(() => makeErrorRequest("PATCH"));

      const statusCodes = await Promise.all(promises);
      const lastStatus = statusCodes[statusCodes.length - 1] || null;

      setStats((prev) => ({
        ...prev,
        patch: {
          count: prev.patch.count + batchSize,
          lastStatus,
        },
      }));

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  }, [makeErrorRequest]);

  // Spam PUT requests
  const spamPut = useCallback(async () => {
    setIsRunning(true);
    const batchSize = 10;
    const batches = 5; // 50 requests total

    for (let batch = 0; batch < batches; batch++) {
      const promises = Array(batchSize)
        .fill(0)
        .map(() => makeErrorRequest("PUT"));

      const statusCodes = await Promise.all(promises);
      const lastStatus = statusCodes[statusCodes.length - 1] || null;

      setStats((prev) => ({
        ...prev,
        put: {
          count: prev.put.count + batchSize,
          lastStatus,
        },
      }));

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  }, [makeErrorRequest]);

  // Spam DELETE requests
  const spamDelete = useCallback(async () => {
    setIsRunning(true);
    const batchSize = 10;
    const batches = 5; // 50 requests total

    for (let batch = 0; batch < batches; batch++) {
      const promises = Array(batchSize)
        .fill(0)
        .map(() => makeErrorRequest("DELETE"));

      const statusCodes = await Promise.all(promises);
      const lastStatus = statusCodes[statusCodes.length - 1] || null;

      setStats((prev) => ({
        ...prev,
        delete: {
          count: prev.delete.count + batchSize,
          lastStatus,
        },
      }));

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  }, [makeErrorRequest]);

  // Spam all methods at once
  const spamAll = useCallback(async () => {
    setIsRunning(true);
    const batchSize = 10;
    const batches = 5; // 50 requests per method = 200 total

    for (let batch = 0; batch < batches; batch++) {
      const promises = [
        ...Array(batchSize).fill(0).map(() => makeErrorRequest("GET")),
        ...Array(batchSize).fill(0).map(() => makeErrorRequest("PATCH")),
        ...Array(batchSize).fill(0).map(() => makeErrorRequest("PUT")),
        ...Array(batchSize).fill(0).map(() => makeErrorRequest("DELETE")),
      ];

      const statusCodes = await Promise.all(promises);
      const lastStatus = statusCodes[statusCodes.length - 1] || null;

      setStats((prev) => ({
        ...prev,
        all: {
          count: prev.all.count + batchSize * 4,
          lastStatus,
        },
      }));

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  }, [makeErrorRequest]);

  // Make a bad request that will return 400 error (invalid data to valid endpoint)
  const makeBadRequest = useCallback(async (): Promise<number> => {
    // Use a valid endpoint that validates request body first
    // Using auth profile endpoint - it validates data before checking user
    const validEndpoint = `/v1/auth/profile`;
    const proxyUrl = `/api/test-errors?endpoint=${encodeURIComponent(validEndpoint)}`;

    // Get auth token for the request
    const authToken = await getAccessToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    // Send invalid data that will fail validation
    // Invalid: firstName too long (max 100), lastName too long (max 100), phone invalid
    const invalidData = {
      firstName: "A".repeat(200), // Too long (max 100)
      lastName: "B".repeat(200), // Too long (max 100)
      phone: "not-a-phone-number-12345", // Invalid format
    };

      try {
        const response = await fetch(proxyUrl, {
          method: "PATCH",
          headers,
          credentials: "include",
          body: JSON.stringify(invalidData),
        });
        const data = await response.json();
        // The proxy now returns the actual status code, but also includes it in body
        // Use response.status (actual HTTP status) or fallback to data.status
        return response.status || data.status || 0;
      } catch (error) {
        return 0;
      }
  }, [getAccessToken]);

  // Spam bad requests (400 errors)
  const spamBadRequest = useCallback(async () => {
    setIsRunning(true);
    const batchSize = 10;
    const batches = 5; // 50 requests total

    for (let batch = 0; batch < batches; batch++) {
      const promises = Array(batchSize)
        .fill(0)
        .map(() => makeBadRequest());

      const statusCodes = await Promise.all(promises);
      const lastStatus = statusCodes[statusCodes.length - 1] || null;

      setStats((prev) => ({
        ...prev,
        badRequest: {
          count: prev.badRequest.count + batchSize,
          lastStatus,
        },
      }));

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  }, [makeBadRequest]);

  // Reset stats
  const resetStats = useCallback(() => {
    setStats({
      get: { count: 0, lastStatus: null },
      patch: { count: 0, lastStatus: null },
      put: { count: 0, lastStatus: null },
      delete: { count: 0, lastStatus: null },
      all: { count: 0, lastStatus: null },
      badRequest: { count: 0, lastStatus: null },
    });
  }, []);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Error Testing Page (Temporary)</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">⚠️ Temporary Test Page</CardTitle>
              <CardDescription>
                This page spams 4xx errors to test if high error rates cause AWS crashes. 
                "404 Errors" buttons send requests to invalid endpoints. 
                "Bad Request" button sends invalid data to valid endpoints (400 errors).
                Each button sends 50 requests. "All at once" sends 200 requests (50 per method).
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Error Statistics</CardTitle>
              <CardDescription>Track how many 4xx errors have been sent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">GET Requests:</span>
                  <span className="text-muted-foreground">
                    {stats.get.count} errors
                    {stats.get.lastStatus && ` (Last: ${stats.get.lastStatus})`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">PATCH Requests:</span>
                  <span className="text-muted-foreground">
                    {stats.patch.count} errors
                    {stats.patch.lastStatus && ` (Last: ${stats.patch.lastStatus})`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">PUT Requests:</span>
                  <span className="text-muted-foreground">
                    {stats.put.count} errors
                    {stats.put.lastStatus && ` (Last: ${stats.put.lastStatus})`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">DELETE Requests:</span>
                  <span className="text-muted-foreground">
                    {stats.delete.count} errors
                    {stats.delete.lastStatus && ` (Last: ${stats.delete.lastStatus})`}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">All Methods Combined (404):</span>
                  <span className="text-muted-foreground">
                    {stats.all.count} errors
                    {stats.all.lastStatus && ` (Last: ${stats.all.lastStatus})`}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-medium">Bad Requests (400):</span>
                  <span className="text-muted-foreground">
                    {stats.badRequest.count} errors
                    {stats.badRequest.lastStatus && ` (Last: ${stats.badRequest.lastStatus})`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Controls</CardTitle>
              <CardDescription>Send error requests to test API stability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">404 Errors (Invalid Endpoints)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button onClick={spamGet} disabled={isRunning} variant="destructive">
                      Spam GET (50 requests)
                    </Button>
                    <Button onClick={spamPatch} disabled={isRunning} variant="destructive">
                      Spam PATCH (50 requests)
                    </Button>
                    <Button onClick={spamPut} disabled={isRunning} variant="destructive">
                      Spam PUT (50 requests)
                    </Button>
                    <Button onClick={spamDelete} disabled={isRunning} variant="destructive">
                      Spam DELETE (50 requests)
                    </Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-2">400 Errors (Bad Requests)</h3>
                  <Button
                    onClick={spamBadRequest}
                    disabled={isRunning}
                    variant="destructive"
                    className="w-full"
                  >
                    Spam Bad Requests (50 requests)
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sends invalid data to valid endpoints to trigger validation errors
                  </p>
                </div>
                <Separator />
                <Button
                  onClick={spamAll}
                  disabled={isRunning}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  Spam All 404 Methods (200 requests)
                </Button>
                <Button onClick={resetStats} disabled={isRunning} variant="outline" className="w-full">
                  Reset Statistics
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
