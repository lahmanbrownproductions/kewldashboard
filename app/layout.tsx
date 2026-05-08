import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import { ButtonBeepHandler } from "@/components/ButtonBeepHandler";
import { DashboardLocationProvider } from "@/components/dashboard-location-context";
import "./globals.css";

const dashboardThemeBootScript = `(function(){try{var k='kewldashboard.theme.v1';var v=localStorage.getItem(k);document.documentElement.setAttribute('data-theme',v==='deep'?'deep':'standard');}catch(e){document.documentElement.setAttribute('data-theme','standard');}})();`;

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
  description: "An LCARS-inspired command dashboard for your location's weather, navigation, markets, and news.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="standard">
      <head>
        <script dangerouslySetInnerHTML={{ __html: dashboardThemeBootScript }} />
      </head>
      <body className={`${orbitron.variable} ${shareTechMono.variable}`}>
        <DashboardLocationProvider>
          <ButtonBeepHandler />
          {children}
        </DashboardLocationProvider>
      </body>
    </html>
  );
}
