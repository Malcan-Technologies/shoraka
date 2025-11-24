import { Navbar } from "../components/navbar";

export default function ComingSoonPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background flex items-center justify-center p-6 pt-24">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="h-16 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="240"
                  height="60"
                  viewBox="0 0 1440 540"
                  className="h-full w-auto"
                >
                  <path
                    fill="#8b0204"
                    d="M 193.230469 344.011719 C 193.644531 336.96875 193.21875 330.039062 191.949219 323.378906 C 188.449219 319.542969 185.269531 315.355469 182.464844 310.894531 C 182.828125 316.148438 182.714844 321.40625 182.140625 326.570312 C 185.023438 332.699219 188.75 338.558594 193.230469 344.011719"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
                Coming Soon
              </h1>
              <p className="text-[17px] leading-7 text-muted-foreground max-w-[70ch] mx-auto">
                We're building something amazing. CashSouk is a modern peer-to-peer lending platform
                that connects borrowers with investors securely and transparently.
              </p>
            </div>
          </div>

          <div className="pt-12 border-t border-border">
            <div className="flex justify-center gap-6">
              <a
                href="#"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                About
              </a>
              <a
                href="#"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Contact
              </a>
              <a
                href="#"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              © 2025 CashSouk. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
