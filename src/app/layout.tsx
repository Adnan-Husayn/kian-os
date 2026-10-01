import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Bullet-journal type: Newsreader for writing, JetBrains Mono for marks,
// labels and times.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kian OS",
  description: "Kian's personal life-management system.",
  // Home-screen install on iOS: open full-screen with the app's name.
  appleWebApp: { capable: true, title: "Kian OS", statusBarStyle: "default" },
};

// Browser / status bar color follows the page background in each theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#151618" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className={`${newsreader.variable} ${jetbrains.variable} min-h-full antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
