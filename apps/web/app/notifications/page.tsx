import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NotificationsCenter } from "@/components/notifications-center";
import { auth } from "@/lib/auth";
import { isFrontendPreview } from "@/lib/runtime";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const preview = isFrontendPreview();
  if (!preview) {
    let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
    try {
      session = await auth.api.getSession({ headers: await headers() });
    } catch {
      session = null;
    }
    if (!session?.user) redirect("/login?next=/notifications");
  }

  return <div className="page-shell"><NotificationsCenter preview={preview} /></div>;
}
