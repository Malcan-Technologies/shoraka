import Link from "next/link";
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BoltIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  CheckIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  MoonIcon,
  ReceiptPercentIcon,
  ShieldCheckIcon,
  StarIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { Badge, Button } from "@cashsouk/ui";

const INVOICE_STEPS = [
  {
    title: "Submit your invoice",
    description: "Upload invoices and basic trade details through our secure portal.",
    Icon: DocumentTextIcon,
  },
  {
    title: "Invoice verification",
    description: "We validate authenticity and buyer creditworthiness quickly.",
    Icon: CheckCircleIcon,
  },
  {
    title: "Get approved",
    description: "Receive a clear offer with advance rate and transparent fees.",
    Icon: DocumentCheckIcon,
  },
  {
    title: "Receive advance payment",
    description: "Funds are disbursed to your account so you can keep operating.",
    Icon: BanknotesIcon,
  },
  {
    title: "Customer pays invoice",
    description: "Your customer settles on maturity; we reconcile and close the loop.",
    Icon: ReceiptPercentIcon,
  },
];

const AR_PRODUCT_POINTS = [
  "Get up to 90% advance on invoices",
  "Fast approval within 24–48 hours",
  "No collateral required",
  "100% Shariah-compliant financing",
];

const FOR_BUSINESSES_FEATURES = [
  {
    title: "Instant liquidity",
    description: "Unlock cash tied up in receivables without waiting on long payment cycles.",
    Icon: BoltIcon,
  },
  {
    title: "Zero debt burden",
    description: "Financing is tied to invoices you’ve already earned—not new term debt.",
    Icon: BanknotesIcon,
  },
  {
    title: "Non-dilutive growth",
    description: "Scale operations and fulfil orders without giving up equity.",
    Icon: ArrowTrendingUpIcon,
  },
];

const FOR_INVESTORS_FEATURES = [
  {
    title: "Asset-backed security",
    description: "Exposure is anchored to short-term receivables with defined maturities.",
    Icon: ShieldCheckIcon,
  },
  {
    title: "Short-term rotation",
    description: "Capital cycles through vetted facilities with clear repayment timelines.",
    Icon: ArrowPathIcon,
  },
  {
    title: "Rigorous vetting",
    description: "Every issuer and facility is reviewed before it reaches the platform.",
    Icon: CheckCircleIcon,
  },
];

function ShariahMark() {
  return (
    <div
      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
      aria-hidden
    >
      <div className="flex items-center gap-0.5">
        <MoonIcon className="size-5" />
        <StarIcon className="size-3.5" />
      </div>
    </div>
  );
}

function InvoiceSimpleSection() {
  return (
    <section className="border-t border-border/60 bg-muted/35 py-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Borrow</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
            Finance your invoices with ease
          </h2>
          <p className="text-[17px] leading-7 text-muted-foreground">
            Turn outstanding invoices into working capital. CashSouk’s receivables financing helps
            healthy businesses smooth cash flow while investors participate in well-structured,
            Shariah-aligned facilities.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:mt-14 lg:grid-cols-2 lg:items-start lg:gap-16">
          <ol className="relative space-y-0" aria-label="Invoice financing steps">
            {INVOICE_STEPS.map((step, index) => {
              const { Icon } = step;
              const isLast = index === INVOICE_STEPS.length - 1;
              return (
                <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0">
                  {!isLast ? (
                    <span className="absolute left-5 top-11 bottom-0 w-px bg-border" aria-hidden />
                  ) : null}
                  <div className="relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-[17px] leading-7 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8 lg:p-10">
            <div className="flex items-start justify-between gap-4">
              <ShariahMark />
              <Badge
                variant="secondary"
                className="border-transparent bg-emerald-100 text-emerald-900 hover:bg-emerald-100/90"
              >
                Popular
              </Badge>
            </div>
            <h3 className="mt-6 text-xl font-bold text-foreground md:text-2xl">
              Account receivable (AR) financing
            </h3>
            <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
              Accelerate cash flow against verified invoices—with transparent pricing and
              Shariah-compliant structures built for Malaysian SMEs.
            </p>
            <ul className="mt-8 space-y-4" role="list">
              {AR_PRODUCT_POINTS.map((line) => (
                <li key={line} className="flex gap-3 text-[17px] leading-7 text-foreground">
                  <CheckIcon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-10 h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-brand hover:opacity-95"
            >
              <Link href="/get-started">Get financing</Link>
            </Button>
          </article>
        </div>
      </div>
    </section>
  );
}

function WhyARSection() {
  return (
    <section className="bg-background py-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Why AR?</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
            Why Account Receivable (AR) financing?
          </h2>
          <p className="mt-4 text-[17px] leading-7 text-muted-foreground">
            Whether you’re growing a business or diversifying investments, AR financing aligns
            incentives: businesses access liquidity; investors gain exposure to short-term,
            asset-backed cash flows.
          </p>
        </header>

        <div className="mt-12 grid gap-6 lg:mt-14 lg:grid-cols-2 lg:gap-8 lg:items-stretch">
          <article className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card p-6 shadow-sm md:p-10 lg:p-12">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BuildingOffice2Icon className="size-6" aria-hidden />
            </div>
            <h3 className="mt-6 text-xl font-bold text-foreground md:text-2xl">For businesses</h3>
            <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
              Strengthen your balance sheet with funding that maps to real trade—not generic loans.
            </p>
            <ul className="mt-8 flex flex-col gap-6" role="list">
              {FOR_BUSINESSES_FEATURES.map(({ title, description, Icon }) => (
                <li key={title} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{title}</p>
                    <p className="mt-1 text-[15px] leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-auto w-full pt-16">
              <Button
                asChild
                className="h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-brand hover:opacity-95"
              >
                <Link href="/get-started">Get financing</Link>
              </Button>
            </div>
          </article>

          <article className="flex h-full min-h-0 flex-col rounded-2xl border border-primary/25 bg-primary p-6 text-primary-foreground shadow-[0_24px_55px_-18px_rgba(138,3,4,0.45)] md:p-10 lg:p-12">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground">
              <UserGroupIcon className="size-6" aria-hidden />
            </div>
            <h3 className="mt-6 text-xl font-bold md:text-2xl">For investors</h3>
            <p className="mt-3 text-[17px] leading-7 text-primary-foreground/90">
              Participate in facilitated receivables programmes with clear structures and
              disciplined onboarding.
            </p>
            <ul className="mt-8 flex flex-col gap-6" role="list">
              {FOR_INVESTORS_FEATURES.map(({ title, description, Icon }) => (
                <li key={title} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15 text-primary-foreground">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="mt-1 text-[15px] leading-6 text-primary-foreground/85">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-auto w-full pt-16">
              <Button
                asChild
                className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-foreground shadow-none hover:opacity-95"
              >
                <Link href="/marketplace">Start investing</Link>
              </Button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function LandingFinancingSections() {
  return (
    <>
      <InvoiceSimpleSection />
      <WhyARSection />
    </>
  );
}
