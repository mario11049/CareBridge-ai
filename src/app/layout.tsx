import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Newsreader, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";
import { CareBridgeProvider } from "@/lib/store";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AssistantWidget from "@/components/assistant/AssistantWidget";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-x", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader-x",
  display: "swap",
  axes: ["opsz"],
});
const telugu = Noto_Sans_Telugu({ subsets: ["telugu", "latin"], variable: "--font-telugu-x", display: "swap" });

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
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${telugu.variable}`}>
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
