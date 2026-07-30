"use client";

import Link from "next/link";
import { useState } from "react";

type Source = { id: string; title: string; citation: number; url: string; category?: string | null; attribution?: string | null };

export function AskJalwa() {
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("roman_ur");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const response = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, language }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Ask Jalwa is unavailable.");
      setAnswer(payload.answer);
      setSources(payload.sources ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ask Jalwa is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ask-grid">
      <form className="ask-panel" onSubmit={submit}>
        <label htmlFor="jalwa-question">Ask about Jalwa content</label>
        <textarea
          id="jalwa-question"
          maxLength={1200}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Example: Cotton ki pani bachanay wali farming videos dikhao"
          required
          rows={6}
          value={question}
        />
        <div className="ask-controls">
          <label>Answer language
            <select onChange={(event) => setLanguage(event.target.value)} value={language}>
              <option value="roman_ur">Roman Urdu</option>
              <option value="ur">Urdu</option>
              <option value="en">English</option>
            </select>
          </label>
          <button className="button button-primary" disabled={loading || question.trim().length < 3} type="submit">
            {loading ? "Searching…" : "Ask Jalwa"}
          </button>
        </div>
        <p className="ask-note">Answers use approved Jalwa sources. Important farming, health, religious, legal and financial decisions still require qualified local advice.</p>
      </form>

      <section aria-live="polite" className="answer-panel">
        {!answer && !error ? <div className="answer-empty"><span className="brand-mark">J</span><h2>Grounded answers, not open-web guesses.</h2><p>Ask for a topic, explanation or recommendation from the Jalwa catalogue.</p></div> : null}
        {error ? <div className="answer-error"><h2>Unable to answer</h2><p>{error}</p>{error.toLowerCase().includes("sign in") ? <Link className="button button-secondary" href="/login?next=/ask">Sign in</Link> : null}</div> : null}
        {answer ? <div className="answer-copy"><span className="eyebrow">Ask Jalwa</span><div className="answer-text">{answer}</div></div> : null}
        {sources.length ? <div className="answer-sources"><h3>Jalwa sources</h3>{sources.map((source) => <Link href={source.url} key={source.id}><span>[{source.citation}]</span><div><strong>{source.title}</strong>{source.category ? <small>{source.category}</small> : null}</div></Link>)}</div> : null}
      </section>
    </div>
  );
}
