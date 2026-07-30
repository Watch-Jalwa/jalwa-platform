import { requestMagicLink } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = typeof params.error === "string" ? params.error : undefined;
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/profile";

  return (
    <div className="page-shell">
      <form className="form-shell" action={requestMagicLink}>
        <span className="eyebrow">Jalwa account</span>
        <h1>Sign in</h1>
        <p>Use a secure email link. Phone OTP can be added after a local provider is selected.</p>
        <input type="hidden" name="next" value={next} />
        <label className="form-field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
        <p className="form-message" role="status">{sent ? "Check your email for the sign-in link." : error ? "We could not send the link. Try again." : ""}</p>
        <button className="button button-primary" type="submit">Send sign-in link</button>
      </form>
    </div>
  );
}
