import Link from "next/link";
import {
  ArrowRightIcon,
  BanknotesIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { Button } from "@cashsouk/ui";
import { InvestmentListingsCarousel } from "./investment-listings-carousel";

const FEATURE_ITEMS = [
  {
    title: "Passive income",
    description:
      "Build wealth while you sleep with automated dividend payouts directly to your wallet.",
    Icon: BanknotesIcon,
    span: "lg:col-span-3" as const,
  },
  {
    title: "Secure transactions",
    description:
      "Military-grade encryption and multi-sig wallets ensure your capital is always protected.",
    Icon: ShieldCheckIcon,
    span: "lg:col-span-3" as const,
  },
  {
    title: "Fast approvals",
    description: "Get funded in as little as 72 hours with our AI-driven vetting system.",
    Icon: CheckCircleIcon,
    span: "lg:col-span-2" as const,
  },
  {
    title: "Analytics",
    description: "Deep insights into project health, market trends, historical performance.",
    Icon: ChartBarIcon,
    span: "lg:col-span-2" as const,
  },
  {
    title: "Diversification",
    description: "Spread your risk across multiple uncorrelated assets effortlessly.",
    Icon: UserGroupIcon,
    span: "lg:col-span-2" as const,
  },
];

function FeatureCard({ title, description, Icon, span }: (typeof FEATURE_ITEMS)[number]) {
  return (
    <article className={`rounded-2xl border border-border/60 bg-muted/40 p-6 md:p-8 ${span}`}>
      <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-bold text-foreground md:text-xl">{title}</h3>
      <p className="mt-3 text-[17px] leading-7 text-muted-foreground">{description}</p>
    </article>
  );
}

function ConvenienceSection() {
  return (
    <section className="bg-background py-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <header className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
            Financing and investing that meets you where you are
          </h2>
          <p className="mt-4 text-[17px] leading-7 text-muted-foreground">
            Flexible funding options tailored to your business needs.
          </p>
        </header>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-6">
          {FEATURE_ITEMS.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingInvestmentListings() {
  return (
    <section className="w-full min-w-0 border-t border-border/60 bg-muted/35 py-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <header className="max-w-2xl space-y-4 text-left">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Invest</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
              Invest in verified secured loans
            </h2>
            <p className="text-[17px] leading-7 text-muted-foreground">
              Build a diversified portfolio from facilities that are reviewed and structured for
              clarity—with transparent key terms before you commit.
            </p>
          </header>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-xl border-border bg-background px-6 text-[15px] font-semibold text-foreground hover:bg-muted"
            >
              <Link href="/marketplace" className="inline-flex items-center gap-2">
                View all listings
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              className="h-12 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-brand hover:opacity-95"
            >
              <Link href="/get-started">Start investing</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-12 w-full min-w-0">
        <InvestmentListingsCarousel />
      </div>
    </section>
  );
}

export function LandingConvenienceAndListings() {
  return <ConvenienceSection />;
}
