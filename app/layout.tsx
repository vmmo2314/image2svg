import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "LaserVector",
    description: "AI-powered cleanup and vectorization for Laser CNC",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased min-h-screen bg-gray-950 text-gray-100 selection:bg-teal-500/30">
                {children}
            </body>
        </html>
    );
}
