import type { Metadata, Viewport } from "next";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { BottomNav } from "@/components/bottom-nav";
import { DeviceHeartbeat } from "@/components/device-heartbeat";
import { PreviewBanner } from "@/components/preview-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./phase5.css";
import "./phase6.css";
import "./phase7.css";

const isFrontendPreview = process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
const deploymentUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(deploymentUrl),
  title: { default: "Jalwa", template: "%s · Jalwa" },
  description: "Pakistan's mobile-first platform for useful content and positive entertainment.",
  applicationName: "Jalwa",
  manifest: "/manifest.webmanifest",
  robots: isFrontendPreview ? { index: false, follow: false } : undefined,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#09090b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><PreviewBanner /><SiteHeader /><main className="site-main">{children}</main><SiteFooter /><BottomNav /><ServiceWorkerRegister />{isFrontendPreview ? null : <><DeviceHeartbeat /><AnalyticsBeacon /></>}</body></html>;
}
