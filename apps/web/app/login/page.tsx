import Link from "next/link";
import { requestMagicLink, requestPhoneOtp, startOAuth, verifyPhoneOtp } from "./actions";

export const metadata = { title: "Sign in" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const messages: Record<string, string> = {
  "invalid-email": "Enter a valid email address.",
  "send-failed": "The sign-in link could not be sent.",
  "invalid-phone": "Enter a valid Pakistani mobile number.",
  "phone-send-failed": "The SMS code could not be sent. Check the configured SMS provider.",
  "invalid-code": "Enter the six-digit code sent to your phone.",
  "oauth-provider": "That social provider is not supported.",
  "oauth-failed": "Social sign-in could not be started.",
  "preview-oauth": "Social sign-in becomes active after provider credentials are connected.",
  "callback-failed": "The sign-in link expired or could not be verified.",
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const phoneSent = params.phoneSent === "1";
  const preview = params.preview === "1";
  const error = typeof params.error === "string" ? messages[params.error] : null;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/profile";
  const phone = typeof params.phone === "string" ? params.phone : "";

  return (
    <div className="page-shell auth-journey login-journey">
      <section className="auth-intro"><span className="eyebrow">Welcome back</span><h1>Sign in your way.</h1><p>Email magic links work immediately with Supabase. Phone and social buttons activate when their provider credentials are connected.</p><Link className="button button-secondary" href="/signup">Create a new account</Link></section>
      <div className="auth-methods">
        <form className="form-shell" action={requestMagicLink}><h2>Email link</h2><input name="next" type="hidden" value={next} /><label className="form-field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label><p className={sent ? "form-success" : "form-message"} role="status">{sent ? (preview ? "Preview complete: production sends a secure email link." : "Check your email for the sign-in link.") : error ?? ""}</p><button className="button button-primary" type="submit">Send sign-in link</button></form>
        <form className="form-shell" action={phoneSent ? verifyPhoneOtp : requestPhoneOtp}><h2>Phone OTP</h2><input name="next" type="hidden" value={next} /><label className="form-field"><span>Pakistani mobile number</span><input name="phone" type="tel" autoComplete="tel" placeholder="03XX XXXXXXX" defaultValue={phone} required /></label>{phoneSent ? <label className="form-field"><span>Six-digit code</span><input name="token" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required /></label> : null}<button className="button button-secondary" type="submit">{phoneSent ? "Verify and sign in" : "Send SMS code"}</button></form>
        <section className="form-shell social-auth"><h2>Social sign-in</h2><p>Provider consent and account linking are handled by Supabase Auth.</p>{["google","apple","facebook"].map((provider) => <form action={startOAuth} key={provider}><input name="provider" type="hidden" value={provider} /><input name="next" type="hidden" value={next} /><button className="button button-secondary" type="submit">Continue with {provider.charAt(0).toUpperCase()+provider.slice(1)}</button></form>)}</section>
      </div>
    </div>
  );
}
