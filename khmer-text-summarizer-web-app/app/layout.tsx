import type { Metadata, Viewport } from "next";
import {
  Noto_Sans_Khmer,
  Noto_Serif_Khmer,
  Outfit,
  Playfair_Display,
  Space_Mono,
} from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const notoSansKhmer = Noto_Sans_Khmer({
  subsets: ["khmer"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-noto-sans-khmer",
  display: "swap",
});

const notoSerifKhmer = Noto_Serif_Khmer({
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto-serif-khmer",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-space-mono",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ខ្លឹម — សង្ខេបអត្ថបទច្បាស់លាស់",
  description:
    "ឧបករណ៍ស្អាតផ្តោតសម្រាប់ប្រែការសរសេរវែងទៅជាការសង្ខេបច្បាស់លាស់។",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "ខ្លឹម — សង្ខេបអត្ថបទច្បាស់លាស់",
    description:
      "ឧបករណ៍ស្អាតផ្តោតសម្រាប់ប្រែការសរសេរវែងទៅជាការសង្ខេបច្បាស់លាស់។",
    images: ["/opengraph.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="km"
      suppressHydrationWarning
      className={`${notoSansKhmer.variable} ${notoSerifKhmer.variable} ${outfit.variable} ${playfair.variable} ${spaceMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
