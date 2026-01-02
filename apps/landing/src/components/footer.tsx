import Link from "next/link";

export function Footer() {
  return (
    <footer className="text-center space-y-4 py-8">
      <div className="flex justify-center gap-6">
        <Link
          href="#"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          About
        </Link>
        <Link
          href="#"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Contact
        </Link>
        <Link
          href="#"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Privacy
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        © {new Date().getFullYear()} CashSouk. All rights reserved.
      </p>
    </footer>
  );
}

