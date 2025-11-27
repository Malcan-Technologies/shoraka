"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Logo,
} from "@cashsouk/ui";
import { ArrowRightIcon, ArrowRightEndOnRectangleIcon } from "@heroicons/react/24/outline";

export default function OnboardingStartPage() {
  const handleStartOnboarding = () => {
    // TODO: Navigate to onboarding flow
  };

  const handleLogout = () => {
    // TODO: Handle logout
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {/* Main Card */}
        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="text-center space-y-2 pb-4">
            <CardTitle className="text-2xl font-bold">Welcome to CashSouk</CardTitle>
            <CardDescription className="text-[15px] leading-7">
              Let's set up your <strong>Investor</strong> account to start exploring verified loan
              opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Button
              variant="action"
              className="w-full h-11 text-[15px]"
              onClick={handleStartOnboarding}
            >
              <span>Start Onboarding</span>
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full h-11 text-[15px] hover:bg-transparent hover:text-primary"
              onClick={handleLogout}
            >
              <ArrowRightEndOnRectangleIcon className="h-4 w-4 mr-2" />
              <span>Logout</span>
            </Button>

            <p className="text-xs text-center text-muted-foreground pt-2">
              Complete your onboarding to access your investor dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
