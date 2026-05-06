"use client";

import * as React from "react";
import Image from "next/image";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon,
} from "@heroicons/react/24/solid";

const COLLAGE_IMAGES = [
  "/hero-home.png",
  "/faq-handshake.png",
] as const;

const TESTIMONIALS = [
  {
    quote:
      "We've been able to scale faster by combining our deposits, spend and controls in one account.",
    name: "Sienna Hewitt",
    role: "Finance Manager, Sisyphus",
  },
  {
    quote:
      "CashSouk cut our approval cycle dramatically—our team finally has one place to track covenant checks and disbursements.",
    name: "Marcus Chen",
    role: "CFO, Northwind Supplies",
  },
  {
    quote:
      "The transparency on fees and Shariah structures gave our board confidence to participate in invoice facilities.",
    name: "Aisha Karim",
    role: "Head of Treasury, Lima Group",
  },
];

function collageSrc(i: number) {
  return COLLAGE_IMAGES[i % COLLAGE_IMAGES.length];
}

export function TestimonialLogoCloud() {
  const [index, setIndex] = React.useState(0);
  const t = TESTIMONIALS[index];
  const prev = () => setIndex((i) => (i === 0 ? TESTIMONIALS.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === TESTIMONIALS.length - 1 ? 0 : i + 1));

  return (
    <section className="bg-background py-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} className="size-6 text-amber-400" />
              ))}
            </div>
            <blockquote className="mt-6">
              <p className="text-2xl font-bold leading-snug tracking-tight text-foreground md:text-3xl lg:text-[1.65rem] lg:leading-snug xl:text-3xl">
                {t.quote}
              </p>
            </blockquote>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="relative size-12 shrink-0 overflow-hidden rounded-full bg-secondary"
                  aria-hidden
                >
                  <Image
                    src={collageSrc(index)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div>
                  <p className="font-bold text-foreground">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={prev}
                  className="flex size-10 items-center justify-center rounded-full border border-border bg-muted/80 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeftIcon className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="flex size-10 items-center justify-center rounded-full border border-border bg-muted/80 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Next testimonial"
                >
                  <ChevronRightIcon className="size-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none">
            <div className="grid aspect-[5/4] min-h-[240px] w-full max-h-[320px] grid-cols-3 grid-rows-2 gap-2 sm:max-h-[380px] sm:gap-3">
              <div className="relative row-span-2 overflow-hidden rounded-xl">
                <Image
                  src={collageSrc(0)}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 33vw, 200px"
                />
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="relative min-h-[4.5rem] overflow-hidden rounded-xl sm:min-h-0"
                >
                  <Image
                    src={collageSrc(i)}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 33vw, 120px"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
