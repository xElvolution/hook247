import { redirect } from "next/navigation";
import CoinsView from "@/components/coins/CoinsView";
import { getSessionUserId } from "@/lib/session";

export const metadata = { title: "Coins | Hooks247" };

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function CoinsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/coins");
  const params = await searchParams;
  const reference = firstParam(params.reference) || firstParam(params.trxref);
  return <CoinsView returnReference={reference} />;
}
