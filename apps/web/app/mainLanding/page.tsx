import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MainLandingRedirect({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  if (!query.has("utm")) query.set("utm", "D");
  if (!query.has("package")) query.set("package", "default");
  if (!query.has("parameter")) query.set("parameter", "default");
  if (!query.has("payment")) query.set("payment", "jazzcash");
  redirect(`/?${query.toString()}`);
}
