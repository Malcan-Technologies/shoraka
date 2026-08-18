import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "body",
            "ui",
            "meta",
            "page-title",
            "section-title",
            "card-title",
            "dialog-title",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Splits a remark string into lines for bullet display. Each non-empty line becomes a bullet. */
export function formatRemarkAsBullets(remark: string): string[] {
  return remark.split("\n").map((s) => s.trim()).filter(Boolean)
}
