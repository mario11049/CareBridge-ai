import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CareBridgeProvider } from "@/lib/store";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AssistantWidget from "@/components/assistant/AssistantWidget";

export const metadata: Metadata = {
  title: "CareBridge AI — Clear instructions. Safer recovery.",
  description:
    "Turn complex hospital discharge summaries into clear, evidence-checked recovery plans in English and Telugu. Hackathon prototype using synthetic data.",
};

export const viewport: Viewport = {
  themeColor: "#101D32",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Noto+Sans+Telugu:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <CareBridgeProvider>
          <div className="no-print">
            <Nav />
          </div>
          <main>{children}</main>
          <div className="no-print">
            <Footer />
          </div>
          <AssistantWidget />
        </CareBridgeProvider>
      </body>
    </html>
  );
}
