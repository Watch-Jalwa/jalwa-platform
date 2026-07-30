import { NotificationsCenter } from "@/components/notifications-center";
import { isFrontendPreview } from "@/lib/runtime";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return <div className="page-shell"><NotificationsCenter preview={isFrontendPreview()} /></div>;
}
