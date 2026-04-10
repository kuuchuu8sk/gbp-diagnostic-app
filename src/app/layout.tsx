import type { Metadata } from "next";
import { Noto_Sans_JP, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto",
  weight: ["300", "400", "500", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Google Business Profile AI Diagnostics | Kuuchuu8sk",
  description: "AIによるGoogleビジネスプロフィールの最適化診断。店舗情報を分析し、集客力向上のための具体的なアクションをご提案します。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${outfit.variable} antialiased`} suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen flex flex-col font-sans selection:bg-neutral-800 selection:text-white">
        {children}
        <Script 
          src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`} 
          strategy="beforeInteractive" 
        />
      </body>
    </html>
  );
}
