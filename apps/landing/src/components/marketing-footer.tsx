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
  Input,
  Logo,
} from "@cashsouk/ui";
import {
  BuildingLibraryIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  HandRaisedIcon,
  RectangleStackIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

const SOCIAL_LINKS = [
  { href: "#", label: "X (Twitter)", Icon: ChatBubbleLeftRightIcon },
  { href: "#", label: "LinkedIn", Icon: BuildingLibraryIcon },
  { href: "#", label: "Facebook", Icon: UserGroupIcon },
  { href: "#", label: "GitHub", Icon: CodeBracketIcon },
  { href: "#", label: "Social", Icon: HandRaisedIcon },
  { href: "#", label: "Website", Icon: GlobeAltIcon },
  { href: "#", label: "More", Icon: RectangleStackIcon },
] as const;

export function MarketingFooter() {
  const year = new Date().getFullYear();

  const onNewsletterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) {
      toast.error("Please enter your email.");
      return;
    }
    toast.success("Thanks — we'll be in touch soon.");
    e.currentTarget.reset();
  };

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="border-b border-primary-foreground/15">
        <div className="mx-auto max-w-7xl px-6 py-10 text-center md:py-12">
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
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 md:py-12 lg:grid-cols-2 lg:gap-14">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <Logo className="brightness-0 invert" size={44} />
            </Link>
            <p className="mt-4 max-w-md text-[17px] leading-7 text-primary-foreground/85">
              Building the future of decentralized business finance. Secure, transparent, and built
              for everyone.
            </p>
            <nav
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] font-medium"
              aria-label="Footer"
            >
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-sm text-primary-foreground outline-none ring-offset-primary transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-foreground/60 focus-visible:ring-offset-2">
                  Invest
                  <ChevronDownIcon className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[12rem]">
                  <DropdownMenuItem asChild>
                    <Link href="/marketplace">Marketplace</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/get-started">Browse opportunities</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/get-started">How investing works</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-sm text-primary-foreground outline-none ring-offset-primary transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-foreground/60 focus-visible:ring-offset-2">
                  Finance
                  <ChevronDownIcon className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[12rem]">
                  <DropdownMenuItem asChild>
                    <Link href="/get-started">Apply for financing</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/get-started">For businesses</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link
                href="/marketplace"
                className="rounded-sm text-primary-foreground outline-none ring-offset-primary hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-foreground/60 focus-visible:ring-offset-2"
              >
                Marketplace
              </Link>

              <Link
                href="#"
                className="rounded-sm text-primary-foreground outline-none ring-offset-primary hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-foreground/60 focus-visible:ring-offset-2"
              >
                About us
              </Link>
              <Link
                href="#"
                className="rounded-sm text-primary-foreground outline-none ring-offset-primary hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-foreground/60 focus-visible:ring-offset-2"
              >
                Blog
              </Link>
              <Link
                href="mailto:hello@cashsouk.com"
                className="rounded-sm text-primary-foreground outline-none ring-offset-primary hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary-foreground/60 focus-visible:ring-offset-2"
              >
                Contact us
              </Link>
            </nav>
          </div>

          <div className="lg:justify-self-end lg:text-left">
            <form
              onSubmit={onNewsletterSubmit}
              className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-stretch lg:ml-auto"
            >
              <Input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Enter your email"
                className="h-12 flex-1 rounded-xl border-0 bg-primary-foreground px-4 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary-foreground/40"
              />
              <Button
                type="submit"
                className="h-12 shrink-0 rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-foreground shadow-none hover:opacity-95"
              >
                Subscribe
              </Button>
            </form>
            <p className="mt-3 text-sm leading-6 text-primary-foreground/80">
              We care about your data in our{" "}
              <Link
                href="#"
                className="font-medium text-primary-foreground underline underline-offset-4 hover:opacity-90"
              >
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-8 sm:flex-row">
        <p className="text-sm text-primary-foreground/80">
          © {year} CashSouk. All rights reserved.
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-5" aria-label="Social links">
          {SOCIAL_LINKS.map(({ href, label, Icon }) => (
            <li key={label}>
              <Link
                href={href}
                aria-label={label}
                className="text-primary-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm"
              >
                <Icon className="size-6" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
