import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AgriEdge | Leave Management",
  description: "Système de gestion des congés pour AgriEdge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-background text-text-main relative">
        <div className="bg-mesh" aria-hidden="true" />
        <div className="relative z-10 flex flex-col min-h-full">
          <Providers>
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
