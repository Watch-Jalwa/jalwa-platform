import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // Allow hosted JazzCash LinkWallet POST (PIN/MPIN only on JazzCash).
  "form-action 'self' https://onlinepayments.jazzcash.com.pk https://payments.jazzcash.com.pk https://pgw.jazzcash.com.pk https://sandbox.jazzcash.com.pk",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.tiktok.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https: https://analytics.tiktok.com",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss: https://analytics.tiktok.com https://analytics-ipv6.tiktok.com https://business-api.tiktok.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
