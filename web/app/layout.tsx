import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daily Dose - Streamline Your Team Standups",
  description:
    "Automate standup meetings, collect updates seamlessly, and keep your team synchronized—all within Slack.",
  keywords: [
    "slack",
    "standup",
    "daily standup",
    "team management",
    "productivity",
  ],
  authors: [{ name: "Daily Dose Team" }],
  openGraph: {
    title: "Daily Dose - Streamline Your Team Standups",
    description:
      "Automate standup meetings, collect updates seamlessly, and keep your team synchronized—all within Slack.",
    type: "website",
    locale: "en_US",
    siteName: "Daily Dose",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daily Dose - Streamline Your Team Standups",
    description:
      "Automate standup meetings, collect updates seamlessly, and keep your team synchronized—all within Slack.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
