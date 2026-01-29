"use client";

import * as React from "react";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cashsouk/ui/card";
import { Button } from "@cashsouk/ui/button";
import { Input, Label } from "@cashsouk/ui";
import { BoltIcon, StopIcon, PlayIcon } from "@heroicons/react/24/outline";

// Load test page for debugging ECS crashes and memory issues
const API_URL_DEFAULT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type EndpointId = "health" | "404" | "500";

const ENDPOINTS: { id: EndpointId; label: string; url: (base: string) => string }[] = [
  { id: "health", label: "Health (200)", url: (base) => `${base}/healthz` },
  { id: "404", label: "404", url: (base) => `${base}/v1/nonexistent-load-test-route` },
  { id: "500", label: "500", url: (base) => `${base}/v1/internal/load-test?code=500` },
];

export default function LoadTestPage() {
  const [baseUrl, setBaseUrl] = React.useState(API_URL_DEFAULT);
  const [rps, setRps] = React.useState(5);
  const [endpoints, setEndpoints] = React.useState<EndpointId[]>(["health", "404", "500"]);
  const [running, setRunning] = React.useState(false);
  const [stats, setStats] = React.useState({ total: 0, "2xx": 0, "4xx": 0, "5xx": 0, errors: 0 });
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleEndpoint = (id: EndpointId) => {
    setEndpoints((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const fireOne = React.useCallback(async () => {
    const list = ENDPOINTS.filter((e) => endpoints.includes(e.id));
    if (list.length === 0) return;
    const chosen = list[Math.floor(Math.random() * list.length)];
    const targetUrl = chosen.url(baseUrl);
    try {
      const res = await fetch(targetUrl, { cache: "no-store" });
      setStats((s) => {
        const next = { ...s, total: s.total + 1 };
        if (res.ok) next["2xx"]++;
        else if (res.status >= 500) next["5xx"]++;
        else next["4xx"]++;
        return next;
      });
    } catch {
      setStats((s) => ({ ...s, total: s.total + 1, errors: s.errors + 1 }));
    }
  }, [endpoints, baseUrl]);

  const start = () => {
    if (running) return;
    setRunning(true);
    setStats({ total: 0, "2xx": 0, "4xx": 0, "5xx": 0, errors: 0 });
    const ms = 1000 / rps;
    intervalRef.current = setInterval(fireOne, ms);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  };

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Load Test</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BoltIcon className="h-5 w-5" />
              API load test
            </CardTitle>
            <CardDescription>
              Hit the API at a set rate to help reproduce ECS crashes. Watch CloudWatch logs and
              memory metrics while this runs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="baseUrl">API base URL</Label>
              <Input
                id="baseUrl"
                value={baseUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaseUrl(e.target.value)}
                placeholder="https://api.cashsouk.com"
                disabled={running}
              />
            </div>
            <div className="grid gap-2">
              <Label>Requests per second</Label>
              <div className="flex gap-2">
                {[1, 2, 5, 10].map((n) => (
                  <Button
                    key={n}
                    variant={rps === n ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRps(n)}
                    disabled={running}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Endpoints to hit</Label>
              <div className="flex flex-wrap gap-2">
                {ENDPOINTS.map((e: (typeof ENDPOINTS)[number]) => (
                  <Button
                    key={e.id}
                    variant={endpoints.includes(e.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleEndpoint(e.id)}
                    disabled={running}
                  >
                    {e.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={start} disabled={running} className="gap-2">
                <PlayIcon className="h-4 w-4" />
                Start
              </Button>
              <Button variant="destructive" onClick={stop} disabled={!running} className="gap-2">
                <StopIcon className="h-4 w-4" />
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stats</CardTitle>
            <CardDescription>Live counts while the test is running</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-mono font-semibold">{stats.total}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">2xx</dt>
                <dd className="font-mono font-semibold text-green-600">{stats["2xx"]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">4xx</dt>
                <dd className="font-mono font-semibold text-amber-600">{stats["4xx"]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">5xx</dt>
                <dd className="font-mono font-semibold text-red-600">{stats["5xx"]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Errors</dt>
                <dd className="font-mono font-semibold text-red-600">{stats.errors}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
