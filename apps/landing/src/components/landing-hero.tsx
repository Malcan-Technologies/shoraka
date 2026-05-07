"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@cashsouk/ui";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-24 md:pt-28 pb-10 md:pb-16">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
            backgroundSize: "72px 72px",
            maskImage:
              "radial-gradient(ellipse 75% 70% at 50% 35%, black 20%, transparent 72%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 75% 70% at 50% 35%, black 20%, transparent 72%)",
          }}
        />
      </div>

      <div className="relative z-[1] mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="space-y-6">
            <div
              className="inline-flex max-w-full flex-wrap items-center overflow-hidden rounded-full border border-border bg-card text-[15px] shadow-sm"
            >
              <span className="inline-flex items-center gap-2 bg-muted px-4 py-2 font-medium text-secondary-foreground">
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                Welcome
              </span>
              <span className="inline-flex items-center gap-1 px-4 py-2 font-medium text-foreground">
                #1 supply chain financing in Malaysia
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
              Invest smartly or{" "}
              <span className="text-primary">Get Funded</span>
            </h1>

            <p className="max-w-[40rem] text-[17px] leading-7 text-muted-foreground">
              CashSouk connects investors with real business opportunities across multiple
              industries. Transparent, secure, and built for growth.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                variant="action"
                className="h-12 rounded-xl px-8 text-[15px] font-semibold"
              >
                <Link href="/get-started">Start investing</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-xl border-border bg-background px-8 text-[15px] font-semibold text-foreground hover:bg-muted hover:text-foreground"
              >
                <Link href="/get-started">Apply for financing</Link>
              </Button>
            </div>
          </div>

          <div>
            <div className="relative mx-auto aspect-[4/3] w-full max-w-xl lg:max-w-none lg:translate-y-1">
              <Image
                src="/hero-home.png"
                alt="Professionals collaborating around a conference table"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="rounded-2xl object-cover object-center shadow-md"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
