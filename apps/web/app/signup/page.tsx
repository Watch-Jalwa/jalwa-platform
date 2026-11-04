import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  if (!query.has("next")) query.set("next", "/onboarding");
  redirect(`/login?${query.toString()}`);
}
