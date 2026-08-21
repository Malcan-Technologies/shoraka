import { redirect } from "next/navigation";
import { buildTransactionsRedirectHref } from "@/portfolio/portfolio-tabs";

type TransactionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsRedirectPage({ searchParams }: TransactionsPageProps) {
  redirect(buildTransactionsRedirectHref(await searchParams));
}
