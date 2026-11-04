import { SignInForm } from "./sign-in-form";
import { startOAuth } from "./actions";
import { safeInternalPath } from "@/lib/runtime";

export const metadata = { title: "Sign in or create account" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const socialProviders = [
  { id: "google", label: "Google", enabled: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true" },
  { id: "apple", label: "Apple", enabled: process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true" },
  { id: "facebook", label: "Facebook", enabled: process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH === "true" },
] as const;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const plan = typeof params.plan === "string" ? params.plan : "";
  const requestedNext = typeof params.next === "string" ? params.next : "/onboarding";
  const nextBase = safeInternalPath(requestedNext, "/onboarding");
  const next = plan
    ? safeInternalPath(`${nextBase}${nextBase.includes("?") ? "&" : "?"}plan=${encodeURIComponent(plan)}`, "/onboarding")
    : nextBase;
  const enabledSocialProviders = socialProviders.filter((provider) => provider.enabled);
  const prefillIdentity = typeof params.prefill === "string" ? params.prefill : "";

  return (
    <div className="page-shell auth-journey">
      <section className="auth-intro">
        <span className="eyebrow">Welcome to Jalwa</span>
        <h1>Sign in or create account</h1>
        <p>One passwordless screen for new and returning viewers. First successful code creates your account; next time the same email or number signs you in.</p>
      </section>
      <div className="auth-methods">
        <SignInForm next={next} prefillIdentity={prefillIdentity} />
        {enabledSocialProviders.length ? (
          <section className="form-shell social-auth">
            <h2>Or continue with</h2>
            {enabledSocialProviders.map((provider) => (
              <form action={startOAuth} key={provider.id}>
                <input name="provider" type="hidden" value={provider.id} />
                <input name="next" type="hidden" value={next} />
                <button className="button button-secondary" type="submit">Continue with {provider.label}</button>
              </form>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
