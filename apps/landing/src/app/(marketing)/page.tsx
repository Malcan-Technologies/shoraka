import {
  LandingConvenienceAndListings,
  LandingInvestmentListings,
} from "../../components/landing-convenience-listings";
import { LandingFinancingSections } from "../../components/landing-financing-sections";
import { LandingFinalSections } from "../../components/landing-final-sections";
import { LandingComingSoonBanner } from "../../components/landing-coming-soon-banner";
import { LandingHero } from "../../components/landing-hero";
import { LandingProcess } from "../../components/landing-process";

export default function HomePage() {
  return (
    <main className="flex-1 pt-16">
      <LandingComingSoonBanner />
      <LandingHero />
      <LandingConvenienceAndListings />
      <LandingProcess />
      <LandingInvestmentListings />
      <LandingFinancingSections />
      <LandingFinalSections />
    </main>
  );
}
