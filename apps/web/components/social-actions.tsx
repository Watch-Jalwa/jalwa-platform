"use client";

import { useState } from "react";

export function SocialActions({ contentId, title }: { contentId?: string | null; title: string }) {
  const [message, setMessage] = useState("");
  const [following, setFollowing] = useState(false);

  async function action(name: string) {
    if (name === "share") {
      if (navigator.share) await navigator.share({ title, url: window.location.href }).catch(() => undefined);
      else await navigator.clipboard.writeText(window.location.href);
    }
    if (!contentId) { setMessage("This action becomes persistent on the connected production backend."); return; }
    const response = await fetch("/api/social/preferences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(name === "follow" || name === "unfollow" ? { action: name, entityType: "content", entityId: contentId } : { action: name, contentId, context: { page: "watch" } }) });
    if (response.status === 401) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; }
    if (!response.ok) { const data = await response.json(); setMessage(data.error ?? "Action unavailable."); return; }
    if (name === "follow" || name === "unfollow") setFollowing(name === "follow");
    setMessage(name === "hide" ? "This title will be reduced in your recommendations." : name === "report" ? "Report signal recorded for review." : name === "share" ? "Link shared or copied." : following ? "No longer following this title." : "Following this title.");
  }

  return <div className="social-actions">
    <button className="button button-secondary" type="button" onClick={() => void action(following ? "unfollow" : "follow")}>{following ? "Following" : "Follow"}</button>
    <button className="button button-secondary" type="button" onClick={() => void action("share")}>Share</button>
    <details><summary className="button button-secondary">More</summary><button type="button" onClick={() => void action("hide")}>Hide from recommendations</button><button type="button" onClick={() => void action("report")}>Report content</button></details>
    {message ? <small role="status">{message}</small> : null}
  </div>;
}
