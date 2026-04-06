import type { Metadata } from "next";
import { Inter, DM_Serif_Display, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "Floom",
    template: "%s | Floom",
  },
  description:
    "Deploy Python apps instantly. From your agent to production in one command.",
  metadataBase: new URL("https://dashboard.floom.dev"),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Floom",
    description:
      "Deploy Python apps instantly. From your agent to production in one command.",
    url: "https://dashboard.floom.dev",
    siteName: "Floom",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Floom — Deploy Python apps instantly",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Floom",
    description:
      "Deploy Python apps instantly. From your agent to production in one command.",
    images: ["/og-image.png"],
  },
  other: {
    "theme-color": "#111827",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("h-full", inter.variable, dmSerif.variable, jetbrainsMono.variable, "font-sans", geist.variable)}
      style={
        {
          "--font-body": inter.style.fontFamily,
          "--font-brand": dmSerif.style.fontFamily,
          "--font-mono": jetbrainsMono.style.fontFamily,
        } as React.CSSProperties
      }
    >
      <body className={`${inter.className} min-h-full antialiased`}>
        {children}
      </body>
    </html>
  );
}
