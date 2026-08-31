import { redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";
import { hasBackendConfiguration, isFrontendPreview } from "@/lib/runtime";
import { completeOnboarding } from "./actions";

export const metadata = { title: "Set up Jalwa" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview = isFrontendPreview() || !hasBackendConfiguration();
  let displayName = "";
  let preferredLanguage = "en";
  if (!preview) {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) redirect(`/login?next=${encodeURIComponent("/onboarding")}`);
    const { data: profile } = await database.from("profiles").select("display_name,preferred_language,onboarding_completed").eq("id", user.id).maybeSingle();
    if (profile?.onboarding_completed) redirect("/profile");
    displayName = profile?.display_name ?? String(user.user_metadata?.display_name ?? "");
    preferredLanguage = profile?.preferred_language ?? String(user.user_metadata?.preferred_language ?? "en");
  }
  const plan = typeof params.plan === "string" ? params.plan : "free";

  return (
    <div className="page-shell onboarding-page">
      <div className="journey-progress" aria-label="Signup progress"><span className="done">1 Account</span><span className="active">2 Set up</span><span>3 {plan === "free" ? "Explore" : "Premium"}</span></div>
      <form className="form-shell onboarding-form" action={completeOnboarding}>
        <span className="eyebrow">Almost ready</span><h1>Make Jalwa yours</h1><p>These settings can be changed later from your account.</p>
        <input name="plan" type="hidden" value={plan} />
        <label className="form-field"><span>Account name</span><input name="displayName" defaultValue={displayName} required minLength={2} maxLength={60} /></label>
        <label className="form-field"><span>First viewer profile</span><input name="viewerName" defaultValue={displayName} required maxLength={40} /></label>
        <label className="form-field"><span>Preferred language</span><select name="preferredLanguage" defaultValue={preferredLanguage}><option value="en">English</option><option value="ur">اردو</option><option value="roman_ur">Roman Urdu</option></select></label>
        <label className="check-field"><input name="acceptedTerms" type="checkbox" defaultChecked required /><span>I accept the Terms and Privacy Policy.</span></label>
        <label className="check-field"><input name="marketingOptIn" type="checkbox" /><span>Send occasional product and content updates.</span></label>
        {params.error ? <p className="form-message">Please check the details and try again.</p> : null}
        <button className="button button-primary" type="submit">{plan === "free" ? "Finish and explore" : "Continue to Premium"}</button>
      </form>
    </div>
  );
}
