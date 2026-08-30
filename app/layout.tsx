import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-geist-mono",
});

const description =
    "Explore the Marvel Cinematic Universe in chronological story order across films, series, specials, and one-shots.";

export const metadata: Metadata = {
    description,
    openGraph: {
        description,
        siteName: "MCU Chronoverse",
        title: "MCU Chronoverse",
        type: "website",
    },
    title: {
        default: "MCU Chronoverse",
        template: "%s | MCU Chronoverse",
    },
    twitter: {
        card: "summary_large_image",
        description,
        title: "MCU Chronoverse",
    },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
        </html>
    );
}
