import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "News / Trend Monitor · समाचार मॉनिटर",
  description:
    "Advanced change-detection demo with Markdown preview, thumbnails, and Hindi/English UI. Inspired by Crawl4AI patterns.",
  openGraph: {
    title: "News / Trend Monitor",
    description: "Detect page changes · Markdown · Thumbnails · हिंदी / English",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
