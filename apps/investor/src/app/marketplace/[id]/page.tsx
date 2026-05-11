import { redirect } from "next/navigation";

export default async function MarketplaceNoteRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/investments/${id}`);
}
