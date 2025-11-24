"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cashsouk/ui";
import { UserIcon, BuildingLibraryIcon } from "@heroicons/react/24/outline";

export default function GetStartedPage() {
  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Get Started</h1>
        <p className="text-[15px] text-muted-foreground">Choose how you'd like to join CashSouk</p>
      </div>

      <div className="w-full max-w-xl grid gap-4">
        <Link href="/signup/investor" className="block">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BuildingLibraryIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">I'm an Investor</CardTitle>
                  <CardDescription className="text-sm">
                    Invest in verified borrowers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Earn competitive returns by funding loans from our curated borrower pool.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/signup/borrower" className="block">
          <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-secondary/30 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">I'm a Borrower</CardTitle>
                  <CardDescription className="text-sm">Get funding for your needs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Apply for a loan with flexible terms and transparent rates.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login/investor" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
