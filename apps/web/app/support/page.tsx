import { SupportForm } from "@/components/support-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Support", description: "Get help with Jalwa accounts, billing, playback, content and AI safety." };

export default async function SupportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="page-shell support-page">
      <header className="policy-header">
        <span className="eyebrow">Help centre</span>
        <h1>Jalwa Support</h1>
        <p>Report account, billing, playback, copyright or Ask Jalwa issues. Never include passwords, card numbers, PINs or OTPs.</p>
      </header>
      <SupportForm defaultEmail={user?.email ?? ""} />
    </div>
  );
}
