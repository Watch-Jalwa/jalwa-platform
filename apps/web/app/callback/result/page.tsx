import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Legacy JazzCash result URL — send users to home with the premium toast. */
export default async function JazzcashCallbackResultPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ok = params.status === "ok";
  const msisdn = typeof params.msisdn === "string" ? params.msisdn : "";
  const next = new URLSearchParams();
  next.set("premium", ok ? "enabled" : "failed");
  if (msisdn) next.set("msisdn", msisdn);
  redirect(`/?${next.toString()}`);
}
