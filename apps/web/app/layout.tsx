import type { Metadata, Viewport } from "next";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { BottomNav } from "@/components/bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./phase5.css";
import "./phase6.css";

export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"), title: { default: "Jalwa", template: "%s · Jalwa" }, description: "Pakistan's mobile-first platform for useful content and positive entertainment.", applicationName: "Jalwa", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#09090b" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body><SiteHeader /><main className="site-main">{children}</main><SiteFooter /><BottomNav /><AnalyticsBeacon /></body></html>; }
