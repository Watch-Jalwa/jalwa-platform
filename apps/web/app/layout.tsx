import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { BottomNav } from "@/components/bottom-nav";
import { DeviceHeartbeat } from "@/components/device-heartbeat";
import { ErrorMonitor } from "@/components/error-monitor";
import { JalwaAdSlot } from "@/components/jalwa-ad-slot";
import { PreviewBanner } from "@/components/preview-banner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { PageMotion } from "@/components/page-motion";
import { PremiumStatusToast } from "@/components/premium-status-toast";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Suspense } from "react";
import "./home-sections.css";
import { documentDirection, documentLanguage, LOCALE_COOKIE, normalizeLocale } from "@/lib/customer/locale";
import { createClient } from "@/lib/database/server";
import { canUseDemoData, hasBackendConfiguration } from "@/lib/runtime";
import "./globals.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./phase5.css";
import "./phase6.css";
import "./phase7.css";
import "./phase8.css";
import "./phase9.css";
import "./phase10.css";

const isFrontendPreview = process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
const isStaging = process.env.DEPLOYMENT_ENVIRONMENT === "staging";
const deploymentUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const releaseSha = process.env.GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

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
  const headerStore = await headers();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const campaignShell = headerStore.get("x-jalwa-campaign") === "1";
  let signedIn = false;
  if (!campaignShell && hasBackendConfiguration() && !canUseDemoData()) {
    try {
      const database = await createClient();
      const { data: { user } } = await database.auth.getUser();
      signedIn = Boolean(user);
    } catch {
      signedIn = false;
    }
  }

  return (
    <html
      lang={documentLanguage(locale)}
      dir={documentDirection(locale)}
      data-release={releaseSha}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className={campaignShell ? "campaign-shell" : undefined} suppressHydrationWarning>
        {campaignShell ? null : <PreviewBanner />}
        {campaignShell ? null : <SiteHeader />}
        {campaignShell ? null : <JalwaAdSlot />}
        <main className={campaignShell ? "site-main site-main-campaign" : "site-main"}>{children}</main>
        {campaignShell ? null : <SiteFooter />}
        {campaignShell ? null : <BottomNav />}
        <Suspense fallback={null}>
          <PremiumStatusToast signedIn={signedIn} />
        </Suspense>
        <PageMotion />
        <ServiceWorkerRegister />
        <ErrorMonitor />
        {campaignShell || isFrontendPreview ? null : <DeviceHeartbeat />}
        {campaignShell || isFrontendPreview || isStaging ? null : <AnalyticsBeacon />}
      </body>
    </html>
  );
}
