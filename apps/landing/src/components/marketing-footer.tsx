"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Logo,
  openPublicLegalPdf,
  useLandingFooterLegalLinks,
} from "@cashsouk/ui";
import { COMPANY, HELP_CENTER_URL, companyCopyrightLine, companyTelHref } from "@cashsouk/config";
import { ChevronDownIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";

export function MarketingFooter() {
  const { links: legalLinks } = useLandingFooterLegalLinks();

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="border-b border-primary-foreground/15">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 text-center md:py-12">
          <h2 className="text-2xl font-bold tracking-tight text-primary-foreground md:text-3xl lg:text-4xl">
            Start Your Investment Journey Today
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-7 text-primary-foreground/90">
            Join thousands of investors growing their wealth through real-world assets. Sign up
            takes less than 2 minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 rounded-xl bg-primary-foreground px-8 text-[15px] font-semibold text-primary shadow-none hover:bg-primary-foreground/90"
            >
              <Link href="/get-started">Apply for financing</Link>
            </Button>
            <Button
              asChild
              className="h-12 rounded-xl bg-accent px-8 text-[15px] font-semibold text-accent-foreground shadow-none hover:opacity-95"
            >
              <Link href="/get-started">Start investing</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-primary-foreground/15">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 md:py-12 lg:grid-cols-3 lg:gap-14">
          <div>
            <Link href="/" className="inline-flex max-w-md items-center">
              <Logo className="brightness-0 invert" size={112} />
            </Link>
            <div className="mt-6 space-y-1 text-sm leading-6 text-primary-foreground/85">
              <p className="font-medium text-primary-foreground">{COMPANY.legalName}</p>
              <p>Registration No. {COMPANY.registrationNumber}</p>
              {COMPANY.address ? <p>{COMPANY.address}</p> : null}
              <p>
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                >
                  <EnvelopeIcon className="size-4 shrink-0" aria-hidden />
                  {COMPANY.email}
                </a>
              </p>
              <p>
                <a
                  href={companyTelHref()}
                  className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
                >
                  <PhoneIcon className="size-4 shrink-0" aria-hidden />
                  {COMPANY.phone}
                </a>
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/70">
              Explore
            </p>
            <nav className="mt-4 flex flex-col gap-3 text-[15px] font-medium" aria-label="Footer explore">
              <Link href="/marketplace" className="hover:opacity-90">
                Marketplace
              </Link>
              <Link href="/get-started" className="hover:opacity-90">
                Apply for financing
              </Link>
              <Link href="/get-started" className="hover:opacity-90">
                Start investing
              </Link>
              <a href={HELP_CENTER_URL} target="_blank" rel="noreferrer noopener" className="hover:opacity-90">
                Help Center
              </a>
            </nav>

            <DropdownMenu>
              <DropdownMenuTrigger className="mt-6 inline-flex items-center gap-1 rounded-sm text-[15px] font-medium text-primary-foreground outline-none ring-offset-primary transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-foreground/60 focus-visible:ring-offset-2">
                More
                <ChevronDownIcon className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem]">
                <DropdownMenuItem asChild>
                  <Link href="/get-started">How investing works</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/get-started">For businesses</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-foreground/70">
              Legal
            </p>
            <nav className="mt-4 flex flex-col gap-3 text-[15px] font-medium" aria-label="Footer legal">
              {legalLinks.map((link) => (
                <button
                  key={link.versionId}
                  type="button"
                  className="text-left hover:opacity-90"
                  onClick={() => {
                    void openPublicLegalPdf(link.versionId, "view").catch(() => {
                      toast.error("Unable to open this legal document right now.");
                    });
                  }}
                >
                  {link.label}
                </button>
              ))}
              {legalLinks.length === 0 ? (
                <span className="text-primary-foreground/70">No public legal documents yet</span>
              ) : null}
            </nav>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-sm leading-6 text-primary-foreground/80">{companyCopyrightLine()}</p>
      </div>
    </footer>
  );
}
