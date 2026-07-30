export function PreviewBanner() {
  const enabled = process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
  if (!enabled) return null;

  return (
    <aside className="preview-banner" role="status">
      <strong>Jalwa frontend preview</strong>
      <span>Demo catalogue is active. Sign-in, AI, payments, uploads and Studio require the connected backend.</span>
    </aside>
  );
}
