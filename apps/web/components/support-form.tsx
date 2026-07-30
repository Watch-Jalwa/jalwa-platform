"use client";

import { FormEvent, useState } from "react";

export function SupportForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseType: form.get("caseType"),
        email: form.get("email"),
        subject: form.get("subject"),
        message: form.get("message"),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? "Could not send your request.");
      return;
    }
    event.currentTarget.reset();
    setStatus("sent");
    setMessage(`Request received. Reference: ${body.id}`);
  }

  return (
    <form className="form-shell support-form" onSubmit={submit}>
      <label className="form-field">Topic
        <select name="caseType" defaultValue="general">
          <option value="general">General</option><option value="billing">Billing</option><option value="playback">Playback</option>
          <option value="copyright">Copyright</option><option value="ai-safety">AI safety</option><option value="account">Account</option>
        </select>
      </label>
      <label className="form-field">Email
        <input name="email" type="email" defaultValue={defaultEmail} maxLength={254} autoComplete="email" />
      </label>
      <label className="form-field">Subject
        <input name="subject" minLength={3} maxLength={160} required />
      </label>
      <label className="form-field">Details
        <textarea name="message" minLength={10} maxLength={5000} rows={7} required />
      </label>
      <button className="button button-primary" disabled={status === "sending"} type="submit">{status === "sending" ? "Sending…" : "Send request"}</button>
      <p className={status === "error" ? "form-message" : "form-success"} aria-live="polite">{message}</p>
    </form>
  );
}
