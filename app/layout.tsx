import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import { ButtonBeepHandler } from "@/components/ButtonBeepHandler";
import { DashboardLocationProvider } from "@/components/dashboard-location-context";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Kewl Dashboard",
  description: "An LCARS-inspired command dashboard for your location's weather, traffic, markets, and news.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${orbitron.variable} ${shareTechMono.variable}`}>
        <DashboardLocationProvider>
          <ButtonBeepHandler />
          {children}
        </DashboardLocationProvider>
      </body>
    </html>
  );
}
