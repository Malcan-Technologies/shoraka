"use client";

import Link from "next/link";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";
import { Button } from "@cashsouk/ui";

export default function ComingSoonPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background flex items-center justify-center p-6 pt-24 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Gradient orbs */}
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-secondary/10 blur-3xl" />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Hero Card */}
        <div className="relative max-w-3xl w-full">
          <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-secondary" />

            <div className="p-8 md:p-12 lg:p-16">
              {/* Illustration */}
              <div className="flex justify-center mb-10">
                <div className="relative">
                  {/* Abstract illustration - financial/growth themed */}
                  <svg
                    viewBox="0 0 200 160"
                    className="w-48 h-40 md:w-56 md:h-44"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Background shapes */}
                    <circle cx="100" cy="80" r="60" className="fill-primary/5" />
                    <circle cx="100" cy="80" r="40" className="fill-secondary/10" />

                    {/* Rising bars chart */}
                    <rect
                      x="50"
                      y="90"
                      width="16"
                      height="40"
                      rx="3"
                      className="fill-secondary/60"
                    />
                    <rect
                      x="72"
                      y="70"
                      width="16"
                      height="60"
                      rx="3"
                      className="fill-secondary/80"
                    />
                    <rect x="94" y="50" width="16" height="80" rx="3" className="fill-primary/70" />
                    <rect x="116" y="35" width="16" height="95" rx="3" className="fill-primary" />
                    <rect x="138" y="55" width="16" height="75" rx="3" className="fill-accent/80" />

                    {/* Growth arrow */}
                    <path
                      d="M45 100 L85 75 L105 65 L125 40 L155 50"
                      className="stroke-primary"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <circle cx="155" cy="50" r="6" className="fill-primary" />

                    {/* Sparkle accents */}
                    <circle cx="130" cy="25" r="3" className="fill-accent" />
                    <circle cx="165" cy="35" r="2" className="fill-secondary" />
                    <circle cx="40" cy="70" r="2.5" className="fill-primary/60" />
                  </svg>

                  {/* Floating badge */}
                  <div className="absolute -top-2 -right-4 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                    P2P Lending
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="text-center space-y-6">
                <div className="space-y-4">
                  {/* <p className="text-sm font-medium tracking-widest uppercase text-primary">
                    Launching Soon
                  </p> */}
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                    Coming Soon
                  </h1>
                </div>

                <p className="text-[17px] leading-7 text-muted-foreground max-w-[55ch] mx-auto">
                  We're building something exceptional. CashSouk is a modern peer-to-peer lending
                  platform that connects issuers with investors — securely, transparently, and
                  efficiently.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                  <Link href="/get-started">
                    <Button className="bg-primary text-primary-foreground shadow-brand hover:opacity-95 h-12 px-8 text-[15px] font-medium">
                      Get Early Access
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="border-border hover:bg-muted h-12 px-8 text-[15px]"
                    onClick={() => (window.location.href = "mailto:hello@cashsouk.com")}
                  >
                    Contact Us
                  </Button>
                </div>
              </div>

              {/* Feature highlights */}
              <div className="mt-12 pt-8 border-t border-border/50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                      <svg
                        className="w-5 h-5 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-foreground">Secure</p>
                    <p className="text-xs text-muted-foreground">Bank-level security</p>
                  </div>
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center mx-auto">
                      <svg
                        className="w-5 h-5 text-secondary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-foreground">Transparent</p>
                    <p className="text-xs text-muted-foreground">Clear terms & rates</p>
                  </div>
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto">
                      <svg
                        className="w-5 h-5 text-accent"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-foreground">Efficient</p>
                    <p className="text-xs text-muted-foreground">Fast funding process</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0">
          <Footer />
        </div>
      </main>
    </>
  );
}
