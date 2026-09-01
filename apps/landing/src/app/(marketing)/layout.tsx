import { Navbar } from "../../components/navbar";
import { MarketingFooter } from "../../components/marketing-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-background text-foreground">
        {children}
      </div>
      <MarketingFooter />
    </>
  );
}
