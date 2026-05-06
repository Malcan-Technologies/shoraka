import { Navbar } from "../../components/navbar";
import { MarketingFooter } from "../../components/marketing-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="flex min-h-screen flex-col bg-background text-foreground">{children}</div>
      <MarketingFooter />
    </>
  );
}
