import { redirect } from "next/navigation";

const LANDING_URL = (process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);

export default function InvestorLegalRedirectPage() {
  redirect(`${LANDING_URL}/legal`);
}
