import type { Config } from "tailwindcss";
import sharedConfig from "@cashsouk/styles/tailwind.config";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindTypography from "@tailwindcss/typography";

const config: Config = {
  darkMode: ["class"],
  ...sharedConfig,
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [tailwindcssAnimate, tailwindTypography],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        brand: 'var(--shadow-brand)'
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["var(--text-meta)", { lineHeight: "1rem" }],
        sm: ["var(--text-ui)", { lineHeight: "1.25rem" }],
        base: ["var(--text-body)", { lineHeight: "1.75rem" }],
        meta: ["var(--text-meta)", { lineHeight: "1rem" }],
        ui: ["var(--text-ui)", { lineHeight: "1.25rem" }],
        body: ["var(--text-body)", { lineHeight: "1.75rem" }],
      },
      colors: {
        /** Status tokens: CSS vars from @cashsouk/styles (light/dark via .dark). */
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
          active: {
            bg: "hsl(var(--status-active-bg))",
            text: "hsl(var(--status-active-text))",
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
        portal: {
          investor: {
            bg: "hsl(var(--portal-investor-bg))",
            text: "hsl(var(--portal-investor-text))",
          },
          issuer: {
            bg: "hsl(var(--portal-issuer-bg))",
            text: "hsl(var(--portal-issuer-text))",
          },
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        }
      }
    }
  }
};

export default config;
