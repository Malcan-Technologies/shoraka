import type { Config } from "tailwindcss";

const config: Omit<Config, "content"> = {
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        /**
         * Status groups by meaning. Light/dark pairs via CSS vars in globals.css.
         * Use bg-status-*-bg / text-status-*-text (action, submitted, in-progress,
         * success, completed, rejected, neutral).
         */
        status: {
          action: {
            bg: "hsl(var(--status-action-bg))",
            text: "hsl(var(--status-action-text))",
          },
          submitted: {
            bg: "hsl(var(--status-submitted-bg))",
            text: "hsl(var(--status-submitted-text))",
          },
          "in-progress": {
            bg: "hsl(var(--status-in-progress-bg))",
            text: "hsl(var(--status-in-progress-text))",
          },
          success: {
            bg: "hsl(var(--status-success-bg))",
            text: "hsl(var(--status-success-text))",
          },
          completed: {
            bg: "hsl(var(--status-completed-bg))",
            text: "hsl(var(--status-completed-text))",
          },
          rejected: {
            bg: "hsl(var(--status-rejected-bg))",
            text: "hsl(var(--status-rejected-text))",
          },
          neutral: {
            bg: "hsl(var(--status-neutral-bg))",
            text: "hsl(var(--status-neutral-text))",
          },
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        brand: "var(--shadow-brand)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
