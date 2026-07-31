import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { BottomNav } from "@/components/bottom-nav";
import { DeviceHeartbeat } from "@/components/device-heartbeat";
import { ErrorMonitor } from "@/components/error-monitor";
import { PreviewBanner } from "@/components/preview-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { documentDirection, documentLanguage, LOCALE_COOKIE, normalizeLocale } from "@/lib/customer/locale";
import "./globals.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./phase5.css";
import "./phase6.css";
import "./phase7.css";
import "./phase8.css";
import "./phase9.css";

const isFrontendPreview = process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
const isStaging = process.env.DEPLOYMENT_ENVIRONMENT === "staging";
const deploymentUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(deploymentUrl),
  title: { default: "Jalwa", template: "%s · Jalwa" },
  description: "Pakistan's mobile-first platform for useful content and positive entertainment.",
  applicationName: "Jalwa",
  manifest: "/manifest.webmanifest",
  robots: isFrontendPreview || isStaging ? { index: false, follow: false } : undefined,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#09090b" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  return <html lang={documentLanguage(locale)} dir={documentDirection(locale)} data-release={process.env.GIT_SHA ?? "local"} suppressHydrationWarning><body><PreviewBanner /><SiteHeader /><main className="site-main">{children}</main><SiteFooter /><BottomNav /><ServiceWorkerRegister /><ErrorMonitor />{isFrontendPreview ? null : <DeviceHeartbeat />}{isFrontendPreview || isStaging ? null : <AnalyticsBeacon />}</body></html>;
}
