import Link from "next/link";
import { requestSignupLink } from "./actions";

export const metadata = { title: "Create account" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const messages: Record<string, string> = {
  "invalid-name": "Enter a name between 2 and 60 characters.",
  "invalid-email": "Enter a valid email address.",
  "invalid-language": "Choose a supported language.",
  "terms-required": "Accept the Terms and Privacy Policy to continue.",
  "send-failed": "The signup link could not be sent. Try again.",
};

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const preview = params.preview === "1";
  const error = typeof params.error === "string" ? messages[params.error] : null;
  const email = typeof params.email === "string" ? params.email : "";
  const selectedPlan = typeof params.plan === "string" ? params.plan : "premium-monthly-pkr";
  const next = typeof params.next === "string" ? params.next : "/onboarding";

  return (
    <div className="page-shell auth-journey">
      <section className="auth-intro">
        <span className="eyebrow">Join Jalwa</span>
        <h1>One account for watching, learning and Premium.</h1>
        <p>Create your account, choose your language and continue to a hosted payment provider only when you are ready.</p>
        <ul className="benefit-checks"><li>Free account and public catalogue</li><li>Viewer profiles and watch history</li><li>Premium checkout with verified entitlements</li></ul>
      </section>

      <form className="form-shell signup-form" action={requestSignupLink}>
        <h2>Create your account</h2>
        <input name="next" type="hidden" value={next} />
        <label className="form-field"><span>Your name</span><input name="displayName" autoComplete="name" required minLength={2} maxLength={60} /></label>
        <label className="form-field"><span>Email</span><input name="email" type="email" autoComplete="email" required defaultValue={email} /></label>
        <label className="form-field"><span>Preferred language</span><select name="preferredLanguage" defaultValue="en"><option value="en">English</option><option value="ur">اردو</option><option value="roman_ur">Roman Urdu</option></select></label>
        <fieldset className="plan-choice"><legend>Start with</legend><label><input type="radio" name="plan" value="free" defaultChecked={selectedPlan === "free"} /><span><strong>Free</strong><small>Explore public content first</small></span></label><label><input type="radio" name="plan" value="premium-monthly-pkr" defaultChecked={selectedPlan !== "free" && selectedPlan !== "premium-annual-pkr"} /><span><strong>Premium monthly</strong><small>Continue to checkout after onboarding</small></span></label><label><input type="radio" name="plan" value="premium-annual-pkr" defaultChecked={selectedPlan === "premium-annual-pkr"} /><span><strong>Premium annual</strong><small>Best-value yearly access</small></span></label></fieldset>
        <label className="check-field"><input name="acceptedTerms" type="checkbox" required /><span>I accept the <Link href="/legal/terms">Terms</Link> and <Link href="/legal/privacy">Privacy Policy</Link>.</span></label>
        <label className="check-field"><input name="marketingOptIn" type="checkbox" /><span>Send me occasional Jalwa updates. Optional.</span></label>
        <p className={sent ? "form-success" : "form-message"} role="status">{sent ? (preview ? "Preview complete: the real deployment will send a secure signup link." : `Check ${email || "your email"} for the secure signup link.`) : error ?? ""}</p>
        <button className="button button-primary" type="submit">Create account</button>
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
