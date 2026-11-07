import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Cormorant_Garamond } from "next/font/google";
import "sileo/styles.css";
import "./globals.css";
import { SezsecToaster } from "@sezsec/ui";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Jamaat Events & Hall Booking | Anjuman-e-Mohammedi Secunderabad",
    template: "%s | Jamaat Events Secunderabad",
  },
  description:
    "Hall booking, event arrangements, and vessel store records for Anjuman-e-Mohammedi, Secunderabad (Dawoodi Bohra Jamaat Trust).",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180x180.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-[#231917]">
        {children}
        <SezsecToaster />
      </body>
    </html>
  );
}
