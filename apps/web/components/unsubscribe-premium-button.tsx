"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { unsubscribePremium } from "@/app/profile/actions";

export function UnsubscribePremiumButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        className="button button-danger"
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await unsubscribePremium();
              if (!result?.ok) {
                setError(result?.message || "Unsubscribe failed. Please try again.");
                return;
              }
              // Stay on profile and reload membership immediately as Free.
              router.replace("/profile?unsubscribed=1");
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unsubscribe failed. Please try again.");
            }
          });
        }}
      >
        {pending ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      {error ? (
        <p className="form-message" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
