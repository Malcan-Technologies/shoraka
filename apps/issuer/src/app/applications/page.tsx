"use client";

import * as React from "react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useApplications } from "@/hooks/use-applications";

const staticApplications = [
  {
    id: "app-001",
    status: "DRAFT",
    financingType: "Invoice Financing",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "app-002",
    status: "SUBMITTED",
    financingType: "Purchase Order Financing",
    createdAt: "2024-01-10T14:20:00Z",
  },
  {
    id: "app-003",
    status: "APPROVED",
    financingType: "Invoice Financing",
    createdAt: "2024-01-05T09:15:00Z",
  },
];

export default function ApplicationsPage() {
  const { data: backendData } = useApplications({
    page: 1,
    pageSize: 10,
  });

  React.useEffect(() => {
    if (backendData) {
      console.log("Backend applications data:", backendData);
    }
  }, [backendData]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Applications</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">My Applications</h2>
              <p className="text-[17px] leading-7 text-muted-foreground">
                View and manage your financing applications
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/applications/new">
                <PlusIcon className="h-4 w-4" />
                New Application
              </Link>
            </Button>
          </div>

          <div className="space-y-4">
            {staticApplications.map((app) => (
              <Card key={app.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{app.financingType}</CardTitle>
                    <Badge variant="outline">{app.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Application ID: {app.id}</p>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button asChild variant="outline">
                      <Link href={`/applications/${app.id}`}>View</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
