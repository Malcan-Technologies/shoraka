import Image from "next/image";
import Link from "next/link";
import {
  ArrowPathRoundedSquareIcon,
  ArrowUpRightIcon,
  HeartIcon,
  LockClosedIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@cashsouk/ui";

const BLOG_POSTS = [
  {
    title: "A Concise Guide to Debt Investment",
    excerpt:
      "Understand how secured notes and invoice-backed facilities fit alongside traditional fixed income in your portfolio.",
    author: "Olivia Rhye",
    date: "20 Jan 2025",
    image:
      "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=640&q=80",
    href: "#",
  },
  {
    title: "The Complete Guide to SME Business",
    excerpt:
      "Practical steps for founders to tighten cash conversion cycles and prepare for growth-stage financing.",
    author: "Phoenix Baker",
    date: "19 Jan 2025",
    image:
      "https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=640&q=80",
    href: "#",
  },
  {
    title: "A Guide to SME Digital Financing",
    excerpt:
      "How digital onboarding, e-invoicing, and API-led checks are shortening time-to-fund for healthy SMEs.",
    author: "Lana Steiner",
    date: "18 Jan 2025",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=640&q=80",
    href: "#",
  },
];

const FAQ_ITEMS = [
  {
    Icon: HeartIcon,
    question: "How do investors earn returns?",
    answer:
      "Returns come from scheduled repayments on facilities you participate in. Cash is distributed according to the facility terms shown before you commit, with visibility on principal and profit or fee components depending on structure.",
  },
  {
    Icon: ArrowPathRoundedSquareIcon,
    question: "How long does it take to get funded?",
    answer:
      "Many businesses receive an initial decision within a few business days after documents are complete. Complex cases or additional verification can add time; your deal team will keep you updated at each stage.",
  },
  {
    Icon: NoSymbolIcon,
    question: "What is your cancellation policy?",
    answer:
      "You can withdraw from an offer before funds are disbursed. Once funds have moved and the facility is active, cancellation follows the legal agreement for that facility—including any applicable fees described upfront.",
  },
  {
    Icon: LockClosedIcon,
    question: "Is CashSouk safe to use?",
    answer:
      "We apply strong authentication, encryption in transit, and strict access controls. Funds are handled through approved arrangements, and we do not display full banking details in marketing communications. Review our security pages and terms for full detail.",
  },
];

function AuthorAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
      aria-hidden
    >
      {initials}
    </div>
  );
}

function BlogSection() {
  return (
    <section className="border-t border-border/60 bg-muted/35 py-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <header className="max-w-2xl space-y-4 text-left">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Our blog</p>
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
              Latest blog posts
            </h2>
            <p className="text-[17px] leading-7 text-muted-foreground">
              Tools and strategies modern teams need to help their companies grow.
            </p>
          </header>
          <Button
            asChild
            className="h-12 shrink-0 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-brand hover:opacity-95 md:self-end"
          >
            <Link href="#">View all posts</Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.title}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <Link
                href={post.href}
                className="relative block aspect-[16/10] shrink-0 overflow-hidden"
              >
                <Image
                  src={post.image}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-200 hover:scale-[1.02]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </Link>
              <div className="flex flex-col p-6">
                <Link
                  href={post.href}
                  className="group inline-flex items-start gap-2 text-lg font-bold text-foreground hover:text-primary"
                >
                  <span>{post.title}</span>
                  <ArrowUpRightIcon className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
                </Link>
                <p className="mt-3 line-clamp-3 text-[15px] leading-6 text-muted-foreground">
                  {post.excerpt}
                </p>
                <div className="mt-10 flex w-full shrink-0 items-center gap-3 border-t border-border/60 pt-5">
                  <AuthorAvatar name={post.author} />
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-foreground">{post.author}</p>
                    <p className="text-muted-foreground">{post.date}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="bg-background py-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Support</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-[17px] leading-7 text-muted-foreground">
            Straight answers on how investing and financing work on CashSouk. Can&apos;t find the
            answer you&apos;re looking for? Please{" "}
            <Link
              href="mailto:hello@cashsouk.com"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              chat to our friendly team
            </Link>
            .
          </p>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <ul className="flex flex-col gap-10" role="list">
            {FAQ_ITEMS.map(({ Icon, question, answer }) => (
              <li key={question} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
                  <Icon className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-foreground">{question}</h3>
                  <p className="mt-2 text-[17px] leading-7 text-muted-foreground">{answer}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="relative aspect-square w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-muted/30 lg:mx-auto lg:max-w-none">
            <Image
              src="/faq-handshake.png"
              alt="Business partners shaking hands outdoors"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingBlogAndFaq() {
  return (
    <>
      <BlogSection />
      <FaqSection />
    </>
  );
}
